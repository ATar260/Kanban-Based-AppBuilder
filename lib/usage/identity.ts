import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { UsageTier } from './limits';

export interface UsageActor {
  key: string; // stable key for tracking (user:<id> or ip:<ip>)
  userId: string | null;
  ip: string;
  tier: UsageTier;
  isAuthenticated: boolean;
}

function normalizeTier(value: unknown): UsageTier | null {
  if (value === 'free' || value === 'pro' || value === 'enterprise') return value;
  return null;
}

function getIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'anonymous';
}

export async function getUsageActor(request: NextRequest): Promise<UsageActor> {
  const ip = getIp(request);

  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    userId = (session as any)?.user?.id || null;
  } catch {
    userId = null;
  }

  const forcedTier = normalizeTier(process.env.USAGE_FORCE_TIER);
  const defaultTier = normalizeTier(process.env.USAGE_DEFAULT_TIER) || 'free';
  const anonTier = normalizeTier(process.env.USAGE_ANON_TIER) || defaultTier;

  const tier = forcedTier || (userId ? defaultTier : anonTier);
  const key = userId ? `user:${userId}` : `ip:${ip}`;

  return {
    key,
    userId,
    ip,
    tier,
    isAuthenticated: Boolean(userId),
  };
}

