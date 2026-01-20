import type { BuildEvent, BuildRunInput, BuildRunRecord, BuildRunStatus } from './types';
import type { KanbanTicket, TicketStatus } from '@/components/kanban/types';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { SandboxFactory } from '@/lib/sandbox/factory';
import type { SandboxProvider } from '@/lib/sandbox/types';
import { rebasePatchFiles } from './patch-rebase';

type Subscriber = (event: BuildEvent) => void;

interface VirtualBranch {
  ticketId: string;
  workerSandboxId: string;
  baseVersion: number;
  patchFiles: Record<string, string>;
  patchCode: string;
  appliedFiles: string[];
}

interface GeneratedPatch {
  ticketId: string;
  baseVersion: number;
  patchFiles: Record<string, string>;
  patchCode: string;
  appliedFiles: string[];
  genMs: number;
}

interface RunInternalState {
  mainSandboxId: string;
  snapshotVersion: number;
  snapshotsByVersion: Map<number, Record<string, string>>;
  mergeQueue: VirtualBranch[];
  healHistoryByTicketId: Map<string, HealRecord[]>;
}

type HealStage = 'pr_review' | 'merge_conflict' | 'merge_apply' | 'integration_gate' | 'build';

type HealRecord = {
  at: number;
  stage: HealStage;
  attempt: number;
  fingerprint: string;
  message: string;
};

function now() {
  return Date.now();
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function looksLikeE2BTemplateApp(appSource: string): boolean {
  const s = String(appSource || '').toLowerCase();
  // Signature strings from `e2b/template/src/App.jsx`
  return s.includes('e2b sandbox ready') || s.includes('start building your react app with vite');
}

function clampInt(n: unknown, min: number, max: number): number | null {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : Number.NaN;
  if (!Number.isFinite(v)) return null;
  return Math.max(min, Math.min(v, max));
}

function getTimeoutMs(envValue: unknown, fallbackMs: number, bounds: { min: number; max: number }): number {
  const parsed = clampInt(Number(envValue), bounds.min, bounds.max);
  if (typeof parsed === 'number') return parsed;
  return Math.max(bounds.min, Math.min(fallbackMs, bounds.max));
}

async function readResponseTextSafe(res: Response, maxChars: number = 4000): Promise<string> {
  try {
    const text = await res.text();
    const t = String(text || '');
    if (t.length <= maxChars) return t;
    return t.slice(0, maxChars) + '\n... (truncated)';
  } catch {
    return '';
  }
}

function fingerprintFailure(text: string): string {
  const t = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[0-9a-f]{7,40}/gi, '<hash>')
    .replace(/\b\d+\b/g, '<n>')
    .trim();
  // Keep just the first few lines to avoid huge keys.
  return t.split('\n').slice(0, 5).join('\n').slice(0, 500);
}

function formatHealHistory(records: HealRecord[]): string {
  if (!records || records.length === 0) return '(none)';
  return records
    .slice(-8)
    .map(r => `- [${new Date(r.at).toISOString()}] (${r.stage} attempt ${r.attempt}) ${r.fingerprint}\n  ${r.message}`)
    .join('\n');
}

