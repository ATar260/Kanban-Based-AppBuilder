import type { BuildEvent, BuildRunInput, BuildRunRecord, BuildRunStatus } from './types';
import type { KanbanTicket, TicketStatus } from '@/components/kanban/types';

type Subscriber = (event: BuildEvent) => void;

function now() {
  return Date.now();
}

function generateRunId() {
  return `run_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function nextBuildableTicket(tickets: KanbanTicket[], onlyTicketId?: string): KanbanTicket | null {
  const currentTickets = tickets;

  if (onlyTicketId) {
    const t = currentTickets.find(x => x.id === onlyTicketId) || null;
    if (!t) return null;
    if (t.status !== 'backlog') return null;
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
  private resumeResolvers = new Map<string, Array<() => void>>();

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
   * Phase 1 runner: sequential execution loop (single worker).
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
      while (true) {
        await this.waitIfPaused(runId);

        const fresh = this.runs.get(runId);
        if (!fresh) return;

        const nextTicket = nextBuildableTicket(fresh.tickets, fresh.input.onlyTicketId);
        if (!nextTicket) break;

        fresh.currentTicketId = nextTicket.id;
        this.updateTicketStatus(runId, nextTicket.id, 'generating', 5);

        await this.executeSingleTicket(runId, nextTicket.id);

        // In single-ticket mode, stop after that ticket.
        if (fresh.input.onlyTicketId) break;
      }

      this.setStatus(runId, 'completed', 'Build complete');
      this.emit(runId, { type: 'run_completed', runId, status: 'completed', at: now() });
    } catch (e: any) {
      const message = e?.message || 'Build failed';
      const current = this.runs.get(runId);
      if (current?.currentTicketId) {
        this.updateTicketStatus(runId, current.currentTicketId, 'failed', undefined, message);
      }
      this.setStatus(runId, 'failed', message, message);
    }
  }

  private async executeSingleTicket(runId: string, ticketId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    const ticket = run.tickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

    const baseUrl = run.baseUrl;
    if (!baseUrl) {
      throw new Error('Missing baseUrl for BuildRun (cannot call internal APIs)');
    }

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
    const generatedCode = await this.generateTicketCode(baseUrl, run.input.model, ticketPrompt, run.input.sandboxId);
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

    const applyRes = await this.applyCode(baseUrl, run.input.sandboxId, generatedCode, true);
    const appliedFiles = applyRes.appliedFiles;
    run.tickets = updateTicket(run.tickets, ticketId, { actualFiles: appliedFiles, previewAvailable: true } as any);

    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      appliedFiles,
      applyDurationMs: applyRes.durationMs,
    });

    // PR review
    this.updateTicketStatus(runId, ticketId, 'pr_review', 95);
    this.emit(runId, { type: 'log', runId, at: now(), level: 'system', message: `PR review: ${ticket.title}`, ticketId });

    const reviewStart = now();
    const filesForReview = extractFileBlocks(generatedCode);
    const reviewRes = await this.reviewCode(baseUrl, ticketId, ticket.title, filesForReview);
    const reviewMs = now() - reviewStart;

    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      reviewDurationMs: reviewMs,
      reviewIssuesCount: reviewRes?.issues?.length ?? 0,
    });

    const blocking = hasBlockingIssues(reviewRes);
    if (blocking) {
      const errorCount =
        Array.isArray(reviewRes?.issues)
          ? reviewRes.issues.filter((i: any) => i?.severity === 'error').length
          : 0;
      throw new Error(`PR review failed: ${errorCount} error(s)`);
    }

    // Validation (placeholder gate)
    this.updateTicketStatus(runId, ticketId, 'testing', 98);
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

    // Done
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

  private async generateTicketCode(baseUrl: string, model: string, prompt: string, sandboxId: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/generate-ai-code-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        context: { sandboxId },
        isEdit: true,
        buildProfile: 'implement_ticket',
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

