import { NextRequest, NextResponse } from 'next/server';
import { SandboxProvider } from '@/lib/sandbox/types';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

declare global {
  var activeSandboxProvider: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const packages = body?.packages;
    const requestedSandboxId = String(body?.sandboxId || body?.sandbox || '').trim();
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Packages array is required' 
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
    
    console.log(`[install-packages-v2] Installing: ${packages.join(', ')}`);
    
    const result = await provider.installPackages(packages);
    
    return NextResponse.json({
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      message: result.success ? 'Packages installed successfully' : 'Package installation failed'
    });
    
  } catch (error) {
    console.error('[install-packages-v2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}