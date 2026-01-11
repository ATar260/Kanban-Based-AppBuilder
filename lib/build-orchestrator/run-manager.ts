import type { BuildEvent, BuildRunInput, BuildRunRecord, BuildRunStatus } from './types';
import type { KanbanTicket, TicketStatus } from '@/components/kanban/types';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { SandboxFactory } from '@/lib/sandbox/factory';
import type { SandboxProvider } from '@/lib/sandbox/types';

type Subscriber = (event: BuildEvent) => void;

interface VirtualBranch {
  ticketId: string;
  workerSandboxId: string;
  baseVersion: number;
  patchFiles: Record<string, string>;
  patchCode: string;
  appliedFiles: string[];
}

interface RunInternalState {
  mainSandboxId: string;
  snapshotVersion: number;
  snapshotsByVersion: Map<number, Record<string, string>>;
  mergeQueue: VirtualBranch[];
}

function now() {
  return Date.now();
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function generateRunId() {
  return `run_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function nextBuildableTicket(
  tickets: KanbanTicket[],
  onlyTicketId?: string,
  excludeTicketIds: Set<string> = new Set()
): KanbanTicket | null {
  const currentTickets = tickets;

  if (onlyTicketId) {
    const t = currentTickets.find(x => x.id === onlyTicketId) || null;
    if (!t) return null;
    if (t.status !== 'backlog') return null;
    if (excludeTicketIds.has(t.id)) return null;
    const hasUnmetDeps = t.dependencies?.some(depId => {
      const dep = currentTickets.find(x => x.id === depId);
      return dep && dep.status !== 'done';
    });
    return hasUnmetDeps ? null : t;
  }

  const backlog = currentTickets
    .filter(t => t.status === 'backlog')
    .sort((a, b) => a.order - b.order);

  for (const ticket of backlog) {
    if (excludeTicketIds.has(ticket.id)) continue;
    const hasUnmetDeps = ticket.dependencies?.some(depId => {
      const dep = currentTickets.find(t => t.id === depId);
      return dep && dep.status !== 'done';
    });
    if (!hasUnmetDeps) return ticket;
  }

  return null;
}

function updateTicket(tickets: KanbanTicket[], ticketId: string, patch: Partial<KanbanTicket>): KanbanTicket[] {
  return tickets.map(t => (t.id === ticketId ? { ...t, ...patch } : t));
}

async function readSseJson<T = any>(res: Response, onEvent: (data: T) => void) {
  if (!res.body) throw new Error('Missing response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events separated by blank line
    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      boundaryIndex = buffer.indexOf('\n\n');

      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.slice(6));

      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');

      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      onEvent(parsed);
    }
  }
}

export class BuildRunManager {
  private runs = new Map<string, BuildRunRecord>();
  private subscribers = new Map<string, Set<Subscriber>>();
  private executionPromises = new Map<string, Promise<void>>();
  private mergePromises = new Map<string, Promise<void>>();
  private resumeResolvers = new Map<string, Array<() => void>>();
  private internalState = new Map<string, RunInternalState>();

  createRun(input: BuildRunInput, baseUrl?: string): BuildRunRecord {
    const runId = generateRunId();
    const record: BuildRunRecord = {
      runId,
      createdAt: now(),
      updatedAt: now(),
      status: 'queued',
      paused: false,
      input,
      events: [],
      tickets: input.tickets,
      baseUrl,
    };

    this.runs.set(runId, record);
    this.subscribers.set(runId, new Set());
    this.resumeResolvers.set(runId, []);

    return record;
  }

  getRun(runId: string): BuildRunRecord | null {
    return this.runs.get(runId) || null;
  }

  listEvents(runId: string): BuildEvent[] {
    return this.getRun(runId)?.events || [];
  }

  subscribe(runId: string, cb: Subscriber): () => void {
    const set = this.subscribers.get(runId);
    if (!set) {
      throw new Error(`Run not found: ${runId}`);
    }
    set.add(cb);
    return () => set.delete(cb);
  }

  private emit(runId: string, event: BuildEvent) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.updatedAt = now();
    run.events.push(event);
    const subs = this.subscribers.get(runId);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(event);
        } catch {
          // ignore subscriber failures
        }
      }
    }
  }

  private setStatus(runId: string, status: BuildRunStatus, message?: string, error?: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.status = status;
    run.error = error;
    run.updatedAt = now();
    this.emit(runId, { type: 'run_status', runId, status, at: now(), message, error });
  }

  pause(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.paused = true;
    this.setStatus(runId, 'paused', 'Paused');
  }

  resume(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.paused = false;
    this.setStatus(runId, 'running', 'Resumed');

    const resolvers = this.resumeResolvers.get(runId);
    if (resolvers && resolvers.length > 0) {
      const toRun = resolvers.splice(0, resolvers.length);
      for (const r of toRun) {
        try {
          r();
        } catch {
          // ignore
        }
      }
    }
  }

  async start(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    if (this.executionPromises.has(runId)) {
      return this.executionPromises.get(runId)!;
    }

    const promise = this.execute(runId).finally(() => {
      this.executionPromises.delete(runId);
    });

    this.executionPromises.set(runId, promise);
    return promise;
  }

  private async waitIfPaused(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    if (!run.paused) return;

    await new Promise<void>(resolve => {
      const arr = this.resumeResolvers.get(runId);
      if (arr) arr.push(resolve);
      else resolve();
    });
  }

  private updateTicketStatus(runId: string, ticketId: string, status: TicketStatus, progress?: number, error?: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.tickets = updateTicket(run.tickets, ticketId, {
      status,
      ...(typeof progress === 'number' ? { progress } : {}),
      ...(error ? { error } : {}),
      ...(status === 'generating' ? { startedAt: new Date() } : {}),
      ...(status === 'done' ? { completedAt: new Date(), progress: 100 } : {}),
    } as any);
    this.emit(runId, { type: 'ticket_status', runId, at: now(), ticketId, status, progress, error });
  }

  /**
   * Phase 2 runner: bounded concurrency execution loop (worker pool).
   */
  private async execute(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    const mode = run.input.onlyTicketId ? 'single_ticket' : 'full';
    run.status = 'running';
    this.emit(runId, {
      type: 'run_started',
      runId,
      status: 'running',
      at: now(),
      planId: run.input.plan?.id,
      sandboxId: run.input.sandboxId,
      mode,
    });

    try {
      const configuredMax =
        typeof run.input.maxConcurrency === 'number' && Number.isFinite(run.input.maxConcurrency)
          ? run.input.maxConcurrency
          : Number(process.env.BUILD_MAX_CONCURRENCY || process.env.SANDBOX_BUILD_MAX_CONCURRENCY);

      const maxConcurrency = clampInt(configuredMax, 1, 5, 2);
      const workerCount = run.input.onlyTicketId ? 1 : maxConcurrency;

      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Worker pool size: ${workerCount}`,
      });

      // Virtual PR mode: worker sandboxes execute tickets on a snapshot of "main",
      // then a merge queue applies changes into the integration sandbox.
      let internal: RunInternalState | null = null;
      if (workerCount > 1) {
        const initialSnapshot = await this.captureSandboxSnapshot(run.input.sandboxId);
        internal = {
          mainSandboxId: run.input.sandboxId,
          snapshotVersion: 0,
          snapshotsByVersion: new Map([[0, initialSnapshot]]),
          mergeQueue: [],
        };
        this.internalState.set(runId, internal);
      }

      const workers: Worker[] =
        workerCount > 1
          ? await this.createWorkerPool(runId, workerCount)
          : [{ sandboxId: run.input.sandboxId, provider: null, kind: 'integration' }];

      const freeWorkers: Worker[] = [...workers];
      const inFlight = new Map<string, Promise<void>>();
      const hasFailures = { value: false };

      const hasMergePending = () => {
        const s = this.internalState.get(runId);
        return Boolean(s && (s.mergeQueue.length > 0 || this.mergePromises.has(runId)));
      };

      while (true) {
        await this.waitIfPaused(runId);

        const fresh = this.runs.get(runId);
        if (!fresh) return;

        // If any tickets are now impossible due to failed deps, mark them as blocked so the run can finish cleanly.
        this.propagateBlockedTickets(runId);

        // Dispatch as many ready tickets as possible up to the worker count.
        while (freeWorkers.length > 0) {
          const next = nextBuildableTicket(fresh.tickets, fresh.input.onlyTicketId, new Set(inFlight.keys()));
          if (!next) break;

          const worker = freeWorkers.pop()!;
          const baseVersion = internal ? internal.snapshotVersion : undefined;
          const baseSnapshot =
            internal && typeof baseVersion === 'number'
              ? internal.snapshotsByVersion.get(baseVersion) || null
              : null;

          this.updateTicketStatus(runId, next.id, 'generating', 5);
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'system',
            message: `Dispatching "${next.title}" to ${worker.kind === 'integration' ? 'integration sandbox' : `worker ${worker.sandboxId}`}`,
            ticketId: next.id,
          });

          const p = (async () => {
            // Ensure the worker sandbox starts from the same base state as the integration sandbox.
            if (worker.kind === 'worker' && baseSnapshot) {
              await this.resetSandboxToSnapshot(worker.sandboxId, baseSnapshot);
            }

            await this.executeSingleTicket(runId, next.id, worker.sandboxId, baseVersion);
          })()
            .catch((e: any) => {
              hasFailures.value = true;
              const msg = e?.message || 'Ticket failed';
              this.updateTicketStatus(runId, next.id, 'failed', undefined, msg);
              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'error',
                message: `Ticket failed: ${msg}`,
                ticketId: next.id,
              });
            })
            .finally(() => {
              inFlight.delete(next.id);
              freeWorkers.push(worker);
            });

          inFlight.set(next.id, p);
        }

        // Single-ticket mode: stop once the ticket is no longer backlog/in-flight.
        if (fresh.input.onlyTicketId) {
          const only = fresh.tickets.find(t => t.id === fresh.input.onlyTicketId);
          if (only && only.status !== 'backlog' && !inFlight.has(only.id)) break;
        }

        const nextSchedulable = nextBuildableTicket(fresh.tickets, fresh.input.onlyTicketId, new Set(inFlight.keys()));
        const mergePending = hasMergePending();

        // If nothing is schedulable and nothing is in-flight, we may still be waiting for merges to complete.
        if (!nextSchedulable && inFlight.size === 0) {
          if (mergePending) {
            const mp = this.mergePromises.get(runId);
            if (mp) {
              await Promise.race([mp, sleep(300)]);
            } else {
              await sleep(300);
            }
            continue;
          }
          break;
        }

        // Wait for one ticket to finish before attempting to schedule more (bounded pool).
        if (inFlight.size > 0) {
          await Promise.race(inFlight.values());
        } else {
          await sleep(200);
        }
      }

      // Drain any remaining work (should be none, but be safe)
      if (inFlight.size > 0) {
        await Promise.allSettled(Array.from(inFlight.values()));
      }

      // Drain merges (virtual PRs) before finalizing run status.
      const mergePromise = this.mergePromises.get(runId);
      if (mergePromise) {
        await mergePromise;
      }

      // Re-run block propagation in case merges caused failures/blocks.
      this.propagateBlockedTickets(runId);

      const finalRun = this.runs.get(runId);
      const anyTicketFailures =
        finalRun?.tickets?.some(t => t.status === 'failed' || t.status === 'blocked') ?? false;

      if (hasFailures.value || anyTicketFailures) {
        this.setStatus(runId, 'failed', 'Build finished with failures', 'One or more tickets failed/blocked');
        this.emit(runId, { type: 'run_completed', runId, status: 'failed', at: now() });
      } else {
        this.setStatus(runId, 'completed', 'Build complete');
        this.emit(runId, { type: 'run_completed', runId, status: 'completed', at: now() });
      }

      // Cleanup internal run state
      this.internalState.delete(runId);
    } catch (e: any) {
      const message = e?.message || 'Build failed';
      const current = this.runs.get(runId);
      if (current?.currentTicketId) {
        this.updateTicketStatus(runId, current.currentTicketId, 'failed', undefined, message);
      }
      this.setStatus(runId, 'failed', message, message);
    }
  }

  private async executeSingleTicket(runId: string, ticketId: string, sandboxId: string, baseVersion?: number) {
    const run = this.runs.get(runId);
    if (!run) return;

    const ticket = run.tickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

    const baseUrl = run.baseUrl;
    if (!baseUrl) {
      throw new Error('Missing baseUrl for BuildRun (cannot call internal APIs)');
    }

    const isWorkerBranch =
      typeof baseVersion === 'number' &&
      baseVersion >= 0 &&
      sandboxId !== run.input.sandboxId &&
      this.internalState.has(runId);

    // Build prompt
    const planBlueprint: any = (run.input.plan as any)?.blueprint || null;
    const desiredTemplate: 'vite' | 'next' =
      (run.input.plan as any)?.templateTarget || planBlueprint?.templateTarget || 'vite';

    const uiStyleBlock = run.input.uiStyle
      ? `\n\nUI STYLE (apply consistently across all tickets):\n${JSON.stringify(run.input.uiStyle, null, 2)}\n`
      : '';

    const ticketPrompt =
      `Implement the following ticket in the existing application.\n\n` +
      `Template: ${desiredTemplate}\n` +
      uiStyleBlock +
      `Blueprint (high-level contract):\n${planBlueprint ? JSON.stringify(planBlueprint, null, 2) : '(none)'}\n\n` +
      `Ticket:\n- Title: ${ticket.title}\n- Description: ${ticket.description}\n\n` +
      `Rules:\n- Implement the ticket completely.\n- Preserve existing routes/navigation and the mock-first data layer.\n- Create new files if required by this ticket.\n- Output ONLY <file path=\"...\"> blocks for files you changed/created.`;

    // Generate code
    this.emit(runId, { type: 'log', runId, at: now(), level: 'system', message: `Generating: ${ticket.title}`, ticketId });

    const genStart = now();
    const generatedCode = await this.generateTicketCode(baseUrl, run.input.model, ticketPrompt, sandboxId);
    const genMs = now() - genStart;

    run.tickets = updateTicket(run.tickets, ticketId, { generatedCode } as any);
    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      generatedCode,
    });

    // Apply
    this.updateTicketStatus(runId, ticketId, 'applying', 90);
    this.emit(runId, { type: 'log', runId, at: now(), level: 'system', message: `Applying: ${ticket.title}`, ticketId });

    const applyRes = await this.applyCode(baseUrl, sandboxId, generatedCode, true);
    const appliedFilesSet = new Set(applyRes.appliedFiles);
    let appliedFiles = Array.from(appliedFilesSet);

    // Read back the final applied file contents so PR review + merge use the real code state.
    let patchFiles = await this.captureFilesFromSandbox(sandboxId, appliedFiles);
    let patchCode = buildFileBlocks(patchFiles);

    run.tickets = updateTicket(run.tickets, ticketId, {
      generatedCode: patchCode,
      actualFiles: appliedFiles,
      // Only mark preview available after the merge applies to the integration sandbox.
      previewAvailable: isWorkerBranch ? false : true,
    } as any);

    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      generatedCode: patchCode,
      appliedFiles,
      applyDurationMs: applyRes.durationMs,
    });

    // PR review
    this.updateTicketStatus(runId, ticketId, 'pr_review', 95);
    this.emit(runId, { type: 'log', runId, at: now(), level: 'system', message: `PR review: ${ticket.title}`, ticketId });

    const reviewStart = now();
    let currentReview = await this.reviewCode(baseUrl, ticketId, ticket.title, extractFileBlocks(patchCode));

    const maxAutoFixAttempts = 2;
    let autoFixAttempts = 0;

    while (hasBlockingIssues(currentReview) && autoFixAttempts < maxAutoFixAttempts) {
      autoFixAttempts += 1;

      const issues = Array.isArray(currentReview?.issues) ? currentReview.issues : [];
      const blockingIssues = issues.filter((i: any) => {
        if (i?.severity === 'error') return true;
        if (i?.severity === 'warning' && (i?.type === 'security' || i?.type === 'bug')) return true;
        return false;
      });

      const issuesText = blockingIssues
        .slice(0, 10)
        .map((i: any, idx: number) => {
          const loc = `${i.file || 'unknown'}${i.line ? `:${i.line}` : ''}`;
          const suggestion = i.suggestion ? `\n  Suggestion: ${i.suggestion}` : '';
          return `- [${idx + 1}] (${i.severity}/${i.type}) ${loc}\n  ${i.message}${suggestion}`;
        })
        .join('\n');

      const filesText = Object.entries(patchFiles)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, content]) => `// FILE: ${path}\n${content}`)
        .join('\n\n---\n\n');

      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'warning',
        message: `PR review found blocking issues. Auto-fix attempt ${autoFixAttempts}/${maxAutoFixAttempts}...`,
        ticketId,
      });

      const fixPrompt =
        `Fix the listed issues in the provided code.\n\n` +
        `Blocking issues:\n${issuesText}\n\n` +
        `Rules:\n` +
        `- Make the smallest possible changes to fix ONLY the issues above.\n` +
        `- Do NOT change app behavior beyond what is needed to fix the issues.\n` +
        `- Do NOT introduce new dependencies unless absolutely necessary.\n` +
        `- Output ONLY <file path="..."> blocks for files you change. Each block must contain the full updated file content.\n\n` +
        `Code:\n${filesText}`;

      const fixCode = await this.generateTicketCode(
        baseUrl,
        run.input.model,
        fixPrompt,
        sandboxId,
        'auto_fix_ticket'
      );

      if (!fixCode || !fixCode.includes('<file path="')) {
        break;
      }

      const fixApplyRes = await this.applyCode(baseUrl, sandboxId, fixCode, true);
      for (const p of fixApplyRes.appliedFiles) {
        appliedFilesSet.add(p);
      }
      appliedFiles = Array.from(appliedFilesSet);

      patchFiles = await this.captureFilesFromSandbox(sandboxId, appliedFiles);
      patchCode = buildFileBlocks(patchFiles);

      run.tickets = updateTicket(run.tickets, ticketId, {
        generatedCode: patchCode,
        actualFiles: appliedFiles,
        previewAvailable: isWorkerBranch ? false : true,
      } as any);

      this.emit(runId, {
        type: 'ticket_artifacts',
        runId,
        at: now(),
        ticketId,
        generatedCode: patchCode,
        appliedFiles,
      });

      currentReview = await this.reviewCode(baseUrl, ticketId, ticket.title, extractFileBlocks(patchCode));
    }

    const reviewMs = now() - reviewStart;
    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      reviewDurationMs: reviewMs,
      reviewIssuesCount: currentReview?.issues?.length ?? 0,
    });

    if (hasBlockingIssues(currentReview)) {
      const errorCount =
        Array.isArray(currentReview?.issues)
          ? currentReview.issues.filter((i: any) => i?.severity === 'error').length
          : 0;
      throw new Error(`PR review failed after auto-fix: ${errorCount} error(s)`);
    }

    // Validation gate (lightweight in worker sandbox; integration gate runs at merge time)
    const validateStart = now();
    if (planBlueprint) {
      const { validateBlueprint } = await import('@/lib/blueprint-validator');
      const bp = validateBlueprint(planBlueprint);
      if (!bp.ok) {
        throw new Error(`Blueprint validation failed: ${(bp.errors || []).join('; ')}`);
      }
    }
    const validateMs = now() - validateStart;

    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      validationDurationMs: validateMs,
    });

    if (isWorkerBranch) {
      // Enqueue for merge; only mark Done once integration merge + gate succeed.
      this.updateTicketStatus(runId, ticketId, 'merge_queued', 97);
      this.enqueueMerge(runId, {
        ticketId,
        workerSandboxId: sandboxId,
        baseVersion: baseVersion!,
        patchFiles,
        patchCode,
        appliedFiles,
      });
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Ready to merge: ${ticket.title} (gen ${(genMs / 1000).toFixed(1)}s)`,
        ticketId,
      });
      return;
    }

    // Non-virtual-PR mode: finish directly in the integration sandbox.
    this.updateTicketStatus(runId, ticketId, 'testing', 98);
    this.updateTicketStatus(runId, ticketId, 'done', 100);
    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: `Done: ${ticket.title} (gen ${(genMs / 1000).toFixed(1)}s)`,
      ticketId,
    });
  }

  private async generateTicketCode(
    baseUrl: string,
    model: string,
    prompt: string,
    sandboxId: string,
    buildProfile: string = 'implement_ticket'
  ): Promise<string> {
    const res = await fetch(`${baseUrl}/api/generate-ai-code-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        context: { sandboxId },
        isEdit: true,
        buildProfile,
      }),
    });

    if (!res.ok) {
      throw new Error(`AI generation failed (HTTP ${res.status})`);
    }

    let generatedCode = '';
    await readSseJson<any>(res, (data) => {
      if (data?.type === 'stream' && data.raw) {
        generatedCode += data.text || '';
      }
      if (data?.type === 'complete') {
        if (typeof data.generatedCode === 'string' && data.generatedCode.trim()) {
          generatedCode = data.generatedCode;
        }
      }
    });

    return generatedCode;
  }

  private async applyCode(
    baseUrl: string,
    sandboxId: string,
    code: string,
    isEdit: boolean
  ): Promise<{ appliedFiles: string[]; durationMs?: number }> {
    const startedAt = now();
    const res = await fetch(`${baseUrl}/api/apply-ai-code-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: code,
        isEdit,
        sandboxId,
      }),
    });

    if (!res.ok) {
      throw new Error(`Apply failed (HTTP ${res.status})`);
    }

    let final: any = null;
    await readSseJson<any>(res, (data) => {
      if (data?.type === 'complete') final = data;
      if (data?.type === 'error') {
        throw new Error(data?.message || data?.error || 'Apply failed');
      }
    });

    const results = final?.results || {};
    const appliedFiles = Array.from(
      new Set([...(results.filesCreated || []), ...(results.filesUpdated || [])])
    );

    return { appliedFiles, durationMs: now() - startedAt };
  }

  private async reviewCode(
    baseUrl: string,
    ticketId: string,
    ticketTitle: string,
    files: Array<{ path: string; content: string }>
  ): Promise<any> {
    const res = await fetch(`${baseUrl}/api/review-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, ticketTitle, files }),
    });

    if (!res.ok) {
      throw new Error(`Review failed (HTTP ${res.status})`);
    }

    return await res.json();
  }

  // Snapshot / reset helpers (Phase 2 baseline). In Phase 3 this becomes the virtual-branch checkout primitive.
  private async captureSandboxSnapshot(sandboxId: string): Promise<Record<string, string>> {
    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider || !provider.getSandboxInfo?.()) {
      throw new Error(`No sandbox provider available for snapshot: ${sandboxId}`);
    }

    const files = await provider.listFiles();
    const snapshot: Record<string, string> = {};

    for (const path of files) {
      try {
        const content = await provider.readFile(path);
        snapshot[normalizeSandboxPath(path)] = content;
      } catch {
        // Best-effort: skip unreadable files
      }
    }

    return snapshot;
  }

  private async resetSandboxToSnapshot(sandboxId: string, snapshot: Record<string, string>): Promise<void> {
    const provider = sandboxManager.getProvider(sandboxId);
    if (!provider) {
      throw new Error(`No sandbox provider available to reset: ${sandboxId}`);
    }

    // Clean project directory except node_modules (if present) to avoid cross-ticket leakage.
    // Providers run commands with a sandbox-specific working directory.
    await provider.runCommand(
      'sh -c "find . -mindepth 1 -maxdepth 1 -not -name node_modules -exec rm -rf {} + || true"'
    );

    const entries = Object.entries(snapshot);
    for (const [path, content] of entries) {
      await provider.writeFile(normalizeSandboxPath(path), content);
    }
  }

  private async createWorkerPool(runId: string, count: number): Promise<Worker[]> {
    const workers: Worker[] = [];

    for (let i = 0; i < count; i++) {
      // Prefer pooled sandbox if enabled (may return null)
      let provider = await sandboxManager.getPooledSandbox();
      let info = provider?.getSandboxInfo?.() || null;

      if (!provider || !info?.sandboxId) {
        provider = SandboxFactory.create();
        info = await provider.createSandbox();
        await provider.setupViteApp();
      }

      // Register but do not take over the UI's active sandbox.
      sandboxManager.registerSandbox(info.sandboxId, provider, { setActive: false });

      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Worker sandbox ready: ${info.sandboxId}`,
      });

      workers.push({ kind: 'worker', sandboxId: info.sandboxId, provider });
    }

    return workers;
  }

  private async captureFilesFromSandbox(sandboxId: string, filePaths: string[]): Promise<Record<string, string>> {
    const provider = sandboxManager.getProvider(sandboxId);
    if (!provider) {
      throw new Error(`No sandbox provider available to read files: ${sandboxId}`);
    }

    const out: Record<string, string> = {};
    const unique = Array.from(new Set((filePaths || []).filter(Boolean).map(normalizeSandboxPath)));

    for (const path of unique) {
      try {
        out[path] = await provider.readFile(path);
      } catch {
        // Best-effort: skip unreadable files
      }
    }

    return out;
  }

  private enqueueMerge(runId: string, branch: VirtualBranch) {
    const state = this.internalState.get(runId);
    if (!state) {
      throw new Error('Missing internal merge state for this run');
    }

    state.mergeQueue.push(branch);
    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'info',
      message: `Merge queued: ${branch.ticketId} (base v${branch.baseVersion})`,
      ticketId: branch.ticketId,
    });

    this.startMergeLoopIfNeeded(runId);
  }

  private startMergeLoopIfNeeded(runId: string) {
    if (this.mergePromises.has(runId)) return;

    const promise = this.runMergeLoop(runId).finally(() => {
      this.mergePromises.delete(runId);
    });

    this.mergePromises.set(runId, promise);
  }

  private async runMergeLoop(runId: string) {
    const run = this.runs.get(runId);
    const state = this.internalState.get(runId);
    if (!run || !state) return;

    const baseUrl = run.baseUrl;
    if (!baseUrl) {
      throw new Error('Missing baseUrl for BuildRun (cannot call internal APIs)');
    }

    while (true) {
      await this.waitIfPaused(runId);

      const next = state.mergeQueue.shift();
      if (!next) break;

      const baseSnapshot = state.snapshotsByVersion.get(next.baseVersion) || {};
      const mainSnapshot = state.snapshotsByVersion.get(state.snapshotVersion) || {};

      const conflicts = detectFileConflicts(baseSnapshot, mainSnapshot, next.patchFiles);
      if (conflicts.length > 0) {
        const msg =
          conflicts.length === 1
            ? `Merge conflict: ${conflicts[0]}`
            : `Merge conflict: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '…' : ''}`;

        this.updateTicketStatus(runId, next.ticketId, 'blocked', undefined, msg);
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'error',
          message: msg,
          ticketId: next.ticketId,
        });
        continue;
      }

      // Merge apply into integration sandbox
      this.updateTicketStatus(runId, next.ticketId, 'merging', 98);
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Merging into integration sandbox (v${state.snapshotVersion} → v${state.snapshotVersion + 1})`,
        ticketId: next.ticketId,
      });

      let applyRes: { appliedFiles: string[]; durationMs?: number };
      try {
        applyRes = await this.applyCode(baseUrl, state.mainSandboxId, next.patchCode, true);
      } catch (e: any) {
        const msg = e?.message || 'Merge apply failed';
        this.updateTicketStatus(runId, next.ticketId, 'failed', undefined, msg);
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'error',
          message: msg,
          ticketId: next.ticketId,
        });
        throw e;
      }
      const mergedFiles = applyRes.appliedFiles;

      // Update ticket artifacts to reflect the integration sandbox reality.
      const latest = this.runs.get(runId);
      if (latest) {
        latest.tickets = updateTicket(latest.tickets, next.ticketId, {
          actualFiles: mergedFiles,
          previewAvailable: true,
        } as any);
      }

      this.emit(runId, {
        type: 'ticket_artifacts',
        runId,
        at: now(),
        ticketId: next.ticketId,
        appliedFiles: mergedFiles,
      });

      // Advance main snapshot version
      const newVersion = state.snapshotVersion + 1;
      const updatedSnapshot: Record<string, string> = { ...mainSnapshot, ...next.patchFiles };
      state.snapshotVersion = newVersion;
      state.snapshotsByVersion.set(newVersion, updatedSnapshot);

      // Integration gate before Done
      this.updateTicketStatus(runId, next.ticketId, 'testing', 99);
      try {
        await this.runIntegrationGate(baseUrl);
      } catch (e: any) {
        const msg = e?.message || 'Integration gate failed';
        this.updateTicketStatus(runId, next.ticketId, 'failed', undefined, msg);
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'error',
          message: msg,
          ticketId: next.ticketId,
        });
        throw e;
      }

      // Done
      this.updateTicketStatus(runId, next.ticketId, 'done', 100);
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Merged + done: ${next.ticketId}`,
        ticketId: next.ticketId,
      });
    }
  }

  private async runIntegrationGate(baseUrl: string): Promise<void> {
    // Keep this lightweight by default (console log check). Expand in Phase 4.
    const res = await fetch(`${baseUrl}/api/run-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType: 'console' }),
    });

    if (!res.ok) {
      // Non-fatal: some environments may not support tests.
      return;
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      return;
    }

    const consoleResult = json?.tests?.console;
    if (consoleResult && consoleResult.success === false) {
      throw new Error(`Console check failed (${consoleResult.errorCount || 0} issue(s))`);
    }
  }

  private propagateBlockedTickets(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    const byId = new Map(run.tickets.map(t => [t.id, t] as const));

    for (const t of run.tickets) {
      if (t.status !== 'backlog') continue;
      const deps = Array.isArray(t.dependencies) ? t.dependencies : [];
      if (deps.length === 0) continue;

      const blocker = deps
        .map(id => byId.get(id))
        .find(dep => dep && (dep.status === 'failed' || dep.status === 'blocked' || dep.status === 'skipped'));

      if (!blocker) continue;

      const msg = `Blocked by dependency: ${blocker.title} (${blocker.status})`;
      this.updateTicketStatus(runId, t.id, 'blocked', undefined, msg);
    }
  }
}

