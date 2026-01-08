import { getUsageLimits, type UsageTier } from './limits';

export type UsageFeature = 'ai_generation' | 'sandbox_time';

export interface UsageSnapshot {
  period: string; // YYYY-MM
  tier: UsageTier;
  limits: ReturnType<typeof getUsageLimits>;
  used: {
    aiGenerations: number;
    sandboxMinutes: number;
  };
  remaining: {
    aiGenerations: number | null;
    sandboxMinutes: number | null;
  };
  exceeded: {
    aiGenerations: boolean;
    sandboxMinutes: boolean;
  };
  updatedAtMs: number;
}

interface UsageCounters {
  period: string; // YYYY-MM
  aiGenerations: number;
  sandboxSeconds: number;
  updatedAtMs: number;
}

interface SandboxSession {
  sandboxId: string;
  startedAtMs: number;
  lastPingAtMs: number;
}

const countersByKey = new Map<string, UsageCounters>();
const sandboxSessionsByKey = new Map<string, Map<string, SandboxSession>>();

const MAX_PING_DELTA_MS = 5 * 60 * 1000; // cap delta per ping to avoid huge jumps after long gaps
const MAX_ENTRIES = 5000;

function getPeriod(nowMs: number): string {
  // ISO month, e.g. "2026-01"
  return new Date(nowMs).toISOString().slice(0, 7);
}

function clampMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms, MAX_PING_DELTA_MS);
}

function getOrInitCounters(key: string, nowMs: number): UsageCounters {
  const period = getPeriod(nowMs);
  const existing = countersByKey.get(key);

  if (!existing || existing.period !== period) {
    const fresh: UsageCounters = {
      period,
      aiGenerations: 0,
      sandboxSeconds: 0,
      updatedAtMs: nowMs,
    };
    countersByKey.set(key, fresh);
    sandboxSessionsByKey.set(key, new Map());
    return fresh;
  }

  existing.updatedAtMs = nowMs;
  return existing;
}

function computeSnapshot(key: string, tier: UsageTier, nowMs: number): UsageSnapshot {
  const c = getOrInitCounters(key, nowMs);
  const limits = getUsageLimits(tier);

  const usedSandboxMinutes = Math.ceil(c.sandboxSeconds / 60);
  const aiLimit = limits.aiGenerationsPerMonth;
  const sandboxLimit = limits.sandboxMinutesPerMonth;

  const aiRemaining = aiLimit === null ? null : Math.max(0, aiLimit - c.aiGenerations);
  const sandboxRemaining = sandboxLimit === null ? null : Math.max(0, sandboxLimit - usedSandboxMinutes);

  const aiExceeded = aiLimit !== null && c.aiGenerations >= aiLimit;
  const sandboxExceeded = sandboxLimit !== null && usedSandboxMinutes >= sandboxLimit;

  return {
    period: c.period,
    tier,
    limits,
    used: {
      aiGenerations: c.aiGenerations,
      sandboxMinutes: usedSandboxMinutes,
    },
    remaining: {
      aiGenerations: aiRemaining,
      sandboxMinutes: sandboxRemaining,
    },
    exceeded: {
      aiGenerations: aiExceeded,
      sandboxMinutes: sandboxExceeded,
    },
    updatedAtMs: c.updatedAtMs,
  };
}

function enforceMaxEntries() {
  if (countersByKey.size <= MAX_ENTRIES) return;
  // Evict oldest entries by updatedAtMs
  const entries = Array.from(countersByKey.entries());
  entries.sort((a, b) => a[1].updatedAtMs - b[1].updatedAtMs);
  const toRemove = Math.ceil(entries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    const key = entries[i]?.[0];
    if (key) {
      countersByKey.delete(key);
      sandboxSessionsByKey.delete(key);
    }
  }
}

export function getUsageSnapshot(key: string, tier: UsageTier, nowMs: number = Date.now()): UsageSnapshot {
  enforceMaxEntries();
  return computeSnapshot(key, tier, nowMs);
}

export function checkAndConsumeAiGeneration(
  key: string,
  tier: UsageTier,
  amount: number = 1,
  nowMs: number = Date.now()
): { allowed: boolean; snapshot: UsageSnapshot } {
  const c = getOrInitCounters(key, nowMs);
  const limits = getUsageLimits(tier);

  const next = c.aiGenerations + Math.max(0, Math.floor(amount));
  if (limits.aiGenerationsPerMonth !== null && next > limits.aiGenerationsPerMonth) {
    return { allowed: false, snapshot: computeSnapshot(key, tier, nowMs) };
  }

  c.aiGenerations = next;
  c.updatedAtMs = nowMs;
  enforceMaxEntries();
  return { allowed: true, snapshot: computeSnapshot(key, tier, nowMs) };
}

export function startSandboxSession(key: string, sandboxId: string, nowMs: number = Date.now()) {
  if (!sandboxId) return;
  const c = getOrInitCounters(key, nowMs);
  void c;

  let sessions = sandboxSessionsByKey.get(key);
  if (!sessions) {
    sessions = new Map();
    sandboxSessionsByKey.set(key, sessions);
  }

  if (!sessions.has(sandboxId)) {
    sessions.set(sandboxId, { sandboxId, startedAtMs: nowMs, lastPingAtMs: nowMs });
  }
  enforceMaxEntries();
}

export function recordSandboxPing(
  key: string,
  tier: UsageTier,
  sandboxId: string,
  nowMs: number = Date.now()
): { snapshot: UsageSnapshot } {
  const c = getOrInitCounters(key, nowMs);

  let sessions = sandboxSessionsByKey.get(key);
  if (!sessions) {
    sessions = new Map();
    sandboxSessionsByKey.set(key, sessions);
  }

  const existing = sessions.get(sandboxId);
  if (!existing) {
    sessions.set(sandboxId, { sandboxId, startedAtMs: nowMs, lastPingAtMs: nowMs });
    return { snapshot: computeSnapshot(key, tier, nowMs) };
  }

  const deltaMs = clampMs(nowMs - existing.lastPingAtMs);
  if (deltaMs > 0) {
    c.sandboxSeconds += Math.floor(deltaMs / 1000);
  }
  existing.lastPingAtMs = nowMs;
  c.updatedAtMs = nowMs;

  enforceMaxEntries();
  return { snapshot: computeSnapshot(key, tier, nowMs) };
}

export function stopSandboxSession(
  key: string,
  tier: UsageTier,
  sandboxId: string,
  nowMs: number = Date.now()
): { snapshot: UsageSnapshot } {
  const c = getOrInitCounters(key, nowMs);

  const sessions = sandboxSessionsByKey.get(key);
  const existing = sessions?.get(sandboxId);
  if (existing) {
    const deltaMs = clampMs(nowMs - existing.lastPingAtMs);
    if (deltaMs > 0) {
      c.sandboxSeconds += Math.floor(deltaMs / 1000);
    }
    sessions?.delete(sandboxId);
  }

  c.updatedAtMs = nowMs;
  enforceMaxEntries();
  return { snapshot: computeSnapshot(key, tier, nowMs) };
}

