export type UsageTier = 'free' | 'pro' | 'enterprise';

export interface UsageLimits {
  aiGenerationsPerMonth: number | null; // null = unlimited
  sandboxMinutesPerMonth: number | null; // null = unlimited
}

export function getUsageLimits(tier: UsageTier): UsageLimits {
  switch (tier) {
    case 'enterprise':
      return {
        aiGenerationsPerMonth: null,
        sandboxMinutesPerMonth: null,
      };
    case 'pro':
      return {
        aiGenerationsPerMonth: 2000,
        sandboxMinutesPerMonth: 2000,
      };
    case 'free':
    default:
      return {
        aiGenerationsPerMonth: 100,
        sandboxMinutesPerMonth: 120,
      };
  }
}

