import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getSandboxHealthSnapshot, installPackagesAndQueueBake } from '@/lib/sandbox/healer';

declare global {
  // eslint-disable-next-line no-var
  var activeSandboxProvider: any;
  // eslint-disable-next-line no-var
  var sandboxHealInProgressBySandbox: Record<string, boolean> | undefined;
  // eslint-disable-next-line no-var
  var sandboxLastHealAtBySandbox: Record<string, number> | undefined;
  // eslint-disable-next-line no-var
  var sandboxHealWindowBySandbox: Record<string, { windowStart: number; count: number }> | undefined;
  // eslint-disable-next-line no-var
  var sandboxHealStatsBySandbox:
    | Record<
        string,
        {
          attempts: number;
          successes: number;
          failures: number;
          lastAt: number;
          lastDurationMs: number;
          lastError?: string;
        }
      >
    | undefined;
  // eslint-disable-next-line no-var
  var sandboxHealBlockedUntilBySandbox: Record<string, number> | undefined;
  // eslint-disable-next-line no-var
  var sandboxHealBlockReasonBySandbox: Record<string, string> | undefined;
}

const HEAL_COOLDOWN_MS = 7000;
const HEAL_WINDOW_MS = 2 * 60_000;
const HEAL_MAX_PER_WINDOW = 6;
const MAX_PACKAGES_PER_HEAL = 25;
const HEAL_EACCES_BLOCK_MS = 15 * 60_000;

