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

function patchViteConfigAllowAllHosts(contents: string): { patched: string; changed: boolean } {
  if (!contents) return { patched: contents, changed: false };
  // If allowedHosts already exists, normalize it to `true` (allow all) for sandbox previews.
  if (/\ballowedHosts\b/.test(contents)) {
    const replaced = contents.replace(/allowedHosts\s*:\s*(['"]?all['"]?|['"][^'"]+['"]|[^\s,}]+)/m, 'allowedHosts: true');
    return { patched: replaced, changed: replaced !== contents };
  }

  // If there's an existing server block, inject allowedHosts inside it.
  const serverBlock = /(server\s*:\s*\{\s*)/m;
  if (serverBlock.test(contents)) {
    return {
      patched: contents.replace(serverBlock, `$1allowedHosts: true, `),
      changed: true,
    };
  }

  // If using defineConfig({ ... }), inject a server block at the top-level.
  const defineConfigBlock = /(defineConfig\s*\(\s*\{\s*)/m;
  if (defineConfigBlock.test(contents)) {
    return {
      patched: contents.replace(
        defineConfigBlock,
        `$1\n  server: { allowedHosts: true },\n  `
      ),
      changed: true,
    };
  }

  // If exporting a plain object, inject server at the top-level.
  const exportDefaultObject = /(export\s+default\s+\{\s*)/m;
  if (exportDefaultObject.test(contents)) {
    return {
      patched: contents.replace(exportDefaultObject, `$1\n  server: { allowedHosts: true },\n  `),
      changed: true,
    };
  }

  return { patched: contents, changed: false };
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const stepStart = (step: string, label: string) => {
          send({ type: 'step', step, status: 'running', label });
        };
        const stepDone = (step: string, detail?: string) => {
          send({ type: 'step', step, status: 'done', detail });
        };
        const stepError = (step: string, message: string) => {
          send({ type: 'step', step, status: 'error', message });
        };

        const tailLines = (text: string, lines: number) => {
          const parts = text.split('\n').filter(Boolean);
          return parts.slice(-lines).join('\n');
        };

        const run = async (step: string, label: string, command: string, opts?: { allowFailure?: boolean }) => {
          stepStart(step, label);
          try {
            const res = await ensureCommandSuccess(provider, command, opts);
            const out = [res?.stdout, res?.stderr].filter(Boolean).join('\n').trim();
            if (out) {
              send({ type: 'log', step, message: tailLines(out, 20) });
            }
            stepDone(step);
            return res;
          } catch (err: any) {
            stepError(step, err?.message || 'Step failed');
            throw err;
          }
        };

        try {
          send({ type: 'start', repoFullName, branch });

          await run('stop_vite', 'Stopping dev server', 'pkill -f vite', { allowFailure: true });
          await run('clear_sandbox', 'Clearing sandbox files', 'find /vercel/sandbox -mindepth 1 -maxdepth 1 -exec rm -rf {} +');

          const tarRef = encodeURIComponent(branch);
          const tarUrl = `https://codeload.github.com/${repoFullName}/tar.gz/${tarRef}`;

          const hasCurl = (await ensureCommandSuccess(provider, 'curl --version', { allowFailure: true }))?.success;
          const hasWget = (await ensureCommandSuccess(provider, 'wget --version', { allowFailure: true }))?.success;

          if (!hasCurl && !hasWget) {
            throw new Error('Sandbox is missing curl/wget, cannot download repository archive.');
          }

          if (hasCurl) {
            await run('download', 'Downloading repository archive', `curl -L ${tarUrl} -o /tmp/repo.tgz`);
          } else {
            await run('download', 'Downloading repository archive', `wget -O /tmp/repo.tgz ${tarUrl}`);
          }

          await run('extract', 'Extracting repository', 'tar -xzf /tmp/repo.tgz --strip-components=1 -C /vercel/sandbox');
          await run('cleanup', 'Cleaning up temporary files', 'rm -f /tmp/repo.tgz', { allowFailure: true });

          // Vite 6+ blocks unknown hosts by default. Patch config to allow the sandbox host.
          stepStart('vite_config', 'Configuring Vite host allowlist');
          try {
            let isViteProject = false;
            let devScript = '';
            try {
              const pkgRaw = await provider.readFile('package.json');
              const pkg = JSON.parse(pkgRaw);
              devScript = String(pkg?.scripts?.dev || '');
              isViteProject = /(^|\s)vite(\s|$)/.test(devScript) || devScript.includes('vite ');
            } catch {
              isViteProject = false;
            }

            if (!isViteProject) {
              send({ type: 'log', step: 'vite_config', message: 'No Vite dev script detected; skipping host allowlist patch.' });
              stepDone('vite_config');
            } else {
              const configMatch = devScript.match(/--config(?:=|\s+)(['"]?)([^'"\s]+)\1/);
              const candidateConfigPaths = [
                configMatch?.[2],
                'vite.config.ts',
                'vite.config.mts',
                'vite.config.js',
                'vite.config.mjs',
                'vite.config.cjs',
              ].filter(Boolean) as string[];

              let chosenConfigPath: string | null = null;
              let chosenConfigContent: string | null = null;

              for (const p of candidateConfigPaths) {
                try {
                  const raw = await provider.readFile(p);
                  chosenConfigPath = p;
                  chosenConfigContent = raw;
                  break;
                } catch {
                  // try next
                }
              }

              if (!chosenConfigPath) {
                // If no config exists, create a minimal one at root (Vite will pick it up).
                chosenConfigPath = 'vite.config.ts';
                chosenConfigContent = `import { defineConfig } from 'vite';\n\nexport default defineConfig({\n  server: {\n    allowedHosts: true,\n  },\n});\n`;
                await provider.writeFile(chosenConfigPath, chosenConfigContent);
                send({ type: 'log', step: 'vite_config', message: `Created ${chosenConfigPath} with server.allowedHosts=true.` });
                stepDone('vite_config');
              } else if (chosenConfigContent != null) {
                const { patched, changed } = patchViteConfigAllowAllHosts(chosenConfigContent);
                if (changed) {
                  await provider.writeFile(chosenConfigPath, patched);
                  send({ type: 'log', step: 'vite_config', message: `Patched ${chosenConfigPath}: server.allowedHosts=true.` });
                } else {
                  send({ type: 'log', step: 'vite_config', message: `No changes needed for ${chosenConfigPath}.` });
                }
                stepDone('vite_config');
              } else {
                stepDone('vite_config');
              }
            }
          } catch (err: any) {
            stepError('vite_config', err?.message || 'Failed to patch Vite config');
            throw err;
          }

          // npm install output is large; emit a start/done without logs
          stepStart('npm_install', 'Installing dependencies (npm install)');
          try {
            const res = await ensureCommandSuccess(provider, 'npm install');
            if (!res?.success) {
              throw new Error(res?.stderr || res?.stdout || 'npm install failed');
            }
            stepDone('npm_install');
          } catch (err: any) {
            stepError('npm_install', err?.message || 'npm install failed');
            throw err;
          }

          stepStart('restart_vite', 'Restarting dev server');
          try {
            if (typeof provider.restartViteServer === 'function') {
              await provider.restartViteServer();
            } else {
              await ensureCommandSuccess(provider, 'sh -c "nohup npm run dev > /tmp/vite.log 2>&1 &"');
            }
            stepDone('restart_vite');
          } catch (err: any) {
            stepError('restart_vite', err?.message || 'Failed to restart dev server');
            throw err;
          }

          send({ type: 'complete', success: true, message: 'Repository loaded into sandbox and dev server restarted' });
        } catch (error: any) {
          send({ type: 'error', success: false, message: error?.message || 'Failed to load repository into sandbox' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      }
    });
  } catch (error: any) {
    console.error('[github/load-into-sandbox] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load repository into sandbox' },
      { status: 500 }
    );
  }
}


