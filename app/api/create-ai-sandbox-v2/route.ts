import { NextRequest, NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
// SandboxProvider type is used through SandboxFactory
import type { SandboxState } from '@/types/sandbox';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { sandboxCreationLimiter } from '@/lib/rateLimit';
import { getUsageActor } from '@/lib/usage/identity';
import { getUsageSnapshotForActor, startSandboxSessionForActor } from '@/lib/usage/persistence';

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
            'Sandbox provider not configured. Set MODAL_TOKEN_ID/MODAL_TOKEN_SECRET (Modal) or VERCEL_OIDC_TOKEN (or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID).',
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

    let templateTarget: 'vite' | 'next' = 'vite';
    try {
      const body = await request.json();
      if (body?.template === 'next') templateTarget = 'next';
      if (body?.template === 'vite') templateTarget = 'vite';
    } catch {
      // No body provided; default to vite
    }

    // Modal sandboxes currently support the Vite template only.
    if (templateTarget === 'next') {
      console.warn(
        '[create-ai-sandbox-v2] Next template requested, but current sandbox provider only supports Vite. Falling back to Vite.'
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
    let provider = await sandboxManager.getPooledSandbox();
    let sandboxInfo = provider?.getSandboxInfo?.() || null;

    if (provider && sandboxInfo?.sandboxId) {
      console.log(`[create-ai-sandbox-v2] Reused pooled sandbox ${sandboxInfo.sandboxId}`);
    } else {
      provider = SandboxFactory.create();
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