import type { UsageActor } from './identity';
import type { UsageSnapshot } from './usage-manager';
import {
  checkAndConsumeAiGeneration,
  getUsageSnapshot,
  recordSandboxPing,
  startSandboxSession,
  stopSandboxSession,
} from './usage-manager';
import {
  consumeAiGenerationPersistent,
  getUsageSnapshotPersistent,
  recordSandboxPingPersistent,
} from './supabase-store';

export async function getUsageSnapshotForActor(actor: UsageActor): Promise<UsageSnapshot> {
  if (actor.userId) {
    const persisted = await getUsageSnapshotPersistent({ userId: actor.userId, tier: actor.tier });
    if (persisted) return persisted;
  }
  return getUsageSnapshot(actor.key, actor.tier);
}

export async function consumeAiGenerationForActor(
  actor: UsageActor,
  amount: number = 1
): Promise<{ allowed: boolean; snapshot: UsageSnapshot }> {
  if (actor.userId) {
    const persisted = await consumeAiGenerationPersistent({ userId: actor.userId, tier: actor.tier, amount });
    if (persisted) return persisted;
  }
  return checkAndConsumeAiGeneration(actor.key, actor.tier, amount);
}

export async function startSandboxSessionForActor(actor: UsageActor, sandboxId: string) {
  // Persisted accounting is derived from ping deltas; no-op here (kept for symmetry).
  // Still start local session so anon users accumulate time.
  startSandboxSession(actor.key, sandboxId);
}

export async function recordSandboxPingForActor(actor: UsageActor, sandboxId: string): Promise<UsageSnapshot> {
  if (actor.userId) {
    const persisted = await recordSandboxPingPersistent({ userId: actor.userId, tier: actor.tier, sandboxId });
    if (persisted) return persisted;
  }
  return recordSandboxPing(actor.key, actor.tier, sandboxId).snapshot;
}

export async function stopSandboxSessionForActor(actor: UsageActor, sandboxId: string): Promise<UsageSnapshot> {
  // Best-effort: treat stop as a final ping in the persisted path.
  if (actor.userId) {
    const persisted = await recordSandboxPingPersistent({ userId: actor.userId, tier: actor.tier, sandboxId });
    if (persisted) return persisted;
  }
  return stopSandboxSession(actor.key, actor.tier, sandboxId).snapshot;
}

