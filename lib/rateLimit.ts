import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  interval: number;
  limit: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function rateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    identifier?: string
  ): Promise<{ success: boolean; remaining: number; reset: number } | NextResponse> {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'anonymous';
    
    const key = identifier ? `${identifier}:${ip}` : ip;
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || record.resetAt < now) {
      record = {
        count: 0,
        resetAt: now + config.interval,
      };
      rateLimitStore.set(key, record);
    }
    
    record.count++;
    
    const remaining = Math.max(0, config.limit - record.count);
    const reset = record.resetAt;
    
    if (record.count > config.limit) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((reset - now) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - now) / 1000).toString(),
          },
        }
      );
    }
    
    return { success: true, remaining, reset };
  };
}

export const aiGenerationLimiter = rateLimit({
  interval: 60 * 1000,
  limit: 10,
});

export const sandboxCreationLimiter = rateLimit({
  interval: 60 * 1000,
  limit: 5,
});

export const githubApiLimiter = rateLimit({
  interval: 60 * 1000,
  limit: 30,
});

export const generalApiLimiter = rateLimit({
  interval: 60 * 1000,
  limit: 100,
});
