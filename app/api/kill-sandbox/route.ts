import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getUsageActor } from '@/lib/usage/identity';
import { stopSandboxSessionForActor } from '@/lib/usage/persistence';
import type { UsageSnapshot } from '@/lib/usage/usage-manager';

declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[kill-sandbox] Stopping active sandbox...');

    const actor = await getUsageActor(request);

    let sandboxKilled = false;
    const killedSandboxIds: string[] = [];
    let usageSnapshot: UsageSnapshot | null = null;

    // Optional: allow callers to target a specific sandboxId (best-effort).
    let requestedSandboxId: string | null = null;
    let reason: string | null = null;
    try {
      const body: any = await request.json().catch(() => null);
      if (body && typeof body === 'object') {
        if (typeof body.sandboxId === 'string') requestedSandboxId = body.sandboxId.trim();
        if (typeof body.reason === 'string') reason = body.reason.trim();
      }
    } catch {
      // ignore
    }

    // Stop existing sandbox if any
    // Prefer sandbox-manager (tracks providers by sandboxId)
    if (requestedSandboxId) {
      try {
        await sandboxManager.terminateSandbox(requestedSandboxId);
        sandboxKilled = true;
        killedSandboxIds.push(requestedSandboxId);
      } catch (e) {
        console.error('[kill-sandbox] Failed to terminate sandbox via sandboxManager:', e);
      }
    } else {
      // Terminate the currently active sandbox if present
      const activeProvider = sandboxManager.getActiveProvider();
      const activeId = activeProvider?.getSandboxInfo?.()?.sandboxId || global.sandboxData?.sandboxId;
      if (activeId) {
        try {
          await sandboxManager.terminateSandbox(activeId);
          sandboxKilled = true;
          killedSandboxIds.push(activeId);
          console.log('[kill-sandbox] Sandbox terminated via sandboxManager:', activeId);
        } catch (e) {
          console.error('[kill-sandbox] Failed to terminate active sandbox via sandboxManager:', e);
        }
      }
    }

    // Legacy global fallback (covers sandboxes created outside sandbox-manager tracking)
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
        sandboxKilled = true;
        console.log('[kill-sandbox] Sandbox stopped successfully');
        const legacyId = global.activeSandboxProvider?.getSandboxInfo?.()?.sandboxId || global.sandboxData?.sandboxId;
        if (legacyId && !killedSandboxIds.includes(legacyId)) {
          killedSandboxIds.push(legacyId);
        }
      } catch (e) {
        console.error('[kill-sandbox] Failed to stop sandbox:', e);
      }
      global.activeSandboxProvider = null;
      global.sandboxData = null;
    }

    // Ensure sandbox-manager active reference is cleared (in case globals were used)
    sandboxManager.clearActiveProvider();

    // Finalize sandbox time accounting (best-effort)
    for (const id of killedSandboxIds) {
      try {
        usageSnapshot = await stopSandboxSessionForActor(actor, id);
      } catch (e) {
        console.warn('[kill-sandbox] Failed to finalize usage session (non-fatal):', e);
      }
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    }
    
    return NextResponse.json({
      success: true,
      sandboxKilled,
      killedSandboxIds,
      usage: usageSnapshot,
      reason,
      message: 'Sandbox cleaned up successfully'
    });
    
  } catch (error) {
    console.error('[kill-sandbox] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
}