function extractLikelyFilePathsFromText(text: string): string[] {
  const t = String(text || '');
  const out: string[] = [];
  const seen = new Set<string>();

  // Matches common build error formats:
  // - src/foo/bar.jsx:12:34
  // - ./src/foo/bar.tsx(12,34)
  // - /vercel/sandbox/src/foo/bar.css:12:34
  const re = /(?:^|[\s(])([A-Za-z0-9_./-]+?\.(?:tsx|ts|jsx|js|css|json))(?:[:)\s]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    let p = (m[1] || '').trim();
    if (!p) continue;

    // Normalize sandbox absolute prefixes and relative noise.
    p = p
      .replace(/^\/vercel\/sandbox\//, '')
      .replace(/^\/home\/user\/app\//, '')
      .replace(/^\.\//, '')
      .replace(/\\/g, '/');

    if (!p) continue;
    if (p.includes('node_modules/')) continue;
    if (!p.startsWith('src/') && !p.startsWith('app/') && !p.startsWith('components/') && !p.startsWith('pages/')) {
      // Keep only likely project-relative files.
      continue;
    }

    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out.slice(0, 5);
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
    if (t.status !== 'backlog' && t.status !== 'rebasing') return null;
    if (excludeTicketIds.has(t.id)) return null;
    const hasUnmetDeps = t.dependencies?.some(depId => {
      const dep = currentTickets.find(x => x.id === depId);
      return dep && dep.status !== 'done';
    });
    return hasUnmetDeps ? null : t;
  }

  const backlog = currentTickets
    .filter(t => t.status === 'backlog' || t.status === 'rebasing')
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
  private contentionLocks = new Map<string, Map<string, string>>();
  private ticketWarningsByRunId = new Map<string, Map<string, string[]>>();

  private pushHealRecord(runId: string, ticketId: string, stage: HealStage, message: string) {
    const state = this.internalState.get(runId);
    if (!state) return;
    const arr = state.healHistoryByTicketId.get(ticketId) || [];
    const attempt = arr.filter(r => r.stage === stage).length + 1;
    const fingerprint = fingerprintFailure(message);
    const rec: HealRecord = { at: now(), stage, attempt, fingerprint, message: String(message || '').slice(0, 4000) };
    arr.push(rec);
    // Rolling window to avoid runaway memory.
    const keep = arr.slice(-30);
    state.healHistoryByTicketId.set(ticketId, keep);
  }

  private getHealHistory(runId: string, ticketId: string): HealRecord[] {
    const state = this.internalState.get(runId);
    if (!state) return [];
    return state.healHistoryByTicketId.get(ticketId) || [];
  }

  private getContentionGroup(ticket: KanbanTicket): string | null {
    if (!ticket) return null;

    // Styling tends to touch global primitives/theme and is the highest-conflict category.
    if (ticket.type === 'styling') return 'globalStyling';

    // If the planner provided route IDs, keep work for a route serialized to reduce collisions on the same page/layout files.
    const routeIds = ticket.blueprintRefs?.routeIds;
    if (Array.isArray(routeIds) && routeIds.length > 0) {
      const first = typeof routeIds[0] === 'string' ? routeIds[0].trim() : '';
      if (first) return `layout_${first}`;
    }

    // No contention group: allow full parallelism for everything else.
    return null;
  }

  private isGroupLockedByOtherTicket(runId: string, group: string, ticketId: string): boolean {
    const locks = this.contentionLocks.get(runId);
    if (!locks) return false;
    const holder = locks.get(group);
    return Boolean(holder && holder !== ticketId);
  }

  private acquireGroupLock(runId: string, group: string, ticketId: string) {
    const locks = this.contentionLocks.get(runId) || new Map<string, string>();
    locks.set(group, ticketId);
    this.contentionLocks.set(runId, locks);
  }

  private releaseLocksForTicket(runId: string, ticketId: string) {
    const locks = this.contentionLocks.get(runId);
    if (!locks) return;
    for (const [group, holder] of Array.from(locks.entries())) {
      if (holder === ticketId) locks.delete(group);
    }
  }

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

    // Production diagnostics: also log a compact, safe summary to server logs.
    // Avoid logging large blobs (e.g., generatedCode contents) to keep logs readable and low-risk.
    try {
      const base: any = {
        type: (event as any)?.type,
        runId,
        at: (event as any)?.at,
      };
      if ((event as any)?.ticketId) base.ticketId = (event as any).ticketId;
      if ((event as any)?.status) base.status = (event as any).status;
      if ((event as any)?.level) base.level = (event as any).level;
      if ((event as any)?.message) base.message = String((event as any).message).slice(0, 500);
      if ((event as any)?.error) base.error = String((event as any).error).slice(0, 500);
      if ((event as any)?.generatedCode) base.generatedCodeChars = String((event as any).generatedCode).length;
      if (Array.isArray((event as any)?.appliedFiles)) base.appliedFilesCount = (event as any).appliedFiles.length;
      console.log('[build-run]', JSON.stringify(base));
    } catch {
      // ignore
    }

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

  private updateTicketWarnings(runId: string, ticketId: string, warnings: string[] | null) {
    const run = this.runs.get(runId);
    if (!run) return;

    const arr = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
    run.tickets = updateTicket(run.tickets, ticketId, { warnings: arr.length > 0 ? arr : undefined } as any);

    const byTicket = this.ticketWarningsByRunId.get(runId) || new Map<string, string[]>();
    if (arr.length > 0) byTicket.set(ticketId, arr);
    else byTicket.delete(ticketId);
    this.ticketWarningsByRunId.set(runId, byTicket);

    this.emit(runId, { type: 'ticket_warnings', runId, at: now(), ticketId, warnings: arr });
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

  private updateTicketStatus(
    runId: string,
    ticketId: string,
    status: TicketStatus,
    progress?: number,
    error?: string | null
  ) {
    const run = this.runs.get(runId);
    if (!run) return;

    const currentTicket = run.tickets.find(t => t.id === ticketId) || null;
    const shouldBumpRetryCount = status === 'failed' && currentTicket && currentTicket.status !== 'failed';
    const bumpedRetryCount = shouldBumpRetryCount
      ? (typeof currentTicket.retryCount === 'number' ? currentTicket.retryCount : 0) + 1
      : undefined;

    const normalizedError: string | null | undefined =
      error === undefined && (status === 'generating' || status === 'done')
        ? null
        : error;

    run.tickets = updateTicket(run.tickets, ticketId, {
      status,
      ...(typeof progress === 'number' ? { progress } : {}),
      ...(normalizedError === null ? { error: undefined } : {}),
      ...(typeof normalizedError === 'string' && normalizedError ? { error: normalizedError } : {}),
      ...(typeof bumpedRetryCount === 'number' ? { retryCount: bumpedRetryCount } : {}),
      ...(status === 'generating' ? { startedAt: new Date() } : {}),
      ...(status === 'done' ? { completedAt: new Date(), progress: 100 } : {}),
    } as any);

    // Clear warnings on a fresh (re)run.
    if (status === 'backlog' || status === 'generating') {
      this.updateTicketWarnings(runId, ticketId, null);
    }

    const updated = run.tickets.find(t => t.id === ticketId);
    const retryCount = typeof updated?.retryCount === 'number' ? updated.retryCount : undefined;

    this.emit(runId, {
      type: 'ticket_status',
      runId,
      at: now(),
      ticketId,
      status,
      progress,
      error: typeof normalizedError === 'string' ? normalizedError : undefined,
      retryCount,
    });

    if (status === 'done' || status === 'failed' || status === 'blocked' || status === 'skipped' || status === 'awaiting_input') {
      this.releaseLocksForTicket(runId, ticketId);
    }
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
      const clampInt = (n: unknown, min: number, max: number): number | undefined => {
        const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : undefined;
        if (typeof v !== 'number') return undefined;
        return Math.max(min, Math.min(v, max));
      };

      // Option A (default): parallel AI generation + serial apply to integration.
      // We keep a single integration sandbox (run.input.sandboxId) and reuse the existing merge loop + deterministic gate.
      const maxParallel = 10;
      const requested = clampInt(run.input.maxConcurrency, 1, maxParallel);
      const env =
        clampInt(Number(process.env.BUILD_WORKERS), 1, maxParallel) ??
        clampInt(Number(process.env.MAX_BUILD_WORKERS), 1, maxParallel);
      const defaultParallel = 10;
      const desired = run.input.onlyTicketId ? 1 : (requested ?? env ?? defaultParallel);

      const genConcurrencyCap = 6;
      const genConcurrency = Math.max(1, Math.min(desired, genConcurrencyCap));

      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Generation pool size: ${genConcurrency}${requested ? ' (request override)' : env ? ' (env override)' : ' (default)'} (cap ${genConcurrencyCap})`,
      });

      // Ensure the integration sandbox is not still the default E2B/Vite template before we
      // snapshot conventions + start generating patches. This is critical for "time to first preview"
      // in production, where the client-side scaffold step may be skipped due to stale plans.
      await this.ensureIntegrationScaffolded(runId, run.input.sandboxId).catch(() => {
        // non-fatal; run can still proceed, but preview quality may degrade
      });

      // Initialize merge state + snapshot v0 (integration as source of truth).
      const initialSnapshot = await this.captureSandboxSnapshot(run.input.sandboxId);
      const internal: RunInternalState = {
        mainSandboxId: run.input.sandboxId,
        snapshotVersion: 0,
        snapshotsByVersion: new Map([[0, initialSnapshot]]),
        mergeQueue: [],
        healHistoryByTicketId: new Map(),
      };
      this.internalState.set(runId, internal);

      // Mark integration sandbox as in-use so background cleanup won't terminate it mid-run.
      try {
        sandboxManager.markInUse(run.input.sandboxId, true);
      } catch {
        // ignore
      }

      const genInFlight = new Map<string, Promise<void>>();
      const reviewInFlight = new Map<string, Promise<void>>();
      const reviewQueue: GeneratedPatch[] = [];
      const hasFailures = { value: false };

      const hasMergePending = () => {
        const s = this.internalState.get(runId);
        return Boolean(s && (s.mergeQueue.length > 0 || this.mergePromises.has(runId)));
      };

      const skipPrReviewEnv = ['1', 'true', 'yes'].includes(
        String(process.env.BUILD_SKIP_PR_REVIEW || '').toLowerCase()
      );
      const skipPrReview = typeof run.input.skipPrReview === 'boolean' ? run.input.skipPrReview : skipPrReviewEnv;

      const skipIntegrationGateEnv = ['1', 'true', 'yes'].includes(
        String(process.env.BUILD_SKIP_INTEGRATION_GATE || '').toLowerCase()
      );
      const skipIntegrationGate =
        typeof run.input.skipIntegrationGate === 'boolean' ? run.input.skipIntegrationGate : skipIntegrationGateEnv;

      if (skipPrReview) {
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'system',
          message: `PR review: skipped (demo mode). Patches will go straight to merge.`,
        });
      }
      if (skipIntegrationGate) {
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'system',
          message: `Integration gate: deferred to end (demo mode). Merges will be accepted immediately; a final build check runs once after all merges.`,
        });
      }

      const reviewConcurrency = Math.max(1, Math.min(genConcurrency, 2));
      const maxBufferedEnv = clampInt(Number(process.env.BUILD_MAX_BUFFERED_PATCHES), 1, 200);
      const defaultMaxBufferedPatches = skipPrReview || skipIntegrationGate
        ? Math.max(50, genConcurrency * 10)
        : Math.max(8, genConcurrency * 2);
      const maxBufferedPatches = maxBufferedEnv ?? defaultMaxBufferedPatches;

      // Adaptive buffering: if merges stall (snapshot version doesn't advance), allow generation to continue
      // by temporarily increasing the buffered patches cap. Once merges progress again, clamp back down.
      let lastSnapshotVersion = internal.snapshotVersion;
      let lastSnapshotAdvanceAt = Date.now();
      let adaptiveBufferMode = false;
      const mergeStallMs =
        clampInt(Number(process.env.BUILD_MERGE_STALL_MS), 1_000, 120_000) ?? 15_000;
      const maxBufferedHardCap = 200;

      while (true) {
        await this.waitIfPaused(runId);

        const fresh = this.runs.get(runId);
        if (!fresh) return;

        // If any tickets are now impossible due to failed deps, mark them as blocked so the run can finish cleanly.
        this.propagateBlockedTickets(runId);

        // If the merge loop crashed (or never started) but work is queued, restart it.
        // Without this, tickets can remain in merge_queued indefinitely in production.
        if (internal.mergeQueue.length > 0 && !this.mergePromises.has(runId)) {
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'warning',
            message: `Merge queue has ${internal.mergeQueue.length} item(s) but merge loop is not running. Restarting merge loop...`,
          });
          this.startMergeLoopIfNeeded(runId);
        }

        // Detect snapshot progress (merge acceptance) to control adaptive buffering.
        if (internal.snapshotVersion !== lastSnapshotVersion) {
          lastSnapshotVersion = internal.snapshotVersion;
          lastSnapshotAdvanceAt = Date.now();
          if (adaptiveBufferMode) {
            adaptiveBufferMode = false;
            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'info',
              message: `Merge progressed (snapshot v${internal.snapshotVersion}). Restoring buffer limit to ${maxBufferedPatches}.`,
            });
          }
        }

        // Stage 2: PR review/refinement (bounded) while generation continues.
        if (!skipPrReview) {
          while (reviewInFlight.size < reviewConcurrency && reviewQueue.length > 0) {
            const patch = reviewQueue.shift()!;
            const ticketId = patch.ticketId;
            const p = (async () => {
              const refined = await this.refinePatchWithPrReview(runId, patch);
              this.enqueueGeneratedPatchForMerge(runId, refined);
            })()
              .catch((e: any) => {
                hasFailures.value = true;
                const msg = e?.message || 'Ticket failed';
                this.updateTicketStatus(runId, ticketId, 'failed', undefined, msg);
                this.emit(runId, {
                  type: 'log',
                  runId,
                  at: now(),
                  level: 'error',
                  message: `Ticket failed: ${msg}`,
                  ticketId,
                });
              })
              .finally(() => {
                reviewInFlight.delete(ticketId);
              });
            reviewInFlight.set(ticketId, p);
          }
        } else if (reviewQueue.length > 0) {
          // Safety: if anything ended up in the review queue, bypass and enqueue for merge.
          while (reviewQueue.length > 0) {
            const patch = reviewQueue.shift()!;
            this.enqueueGeneratedPatchForMerge(runId, patch);
          }
        }

        // Stage 1: Dispatch as many ready tickets as possible up to the generation concurrency.
        while (genInFlight.size < genConcurrency) {
          // Avoid unbounded pipelining: keep generation ahead of downstream stages (PR review + merge),
          // otherwise patches become stale and conflict rates explode under parallelism.
          const bufferedReview = reviewQueue.length + reviewInFlight.size;
          const mergeQueueLen = internal.mergeQueue.length;
          const mergeBusy = this.mergePromises.has(runId) ? 1 : 0;
          const bufferedTotal = bufferedReview + mergeQueueLen + mergeBusy;

          const mergeStalled =
            (mergeQueueLen > 0 || mergeBusy > 0) && Date.now() - lastSnapshotAdvanceAt > mergeStallMs;
          const effectiveMaxBufferedPatches = mergeStalled
            ? Math.min(maxBufferedHardCap, Math.max(maxBufferedPatches, maxBufferedPatches * 3))
            : maxBufferedPatches;

          if (mergeStalled && !adaptiveBufferMode) {
            adaptiveBufferMode = true;
            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'warning',
              message: `Merge appears stalled (no snapshot advance for ${Math.round(
                (Date.now() - lastSnapshotAdvanceAt) / 1000
              )}s). Increasing buffer limit to ${effectiveMaxBufferedPatches} to keep generation moving.`,
            });
          }

          if (!mergeStalled && adaptiveBufferMode && Date.now() - lastSnapshotAdvanceAt <= mergeStallMs) {
            // Merge isn't stalled anymore (or the queue cleared) but snapshot hasn't advanced yet; keep mode until we
            // observe actual progress via snapshotVersion change above.
          }

          if (bufferedTotal >= effectiveMaxBufferedPatches) break;

          const exclude = new Set(genInFlight.keys());
          let next: KanbanTicket | null = null;
          let contentionGroup: string | null = null;

          while (true) {
            next = nextBuildableTicket(fresh.tickets, fresh.input.onlyTicketId, exclude);
            if (!next) break;

            contentionGroup = this.getContentionGroup(next);
            if (contentionGroup && this.isGroupLockedByOtherTicket(runId, contentionGroup, next.id)) {
              exclude.add(next.id);
              next = null;
              continue;
            }

            break;
          }

          if (!next) break;

          // Acquire group lock while generating this patch (released as soon as generation completes).
          if (contentionGroup) {
            this.acquireGroupLock(runId, contentionGroup, next.id);
          }

          const baseVersion = internal.snapshotVersion;

          this.updateTicketStatus(runId, next.id, 'generating', 5, null);
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'system',
            message: `Generating patch for "${next.title}" (base v${baseVersion})`,
            ticketId: next.id,
          });

          const ticketId = next.id;
          const p = (async () => {
            const patch = await this.generateTicketPatch(runId, ticketId, baseVersion, skipPrReview);
            if (skipPrReview) {
              this.enqueueGeneratedPatchForMerge(runId, patch);
            } else {
              reviewQueue.push(patch);
            }
          })()
            .catch((e: any) => {
              hasFailures.value = true;
              const msg = e?.message || 'Ticket failed';
              this.updateTicketStatus(runId, ticketId, 'failed', undefined, msg);
              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'error',
                message: `Ticket failed: ${msg}`,
                ticketId,
              });
            })
            .finally(() => {
              genInFlight.delete(ticketId);
              // Release contention locks after generation so other tickets can start while this one is in PR review/merge queue.
              this.releaseLocksForTicket(runId, ticketId);
            });

          genInFlight.set(ticketId, p);
        }

        const nextSchedulable = nextBuildableTicket(fresh.tickets, fresh.input.onlyTicketId, new Set(genInFlight.keys()));
        const mergePending = hasMergePending();

        const anyInFlight = genInFlight.size > 0 || reviewInFlight.size > 0;

        // If nothing is schedulable, nothing is in-flight, and nothing is queued for review, we may still be waiting for merges to complete.
        if (!nextSchedulable && !anyInFlight && reviewQueue.length === 0) {
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

        // Wait for one unit of work to finish before attempting to schedule more (bounded pool).
        if (genInFlight.size > 0 || reviewInFlight.size > 0) {
          await Promise.race([...Array.from(genInFlight.values()), ...Array.from(reviewInFlight.values())]);
        } else {
          await sleep(200);
        }
      }

      // Drain any remaining work (should be none, but be safe)
      if (genInFlight.size > 0 || reviewInFlight.size > 0) {
        await Promise.allSettled([...Array.from(genInFlight.values()), ...Array.from(reviewInFlight.values())]);
      }

      // Drain merges (virtual PRs) before finalizing run status.
      const mergePromise = this.mergePromises.get(runId);
      if (mergePromise) {
        await mergePromise;
      }

      // If integration gating was deferred, run a single integration gate at the end (bounded healing attempts).
      let deferredGateFailure: string | null = null;
      if (skipIntegrationGate) {
        const maxFinalGateAttempts =
          clampInt(Number(process.env.BUILD_FINAL_INTEGRATION_GATE_ATTEMPTS), 1, 10) ?? 3;

        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'system',
          message: `Final integration gate (deferred): running (max ${maxFinalGateAttempts} attempt(s))...`,
        });

        const history: string[] = [];
        const state = this.internalState.get(runId);
        const integrationSandboxId = state?.mainSandboxId || run.input.sandboxId;

        const baseUrl = run.baseUrl;
        if (!baseUrl) {
          deferredGateFailure = 'Missing baseUrl for BuildRun (cannot call internal APIs)';
        } else {
          for (let attempt = 1; attempt <= maxFinalGateAttempts; attempt++) {
            try {
              await this.runIntegrationGate(baseUrl, integrationSandboxId);
              deferredGateFailure = null;
              break;
            } catch (e: any) {
              const msg = e?.message || 'Final integration gate failed';
              deferredGateFailure = msg;
              history.push(msg);

              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'warning',
                message: `Final integration gate failed (attempt ${attempt}/${maxFinalGateAttempts}). Auto-healing and retrying...`,
              });

              const extracted = extractLikelyFilePathsFromText(msg);
              const fallbackCandidates = [
                'src/App.tsx',
                'src/main.tsx',
                'src/App.jsx',
                'src/main.jsx',
                'index.html',
                'package.json',
                'vite.config.ts',
                'vite.config.js',
              ];

              const candidatePaths = extracted.length > 0 ? extracted : fallbackCandidates;

              let problemFiles: Record<string, string> = {};
              try {
                if (candidatePaths.length > 0) {
                  problemFiles = await this.captureFilesFromSandbox(integrationSandboxId, candidatePaths);
                }
              } catch {
                problemFiles = {};
              }

              const historyText = history
                .slice(-5)
                .map((h, idx) => `- [${idx + 1}] ${h.slice(0, 800)}`)
                .join('\n');

              const problemFilesText = Object.keys(problemFiles).length > 0 ? buildFileBlocks(problemFiles) : '';

              const fixPrompt =
                `Fix the build/runtime issues preventing the application from passing the FINAL integration gate.\n\n` +
                `Final integration gate failure:\n${msg}\n\n` +
                `Previous attempts history (do NOT repeat failed approaches; adapt):\n${historyText || '(none)'}\n\n` +
                `Rules:\n` +
                `- Your goal is to make the app pass \`npm run build\` and eliminate obvious runtime errors.\n` +
                `- Make the smallest possible changes.\n` +
                `- Do NOT add features.\n` +
                `- Prefer fixing the files implicated by the error output.\n` +
                `- NEVER include markdown fences like \`\`\` or language tags inside files.\n` +
                `- If a file contains accidental markdown markers (e.g. \`\`\`css), remove them.\n` +
                `- Output ONLY <file path=\"...\"> blocks for files you change. Each block must contain the full updated file content.\n\n` +
                (extracted.length > 0 ? `You MUST output ONLY these file(s): ${extracted.join(', ')}\n\n` : '') +
                (problemFilesText ? `Current file contents (authoritative):\n${problemFilesText}\n\n` : '');

              let fixCode = '';
              try {
                fixCode = await this.generateTicketCode(
                  baseUrl,
                  run.input.model,
                  fixPrompt,
                  integrationSandboxId,
                  'fix_validation'
                );
              } catch {
                fixCode = '';
              }

              if (fixCode && fixCode.includes('<file path="')) {
                try {
                  await this.applyCode(baseUrl, integrationSandboxId, fixCode, true);
                } catch {
                  // ignore and retry gate
                }
              } else {
                // Avoid a tight loop if the model returns unusable output.
                await sleep(2000);
              }

              await sleep(1500);
            }
          }
        }

        if (deferredGateFailure) {
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'error',
            message: `Final integration gate failed after ${maxFinalGateAttempts} attempt(s): ${deferredGateFailure.slice(0, 800)}`,
          });
        } else {
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'system',
            message: `Final integration gate passed.`,
          });

          // Update the final snapshot to include any end-of-run healing fixes.
          try {
            const st = this.internalState.get(runId);
            if (st) {
              const finalSnapshot = await this.captureSandboxSnapshot(integrationSandboxId);
              st.snapshotsByVersion.set(st.snapshotVersion, finalSnapshot);
            }
          } catch {
            // ignore
          }
        }
      }

      // Re-run block propagation in case merges caused failures/blocks.
      this.propagateBlockedTickets(runId);

      const finalRun = this.runs.get(runId);
      const anyTicketFailures =
        finalRun?.tickets?.some(t => t.status === 'failed' || t.status === 'blocked') ?? false;

      const anyAwaitingInput =
        finalRun?.tickets?.some(t => t.status === 'awaiting_input') ?? false;
      const anyUnfinished =
        finalRun?.tickets?.some(t => t.status === 'backlog' || t.status === 'rebasing') ?? false;

      const reason = deferredGateFailure
        ? `Final integration gate failed`
        : anyTicketFailures
          ? 'One or more tickets failed/blocked'
          : anyAwaitingInput
            ? 'One or more tickets are awaiting user input'
            : anyUnfinished
              ? 'One or more tickets were not completed'
              : undefined;

      if (hasFailures.value || anyTicketFailures || anyAwaitingInput || anyUnfinished || Boolean(deferredGateFailure)) {
        const err = deferredGateFailure ? `Final integration gate failed: ${deferredGateFailure}` : (reason || 'Build finished incomplete');
        this.setStatus(runId, 'failed', 'Build finished with failures', err);
        this.emit(runId, { type: 'run_completed', runId, status: 'failed', at: now() });
      } else {
        this.setStatus(runId, 'completed', 'Build complete');
        this.emit(runId, { type: 'run_completed', runId, status: 'completed', at: now() });
      }
    } catch (e: any) {
      const message = e?.message || 'Build failed';
      const current = this.runs.get(runId);
      if (current?.currentTicketId) {
        this.updateTicketStatus(runId, current.currentTicketId, 'failed', undefined, message);
      }
      this.setStatus(runId, 'failed', message, message);
    } finally {
      try {
        sandboxManager.markInUse(run?.input?.sandboxId || '', false);
      } catch {
        // ignore
      }

      this.internalState.delete(runId);
      this.contentionLocks.delete(runId);
    }
  }

  private async generateAndQueueTicket(runId: string, ticketId: string, baseVersion: number) {
    const run = this.runs.get(runId);
    const skipPrReviewEnv = ['1', 'true', 'yes'].includes(
      String(process.env.BUILD_SKIP_PR_REVIEW || '').toLowerCase()
    );
    const skipPrReview = typeof run?.input?.skipPrReview === 'boolean' ? run!.input.skipPrReview : skipPrReviewEnv;

    const patch = await this.generateTicketPatch(runId, ticketId, baseVersion, skipPrReview);
    if (skipPrReview) {
      this.enqueueGeneratedPatchForMerge(runId, patch);
      return;
    }

    const refined = await this.refinePatchWithPrReview(runId, patch);
    this.enqueueGeneratedPatchForMerge(runId, refined);
  }

  private async generateTicketPatch(
    runId: string,
    ticketId: string,
    baseVersion: number,
    skipPrReview = false
  ): Promise<GeneratedPatch> {
    const run = this.runs.get(runId);
    const state = this.internalState.get(runId);
    if (!run || !state) throw new Error(`Run not found: ${runId}`);

    const ticket = run.tickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

    const baseUrl = run.baseUrl;
    if (!baseUrl) {
      throw new Error('Missing baseUrl for BuildRun (cannot call internal APIs)');
    }

    const planBlueprint: any = (run.input.plan as any)?.blueprint || null;
    const desiredTemplate: 'vite' | 'next' =
      (run.input.plan as any)?.templateTarget || planBlueprint?.templateTarget || 'vite';

    const uiStyleBlock = run.input.uiStyle
      ? `\n\nUI STYLE (apply consistently across all tickets):\n${JSON.stringify(run.input.uiStyle, null, 2)}\n`
      : '';

    const conventionsSnapshot = state.snapshotsByVersion.get(baseVersion) || null;
    const conventionsBlock = conventionsSnapshot ? buildSnapshotConventions(conventionsSnapshot) : '';

    const ticketPrompt =
      `Implement the following ticket in the existing application.\n\n` +
      `Template: ${desiredTemplate}\n` +
      uiStyleBlock +
      `Blueprint (high-level contract):\n${planBlueprint ? JSON.stringify(planBlueprint, null, 2) : '(none)'}\n\n` +
      (conventionsBlock ? `Project conventions & existing surface (follow strictly):\n${conventionsBlock}\n\n` : '') +
      `Ticket:\n- Title: ${ticket.title}\n- Description: ${ticket.description}\n\n` +
      `Rules:\n- Implement the ticket completely.\n- Preserve existing routes/navigation and the mock-first data layer.\n- Create new files if required by this ticket.\n- Follow the existing project structure and file extensions (do not introduce alternate trees like src/ if the repo uses app/ and components/).\n- If a UI primitive/component already exists, prefer editing it in-place instead of creating a new copy with a different name or extension (avoid Button.jsx vs button.tsx drift).\n- Output ONLY <file path=\"...\"> blocks for files you changed/created.`;

    // Generate patch (LLM) against the integration sandbox context.
    const genStart = now();
    const rawGenerated = await this.generateTicketCode(
      baseUrl,
      run.input.model,
      ticketPrompt,
      run.input.sandboxId,
      'implement_ticket'
    );
    const genMs = now() - genStart;

    // Parse + canonicalize patch to avoid stray text breaking downstream apply.
    const patchFiles: Record<string, string> = {};
    for (const block of extractFileBlocks(rawGenerated || '')) {
      const p = normalizeSandboxPath(block.path || '');
      if (!p) continue;
      patchFiles[p] = (block.content || '').trim();
    }

    if (Object.keys(patchFiles).length === 0) {
      throw new Error('AI generation returned no <file> blocks');
    }

    const appliedFiles = Object.keys(patchFiles).sort();
    const patchCode = buildFileBlocks(patchFiles);

    run.tickets = updateTicket(run.tickets, ticketId, {
      generatedCode: patchCode,
      actualFiles: appliedFiles,
      previewAvailable: false,
    } as any);

    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId,
      generatedCode: patchCode,
      appliedFiles,
    });

    if (!skipPrReview) {
      // Mark for PR review/refinement (runs in parallel with more generation).
      this.updateTicketStatus(runId, ticketId, 'pr_review', 95);
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Patch generated (gen ${(genMs / 1000).toFixed(1)}s). Queued for PR review.`,
        ticketId,
      });
    } else {
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'system',
        message: `Patch generated (gen ${(genMs / 1000).toFixed(1)}s). PR review skipped (demo mode).`,
        ticketId,
      });
    }

    return { ticketId, baseVersion, patchFiles, patchCode, appliedFiles, genMs };
  }

  private async refinePatchWithPrReview(runId: string, patch: GeneratedPatch): Promise<GeneratedPatch> {
    const run = this.runs.get(runId);
    const state = this.internalState.get(runId);
    if (!run || !state) throw new Error(`Run not found: ${runId}`);

    const ticket = run.tickets.find(t => t.id === patch.ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${patch.ticketId}`);

    const baseUrl = run.baseUrl;
    if (!baseUrl) {
      throw new Error('Missing baseUrl for BuildRun (cannot call internal APIs)');
    }

    let patchFiles = { ...patch.patchFiles };
    let patchCode = patch.patchCode;
    let appliedFiles = patch.appliedFiles.slice();

    // PR review (soft gate) + in-memory refinement (no sandbox apply here).
    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: `PR review: ${ticket.title}`,
      ticketId: patch.ticketId,
    });

    const reviewStart = now();
    let currentReview = await this.reviewCode(baseUrl, patch.ticketId, ticket.title, extractFileBlocks(patchCode));

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
        ticketId: patch.ticketId,
      });

      const fixPrompt =
        `Fix the listed issues in the provided code.\n\n` +
        `Blocking issues:\n${issuesText}\n\n` +
        `Rules:\n` +
        `- Make the smallest possible changes to fix ONLY the issues above.\n` +
        `- Do NOT change app behavior beyond what is needed to fix the issues.\n` +
        `- Do NOT introduce new dependencies unless absolutely necessary.\n` +
        `- NEVER include markdown fences like \`\`\` or language tags inside files.\n` +
        `- Output ONLY <file path="..."> blocks for files you change. Each block must contain the full updated file content.\n\n` +
        `Code:\n${filesText}`;

      const fixCode = await this.generateTicketCode(
        baseUrl,
        run.input.model,
        fixPrompt,
        run.input.sandboxId,
        'fix_validation'
      );

      const fixBlocks = extractFileBlocks(fixCode || '');
      if (fixBlocks.length === 0) break;

      for (const b of fixBlocks) {
        const p = normalizeSandboxPath(b.path || '');
        if (!p) continue;
        patchFiles[p] = (b.content || '').trim();
      }

      appliedFiles = Object.keys(patchFiles).sort();
      patchCode = buildFileBlocks(patchFiles);

      run.tickets = updateTicket(run.tickets, patch.ticketId, {
        generatedCode: patchCode,
        actualFiles: appliedFiles,
        previewAvailable: false,
      } as any);

      this.emit(runId, {
        type: 'ticket_artifacts',
        runId,
        at: now(),
        ticketId: patch.ticketId,
        generatedCode: patchCode,
        appliedFiles,
      });

      currentReview = await this.reviewCode(baseUrl, patch.ticketId, ticket.title, extractFileBlocks(patchCode));
    }

    const reviewMs = now() - reviewStart;
    this.emit(runId, {
      type: 'ticket_artifacts',
      runId,
      at: now(),
      ticketId: patch.ticketId,
      reviewDurationMs: reviewMs,
      reviewIssuesCount: currentReview?.issues?.length ?? 0,
    });

    if (hasBlockingIssues(currentReview)) {
      const issues = Array.isArray(currentReview?.issues) ? currentReview.issues : [];
      const top = issues
        .filter((i: any) => i && (i.severity === 'error' || i.severity === 'warning'))
        .slice(0, 10)
        .map((i: any) => {
          const loc = `${i.file || 'unknown'}${i.line ? `:${i.line}` : ''}`;
          return `${i.severity}/${i.type}: ${loc} — ${i.message}`;
        });

      const warnings = [
        `Bugbot review did not fully pass. Proceeding with merge (soft-gated).`,
        ...(top.length > 0 ? top : [`Issues count: ${issues.length}`]),
      ];

      this.updateTicketWarnings(runId, patch.ticketId, warnings);
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'warning',
        message: `PR review has remaining issues; proceeding anyway (soft-gate).`,
        ticketId: patch.ticketId,
      });
    }

    return { ...patch, patchFiles, patchCode, appliedFiles };
  }

  private enqueueGeneratedPatchForMerge(runId: string, patch: GeneratedPatch) {
    const run = this.runs.get(runId);
    if (!run) return;

    const ticket = run.tickets.find(t => t.id === patch.ticketId);
    const title = ticket?.title || patch.ticketId;

    // Enqueue for merge; only mark Done once integration merge + gate succeed.
    this.updateTicketStatus(runId, patch.ticketId, 'merge_queued', 97);
    this.enqueueMerge(runId, {
      ticketId: patch.ticketId,
      workerSandboxId: run.input.sandboxId,
      baseVersion: patch.baseVersion,
      patchFiles: patch.patchFiles,
      patchCode: patch.patchCode,
      appliedFiles: patch.appliedFiles,
    });

    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: `Ready to merge: ${title} (gen ${(patch.genMs / 1000).toFixed(1)}s)`,
      ticketId: patch.ticketId,
    });
  }

  private async releaseWorkerSandboxes(runId: string, workers: Worker[]): Promise<void> {
    const workerSandboxes = (workers || []).filter(w => w.kind === 'worker');
    if (workerSandboxes.length === 0) return;

    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: `Releasing ${workerSandboxes.length} worker sandbox(es)`,
    });

    await Promise.allSettled(
      workerSandboxes.map(async w => {
        try {
          sandboxManager.markInUse(w.sandboxId, false);
        } catch {
          // ignore
        }

        try {
          const returned = await sandboxManager.returnToPool(w.sandboxId);
          if (returned) return;
        } catch {
          // ignore and fall through to terminate
        }

        try {
          await sandboxManager.terminateSandbox(w.sandboxId);
        } catch {
          // ignore
        }
      })
    );
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

    const conventionsSnapshot = (() => {
      const state = this.internalState.get(runId);
      if (!state) return null;
      if (typeof baseVersion === 'number' && baseVersion >= 0) {
        return state.snapshotsByVersion.get(baseVersion) || null;
      }
      return state.snapshotsByVersion.get(state.snapshotVersion) || null;
    })();

    const conventionsBlock = conventionsSnapshot ? buildSnapshotConventions(conventionsSnapshot) : '';

    const ticketPrompt =
      `Implement the following ticket in the existing application.\n\n` +
      `Template: ${desiredTemplate}\n` +
      uiStyleBlock +
      `Blueprint (high-level contract):\n${planBlueprint ? JSON.stringify(planBlueprint, null, 2) : '(none)'}\n\n` +
      (conventionsBlock ? `Project conventions & existing surface (follow strictly):\n${conventionsBlock}\n\n` : '') +
      `Ticket:\n- Title: ${ticket.title}\n- Description: ${ticket.description}\n\n` +
      `Rules:\n- Implement the ticket completely.\n- Preserve existing routes/navigation and the mock-first data layer.\n- Create new files if required by this ticket.\n- Follow the existing project structure and file extensions (do not introduce alternate trees like src/ if the repo uses app/ and components/).\n- If a UI primitive/component already exists, prefer editing it in-place instead of creating a new copy with a different name or extension (avoid Button.jsx vs button.tsx drift).\n- Output ONLY <file path=\"...\"> blocks for files you changed/created.`;

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
      const issues = Array.isArray(currentReview?.issues) ? currentReview.issues : [];
      const top = issues
        .filter((i: any) => i && (i.severity === 'error' || i.severity === 'warning'))
        .slice(0, 10)
        .map((i: any) => {
          const loc = `${i.file || 'unknown'}${i.line ? `:${i.line}` : ''}`;
          return `${i.severity}/${i.type}: ${loc} — ${i.message}`;
        });

      const warnings = [
        `Bugbot review did not fully pass. Proceeding with merge (soft-gated).`,
        ...(top.length > 0 ? top : [`Issues count: ${issues.length}`]),
      ];

      this.updateTicketWarnings(runId, ticketId, warnings);
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'warning',
        message: `PR review has remaining issues; proceeding anyway (soft-gate).`,
        ticketId,
      });
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
    const skipIntegrationGateEnv = ['1', 'true', 'yes'].includes(
      String(process.env.BUILD_SKIP_INTEGRATION_GATE || '').toLowerCase()
    );
    const skipIntegrationGate =
      typeof run.input.skipIntegrationGate === 'boolean' ? run.input.skipIntegrationGate : skipIntegrationGateEnv;

    if (!skipIntegrationGate) {
      this.updateTicketStatus(runId, ticketId, 'testing', 98);
    }
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
    const timeoutMs = getTimeoutMs(process.env.BUILD_TICKET_GENERATION_TIMEOUT_MS, 180_000, {
      min: 15_000,
      max: 10 * 60_000,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/generate-ai-code-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          context: { sandboxId },
          isEdit: true,
          buildProfile,
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      const msg = String(e?.name || '') === 'AbortError'
        ? `AI generation timed out after ${(timeoutMs / 1000).toFixed(0)}s`
        : (e?.message || 'AI generation request failed');
      throw new Error(msg);
    }

    if (!res.ok) {
      clearTimeout(timeoutId);
      const bodyText = await readResponseTextSafe(res, 4000);
      const details = bodyText ? `\n${bodyText}` : '';
      throw new Error(`AI generation failed (HTTP ${res.status})${details}`);
    }

    let generatedCode = '';
    try {
      await readSseJson<any>(res, (data) => {
        if (data?.type === 'stream' && data.raw) {
          generatedCode += data.text || '';
        }
        if (data?.type === 'complete') {
          if (typeof data.generatedCode === 'string' && data.generatedCode.trim()) {
            generatedCode = data.generatedCode;
          }
        }
        if (data?.type === 'error') {
          const msg = data?.message || data?.error || 'AI generation stream error';
          throw new Error(String(msg));
        }
      });
    } catch (e: any) {
      const msg = String(e?.name || '') === 'AbortError'
        ? `AI generation timed out after ${(timeoutMs / 1000).toFixed(0)}s`
        : (e?.message || 'AI generation failed');
      throw new Error(msg);
    } finally {
      clearTimeout(timeoutId);
    }

    return generatedCode;
  }

  private async applyCode(
    baseUrl: string,
    sandboxId: string,
    code: string,
    isEdit: boolean
  ): Promise<{ appliedFiles: string[]; durationMs?: number }> {
    const startedAt = now();
    const timeoutMs = getTimeoutMs(process.env.BUILD_TICKET_APPLY_TIMEOUT_MS, 120_000, {
      min: 15_000,
      max: 10 * 60_000,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/apply-ai-code-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: code,
          isEdit,
          sandboxId,
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      const msg = String(e?.name || '') === 'AbortError'
        ? `Apply timed out after ${(timeoutMs / 1000).toFixed(0)}s`
        : (e?.message || 'Apply request failed');
      throw new Error(msg);
    }

    if (!res.ok) {
      clearTimeout(timeoutId);
      const bodyText = await readResponseTextSafe(res, 4000);
      const details = bodyText ? `\n${bodyText}` : '';
      throw new Error(`Apply failed (HTTP ${res.status})${details}`);
    }

    let final: any = null;
    try {
      await readSseJson<any>(res, (data) => {
        if (data?.type === 'complete') final = data;
        if (data?.type === 'error') {
          throw new Error(data?.message || data?.error || 'Apply failed');
        }
      });
    } catch (e: any) {
      const msg = String(e?.name || '') === 'AbortError'
        ? `Apply timed out after ${(timeoutMs / 1000).toFixed(0)}s`
        : (e?.message || 'Apply failed');
      throw new Error(msg);
    } finally {
      clearTimeout(timeoutId);
    }

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
    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider || !provider.getSandboxInfo?.()) {
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
      workers.push(await this.createSingleWorker(runId));
    }

    return workers;
  }

  private async createSingleWorker(runId: string): Promise<Worker> {
    // Prefer pooled sandbox if enabled (may return null)
    let provider = await sandboxManager.getPooledSandbox();
    let info = provider?.getSandboxInfo?.() || null;

    if (!provider || !info?.sandboxId) {
      provider = SandboxFactory.create();
      info = await provider.createSandbox();
      await provider.setupViteApp();
    }

    // Register but do not take over the UI's active sandbox.
    sandboxManager.registerSandbox(info.sandboxId, provider, { setActive: false, inUse: true });

    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: `Worker sandbox ready: ${info.sandboxId}`,
    });

    return { kind: 'worker', sandboxId: info.sandboxId, provider };
  }

  private async captureFilesFromSandbox(sandboxId: string, filePaths: string[]): Promise<Record<string, string>> {
    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider || !provider.getSandboxInfo?.()) {
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

  private async readFirstFileFromSandbox(
    sandboxId: string,
    paths: string[]
  ): Promise<{ path: string; content: string } | null> {
    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider || !provider.getSandboxInfo?.()) return null;
    if (typeof (provider as any).readFile !== 'function') return null;

    for (const p of paths) {
      try {
        const content = await (provider as any).readFile(p);
        if (typeof content === 'string' && content.trim().length > 0) {
          return { path: p, content };
        }
      } catch {
        // ignore and try next
      }
    }
    return null;
  }

  private async detectE2BTemplateInSandbox(sandboxId: string): Promise<boolean> {
    // Vite sandboxes: check App source (most reliable; avoids cross-origin fetching)
    const app = await this.readFirstFileFromSandbox(sandboxId, [
      'src/App.jsx',
      'src/App.tsx',
      'App.jsx',
      'App.tsx',
    ]);
    if (!app?.content) return false;
    return looksLikeE2BTemplateApp(app.content);
  }

  private async ensureIntegrationScaffolded(runId: string, sandboxId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;

    const baseUrl = run.baseUrl;
    if (!baseUrl) return;

    const plan: any = run.input.plan as any;
    const planBlueprint: any = plan?.blueprint || null;
    const desiredTemplate: 'vite' | 'next' =
      plan?.templateTarget || planBlueprint?.templateTarget || 'vite';

    // Only needed for Vite template sandboxes.
    if (desiredTemplate !== 'vite') return;

    const looksLikeTemplate = await this.detectE2BTemplateInSandbox(sandboxId);
    if (!looksLikeTemplate) return;

    const minimalBlueprint: any = {
      templateTarget: 'vite',
      dataMode: plan?.dataMode || 'real_optional',
      theme: { preset: 'modern_light', accent: 'indigo' },
      routes: [
        { id: 'home', kind: 'page', path: '/', title: 'Home', navLabel: 'Home' },
      ],
      navigation: { items: [{ label: 'Home', routeId: 'home' }] },
      entities: [],
      flows: [],
    };

    const blueprintForScaffold = planBlueprint || minimalBlueprint;

    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: planBlueprint
        ? 'Scaffolding project from blueprint (server-side) for early preview...'
        : 'No blueprint on plan; scaffolding a minimal app shell (server-side) for early preview...',
    });

    const res = await fetch(`${baseUrl}/api/scaffold-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        template: 'vite',
        blueprint: blueprintForScaffold,
        uiStyle: run.input.uiStyle,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      const msg = data?.error || `Scaffold failed (HTTP ${res.status})`;
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'warning',
        message: `Scaffold attempt failed (non-fatal): ${msg}`,
      });
      return;
    }

    this.emit(runId, {
      type: 'log',
      runId,
      at: now(),
      level: 'system',
      message: `Scaffolded ${data?.filesWritten?.length || 0} file(s) (early preview enabled).`,
    });
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

    const promise = this.runMergeLoop(runId)
      .catch((e: any) => {
        const msg = String(e?.message || 'Merge loop crashed').slice(0, 800);
        this.emit(runId, { type: 'log', runId, at: now(), level: 'error', message: `Merge loop crashed: ${msg}` });
      })
      .finally(() => {
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

    const skipIntegrationGateEnv = ['1', 'true', 'yes'].includes(
      String(process.env.BUILD_SKIP_INTEGRATION_GATE || '').toLowerCase()
    );
    const skipIntegrationGate =
      typeof run.input.skipIntegrationGate === 'boolean' ? run.input.skipIntegrationGate : skipIntegrationGateEnv;

    while (true) {
      await this.waitIfPaused(runId);

      const next = state.mergeQueue.shift();
      if (!next) break;

      // Immediately reflect that this ticket is actively being processed by the merge loop
      // (otherwise it can appear "stuck" in merge_queued while we resolve conflicts, etc).
      this.updateTicketStatus(runId, next.ticketId, 'merging', 98);
      this.emit(runId, {
        type: 'log',
        runId,
        at: now(),
        level: 'info',
        message: `Merge started: ${next.ticketId} (base v${next.baseVersion} → main v${state.snapshotVersion})`,
        ticketId: next.ticketId,
      });

      const baseSnapshot = state.snapshotsByVersion.get(next.baseVersion) || {};
      const mainSnapshot = state.snapshotsByVersion.get(state.snapshotVersion) || {};

      const conflicts = detectFileConflicts(baseSnapshot, mainSnapshot, next.patchFiles);
      if (conflicts.length > 0) {
        const msg =
          conflicts.length === 1
            ? `Merge conflict: ${conflicts[0]}`
            : `Merge conflict: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '…' : ''}`;

        // Show conflict-resolution work explicitly (UI column + status), since it can take time.
        this.updateTicketStatus(runId, next.ticketId, 'rebasing', 0, msg);

        // First: deterministic "3-way-ish" rebase (fast path).
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'warning',
          message: `${msg}. Attempting deterministic rebase (base v${next.baseVersion} → main v${state.snapshotVersion})...`,
          ticketId: next.ticketId,
        });

        const rebase = rebasePatchFiles({
          baseSnapshot,
          mainSnapshot,
          patchFiles: next.patchFiles,
          onlyPaths: conflicts,
        });

        // Apply any successful rebases to this branch's patch set.
        if (rebase.rebasedPaths.length > 0) {
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'info',
            message: `Deterministic rebase succeeded for: ${rebase.rebasedPaths.slice(0, 5).join(', ')}${rebase.rebasedPaths.length > 5 ? '…' : ''}`,
            ticketId: next.ticketId,
          });
        }

        next.patchFiles = rebase.rebasedPatchFiles;
        next.appliedFiles = Object.keys(next.patchFiles).sort();
        next.patchCode = buildFileBlocks(next.patchFiles);

        // Surface the latest patch to the UI for debugging (view-code).
        run.tickets = updateTicket(run.tickets, next.ticketId, {
          generatedCode: next.patchCode,
          actualFiles: next.appliedFiles,
          previewAvailable: false,
        } as any);
        this.emit(runId, {
          type: 'ticket_artifacts',
          runId,
          at: now(),
          ticketId: next.ticketId,
          generatedCode: next.patchCode,
          appliedFiles: next.appliedFiles,
        });

        if (!rebase.ok) {
          const conflictPaths = rebase.failedPaths.slice();
          const history = this.getHealHistory(runId, next.ticketId);
          const conflictAttemptsSoFar = history.filter(r => r.stage === 'merge_conflict').length;
          const maxConflictAttempts = 2;

          // Second: LLM merge conflict resolver (slow path) with appended context.
          if (conflictAttemptsSoFar < maxConflictAttempts) {
            const attempt = conflictAttemptsSoFar + 1;
            const historyText = formatHealHistory(history);
            const ticket = run.tickets.find(x => x.id === next.ticketId) || null;

            const baseHeader = `base v${next.baseVersion}`;
            const mainHeader = `main v${state.snapshotVersion}`;

            const fileContextBlocks = conflictPaths
              .map((p) => {
                const baseHas = Object.prototype.hasOwnProperty.call(baseSnapshot, p);
                const mainHas = Object.prototype.hasOwnProperty.call(mainSnapshot, p);
                const patchHas = Object.prototype.hasOwnProperty.call(next.patchFiles, p);

                const baseText = baseHas ? baseSnapshot[p] : '(file missing)';
                const mainText = mainHas ? mainSnapshot[p] : '(file missing)';
                const patchText = patchHas ? next.patchFiles[p] : '(file missing)';

                const patchDelta = rebase.patchTextByPath?.[p] || '';

                return (
                  `\nFILE: ${p}\n` +
                  `--- BEGIN ${baseHeader} ---\n${baseText}\n--- END ${baseHeader} ---\n\n` +
                  `--- BEGIN ${mainHeader} ---\n${mainText}\n--- END ${mainHeader} ---\n\n` +
                  `--- BEGIN ticket_generated ---\n${patchText}\n--- END ticket_generated ---\n\n` +
                  (patchDelta ? `--- BEGIN base_to_ticket_patch ---\n${patchDelta}\n--- END base_to_ticket_patch ---\n` : '')
                );
              })
              .join('\n');

            const conflictMsg = `${msg}. Deterministic rebase failed for: ${conflictPaths.slice(0, 5).join(', ')}${conflictPaths.length > 5 ? '…' : ''}`;
            this.pushHealRecord(runId, next.ticketId, 'merge_conflict', conflictMsg);

            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'warning',
              message: `${conflictMsg}. Invoking AI conflict resolver (attempt ${attempt}/${maxConflictAttempts})...`,
              ticketId: next.ticketId,
            });

            const fixPrompt =
              `Resolve merge conflicts when integrating a ticket patch into the current application.\n\n` +
              `Ticket:\n- Title: ${ticket?.title || next.ticketId}\n- Description: ${ticket?.description || '(unknown)'}\n\n` +
              `Context:\n- You are merging changes generated against ${baseHeader} into ${mainHeader}.\n` +
              `- Conflicting file(s): ${conflictPaths.join(', ')}\n\n` +
              `Previous attempts history (do NOT repeat failed approaches; adapt):\n${historyText}\n\n` +
              `Rules:\n` +
              `- Output ONLY <file path="..."> blocks for the conflicting file(s) listed above.\n` +
              `- Each <file> block MUST contain the FULL updated file content (no truncation).\n` +
              `- Preserve all unrelated changes already present in ${mainHeader}.\n` +
              `- Incorporate the ticket's intended changes from ticket_generated (or base_to_ticket_patch) into ${mainHeader}.\n` +
              `- Do NOT modify any other files.\n` +
              `- NEVER include markdown fences like \`\`\` or language tags inside files.\n\n` +
              `You MUST output ONLY these file(s): ${conflictPaths.join(', ')}\n\n` +
              `File contexts (authoritative):\n${fileContextBlocks}\n`;

            let fixCode = '';
            try {
              fixCode = await this.generateTicketCode(
                baseUrl,
                run.input.model,
                fixPrompt,
                state.mainSandboxId,
                'fix_validation'
              );
            } catch (e: any) {
              fixCode = '';
              this.pushHealRecord(runId, next.ticketId, 'merge_conflict', e?.message || 'AI conflict resolver failed');
            }

            const fixBlocks = extractFileBlocks(fixCode || '');
            const fixedByPath = new Map<string, string>();
            for (const b of fixBlocks) {
              const p = normalizeSandboxPath(b.path || '');
              if (!p) continue;
              if (!conflictPaths.includes(p)) continue;
              fixedByPath.set(p, (b.content || '').trim());
            }

            const missing = conflictPaths.filter(p => !fixedByPath.has(p));

            if (missing.length === 0 && fixedByPath.size > 0) {
              for (const [p, content] of fixedByPath.entries()) {
                next.patchFiles[p] = content;
              }
              next.appliedFiles = Object.keys(next.patchFiles).sort();
              next.patchCode = buildFileBlocks(next.patchFiles);

              run.tickets = updateTicket(run.tickets, next.ticketId, {
                generatedCode: next.patchCode,
                actualFiles: next.appliedFiles,
                previewAvailable: false,
              } as any);
              this.emit(runId, {
                type: 'ticket_artifacts',
                runId,
                at: now(),
                ticketId: next.ticketId,
                generatedCode: next.patchCode,
                appliedFiles: next.appliedFiles,
              });

              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'info',
                message: `AI conflict resolver succeeded for: ${conflictPaths.slice(0, 5).join(', ')}${conflictPaths.length > 5 ? '…' : ''}. Proceeding with merge.`,
                ticketId: next.ticketId,
              });
            } else {
              const failMsg =
                missing.length > 0
                  ? `AI conflict resolver did not return all required files (missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''})`
                  : `AI conflict resolver returned no usable <file> blocks`;

              this.pushHealRecord(runId, next.ticketId, 'merge_conflict', failMsg);
              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'warning',
                message: `${msg}. ${failMsg}. Falling back to regenerate/rebase strategy...`,
                ticketId: next.ticketId,
              });

              const maxRebaseAttempts = 3;
              const t = run.tickets.find(x => x.id === next.ticketId) || null;
              const currentRetries = typeof t?.retryCount === 'number' ? t!.retryCount : 0;

              if (currentRetries < maxRebaseAttempts) {
                const regenAttempt = currentRetries + 1;
                run.tickets = updateTicket(run.tickets, next.ticketId, { retryCount: regenAttempt } as any);
                this.updateTicketStatus(runId, next.ticketId, 'rebasing', 0, msg);
                this.emit(runId, {
                  type: 'log',
                  runId,
                  at: now(),
                  level: 'warning',
                  message: `${msg}. Auto-rebasing and re-running (attempt ${regenAttempt}/${maxRebaseAttempts})...`,
                  ticketId: next.ticketId,
                });
                continue;
              }

              this.updateTicketStatus(
                runId,
                next.ticketId,
                'failed',
                undefined,
                `${msg}. Auto-rebase exhausted (${currentRetries}/${maxRebaseAttempts}).`
              );
              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'error',
                message: `${msg}. Auto-rebase exhausted (${currentRetries}/${maxRebaseAttempts}).`,
                ticketId: next.ticketId,
              });
              continue;
            }
          } else {
            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'warning',
              message: `${msg}. AI conflict resolver attempts exhausted (${conflictAttemptsSoFar}/${maxConflictAttempts}). Falling back to regenerate/rebase strategy...`,
              ticketId: next.ticketId,
            });

            const maxRebaseAttempts = 3;
            const t = run.tickets.find(x => x.id === next.ticketId) || null;
            const currentRetries = typeof t?.retryCount === 'number' ? t!.retryCount : 0;

            if (currentRetries < maxRebaseAttempts) {
              const attempt = currentRetries + 1;
              run.tickets = updateTicket(run.tickets, next.ticketId, { retryCount: attempt } as any);
              this.updateTicketStatus(runId, next.ticketId, 'rebasing', 0, msg);
              this.emit(runId, {
                type: 'log',
                runId,
                at: now(),
                level: 'warning',
                message: `${msg}. Auto-rebasing and re-running (attempt ${attempt}/${maxRebaseAttempts})...`,
                ticketId: next.ticketId,
              });
              continue;
            }

            this.updateTicketStatus(
              runId,
              next.ticketId,
              'failed',
              undefined,
              `${msg}. Auto-rebase exhausted (${currentRetries}/${maxRebaseAttempts}).`
            );
            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'error',
              message: `${msg}. Auto-rebase exhausted (${currentRetries}/${maxRebaseAttempts}).`,
              ticketId: next.ticketId,
            });
            continue;
          }
        } else {
          // Everything was successfully rebased deterministically; proceed with merge.
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'info',
            message: `${msg}. Deterministic rebase resolved all conflicts. Proceeding with merge.`,
            ticketId: next.ticketId,
          });
        }
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
      // Optimistic merge: the integration sandbox should already reflect `mainSnapshot` (the last accepted version).
      // If apply fails, we reset back to `mainSnapshot` in the failure path below.

      // Apply patch (merge)
      let applyRes: { appliedFiles: string[]; durationMs?: number } | null = null;
      try {
        applyRes = await this.applyCode(baseUrl, state.mainSandboxId, next.patchCode, true);
      } catch (e: any) {
        const msg = e?.message || 'Merge apply failed';
        this.pushHealRecord(runId, next.ticketId, 'merge_apply', msg);

        // Treat merge-apply failures as recoverable: rebase/regenerate on the latest snapshot.
        const maxApplyRebaseAttempts = 3;
        const t = run.tickets.find(x => x.id === next.ticketId) || null;
        const currentRetries = typeof t?.retryCount === 'number' ? t!.retryCount : 0;

        if (currentRetries < maxApplyRebaseAttempts) {
          const attempt = currentRetries + 1;
          run.tickets = updateTicket(run.tickets, next.ticketId, { retryCount: attempt } as any);
          this.updateTicketStatus(runId, next.ticketId, 'rebasing', 0, msg);
          this.emit(runId, {
            type: 'log',
            runId,
            at: now(),
            level: 'warning',
            message: `Merge apply failed. Auto-rebasing and re-running (attempt ${attempt}/${maxApplyRebaseAttempts})...`,
            ticketId: next.ticketId,
          });
          // Revert integration sandbox to known-good state before continuing.
          try {
            await this.resetSandboxToSnapshot(state.mainSandboxId, mainSnapshot);
          } catch {
            // ignore
          }
          // Small backoff to avoid tight loops if apply keeps failing deterministically.
          await sleep(500 * attempt);
          continue;
        }

        this.updateTicketStatus(
          runId,
          next.ticketId,
          'failed',
          undefined,
          `${msg}. Auto-rebase exhausted (${currentRetries}/${maxApplyRebaseAttempts}).`
        );
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'error',
          message: `${msg}. Auto-rebase exhausted (${currentRetries}/${maxApplyRebaseAttempts}).`,
          ticketId: next.ticketId,
        });
        // Revert integration sandbox to known-good state and continue with other merges.
        try {
          await this.resetSandboxToSnapshot(state.mainSandboxId, mainSnapshot);
        } catch {
          // ignore
        }
        continue;
      }

      const mergedFiles = applyRes.appliedFiles;

      if (!skipIntegrationGate) {
        // Integration gate before accepting this merge (infinite healing loop).
        this.updateTicketStatus(runId, next.ticketId, 'testing', 99);
        let gateAttempt = 0;

        while (true) {
          gateAttempt += 1;
          try {
            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'info',
              message: `Integration gate running (attempt ${gateAttempt})...`,
              ticketId: next.ticketId,
            });
            await this.runIntegrationGate(baseUrl, state.mainSandboxId);
            break;
          } catch (e: any) {
            const msg = e?.message || 'Integration gate failed';
            this.pushHealRecord(runId, next.ticketId, 'integration_gate', msg);

            this.emit(runId, {
              type: 'log',
              runId,
              at: now(),
              level: 'warning',
              message: `Integration gate failed (attempt ${gateAttempt}). Auto-healing and retrying...`,
              ticketId: next.ticketId,
            });

            // Attempt to auto-fix in the integration sandbox using error history.
            const history = this.getHealHistory(runId, next.ticketId);
            const historyText = formatHealHistory(history);

            const candidatePaths = (() => {
              const extracted = extractLikelyFilePathsFromText(msg);
              if (extracted.length > 0) return extracted;
              // Fallback: prefer the files that were merged for this ticket.
              return (mergedFiles || []).slice(0, 5);
            })();

            let problemFiles: Record<string, string> = {};
            try {
              if (candidatePaths.length > 0) {
                problemFiles = await this.captureFilesFromSandbox(state.mainSandboxId, candidatePaths);
              }
            } catch {
              problemFiles = {};
            }

            const problemFilesText = Object.keys(problemFiles).length > 0 ? buildFileBlocks(problemFiles) : '';

            const fixPrompt =
              `Fix the build/runtime issues preventing the application from passing the integration gate.\n\n` +
              `Integration gate failure:\n${msg}\n\n` +
              `Previous attempts history (do NOT repeat failed approaches; adapt):\n${historyText}\n\n` +
              `Rules:\n` +
              `- Your goal is to make the app pass \`npm run build\` and eliminate obvious runtime errors.\n` +
              `- Make the smallest possible changes.\n` +
              `- Do NOT add features.\n` +
              `- Prefer fixing the files implicated by the error output.\n` +
              `- NEVER include markdown fences like \`\`\` or language tags inside files.\n` +
              `- If a file contains accidental markdown markers (e.g. \`\`\`css), remove them.\n` +
              `- Output ONLY <file path=\"...\"> blocks for files you change. Each block must contain the full updated file content.\n\n` +
              (candidatePaths.length > 0 ? `You MUST output ONLY these file(s): ${candidatePaths.join(', ')}\n\n` : '') +
              (problemFilesText ? `Current file contents (authoritative):\n${problemFilesText}\n\n` : '');

            const fixCode = await this.generateTicketCode(
              baseUrl,
              run.input.model,
              fixPrompt,
              state.mainSandboxId,
              'fix_validation'
            );

            if (!fixCode || !fixCode.includes('<file path="')) {
              // Backoff and keep trying (no hard cap), but avoid a tight loop.
              await sleep(2000);
              continue;
            }

            try {
              const fixApplyRes = await this.applyCode(baseUrl, state.mainSandboxId, fixCode, true);
              // Expand the patch file set with any new files touched by the fix.
              for (const p of fixApplyRes.appliedFiles) {
                if (p && !mergedFiles.includes(p)) mergedFiles.push(p);
              }
            } catch (applyErr: any) {
              const applyMsg = applyErr?.message || 'Auto-fix apply failed';
              this.pushHealRecord(runId, next.ticketId, 'merge_apply', applyMsg);
            }

            // Small backoff to avoid thrash.
            await sleep(1500);
            continue;
          }
        }
      } else {
        this.emit(runId, {
          type: 'log',
          runId,
          at: now(),
          level: 'warning',
          message: `Integration gate deferred to end (demo mode).`,
          ticketId: next.ticketId,
        });
      }

      // Accept merge: advance main snapshot version only after gate passes.
      const newVersion = state.snapshotVersion + 1;
      // Performance: instead of re-snapshotting the entire repo after every merge, capture only the
      // files touched by this merge (including any auto-heal edits) and update the snapshot incrementally.
      let finalPatchFiles: Record<string, string> = {};
      try {
        finalPatchFiles = await this.captureFilesFromSandbox(state.mainSandboxId, mergedFiles);
      } catch {
        finalPatchFiles = {};
      }

      const updatedSnapshot: Record<string, string> =
        Object.keys(finalPatchFiles).length > 0
          ? { ...mainSnapshot, ...finalPatchFiles }
          : await this.captureSandboxSnapshot(state.mainSandboxId);

      // If we fell back to a full snapshot, derive the per-ticket patch files from it for restore/debugging.
      if (Object.keys(finalPatchFiles).length === 0) {
        for (const p of mergedFiles) {
          const key = normalizeSandboxPath(String(p || ''));
          if (key && Object.prototype.hasOwnProperty.call(updatedSnapshot, key)) {
            finalPatchFiles[key] = updatedSnapshot[key];
          }
        }
      }

      state.snapshotVersion = newVersion;
      state.snapshotsByVersion.set(newVersion, updatedSnapshot);

      // Update ticket artifacts to reflect the integration sandbox reality.
      const finalPatchCode = Object.keys(finalPatchFiles).length > 0 ? buildFileBlocks(finalPatchFiles) : undefined;
      const latest = this.runs.get(runId);
      if (latest) {
        latest.tickets = updateTicket(latest.tickets, next.ticketId, {
          actualFiles: mergedFiles,
          previewAvailable: true,
          ...(finalPatchCode ? { generatedCode: finalPatchCode } : {}),
        } as any);
      }

      this.emit(runId, {
        type: 'ticket_artifacts',
        runId,
        at: now(),
        ticketId: next.ticketId,
        ...(typeof latest?.tickets?.find(t => t.id === next.ticketId)?.generatedCode === 'string'
          ? { generatedCode: latest.tickets.find(t => t.id === next.ticketId)!.generatedCode }
          : {}),
        appliedFiles: mergedFiles,
      });

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

  private async runIntegrationGate(baseUrl: string, sandboxId: string): Promise<void> {
    // Deterministic integration gate (hard signal):
    // 1) Build must succeed (`npm run build`), then
    // 2) Console log check must pass (best-effort).

    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider) {
      throw new Error(`No sandbox provider available for integration gate: ${sandboxId}`);
    }

    const buildTimeoutMs = getTimeoutMs(process.env.BUILD_INTEGRATION_BUILD_TIMEOUT_MS, 180_000, {
      min: 15_000,
      max: 20 * 60_000,
    });

    let buildRes: any;
    try {
      buildRes = await Promise.race([
        provider.runCommand('npm run build'),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Build timed out after ${(buildTimeoutMs / 1000).toFixed(0)}s`)),
            buildTimeoutMs
          )
        ),
      ]);
    } catch (e: any) {
      throw new Error(e?.message || 'Build failed');
    }
    if (!buildRes.success) {
      const out = `${buildRes.stdout || ''}\n${buildRes.stderr || ''}`.trim();
      throw new Error(`Build failed: ${out.slice(0, 4000)}`);
    }

    // Console check (non-fatal if the API route isn't available in this environment).
    try {
      const consoleTimeoutMs = getTimeoutMs(process.env.BUILD_INTEGRATION_CONSOLE_TIMEOUT_MS, 20_000, {
        min: 3_000,
        max: 120_000,
      });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), consoleTimeoutMs);

      try {
        const res = await fetch(`${baseUrl}/api/run-tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testType: 'console', sandboxId }),
          signal: controller.signal,
        });

        if (!res.ok) return;

        const json = await res.json().catch(() => null);
        const consoleResult = json?.tests?.console;
        if (consoleResult && consoleResult.success === false) {
          throw new Error(`Console check failed (${consoleResult.errorCount || 0} issue(s))`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      // ignore
    }
  }

  private propagateBlockedTickets(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    const byId = new Map(run.tickets.map(t => [t.id, t] as const));

    for (const t of run.tickets) {
      if (t.status !== 'backlog' && t.status !== 'rebasing') continue;
      const deps = Array.isArray(t.dependencies) ? t.dependencies : [];
      if (deps.length === 0) continue;

      const blocker = deps
        .map(id => byId.get(id))
        .find(dep => dep && (dep.status === 'failed' || dep.status === 'blocked' || dep.status === 'skipped' || dep.status === 'awaiting_input'));

      if (!blocker) continue;

      const msg = `Blocked by dependency: ${blocker.title} (${blocker.status})`;
      this.updateTicketStatus(runId, t.id, 'blocked', undefined, msg);
    }
  }
}

