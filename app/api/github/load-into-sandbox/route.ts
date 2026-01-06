import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

function isValidRepoFullName(value: string): boolean {
  // owner/repo (GitHub rules are broader, but keep this tight to prevent injection)
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function isValidBranch(value: string): boolean {
  // allow common branch/tag refs like main, master, feature/foo, v1.2.3
  if (value.length < 1 || value.length > 200) return false;
  if (value.includes('..')) return false;
  if (value.includes('~') || value.includes('^') || value.includes(':') || value.includes('\\')) return false;
  return /^[A-Za-z0-9._/-]+$/.test(value);
}

async function ensureCommandSuccess(
  provider: any,
  command: string,
  opts?: { allowFailure?: boolean }
) {
  const result = await provider.runCommand(command);
  if (opts?.allowFailure) return result;
  if (!result?.success) {
    throw new Error(
      `Command failed: ${command}\n${result?.stderr || result?.stdout || 'Unknown error'}`
    );
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sandboxId = body?.sandboxId as string | undefined;
    const repoFullName = body?.repoFullName as string | undefined;
    const branch = (body?.branch as string | undefined) ?? 'main';

    if (!sandboxId || typeof sandboxId !== 'string') {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }
    if (!repoFullName || typeof repoFullName !== 'string') {
      return NextResponse.json({ success: false, error: 'repoFullName is required' }, { status: 400 });
    }
    if (!isValidRepoFullName(repoFullName)) {
      return NextResponse.json(
        { success: false, error: 'Invalid repoFullName format. Expected owner/repo.' },
        { status: 400 }
      );
    }
    if (!isValidBranch(branch)) {
      return NextResponse.json(
        { success: false, error: 'Invalid branch name.' },
        { status: 400 }
      );
    }

    // Prefer exact sandbox provider from manager; fall back to legacy global for older flows
    let provider: any = sandboxManager.getProvider(sandboxId) || (global as any).activeSandboxProvider;

    if (!provider) {
      return NextResponse.json({ success: false, error: 'No active sandbox provider found' }, { status: 400 });
    }

    const info = typeof provider.getSandboxInfo === 'function' ? provider.getSandboxInfo() : null;
    if (info?.sandboxId && info.sandboxId !== sandboxId) {
      const exact = sandboxManager.getProvider(sandboxId);
      if (!exact) {
        return NextResponse.json(
          { success: false, error: 'Sandbox not found in server memory. Create a new sandbox and try again.' },
          { status: 400 }
        );
      }
      provider = exact;
    }

    // Best-effort: stop existing Vite so we can replace files safely
    await ensureCommandSuccess(provider, 'pkill -f vite', { allowFailure: true });

    // Clear current project (including node_modules) to avoid conflicts
    await ensureCommandSuccess(provider, 'find /vercel/sandbox -mindepth 1 -maxdepth 1 -exec rm -rf {} +');

    // Download tarball from GitHub codeload and extract into sandbox root
    const tarRef = encodeURIComponent(branch);
    const tarUrl = `https://codeload.github.com/${repoFullName}/tar.gz/${tarRef}`;

    const hasCurl = (await ensureCommandSuccess(provider, 'curl --version', { allowFailure: true }))?.success;
    const hasWget = (await ensureCommandSuccess(provider, 'wget --version', { allowFailure: true }))?.success;

    if (!hasCurl && !hasWget) {
      return NextResponse.json(
        { success: false, error: 'Sandbox is missing curl/wget, cannot download repository archive.' },
        { status: 500 }
      );
    }

    if (hasCurl) {
      await ensureCommandSuccess(provider, `curl -L ${tarUrl} -o /tmp/repo.tgz`);
    } else {
      await ensureCommandSuccess(provider, `wget -O /tmp/repo.tgz ${tarUrl}`);
    }

    await ensureCommandSuccess(provider, 'tar -xzf /tmp/repo.tgz --strip-components=1 -C /vercel/sandbox');
    await ensureCommandSuccess(provider, 'rm -f /tmp/repo.tgz', { allowFailure: true });

    // Install dependencies and restart dev server
    await ensureCommandSuccess(provider, 'npm install');

    if (typeof provider.restartViteServer === 'function') {
      await provider.restartViteServer();
    }

    return NextResponse.json({
      success: true,
      repoFullName,
      branch,
      message: 'Repository loaded into sandbox and dev server restarted',
    });
  } catch (error: any) {
    console.error('[github/load-into-sandbox] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load repository into sandbox' },
      { status: 500 }
    );
  }
}


