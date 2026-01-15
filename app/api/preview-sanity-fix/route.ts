import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

declare global {
  // legacy/active provider cache (dev + some runtimes)
  // eslint-disable-next-line no-var
  var activeSandboxProvider: any;
}

function includesBrowserRouter(text: string): boolean {
  return /\bBrowserRouter\b/.test(text || '');
}

function hasRouterWrapperInMain(text: string): boolean {
  return /<\s*BrowserRouter\b/.test(text || '') && /<\/\s*BrowserRouter\s*>/.test(text || '');
}

function stripMainRouterWrapper(mainContent: string): string {
  let out = mainContent;
  // Remove BrowserRouter import (common patterns)
  out = out.replace(/^\s*import\s+\{\s*BrowserRouter\s*\}\s+from\s+['"]react-router-dom['"]\s*;?\s*$/gm, '');

  // Remove wrapper tags. This is intentionally minimal and relies on typical scaffold formatting.
  out = out.replace(/<\s*BrowserRouter\s*>\s*/g, '');
  out = out.replace(/\s*<\/\s*BrowserRouter\s*>\s*/g, '');

  // Clean up excessive blank lines
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim() + '\n';
}

async function readFirstExisting(provider: any, paths: string[]): Promise<{ path: string; content: string } | null> {
  for (const p of paths) {
    try {
      const content = await provider.readFile(p);
      if (typeof content === 'string' && content.length > 0) {
        return { path: p, content };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sandboxId = typeof body?.sandboxId === 'string' ? body.sandboxId.trim() : '';

    if (!sandboxId) {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }

    const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;

    let provider: any =
      sandboxManager.getProvider(sandboxId) ||
      (activeProvider?.getSandboxInfo?.()?.sandboxId === sandboxId ? activeProvider : null);

    if (!provider) {
      try {
        provider = await sandboxManager.getOrCreateProvider(sandboxId);
        const info = provider?.getSandboxInfo?.();
        if (!info || info.sandboxId !== sandboxId) provider = null;
      } catch {
        provider = null;
      }
    }

    if (!provider || !provider.getSandboxInfo?.()) {
      return NextResponse.json({ success: false, error: `No sandbox provider for sandboxId: ${sandboxId}` }, { status: 404 });
    }

    const main = await readFirstExisting(provider, ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx']);
    const app = await readFirstExisting(provider, ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx']);

    const mainHas = Boolean(main?.content);
    const appHas = Boolean(app?.content);

    const mainHasRouter = mainHas ? includesBrowserRouter(main!.content) : false;
    const appHasRouter = appHas ? includesBrowserRouter(app!.content) : false;

    const shouldFix = Boolean(mainHasRouter && appHasRouter && main && hasRouterWrapperInMain(main.content));

    // #region agent log (debug)
    fetch('http://127.0.0.1:7244/ingest/c9f29500-2419-465e-93c8-b96754dedc28', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'preview-stuck-pre',
        hypothesisId: 'H4',
        location: 'app/api/preview-sanity-fix/route.ts:POST',
        message: 'preview sanity fix evaluated',
        data: {
          sandboxId,
          mainPath: main?.path || null,
          appPath: app?.path || null,
          mainHasRouter,
          appHasRouter,
          shouldFix,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log (debug)

    if (shouldFix) {
      const newMain = stripMainRouterWrapper(main!.content);
      await provider.writeFile(main!.path, newMain);
    }

    // Optional restart Vite (default true) so preview reflects file changes.
    const doRestart = body?.restartVite === undefined ? true : Boolean(body.restartVite);
    if (doRestart && typeof provider.restartViteServer === 'function') {
      try {
        await provider.restartViteServer();
      } catch {
        // ignore
      }
    } else if (doRestart) {
      try {
        await provider.runCommand('sh -c "pkill -f vite || true"');
        await provider.runCommand('sh -c "nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/vite.log 2>&1 &"');
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: true,
      applied: shouldFix,
      message: shouldFix
        ? 'Applied preview sanity fix (removed nested BrowserRouter from main entrypoint)'
        : 'No preview sanity fix needed',
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to apply preview sanity fix' }, { status: 500 });
  }
}