function jsonSse(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const autoHealEnabled = process.env.SANDBOX_AUTO_HEAL === 'true';
  if (!autoHealEnabled) {
    return NextResponse.json(
      { success: false, error: 'Sandbox auto-heal is disabled (set SANDBOX_AUTO_HEAL=true).' },
      { status: 403 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (payload: any) => {
    await writer.write(encoder.encode(jsonSse(payload)));
  };

  (async () => {
    let sandboxKey = 'active';
    const startedAt = Date.now();
    try {
      const body = await request.json().catch(() => null);
      const requestedSandboxId = String(body?.sandboxId || body?.sandbox || '').trim();
      const hintedPkgs = Array.isArray(body?.packages) ? body.packages : [];

      const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;

      let provider: any =
        requestedSandboxId
          ? sandboxManager.getProvider(requestedSandboxId) ||
            (activeProvider?.getSandboxInfo?.()?.sandboxId === requestedSandboxId ? activeProvider : null)
          : activeProvider;

      if (!provider && requestedSandboxId) {
        try {
          provider = await sandboxManager.getOrCreateProvider(requestedSandboxId);
          const info = provider?.getSandboxInfo?.();
          if (!info || info.sandboxId !== requestedSandboxId) provider = null;
        } catch {
          provider = null;
        }
      }

      if (!provider || !provider.getSandboxInfo?.()) {
        await send({
          type: 'error',
          message: requestedSandboxId ? `No sandbox provider for sandboxId: ${requestedSandboxId}` : 'No active sandbox',
        });
        console.warn('[sandbox-heal] No provider available', { requestedSandboxId });
        return;
      }

      const info = provider.getSandboxInfo?.();
      sandboxKey = String(requestedSandboxId || info?.sandboxId || 'active');

      if (!global.sandboxHealInProgressBySandbox) global.sandboxHealInProgressBySandbox = {};
      if (!global.sandboxLastHealAtBySandbox) global.sandboxLastHealAtBySandbox = {};
      if (!global.sandboxHealWindowBySandbox) global.sandboxHealWindowBySandbox = {};
      if (!global.sandboxHealStatsBySandbox) global.sandboxHealStatsBySandbox = {};
      if (!global.sandboxHealBlockedUntilBySandbox) global.sandboxHealBlockedUntilBySandbox = {};
      if (!global.sandboxHealBlockReasonBySandbox) global.sandboxHealBlockReasonBySandbox = {};

      const now = Date.now();
      const blockedUntil = global.sandboxHealBlockedUntilBySandbox[sandboxKey] || 0;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H5',location:'app/api/sandbox-heal/route.ts:POST:start',message:'sandbox-heal request',data:{requestedSandboxId,sandboxKey,hintedPkgs:Array.isArray(hintedPkgs)?hintedPkgs.slice(0,10):[],provider:String(info?.provider||''),providerSandboxId:String(info?.sandboxId||''),blockedUntil,now,autoHealEnabled:String(process.env.SANDBOX_AUTO_HEAL||'')==='true',e2bTemplateId:String(process.env.E2B_TEMPLATE_ID||process.env.E2B_TEMPLATE||'')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (blockedUntil && now < blockedUntil) {
        const retryAfterMs = blockedUntil - now;

        // If permissions were fixed since the last EACCES (e.g. template was republished and sandbox recreated),
        // automatically clear the block and proceed instead of forcing a long cooldown.
        let nodeModulesWritable: boolean | null = null;
        try {
          const diag = await provider.runCommand(
            `id -a 2>/dev/null || true; ` +
              `ls -ld /app /app/node_modules 2>/dev/null || true; ` +
              `(test -w /app && echo APP_WRITABLE || echo APP_NOT_WRITABLE) 2>/dev/null || true; ` +
              `(test -w /app/node_modules && echo NODE_MODULES_WRITABLE || echo NODE_MODULES_NOT_WRITABLE) 2>/dev/null || true`
          );
          const out = String(diag?.stdout || '');
          nodeModulesWritable = out.includes('NODE_MODULES_WRITABLE');

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'app/api/sandbox-heal/route.ts:POST:blocked-perms-probe',message:'sandbox-heal blocked perms probe',data:{sandboxKey,blockedUntil,now,retryAfterMs,nodeModulesWritable,diagStdout:String(diag?.stdout||'').slice(0,800),diagStderr:String(diag?.stderr||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        } catch (e: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'app/api/sandbox-heal/route.ts:POST:blocked-perms-probe-error',message:'sandbox-heal blocked perms probe error',data:{sandboxKey,blockedUntil,now,retryAfterMs,error:String(e?.message||e).slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          nodeModulesWritable = null;
        }

        if (nodeModulesWritable === true) {
          global.sandboxHealBlockedUntilBySandbox[sandboxKey] = 0;
          global.sandboxHealBlockReasonBySandbox[sandboxKey] = '';
          // proceed (do not return)
        } else {
        await send({
          type: 'complete',
          healthy: false,
          code: 'AUTO_HEAL_BLOCKED',
          retryAfterMs,
          message: global.sandboxHealBlockReasonBySandbox[sandboxKey] || 'Auto-heal is temporarily blocked.',
        });
        console.warn('[sandbox-heal] Blocked', { sandboxKey, retryAfterMs });
        return;
        }
      }

      if (global.sandboxHealInProgressBySandbox[sandboxKey]) {
        await send({
          type: 'complete',
          healthy: false,
          code: 'AUTO_HEAL_IN_PROGRESS',
          retryAfterMs: 2000,
          message: 'Heal already in progress. Waiting for it to complete…',
        });
        console.log('[sandbox-heal] Skip (in progress)', { sandboxKey });
        return;
      }

      const lastAt = global.sandboxLastHealAtBySandbox[sandboxKey] || 0;
      if (lastAt && now - lastAt < HEAL_COOLDOWN_MS) {
        const retryAfterMs = HEAL_COOLDOWN_MS - (now - lastAt);
        const remaining = Math.ceil(retryAfterMs / 1000);
        await send({
          type: 'complete',
          healthy: false,
          code: 'AUTO_HEAL_COOLDOWN',
          retryAfterMs,
          message: `Heal cooldown active (${remaining}s).`,
        });
        console.log('[sandbox-heal] Skip (cooldown)', { sandboxKey, remainingSeconds: remaining });
        return;
      }

      const windowRec = global.sandboxHealWindowBySandbox[sandboxKey] || { windowStart: now, count: 0 };
      const windowStart = windowRec.windowStart && now - windowRec.windowStart < HEAL_WINDOW_MS ? windowRec.windowStart : now;
      const count = windowStart === windowRec.windowStart ? windowRec.count : 0;
      if (count >= HEAL_MAX_PER_WINDOW) {
        await send({
          type: 'complete',
          healthy: false,
          code: 'AUTO_HEAL_RATE_LIMITED',
          retryAfterMs: Math.max(5_000, HEAL_WINDOW_MS - (now - windowStart)),
          message: 'Auto-heal is rate-limited for this sandbox (too many attempts). Consider recreating the sandbox.',
        });
        console.warn('[sandbox-heal] Rate-limited', { sandboxKey, windowStart, count });
        return;
      }

      global.sandboxHealInProgressBySandbox[sandboxKey] = true;
      global.sandboxLastHealAtBySandbox[sandboxKey] = now;
      global.sandboxHealWindowBySandbox[sandboxKey] = { windowStart, count: count + 1 };
      global.sandboxHealStatsBySandbox[sandboxKey] = {
        ...(global.sandboxHealStatsBySandbox[sandboxKey] || {
          attempts: 0,
          successes: 0,
          failures: 0,
          lastAt: 0,
          lastDurationMs: 0,
        }),
        attempts: (global.sandboxHealStatsBySandbox[sandboxKey]?.attempts || 0) + 1,
        lastAt: now,
        lastError: undefined,
      };

      await send({ type: 'start', message: 'Checking sandbox for build issues…', sandboxId: sandboxKey });

      const before = await getSandboxHealthSnapshot(provider);

      const pkgs = Array.from(
        new Set([
          ...before.missingPackages,
          ...hintedPkgs.map((p: any) => String(p || '').trim()).filter(Boolean),
        ])
      ).slice(0, MAX_PACKAGES_PER_HEAL);

      if (pkgs.length === 0 && before.viteRunning !== false) {
        await send({
          type: 'complete',
          healthy: true,
          message: 'No healing needed.',
          snapshot: before,
          durationMs: Date.now() - startedAt,
        });
        const dur = Date.now() - startedAt;
        global.sandboxHealStatsBySandbox[sandboxKey] = {
          ...(global.sandboxHealStatsBySandbox[sandboxKey] || {
            attempts: 1,
            successes: 0,
            failures: 0,
            lastAt: now,
            lastDurationMs: 0,
          }),
          successes: (global.sandboxHealStatsBySandbox[sandboxKey]?.successes || 0) + 1,
          lastDurationMs: dur,
          lastError: undefined,
        };
        console.log('[sandbox-heal] No-op (healthy)', { sandboxKey, durationMs: dur });
        return;
      }

      console.log('[sandbox-heal] Starting heal', {
        sandboxKey,
        provider: String(info?.provider || ''),
        missingPackages: pkgs,
        viteRunning: before.viteRunning,
      });

      if (pkgs.length > 0) {
        await send({ type: 'step', step: 1, message: `Installing ${pkgs.length} missing package(s)…`, packages: pkgs });

        const install = await installPackagesAndQueueBake({
          provider,
          packages: pkgs,
          source: 'sandbox-heal',
        });

        if (install.stdout) {
          await send({ type: 'install-output', message: install.stdout.slice(0, 2000) });
        }
        if (!install.success) {
          const combined = `${String(install.stderr || '')}\n${String(install.stdout || '')}`.toLowerCase();
          const looksEacces =
            combined.includes('eacces') ||
            combined.includes('permission denied') ||
            combined.includes('errno -13');

          if (looksEacces) {
            const blockedUntil = Date.now() + HEAL_EACCES_BLOCK_MS;
            global.sandboxHealBlockedUntilBySandbox[sandboxKey] = blockedUntil;
            global.sandboxHealBlockReasonBySandbox[sandboxKey] =
              'Sandbox npm installs are failing due to permissions (EACCES writing to /app/node_modules). ' +
              'This usually means /app/node_modules are not writable by the sandbox runtime user. ' +
              'Publish the updated E2B template (fixes /app permissions) and recreate the sandbox.';

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'app/api/sandbox-heal/route.ts:POST:eacces-block',message:'sandbox-heal install failed with EACCES (blocked)',data:{sandboxKey,missingPackages:pkgs.slice(0,10),installSuccess:Boolean(install.success),stderrSnippet:String(install.stderr||'').slice(0,400),stdoutSnippet:String(install.stdout||'').slice(0,400),blockedUntil},timestamp:Date.now()})}).catch(()=>{});
            // #endregion

            await send({
              type: 'error',
              code: 'NPM_EACCES',
              message: global.sandboxHealBlockReasonBySandbox[sandboxKey],
            });
          } else {
            await send({ type: 'error', message: install.stderr || 'Package installation failed.' });
          }
          const afterFail = await getSandboxHealthSnapshot(provider);
          const dur = Date.now() - startedAt;
          await send({ type: 'complete', healthy: false, snapshot: afterFail, durationMs: dur });
          global.sandboxHealStatsBySandbox[sandboxKey] = {
            ...(global.sandboxHealStatsBySandbox[sandboxKey] || {
              attempts: 1,
              successes: 0,
              failures: 0,
              lastAt: now,
              lastDurationMs: 0,
            }),
            failures: (global.sandboxHealStatsBySandbox[sandboxKey]?.failures || 0) + 1,
            lastDurationMs: dur,
            lastError: looksEacces ? 'npm_eacces' : String(install.stderr || 'install_failed').slice(0, 300),
          };
          console.warn('[sandbox-heal] Install failed', {
            sandboxKey,
            durationMs: dur,
            stderr: String(install.stderr || '').slice(0, 300),
            missingAfter: afterFail.missingPackages,
          });
          return;
        }

        await send({ type: 'success', message: `Installed: ${install.installed.join(', ')}` });
      } else {
        await send({ type: 'step', step: 1, message: 'No missing packages detected. Attempting Vite restart…' });
      }

      await send({ type: 'step', step: 2, message: 'Restarting Vite…' });

      try {
        if (typeof provider.restartViteServer === 'function') {
          await provider.restartViteServer();
        } else {
          await provider.runCommand('pkill -f vite || true');
          await provider.runCommand('nohup npm run dev > /tmp/vite.log 2>&1 &');
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (e: any) {
        await send({ type: 'error', message: `Failed to restart Vite: ${String(e?.message || e)}` });
      }

      await send({ type: 'step', step: 3, message: 'Re-checking sandbox health…' });
      const after = await getSandboxHealthSnapshot(provider);

      await send({
        type: 'complete',
        healthy: after.healthyForPreview,
        snapshot: after,
        message: after.healthyForPreview ? 'Sandbox preview recovered.' : 'Sandbox still unhealthy after heal.',
        durationMs: Date.now() - startedAt,
      });

      const dur = Date.now() - startedAt;
      global.sandboxHealStatsBySandbox[sandboxKey] = {
        ...(global.sandboxHealStatsBySandbox[sandboxKey] || {
          attempts: 1,
          successes: 0,
          failures: 0,
          lastAt: now,
          lastDurationMs: 0,
        }),
        successes: (global.sandboxHealStatsBySandbox[sandboxKey]?.successes || 0) + (after.healthyForPreview ? 1 : 0),
        failures: (global.sandboxHealStatsBySandbox[sandboxKey]?.failures || 0) + (after.healthyForPreview ? 0 : 1),
        lastDurationMs: dur,
        lastError: after.healthyForPreview ? undefined : 'unhealthy_after_heal',
      };

      console.log('[sandbox-heal] Completed', {
        sandboxKey,
        durationMs: dur,
        healthy: after.healthyForPreview,
        missingAfter: after.missingPackages,
      });
    } catch (error: any) {
      console.error('[sandbox-heal] Error:', error);
      try {
        await send({ type: 'error', message: error?.message || String(error) });
      } catch {
        // ignore
      }
      try {
        if (!global.sandboxHealStatsBySandbox) global.sandboxHealStatsBySandbox = {};
        global.sandboxHealStatsBySandbox[sandboxKey] = {
          ...(global.sandboxHealStatsBySandbox[sandboxKey] || {
            attempts: 1,
            successes: 0,
            failures: 0,
            lastAt: Date.now(),
            lastDurationMs: 0,
          }),
          failures: (global.sandboxHealStatsBySandbox[sandboxKey]?.failures || 0) + 1,
          lastDurationMs: Date.now() - startedAt,
          lastError: String(error?.message || error).slice(0, 300),
        };
      } catch {
        // ignore
      }
    } finally {
      try {
        if (!global.sandboxHealInProgressBySandbox) global.sandboxHealInProgressBySandbox = {};
        global.sandboxHealInProgressBySandbox[sandboxKey] = false;
      } catch {
        // ignore
      }
      try {
        await writer.close();
      } catch {
        // ignore
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

