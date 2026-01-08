import { getUsageLimits, type UsageTier } from './limits';
import type { UsageSnapshot } from './usage-manager';

export function computeUsageSnapshotFromTotals(args: {
  tier: UsageTier;
  period: string;
  aiGenerations: number;
  sandboxSeconds: number;
  updatedAtMs: number;
}): UsageSnapshot {
  const limits = getUsageLimits(args.tier);

  const usedSandboxMinutes = Math.ceil(Math.max(0, args.sandboxSeconds) / 60);

  const aiLimit = limits.aiGenerationsPerMonth;
  const sandboxLimit = limits.sandboxMinutesPerMonth;

  const aiRemaining = aiLimit === null ? null : Math.max(0, aiLimit - Math.max(0, args.aiGenerations));
  const sandboxRemaining = sandboxLimit === null ? null : Math.max(0, sandboxLimit - usedSandboxMinutes);

  const aiExceeded = aiLimit !== null && Math.max(0, args.aiGenerations) >= aiLimit;
  const sandboxExceeded = sandboxLimit !== null && usedSandboxMinutes >= sandboxLimit;

  return {
    period: args.period,
    tier: args.tier,
    limits,
    used: {
      aiGenerations: Math.max(0, args.aiGenerations),
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
    updatedAtMs: args.updatedAtMs,
  };
}

