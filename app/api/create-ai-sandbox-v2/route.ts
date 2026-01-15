import { NextRequest, NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
// SandboxProvider type is used through SandboxFactory
import type { SandboxState } from '@/types/sandbox';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { sandboxCreationLimiter } from '@/lib/rateLimit';
import { getUsageActor } from '@/lib/usage/identity';
import { getUsageSnapshotForActor, startSandboxSessionForActor } from '@/lib/usage/persistence';
import { E2BProvider } from '@/lib/sandbox/providers/e2b-provider';
import { ModalProvider } from '@/lib/sandbox/providers/modal-provider';
import { VercelProvider } from '@/lib/sandbox/providers/vercel-provider';

// Store active sandbox globally
declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[create-ai-sandbox-v2] Creating sandbox...');

    // Fail fast if the sandbox provider is not configured.
    // This avoids consuming rate-limit / usage quota for a request that can never succeed.
    if (!SandboxFactory.isProviderAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Sandbox provider not configured. Set E2B_API_KEY (E2B), MODAL_TOKEN_ID/MODAL_TOKEN_SECRET (Modal), or VERCEL_OIDC_TOKEN (or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID).',
          code: 'SANDBOX_PROVIDER_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    // Rate-limit + usage gate (best-effort; in-memory counters by user/ip)
    const actor = await getUsageActor(request);
    const rl = await sandboxCreationLimiter(request, actor.userId || actor.key);
    if (rl instanceof NextResponse) return rl;

    const usage = await getUsageSnapshotForActor(actor);
    const disableSandboxUsageLimit =
      process.env.USAGE_DISABLE_SANDBOX_LIMIT === 'true' || process.env.USAGE_DISABLE_LIMITS === 'true';
    if (!disableSandboxUsageLimit && usage.exceeded.sandboxMinutes) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sandbox time usage limit reached for this month. Upgrade to continue.',
          code: 'USAGE_LIMIT_REACHED',
          usage,
          upgradeUrl: '/pricing',
        },
        { status: 402 }
      );
    }

    const body = await (async () => {
      try {
        return await request.json();
      } catch {
        return null;
      }
    })();

    let templateTarget: 'vite' | 'next' = 'vite';
    if (body?.template === 'next') templateTarget = 'next';
    if (body?.template === 'vite') templateTarget = 'vite';

    let requestedProvider: 'auto' | 'e2b' | 'modal' | 'vercel' = (() => {
      const raw = String(body?.provider ?? body?.sandboxProvider ?? '').trim().toLowerCase();
      if (raw === 'e2b') return 'e2b';
      if (raw === 'modal') return 'modal';
      if (raw === 'vercel') return 'vercel';
      return 'auto';
    })();

    // Force E2B in production if configured via SANDBOX_PROVIDER=e2b
    if (process.env.NODE_ENV === 'production' && SandboxFactory.getPreferredProvider() === 'e2b') {
      if (requestedProvider !== 'e2b') {
        console.log(
          `[create-ai-sandbox-v2] Forcing E2B in production (ignoring requested provider: ${requestedProvider})`
        );
      }
      requestedProvider = 'e2b';
    }

    // If the UI explicitly requests a provider, fail fast if it isn't configured.
    if (requestedProvider === 'e2b' && !SandboxFactory.isE2BAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'E2B sandbox provider not configured. Set E2B_API_KEY (and optionally E2B_TEMPLATE_ID).',
          code: 'SANDBOX_PROVIDER_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }
    if (requestedProvider === 'modal' && !SandboxFactory.isModalAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Modal sandbox provider not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET.',
          code: 'SANDBOX_PROVIDER_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }
    if (requestedProvider === 'vercel' && !SandboxFactory.isVercelAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Vercel sandbox provider not configured. Set VERCEL_OIDC_TOKEN (or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID).',
          code: 'SANDBOX_PROVIDER_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    // Sandboxes currently support the Vite template only.
    if (templateTarget === 'next') {
      console.warn(
        '[create-ai-sandbox-v2] Next template requested, but sandboxes currently support Vite only. Falling back to Vite.'
      );
      templateTarget = 'vite';
    }
    
    // Clean up the previously active sandbox only (do not terminate all sandboxes).
    // This enables a bounded pool of warm sandboxes for faster startup and supports multi-sandbox workflows.
    console.log('[create-ai-sandbox-v2] Cleaning up previous active sandbox (if any)...');
    try {
      const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
      const activeId = activeProvider?.getSandboxInfo?.()?.sandboxId || global.sandboxData?.sandboxId;
      if (activeId) {
        await sandboxManager.terminateSandbox(activeId);
      } else if (activeProvider) {
        await activeProvider.terminate();
      }
    } catch (e) {
      console.warn('[create-ai-sandbox-v2] Failed to terminate previous active sandbox (non-fatal):', e);
    } finally {
      sandboxManager.clearActiveProvider();
      global.activeSandboxProvider = null;
      global.sandboxData = null;
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    } else {
      global.existingFiles = new Set<string>();
    }

    // Create new sandbox using factory (prefer pooled warm sandbox when enabled)
    let provider = requestedProvider === 'auto' ? await sandboxManager.getPooledSandbox() : null;
    let sandboxInfo = provider?.getSandboxInfo?.() || null;

    if (provider && sandboxInfo?.sandboxId) {
      console.log(`[create-ai-sandbox-v2] Reused pooled sandbox ${sandboxInfo.sandboxId}`);
    } else {
      if (requestedProvider === 'e2b') {
        console.log('[create-ai-sandbox-v2] Creating E2B sandbox (UI override)');
        provider = new E2BProvider({});
      } else if (requestedProvider === 'modal') {
        console.log('[create-ai-sandbox-v2] Creating Modal sandbox (UI override)');
        provider = new ModalProvider({});
      } else if (requestedProvider === 'vercel') {
        console.log('[create-ai-sandbox-v2] Creating Vercel sandbox (UI override)');
        provider = new VercelProvider({});
      } else {
        provider = SandboxFactory.create();
      }
      sandboxInfo = await provider.createSandbox();

      console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
      await provider.setupViteApp();
    }

    // Annotate info for the UI (provider may not set these fields)
    (sandboxInfo as any).templateTarget = templateTarget;
    if (!(sandboxInfo as any).devPort) (sandboxInfo as any).devPort = 5173;
    
    // Register with sandbox manager (active)
    sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider, { setActive: true });

    // Start tracking sandbox time for this user/ip (best-effort)
    try {
      await startSandboxSessionForActor(actor, sandboxInfo.sandboxId);
    } catch (e) {
      console.warn('[create-ai-sandbox-v2] Failed to start usage tracking session:', e);
    }
    
    // Also store in legacy global state for backward compatibility
    global.activeSandboxProvider = provider;
    global.sandboxData = {
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      templateTarget,
      devPort: sandboxInfo.devPort
    };
    
    // Initialize sandbox state
    global.sandboxState = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId: sandboxInfo.sandboxId,
        templateTarget
      },
      sandbox: provider, // Store the provider instead of raw sandbox
      sandboxData: {
        sandboxId: sandboxInfo.sandboxId,
        url: sandboxInfo.url,
        templateTarget,
        devPort: sandboxInfo.devPort
      }
    };
    
    console.log('[create-ai-sandbox-v2] Sandbox ready at:', sandboxInfo.url);
    
    return NextResponse.json({
      success: true,
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
      templateTarget,
      devPort: sandboxInfo.devPort,
      message: 'Sandbox created and Vite React app initialized'
    });

  } catch (error: any) {
    console.error('[create-ai-sandbox-v2] Error:', error);
    
    // Clean up on error (best-effort)
    try {
      const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
      const activeId = activeProvider?.getSandboxInfo?.()?.sandboxId || global.sandboxData?.sandboxId;
      if (activeId) {
        await sandboxManager.terminateSandbox(activeId);
      } else if (activeProvider) {
        await activeProvider.terminate();
      }
    } catch (e) {
      console.warn('[create-ai-sandbox-v2] Failed to terminate sandbox on error (non-fatal):', e);
    } finally {
      sandboxManager.clearActiveProvider();
      global.activeSandboxProvider = null;
      global.sandboxData = null;
    }
    
    // Surface upstream provider status codes (e.g., Vercel 402/429) instead of always returning 500.
    const upstreamStatus = Number(error?.response?.status);
    if (Number.isFinite(upstreamStatus) && upstreamStatus >= 400 && upstreamStatus < 600) {
      let retryAfter: number | undefined;
      try {
        const ra = Number(error?.response?.headers?.get?.('Retry-After'));
        if (Number.isFinite(ra) && ra > 0) retryAfter = Math.floor(ra);
      } catch {
        // ignore
      }

      const code =
        upstreamStatus === 402
          ? 'PAYMENT_REQUIRED'
          : upstreamStatus === 429
            ? 'UPSTREAM_RATE_LIMITED'
            : 'SANDBOX_PROVIDER_ERROR';

      const message =
        upstreamStatus === 402
          ? 'Sandbox provider returned Payment Required (402). Check Vercel billing/spend limits and sandbox entitlement.'
          : upstreamStatus === 429
            ? 'Sandbox provider rate-limited the request. Please retry shortly.'
            : (error?.message || 'Failed to create sandbox');

      return NextResponse.json(
        {
          success: false,
          error: message,
          code,
          retryAfter,
        },
        { status: upstreamStatus }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        code: 'SANDBOX_CREATE_FAILED',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}