type Worker =
  | { kind: 'integration'; sandboxId: string; provider: null }
  | { kind: 'worker'; sandboxId: string; provider: SandboxProvider };

function isInfraRecoverableError(e: any): boolean {
  const msg = (e?.message || String(e || '')).toLowerCase();
  return (
    msg.includes('no sandbox provider') ||
    msg.includes('sandbox_stopped') ||
    msg.includes('status code 410') ||
    msg.includes('410') ||
    msg.includes('no active sandbox')
  );
}

async function safeReleaseWorker(runId: string, worker: Worker): Promise<void> {
  if (worker.kind !== 'worker') return;
  try {
    sandboxManager.markInUse(worker.sandboxId, false);
  } catch {
    // ignore
  }
  try {
    const returned = await sandboxManager.returnToPool(worker.sandboxId);
    if (returned) return;
  } catch {
    // ignore
  }
  try {
    await sandboxManager.terminateSandbox(worker.sandboxId);
  } catch {
    // ignore
  }
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

function buildSnapshotConventions(snapshot: Record<string, string>): string {
  const paths = Object.keys(snapshot || {}).filter(Boolean);
  if (paths.length === 0) return '';

  const rootCounts = new Map<string, number>();
  const extCounts = new Map<string, number>();
  const uiPrimitives: string[] = [];
  const entrypoints: string[] = [];

  const entryCandidates = [
    'src/main.jsx',
    'src/main.tsx',
    'src/App.jsx',
    'src/App.tsx',
    'app/layout.tsx',
    'app/page.tsx',
    'index.html',
  ];

  const isComponentLike = (p: string) => /\.(tsx|jsx)$/.test(p);
  const uiPrimitiveRe = /(^|\/)(components\/ui\/|ui\/)[^/]+\.(tsx|jsx|ts|js)$/i;

  for (const p of paths) {
    const root = p.split('/')[0] || '';
    if (root) rootCounts.set(root, (rootCounts.get(root) || 0) + 1);

    const ext = p.includes('.') ? p.slice(p.lastIndexOf('.')) : '';
    if (ext) extCounts.set(ext, (extCounts.get(ext) || 0) + 1);

    if (uiPrimitiveRe.test(p)) uiPrimitives.push(p);
  }

  for (const ep of entryCandidates) {
    if (Object.prototype.hasOwnProperty.call(snapshot, ep)) entrypoints.push(ep);
  }

  const topRoots = Array.from(rootCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);

  const componentExt = (() => {
    const candidates = ['.tsx', '.jsx'] as const;
    const ranked = candidates
      .map(ext => [ext, extCounts.get(ext) || 0] as const)
      .sort((a, b) => b[1] - a[1]);
    const [best, count] = ranked[0] || ['.tsx', 0];
    return count > 0 ? best : '';
  })();

  const uiList = uiPrimitives.sort().slice(0, 20);

  const lines: string[] = [];
  if (topRoots.length > 0) lines.push(`- Root dirs: ${topRoots.join(', ')}`);
  if (entrypoints.length > 0) lines.push(`- Entrypoints: ${entrypoints.join(', ')}`);
  if (componentExt) lines.push(`- Preferred component extension: ${componentExt}`);
  if (uiList.length > 0) {
    lines.push(`- Existing UI primitives (edit these; do not duplicate under new paths/extensions):`);
    for (const p of uiList) lines.push(`  - ${p}`);
  }

  return lines.join('\n');
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

