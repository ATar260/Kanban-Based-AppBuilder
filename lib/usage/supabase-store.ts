import { supabaseAdmin } from '@/lib/supabase';
import { getUsageLimits, type UsageTier } from './limits';
import type { UsageSnapshot } from './usage-manager';
import { computeUsageSnapshotFromTotals } from './usage-utils';

const MAX_PING_DELTA_MS = 5 * 60 * 1000; // cap delta per ping to avoid huge jumps after long gaps

function getPeriod(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 7);
}

function isUsagePersistenceEnabled(): boolean {
  // Require service role so we can read/write regardless of RLS, and keep the table private.
  return Boolean(supabaseAdmin && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function clampMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms, MAX_PING_DELTA_MS);
}

type UsageMonthlyRow = {
  id: string;
  user_id: string;
  period: string;
  ai_generations: number;
  sandbox_seconds: number;
  last_sandbox_ping_at: string | null;
  last_sandbox_id: string | null;
  created_at: string;
  updated_at: string;
};

async function getMonthlyRow(userId: string, period: string): Promise<UsageMonthlyRow | null> {
  if (!isUsagePersistenceEnabled()) return null;

  const { data, error } = await (supabaseAdmin as any)
    .from('usage_monthly')
    .select(
      'id, user_id, period, ai_generations, sandbox_seconds, last_sandbox_ping_at, last_sandbox_id, created_at, updated_at'
    )
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle();

  if (error) {
    // Common case: table missing (dev). Fall back to in-memory.
    console.warn('[usage][supabase] Failed to read usage_monthly:', error?.message || error);
    return null;
  }

  return (data as UsageMonthlyRow) || null;
}

async function ensureMonthlyRow(userId: string, period: string, nowIso: string): Promise<UsageMonthlyRow | null> {
  if (!isUsagePersistenceEnabled()) return null;

  const existing = await getMonthlyRow(userId, period);
  if (existing) return existing;

  // Try to insert; if a race happens, fall back to select.
  const { data, error } = await (supabaseAdmin as any)
    .from('usage_monthly')
    .insert({
      user_id: userId,
      period,
      ai_generations: 0,
      sandbox_seconds: 0,
      last_sandbox_ping_at: null,
      last_sandbox_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(
      'id, user_id, period, ai_generations, sandbox_seconds, last_sandbox_ping_at, last_sandbox_id, created_at, updated_at'
    )
    .single();

  if (error) {
    const fallback = await getMonthlyRow(userId, period);
    return fallback;
  }

  return (data as UsageMonthlyRow) || null;
}

export async function getUsageSnapshotPersistent(args: {
  userId: string;
  tier: UsageTier;
  nowMs?: number;
}): Promise<UsageSnapshot | null> {
  if (!isUsagePersistenceEnabled()) return null;

  const nowMs = args.nowMs ?? Date.now();
  const period = getPeriod(nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const row = await ensureMonthlyRow(args.userId, period, nowIso);
  if (!row) return null;

  return computeUsageSnapshotFromTotals({
    tier: args.tier,
    period: row.period,
    aiGenerations: row.ai_generations || 0,
    sandboxSeconds: row.sandbox_seconds || 0,
    updatedAtMs: nowMs,
  });
}

export async function consumeAiGenerationPersistent(args: {
  userId: string;
  tier: UsageTier;
  amount?: number;
  nowMs?: number;
}): Promise<{ allowed: boolean; snapshot: UsageSnapshot } | null> {
  if (!isUsagePersistenceEnabled()) return null;

  const nowMs = args.nowMs ?? Date.now();
  const period = getPeriod(nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const row = await ensureMonthlyRow(args.userId, period, nowIso);
  if (!row) return null;

  const amount = Math.max(0, Math.floor(args.amount ?? 1));
  const limits = getUsageLimits(args.tier);

  const nextAi = (row.ai_generations || 0) + amount;
  if (limits.aiGenerationsPerMonth !== null && nextAi > limits.aiGenerationsPerMonth) {
    return {
      allowed: false,
      snapshot: computeUsageSnapshotFromTotals({
        tier: args.tier,
        period: row.period,
        aiGenerations: row.ai_generations || 0,
        sandboxSeconds: row.sandbox_seconds || 0,
        updatedAtMs: nowMs,
      }),
    };
  }

  const { error } = await (supabaseAdmin as any)
    .from('usage_monthly')
    .update({
      ai_generations: nextAi,
      updated_at: nowIso,
    })
    .eq('id', row.id);

  if (error) {
    console.warn('[usage][supabase] Failed to update ai_generations:', error?.message || error);
    return null;
  }

  return {
    allowed: true,
    snapshot: computeUsageSnapshotFromTotals({
      tier: args.tier,
      period: row.period,
      aiGenerations: nextAi,
      sandboxSeconds: row.sandbox_seconds || 0,
      updatedAtMs: nowMs,
    }),
  };
}

export async function recordSandboxPingPersistent(args: {
  userId: string;
  tier: UsageTier;
  sandboxId: string;
  nowMs?: number;
}): Promise<UsageSnapshot | null> {
  if (!isUsagePersistenceEnabled()) return null;

  const nowMs = args.nowMs ?? Date.now();
  const period = getPeriod(nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const row = await ensureMonthlyRow(args.userId, period, nowIso);
  if (!row) return null;

  let deltaMs = 0;
  if (row.last_sandbox_ping_at) {
    const last = Date.parse(row.last_sandbox_ping_at);
    if (Number.isFinite(last)) {
      deltaMs = clampMs(nowMs - last);
    }
  }

  const deltaSeconds = Math.floor(deltaMs / 1000);
  const nextSandboxSeconds = (row.sandbox_seconds || 0) + deltaSeconds;

  const { error } = await (supabaseAdmin as any)
    .from('usage_monthly')
    .update({
      sandbox_seconds: nextSandboxSeconds,
      last_sandbox_ping_at: nowIso,
      last_sandbox_id: args.sandboxId,
      updated_at: nowIso,
    })
    .eq('id', row.id);

  if (error) {
    console.warn('[usage][supabase] Failed to update sandbox_seconds:', error?.message || error);
    return null;
  }

  return computeUsageSnapshotFromTotals({
    tier: args.tier,
    period: row.period,
    aiGenerations: row.ai_generations || 0,
    sandboxSeconds: nextSandboxSeconds,
    updatedAtMs: nowMs,
  });
}

