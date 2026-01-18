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

function patchViteConfigAllowAllHosts(contents: string): { patched: string; changed: boolean } {
  if (!contents) return { patched: contents, changed: false };

  // Most reliable for ephemeral sandbox preview domains: disable the host check.
  // This prevents Vite's "Blocked request. This host is not allowed." error for tunnel hosts.
  const allowedHostsValue = `allowedHosts: true`;

  // If allowedHosts already exists, normalize it.
  if (/\ballowedHosts\b/.test(contents)) {
    const replaced = contents.replace(
      /allowedHosts\s*:\s*([\s\S]*?)(?=,\s*\w+\s*:|,\s*\}|}\s*\)|\n\s*\})/m,
      allowedHostsValue
    );
    return { patched: replaced, changed: replaced !== contents };
  }

  // If there's an existing server block, inject allowedHosts inside it.
  const serverBlock = /(server\s*:\s*\{\s*)/m;
  if (serverBlock.test(contents)) {
    return {
      patched: contents.replace(serverBlock, `$1${allowedHostsValue}, `),
      changed: true,
    };
  }

  // If using defineConfig({ ... }), inject a server block at the top-level.
  const defineConfigBlock = /(defineConfig\s*\(\s*\{\s*)/m;
  if (defineConfigBlock.test(contents)) {
    return {
      patched: contents.replace(defineConfigBlock, `$1\n  server: { ${allowedHostsValue} },\n  `),
      changed: true,
    };
  }

  // If exporting a plain object, inject server at the top-level.
  const exportDefaultObject = /(export\s+default\s+\{\s*)/m;
  if (exportDefaultObject.test(contents)) {
    return {
      patched: contents.replace(exportDefaultObject, `$1\n  server: { ${allowedHostsValue} },\n  `),
      changed: true,
    };
  }

  return { patched: contents, changed: false };
}

function patchViteConfigDisableOverlay(contents: string): { patched: string; changed: boolean } {
  if (!contents) return { patched: contents, changed: false };

  // Prefer disabling Vite's HMR error overlay so users never see raw build errors in the iframe.
  // If overlay is already configured anywhere in the config, normalize it to false.
  if (/\boverlay\s*:/.test(contents)) {
    const replaced = contents.replace(/\boverlay\s*:\s*[^,\n}]+/g, 'overlay: false');
    return { patched: replaced, changed: replaced !== contents };
  }

  // If there's an existing hmr block, inject overlay inside it.
  const hmrBlock = /(hmr\s*:\s*\{\s*)/m;
  if (hmrBlock.test(contents)) {
    return {
      patched: contents.replace(hmrBlock, `$1overlay: false, `),
      changed: true,
    };
  }

  // If there's an existing server block, inject a minimal hmr block.
  const serverBlock = /(server\s*:\s*\{\s*)/m;
  if (serverBlock.test(contents)) {
    return {
      patched: contents.replace(serverBlock, `$1hmr: { overlay: false }, `),
      changed: true,
    };
  }

  // If using defineConfig({ ... }), inject a server block at the top-level.
  const defineConfigBlock = /(defineConfig\s*\(\s*\{\s*)/m;
  if (defineConfigBlock.test(contents)) {
    return {
      patched: contents.replace(defineConfigBlock, `$1\n  server: { hmr: { overlay: false } },\n  `),
      changed: true,
    };
  }

  // If exporting a plain object, inject server at the top-level.
  const exportDefaultObject = /(export\s+default\s+\{\s*)/m;
  if (exportDefaultObject.test(contents)) {
    return {
      patched: contents.replace(exportDefaultObject, `$1\n  server: { hmr: { overlay: false } },\n  `),
      changed: true,
    };
  }

  return { patched: contents, changed: false };
}

async function ensureViteHostAllowed(provider: any): Promise<{
  createdConfigPath: string | null;
  patchedConfigPaths: string[];
  attemptedConfigPaths: string[];
}> {
  const attempted: string[] = [];
  const patched: string[] = [];

  let devScript = '';
  try {
    const pkgRaw = await provider.readFile('package.json');
    const pkg = JSON.parse(pkgRaw);
    devScript = String(pkg?.scripts?.dev || '');
  } catch {
    devScript = '';
  }

  const configMatch = devScript.match(/--config(?:=|\s+)(['"]?)([^'"\s]+)\1/);
  const candidates = [
    configMatch?.[2],
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ].filter(Boolean) as string[];

  // Deduplicate while preserving order
  const uniqueCandidates = Array.from(new Set(candidates.map(p => String(p))));

  for (const p of uniqueCandidates) {
    attempted.push(p);
    try {
      const raw = await provider.readFile(p);
      const allow = patchViteConfigAllowAllHosts(raw);
      const overlay = patchViteConfigDisableOverlay(allow.patched);
      const next = overlay.patched;
      const changed = allow.changed || overlay.changed;
      if (changed) {
        await provider.writeFile(p, next);
        patched.push(p);
      }
    } catch {
      // try next
    }
  }

  if (patched.length === 0) {
    // If we couldn't find/patch any config file, create a minimal config so Vite will pick it up.
    const createdConfigPath = 'vite.config.ts';
    const content = `import { defineConfig } from 'vite';\n\nexport default defineConfig({\n  server: {\n    allowedHosts: true,\n    hmr: { overlay: false },\n  },\n});\n`;
    try {
      await provider.writeFile(createdConfigPath, content);
      return { createdConfigPath, patchedConfigPaths: [], attemptedConfigPaths: attempted };
    } catch {
      // ignore
    }
  }

  return { createdConfigPath: null, patchedConfigPaths: patched, attemptedConfigPaths: attempted };
}

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

    // Patch Vite config to allow tunnel hosts (avoids "Blocked request" on modal/vercel domains).
    try {
      await ensureViteHostAllowed(provider);
    } catch (e: any) {
      console.warn('[restart-vite] Failed to patch Vite allowedHosts (non-fatal):', e);
    }

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