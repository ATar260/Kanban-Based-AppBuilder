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

    // Rate-limit + usage gate (best-effort; in-memory counters by user/ip)
    const actor = await getUsageActor(request);
    const rl = await sandboxCreationLimiter(request, actor.userId || actor.key);
    if (rl instanceof NextResponse) return rl;

    const usage = await getUsageSnapshotForActor(actor);
    if (usage.exceeded.sandboxMinutes) {
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
    
    // Clean up all existing sandboxes
    console.log('[create-ai-sandbox-v2] Cleaning up existing sandboxes...');
    await sandboxManager.terminateAll();
    
    // Also clean up legacy global state
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to terminate legacy global sandbox:', e);
      }
      global.activeSandboxProvider = null;
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    } else {
      global.existingFiles = new Set<string>();
    }

    // Create new sandbox using factory
    const provider = SandboxFactory.create(undefined, { templateTarget });
    const sandboxInfo = await provider.createSandbox();
    
    if (templateTarget === 'next') {
      console.log('[create-ai-sandbox-v2] Setting up Next.js app...');
      await provider.setupNextApp();
    } else {
      console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
      await provider.setupViteApp();
    }
    
    // Register with sandbox manager
    sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);

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
      message: templateTarget === 'next'
        ? 'Sandbox created and Next.js app initialized'
        : 'Sandbox created and Vite React app initialized'
    });

  } catch (error) {
    console.error('[create-ai-sandbox-v2] Error:', error);
    
    // Clean up on error
    await sandboxManager.terminateAll();
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to terminate sandbox on error:', e);
      }
      global.activeSandboxProvider = null;
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}