import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
  var lastViteRestartTime: number;
  var viteRestartInProgress: boolean;
  var lastViteRestartTimeBySandbox: Record<string, number> | undefined;
  var viteRestartInProgressBySandbox: Record<string, boolean> | undefined;
}

const RESTART_COOLDOWN_MS = 5000; // 5 second cooldown between restarts

export async function POST(request: NextRequest) {
  let sandboxKeyForError = 'active';
  try {
    const body = await request.json().catch(() => null);
    const requestedSandboxId = typeof body?.sandboxId === 'string' ? body.sandboxId.trim() : '';

    const activeProvider =
      sandboxManager.getActiveProvider() || global.activeSandbox || global.activeSandboxProvider;

    const provider = requestedSandboxId
      ? sandboxManager.getProvider(requestedSandboxId) ||
        (activeProvider?.getSandboxInfo?.()?.sandboxId === requestedSandboxId ? activeProvider : null) ||
        (await sandboxManager.getOrCreateProvider(requestedSandboxId))
      : activeProvider;

    if (!provider || !provider.getSandboxInfo?.()) {
      return NextResponse.json({
        success: false,
        error: requestedSandboxId ? `No sandbox provider for sandboxId: ${requestedSandboxId}` : 'No active sandbox'
      }, { status: requestedSandboxId ? 404 : 400 });
    }

    const sandboxKey = requestedSandboxId || provider.getSandboxInfo?.()?.sandboxId || 'active';
    sandboxKeyForError = sandboxKey;
    if (!global.lastViteRestartTimeBySandbox) global.lastViteRestartTimeBySandbox = {};
    if (!global.viteRestartInProgressBySandbox) global.viteRestartInProgressBySandbox = {};

    // Check if restart is already in progress
    if (global.viteRestartInProgressBySandbox[sandboxKey]) {
      console.log('[restart-vite] Vite restart already in progress, skipping...');
      return NextResponse.json({
        success: true,
        message: 'Vite restart already in progress'
      });
    }

    // Check cooldown
    const now = Date.now();
    const lastRestartAt = global.lastViteRestartTimeBySandbox[sandboxKey] || 0;
    if (lastRestartAt && (now - lastRestartAt) < RESTART_COOLDOWN_MS) {
      const remainingTime = Math.ceil((RESTART_COOLDOWN_MS - (now - lastRestartAt)) / 1000);
      console.log(`[restart-vite] Cooldown active, ${remainingTime}s remaining`);
      return NextResponse.json({
        success: true,
        message: `Vite was recently restarted, cooldown active (${remainingTime}s remaining)`
      });
    }

    // Set the restart flag
    global.viteRestartInProgressBySandbox[sandboxKey] = true;

    console.log('[restart-vite] Using provider method to restart Vite...');

    // Use the provider's restartViteServer method if available
    if (typeof provider.restartViteServer === 'function') {
      await provider.restartViteServer();
      console.log('[restart-vite] Vite restarted via provider method');
    } else {
      // Fallback to manual restart using provider's runCommand
      console.log('[restart-vite] Fallback to manual Vite restart...');

      // Kill existing Vite processes
      try {
        await provider.runCommand('pkill -f vite');
        console.log('[restart-vite] Killed existing Vite processes');

        // Wait a moment for processes to terminate
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (killError) {
        console.log('[restart-vite] No existing Vite processes found or kill failed:', killError);
      }

      // Clear any error tracking files
      try {
        await provider.runCommand('bash -c "echo \'{\\"errors\\": [], \\"lastChecked\\": ' + Date.now() + '}\' > /tmp/vite-errors.json"');
      } catch (clearError) {
        console.debug('[restart-vite] Failed to clear error tracking file:', clearError);
      }

      // Start Vite dev server in background
      await provider.runCommand('sh -c "nohup npm run dev > /tmp/vite.log 2>&1 &"');
      console.log('[restart-vite] Vite dev server restarted');

      // Wait for Vite to start up
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Update global state
    global.lastViteRestartTimeBySandbox[sandboxKey] = Date.now();
    global.viteRestartInProgressBySandbox[sandboxKey] = false;

    return NextResponse.json({
      success: true,
      message: 'Vite restarted successfully'
    });

  } catch (error) {
    console.error('[restart-vite] Error:', error);

    // Clear the restart flag on error
    if (!global.viteRestartInProgressBySandbox) global.viteRestartInProgressBySandbox = {};
    global.viteRestartInProgressBySandbox[sandboxKeyForError] = false;

    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}