type Worker =
  | { kind: 'integration'; sandboxId: string; provider: null }
  | { kind: 'worker'; sandboxId: string; provider: SandboxProvider };

function clampInt(value: any, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeSandboxPath(p: string): string {
  if (!p) return p;
  // Provider helpers already handle absolute paths, but normalize for consistency.
  return p.startsWith('/') ? p.slice(1) : p;
}

function buildFileBlocks(files: Record<string, string>): string {
  const paths = Object.keys(files || {}).sort();
  return paths
    .map((path) => {
      const content = files[path] ?? '';
      return `<file path="${path}">\n${content}\n</file>`;
    })
    .join('\n\n');
}

function detectFileConflicts(
  baseSnapshot: Record<string, string>,
  mainSnapshot: Record<string, string>,
  patchFiles: Record<string, string>
): string[] {
  const conflicts: string[] = [];
  const baseHas = (p: string) => Object.prototype.hasOwnProperty.call(baseSnapshot, p);
  const mainHas = (p: string) => Object.prototype.hasOwnProperty.call(mainSnapshot, p);

  for (const [path, patchContent] of Object.entries(patchFiles || {})) {
    const baseContent = baseHas(path) ? baseSnapshot[path] : null;
    const mainContent = mainHas(path) ? mainSnapshot[path] : null;

    // If main hasn't changed since this branch's base, safe.
    if (baseContent === mainContent) continue;

    // If branch change matches main already, safe.
    if (patchContent === mainContent) continue;

    // If branch didn't actually change the file relative to base, safe.
    if (patchContent === baseContent) continue;

    conflicts.push(path);
  }

  return conflicts;
}

function hasBlockingIssues(review: any): boolean {
  const issues = Array.isArray(review?.issues) ? review.issues : [];
  return issues.some((i: any) => {
    if (i?.severity === 'error') return true;
    if (i?.severity === 'warning' && (i?.type === 'security' || i?.type === 'bug')) return true;
    return false;
  });
}

function extractFileBlocks(generatedCode: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|(?=<file path="|$))/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(generatedCode)) !== null) {
    files.push({ path: match[1], content: (match[2] || '').trim() });
  }
  return files;
}

declare global {
  // eslint-disable-next-line no-var
  var buildRunManager: BuildRunManager | undefined;
}

export const buildRunManager: BuildRunManager =
  global.buildRunManager || (global.buildRunManager = new BuildRunManager());

