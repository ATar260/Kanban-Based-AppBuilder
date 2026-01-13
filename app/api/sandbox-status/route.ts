import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getUsageActor } from '@/lib/usage/identity';
import { recordSandboxPingForActor } from '@/lib/usage/persistence';
import type { UsageSnapshot } from '@/lib/usage/usage-manager';

declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function GET(request: NextRequest) {
  try {
    // Best-effort usage tracking identity (user or IP)
    const actor = await getUsageActor(request);

    const requestedSandboxId = (() => {
      try {
        const url = new URL(request.url);
        return String(url.searchParams.get('sandboxId') || '').trim();
      } catch {
        return '';
      }
    })();

    const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;

    let provider =
      requestedSandboxId
        ? sandboxManager.getProvider(requestedSandboxId) ||
          (activeProvider?.getSandboxInfo?.()?.sandboxId === requestedSandboxId ? activeProvider : null)
        : activeProvider;

    // If the provider isn't registered in this process, attempt a best-effort reconnect by sandboxId.
    if (!provider && requestedSandboxId) {
      try {
        provider = await sandboxManager.getOrCreateProvider(requestedSandboxId);
        if (!provider?.getSandboxInfo?.() || provider.getSandboxInfo()?.sandboxId !== requestedSandboxId) {
          provider = null;
        }
      } catch {
        provider = null;
      }
    }

    const sandboxExists = !!provider;

    // Opportunistic lifecycle cleanup (idle sandboxes + stale prewarmed pool entries).
    // This runs on a hot path (polled by the UI), so it is debounced in the manager.
    try {
      const envIdle = Number(process.env.SANDBOX_IDLE_TTL_MS);
      const idleTtlMs =
        Number.isFinite(envIdle) && envIdle > 0 ? envIdle : 30 * 60 * 1000; // default 30m
      await sandboxManager.cleanup(idleTtlMs);
    } catch (e) {
      console.warn('[sandbox-status] Cleanup failed (non-fatal):', e);
    }

    let sandboxHealthy = false;
    let sandboxInfo = null;
    let sandboxStopped = false;
    let usageSnapshot: UsageSnapshot | null = null;

    if (sandboxExists && provider) {
      try {
        const providerInfo = provider.getSandboxInfo();
        const url = providerInfo?.url || global.sandboxData?.url;

        // Health check: prefer provider-level check (detects SANDBOX_STOPPED), then use URL probe to get status code.
        let healthStatusCode: number | null = null;
        let healthError: string | undefined;

        if (providerInfo && typeof provider.checkHealth === 'function') {
          const healthResult = await provider.checkHealth();
          sandboxHealthy = healthResult.healthy;
          if (!sandboxHealthy && healthResult.error) {
            healthError = healthResult.error;
          }
          sandboxStopped = healthResult.error === 'SANDBOX_STOPPED';
        } else {
          sandboxHealthy = !!providerInfo;
        }

        // Probe sandbox URL to detect stopped sandboxes (410) and surface status code for debugging.
        if (url) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          try {
            const res = await fetch(url, {
              method: 'HEAD',
              cache: 'no-store',
              signal: controller.signal,
            });

            healthStatusCode = res.status;

            if (res.status === 410) {
              sandboxHealthy = false;
              sandboxStopped = true;
              healthError = 'SANDBOX_STOPPED';
            } else {
              sandboxHealthy = res.ok;
              if (!res.ok && !healthError) {
                healthError = `HTTP ${res.status}`;
              }
            }
          } catch (err) {
            sandboxHealthy = false;
            healthError = healthError || (err instanceof Error ? err.message : String(err));
          } finally {
            clearTimeout(timer);
          }
        } else if (!healthError) {
          healthError = 'No sandbox URL available';
        }

        const activeSandboxId = activeProvider?.getSandboxInfo?.()?.sandboxId || null;
        const isActiveSandbox = !requestedSandboxId || (activeSandboxId && requestedSandboxId === activeSandboxId);

        if (sandboxStopped && isActiveSandbox) {
          global.activeSandboxProvider = null;
          global.sandboxData = null;
          sandboxManager.clearActiveProvider();
          sandboxInfo = null;
        } else if (sandboxStopped) {
          // Don't clear the globally active sandbox if the caller is checking a specific sandboxId.
          sandboxInfo = null;
        } else {
          sandboxInfo = {
            sandboxId: providerInfo?.sandboxId || global.sandboxData?.sandboxId,
            url,
            filesTracked: global.existingFiles ? Array.from(global.existingFiles) : [],
            lastHealthCheck: new Date().toISOString(),
            healthStatusCode,
            healthError,
          };

          // Track sandbox time based on pings (best-effort; in-memory counters)
          if (sandboxInfo.sandboxId) {
            try {
              usageSnapshot = await recordSandboxPingForActor(actor, sandboxInfo.sandboxId);
            } catch (e) {
              console.warn('[sandbox-status] Usage tracking ping failed (non-fatal):', e);
            }
          }
        }
      } catch (error: any) {
        console.error('[sandbox-status] Health check failed:', error);
        if (error?.message?.includes('SANDBOX_STOPPED') || error?.message?.includes('410')) {
          sandboxStopped = true;
          const activeSandboxId = activeProvider?.getSandboxInfo?.()?.sandboxId || null;
          const isActiveSandbox = !requestedSandboxId || (activeSandboxId && requestedSandboxId === activeSandboxId);
          if (isActiveSandbox) {
            global.activeSandboxProvider = null;
            global.sandboxData = null;
            sandboxManager.clearActiveProvider();
          }
        }
        sandboxHealthy = false;
      }
    }
    
    return NextResponse.json({
      success: true,
      active: sandboxExists && !sandboxStopped,
      healthy: sandboxHealthy,
      sandboxStopped,
      sandboxData: sandboxInfo,
      usage: usageSnapshot,
      message: sandboxStopped
        ? 'Sandbox has stopped - please create a new one'
        : sandboxHealthy 
          ? 'Sandbox is active and healthy' 
          : sandboxExists 
            ? 'Sandbox exists but is not responding' 
            : 'No active sandbox'
    });
    
  } catch (error) {
    console.error('[sandbox-status] Error:', error);
    return NextResponse.json({ 
      success: false,
      active: false,
      error: (error as Error).message 
    }, { status: 500 });
  }
}