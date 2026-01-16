import { NextRequest, NextResponse } from 'next/server';
import type { SandboxState } from '@/types/sandbox';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

function extractMissingPackages(text: string): string[] {
  const out = new Set<string>();
  const lines = String(text || '').split('\n');

  for (const line of lines) {
    const l = String(line || '');

    // Vite / Rollup
    let m = l.match(/Failed to resolve import\s+"([^"]+)"/i);
    if (m?.[1]) {
      const imp = m[1];
      if (!imp.startsWith('.') && !imp.startsWith('/')) out.add(imp);
      continue;
    }

    // Node ESM
    m = l.match(/Cannot find package\s+'([^']+)'/i);
    if (m?.[1]) {
      const pkg = m[1];
      if (!pkg.startsWith('.') && !pkg.startsWith('/')) out.add(pkg);
      continue;
    }

    // CommonJS
    m = l.match(/Cannot find module\s+'([^']+)'/i);
    if (m?.[1]) {
      const pkg = m[1];
      if (!pkg.startsWith('.') && !pkg.startsWith('/')) out.add(pkg);
      continue;
    }
  }

  const normalized: string[] = [];
  for (const raw of out) {
    const s = String(raw || '').trim();
    if (!s) continue;
    if (s.startsWith('@')) {
      const parts = s.split('/');
      normalized.push(parts.length >= 2 ? parts.slice(0, 2).join('/') : s);
    } else {
      normalized.push(s.split('/')[0]);
    }
  }

  return Array.from(new Set(normalized)).filter(Boolean).slice(0, 10);
}

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
  var sandboxState: SandboxState;
}

export async function GET(request: NextRequest) {
  try {
    const requestedSandboxId = (() => {
      try {
        const url = new URL(request.url);
        return String(url.searchParams.get('sandboxId') || '').trim();
      } catch {
        return '';
      }
    })();

    const provider: any = requestedSandboxId
      ? sandboxManager.getProvider(requestedSandboxId) ||
        (await sandboxManager.getOrCreateProvider(requestedSandboxId))
      : global.activeSandboxProvider || global.sandboxState?.sandbox || null;

    // Backward compatibility: older code paths may still set activeSandbox directly.
    const legacySandbox: any = global.activeSandbox || null;

    if ((!provider || !provider.getSandboxInfo?.()) && !legacySandbox) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }
    
    console.log('[sandbox-logs] Fetching Vite dev server logs...');
    
    // Check if Vite processes are running
    const psStdout = (() => {
      if (provider) return provider.runCommand('ps aux');
      return legacySandbox.runCommand({ cmd: 'ps', args: ['aux'] });
    })();
    
    let viteRunning = false;
    const logContent: string[] = [];
    
    // Normalize process output for both provider styles
    let psOutput = '';
    try {
      const psResult: any = await psStdout;
      if (provider) {
        psOutput = psResult.stdout || '';
      } else if (typeof psResult.stdout === 'function') {
        psOutput = await psResult.stdout();
      } else {
        psOutput = psResult.stdout || '';
      }
    } catch {
      psOutput = '';
    }

    if (psOutput) {
      const viteProcesses = psOutput.split('\n').filter((line: string) => 
        line.toLowerCase().includes('vite') || 
        line.toLowerCase().includes('npm run dev')
      );
      
      viteRunning = viteProcesses.length > 0;
      
      if (viteRunning) {
        logContent.push("Vite is running");
        logContent.push(...viteProcesses.slice(0, 3)); // Show first 3 processes
      } else {
        logContent.push("Vite process not found");
      }
    }
    
    // Try to read any recent log files
    try {
      const findResult: any = provider
        ? await provider.runCommand('find /tmp -type f')
        : await legacySandbox.runCommand({ cmd: 'find', args: ['/tmp', '-type', 'f'] });
      
      let findOutput = '';
      if (provider) {
        findOutput = findResult.stdout || '';
      } else if (typeof findResult.stdout === 'function') {
        findOutput = await findResult.stdout();
      } else {
        findOutput = findResult.stdout || '';
      }

      if (findOutput) {
        const logFiles = findOutput
          .split('\n')
          .map((f: string) => f.trim())
          .filter((f: string) => f.length > 0)
          .filter((f: string) => f.toLowerCase().includes('vite') || f.toLowerCase().endsWith('.log'));
        
        for (const logFile of logFiles.slice(0, 2)) {
          try {
            const catResult: any = provider
              ? await provider.runCommand(`tail -n 10 ${logFile}`)
              : await legacySandbox.runCommand({ cmd: 'tail', args: ['-n', '10', logFile] });
            
            const catOutput = provider
              ? (catResult.stdout || '')
              : (typeof catResult.stdout === 'function' ? await catResult.stdout() : (catResult.stdout || ''));

            const catExitCode = provider ? (catResult.exitCode ?? (catResult.success ? 0 : 1)) : (catResult.exitCode ?? 1);

            if (catExitCode === 0 && catOutput) {
              logContent.push(`--- ${logFile} ---`);
              logContent.push(catOutput);
            }
          } catch {
            // Skip if can't read log file
          }
        }
      }
    } catch {
      // No log files found, that's OK
    }

    // Auto-fix: if logs show missing packages, install them (E2B only) and restart Vite.
    // This is best-effort and capped to avoid runaway installs.
    const providerInfo = provider?.getSandboxInfo?.();
    const canAutoFix = providerInfo?.provider === 'e2b' && typeof provider?.installPackages === 'function';
    const logsJoined = logContent.join('\n');
    const missingPkgs = extractMissingPackages(logsJoined);

    if (canAutoFix && missingPkgs.length > 0) {
      try {
        const installRes = await provider.installPackages(missingPkgs);
        logContent.push(`Auto-installed missing packages: ${missingPkgs.join(', ')}`);
        if (!installRes?.success) {
          logContent.push(`Auto-install stderr: ${String(installRes?.stderr || '').slice(0, 800)}`);
        } else if (typeof provider.restartViteServer === 'function') {
          await provider.restartViteServer();
          logContent.push('Restarted Vite after auto-install.');
        }
      } catch (e: any) {
        logContent.push(`Auto-install failed: ${String(e?.message || e).slice(0, 400)}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      hasErrors: false,
      logs: logContent,
      status: viteRunning ? 'running' : 'stopped',
      missingPackages: missingPkgs
    });
    
  } catch (error) {
    console.error('[sandbox-logs] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}