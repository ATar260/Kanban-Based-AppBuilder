import { NextRequest, NextResponse } from 'next/server';
import { SandboxProvider } from '@/lib/sandbox/types';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

// Get active sandbox provider from global state
declare global {
  var activeSandboxProvider: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const command = String(body?.command || '').trim();
    const requestedSandboxId = String(body?.sandboxId || body?.sandbox || '').trim();
    
    if (!command) {
      return NextResponse.json({ 
        success: false, 
        error: 'Command is required' 
      }, { status: 400 });
    }
    
    // Get provider from sandbox manager or global state
    const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    const provider = requestedSandboxId
      ? sandboxManager.getProvider(requestedSandboxId) ||
        (activeProvider?.getSandboxInfo?.()?.sandboxId === requestedSandboxId ? activeProvider : null) ||
        (await sandboxManager.getOrCreateProvider(requestedSandboxId).catch(() => null))
      : activeProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: requestedSandboxId ? `No sandbox provider for sandboxId: ${requestedSandboxId}` : 'No active sandbox',
      }, { status: requestedSandboxId ? 404 : 400 });
    }
    
    console.log(`[run-command-v2] Executing: ${command}`);
    
    const result = await provider.runCommand(command);
    
    return NextResponse.json({
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      message: result.success ? 'Command executed successfully' : 'Command failed'
    });
    
  } catch (error) {
    console.error('[run-command-v2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}