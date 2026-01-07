import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

type TemplateTarget = 'vite' | 'next';

interface ApplySandboxEnvRequest {
  sandboxId: string;
  template: TemplateTarget;
  userInputs: Record<string, string>;
}

function sanitizeEnvValue(value: string): string {
  return String(value ?? '').replace(/\r?\n/g, '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ApplySandboxEnvRequest | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const sandboxId = typeof body.sandboxId === 'string' ? body.sandboxId.trim() : '';
    const template = body.template;
    const userInputs = body.userInputs && typeof body.userInputs === 'object' ? body.userInputs : {};

    if (!sandboxId) {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }
    if (template !== 'vite' && template !== 'next') {
      return NextResponse.json({ success: false, error: 'template must be vite or next' }, { status: 400 });
    }

    // Currently only supports Supabase credentials. These are stored as ticket userInputs.
    const supabaseUrl = typeof userInputs.supabase_url === 'string' ? sanitizeEnvValue(userInputs.supabase_url) : '';
    const supabaseAnonKey =
      typeof userInputs.supabase_anon_key === 'string' ? sanitizeEnvValue(userInputs.supabase_anon_key) : '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'supabase_url and supabase_anon_key are required' },
        { status: 400 }
      );
    }

    // Prefer an already-registered provider for this sandboxId. If not present,
    // fall back to the legacy global provider *only if it matches the sandboxId*.
    // Note: `getOrCreateProvider` may return a fresh (unconnected) provider for some
    // providers (e.g., Vercel), so it must be the last resort.
    const legacyProvider = (global as any).activeSandboxProvider;
    const legacyMatches =
      legacyProvider &&
      typeof legacyProvider.getSandboxInfo === 'function' &&
      legacyProvider.getSandboxInfo()?.sandboxId === sandboxId;

    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (legacyMatches ? legacyProvider : null) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider) {
      return NextResponse.json({ success: false, error: 'No sandbox provider available' }, { status: 400 });
    }
    if (typeof provider.getSandboxInfo === 'function' && !provider.getSandboxInfo()) {
      return NextResponse.json(
        { success: false, error: 'Sandbox is not active. Create a sandbox before applying env vars.' },
        { status: 400 }
      );
    }

    const envLines =
      template === 'vite'
        ? [`VITE_SUPABASE_URL=${supabaseUrl}`, `VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}`]
        : [`NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}`];

    // Do NOT log env file contents (may include sensitive values).
    await provider.writeFile('.env.local', `${envLines.join('\n')}\n`);

    let restarted = false;
    try {
      if (template === 'vite' && typeof provider.restartViteServer === 'function') {
        await provider.restartViteServer();
        restarted = true;
      } else if (template === 'next' && typeof provider.restartNextServer === 'function') {
        await provider.restartNextServer();
        restarted = true;
      }
    } catch (e) {
      // Return success but note that restart failed; caller can decide whether to continue.
      return NextResponse.json({
        success: true,
        restarted: false,
        warning: (e as Error).message,
      });
    }

    return NextResponse.json({ success: true, restarted });
  } catch (error) {
    console.error('[apply-sandbox-env] Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}


