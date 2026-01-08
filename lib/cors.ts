import type { NextRequest } from 'next/server';

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  const fromEnv = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const inferred: string[] = [];
  if (process.env.NEXTAUTH_URL) inferred.push(process.env.NEXTAUTH_URL);
  if (process.env.VERCEL_URL) inferred.push(`https://${process.env.VERCEL_URL}`);

  // Local dev convenience
  inferred.push('http://localhost:3000', 'http://127.0.0.1:3000');

  return Array.from(new Set([...fromEnv, ...inferred]));
}

function isSameOrigin(origin: string, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

export function getCorsHeaders(
  request: NextRequest,
  opts?: {
    methods?: string;
    headers?: string;
    credentials?: boolean;
  }
): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin) return {};

  const allowed = parseAllowedOrigins();
  const host = request.headers.get('host');

  const isAllowed = allowed.includes(origin) || isSameOrigin(origin, host);
  if (!isAllowed) return {};

  const out: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': opts?.methods || 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': opts?.headers || 'Content-Type, Authorization',
  };

  if (opts?.credentials) {
    out['Access-Control-Allow-Credentials'] = 'true';
  }

  return out;
}

