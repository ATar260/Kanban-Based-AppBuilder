import { Sandbox as E2BSandbox } from 'e2b';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { queueE2BTemplateBakeCandidates } from '@/lib/e2b/template-bake-queue';

export class E2BProvider extends SandboxProvider {
  private sandboxInstance: E2BSandbox | null = null;
  private existingFiles: Set<string> = new Set();

  private getApiKey(): string {
    const key = String(process.env.E2B_API_KEY || '').trim();
    if (!key) {
      throw new Error('E2B_API_KEY is required to use the E2B sandbox provider.');
    }
    return key;
  }

  private getTemplateId(): string {
    // We default to a custom template (recommended). If not set, fall back to E2B default template.
    const template = String(process.env.E2B_TEMPLATE_ID || process.env.E2B_TEMPLATE || '').trim();
    return template || 'base';
  }

  private getTimeoutMs(): number {
    // E2B timeouts vary by plan. Default to < 1 hour to avoid hobby-limit failures.
    const defaultTimeoutMs = 55 * 60 * 1000; // 55 minutes
    const envTimeoutMs = Number(process.env.E2B_SANDBOX_TIMEOUT_MS);
    return Number.isFinite(envTimeoutMs) && envTimeoutMs > 0 ? envTimeoutMs : defaultTimeoutMs;
  }

  private toPreviewUrl(host: string): string {
    const h = String(host || '').trim();
    if (!h) return '';
    if (h.startsWith('http://') || h.startsWith('https://')) return h;
    return `https://${h}`;
  }

  private resolveSandboxRoot(): string {
    // Match our other providers (Modal uses /app). The E2B template should use /app too.
    return '/app';
  }

  private async ensureViteListening(maxWaitMs: number = 30_000): Promise<{ ok: boolean; logTail?: string }> {
    if (!this.sandboxInstance) return { ok: false };
    const deadline = Date.now() + Math.max(5_000, maxWaitMs);

    // Use curl (installed in our template). If curl is missing, this will just fail and we’ll fall back to log tail.
    while (Date.now() < deadline) {
      const res = await this.runCommand('curl -sSf --max-time 1 http://127.0.0.1:5173/ >/dev/null 2>&1 && echo OK');
      if (res.success && /\bOK\b/.test(res.stdout)) return { ok: true };
      await new Promise(r => setTimeout(r, 1000));
    }

    const tail = await this.runCommand('tail -n 120 /tmp/vite.log 2>/dev/null || true');
    return { ok: false, logTail: (tail.stdout || '').slice(0, 8000) };
  }

  async createSandbox(): Promise<SandboxInfo> {
    try {
      if (this.sandboxInstance) {
        await this.terminate();
      }

      this.existingFiles.clear();

      const apiKey = this.getApiKey();
      const template = this.getTemplateId();
      const timeoutMs = this.getTimeoutMs();

      const sandbox = await E2BSandbox.create(template, {
        apiKey,
        timeoutMs,
      });

      this.sandboxInstance = sandbox;
      this.sandbox = sandbox;

      const url = this.toPreviewUrl(sandbox.getHost(5173));
      this.sandboxInfo = {
        sandboxId: sandbox.sandboxId,
        url,
        provider: 'e2b',
        createdAt: new Date(),
        templateTarget: 'vite',
        devPort: 5173,
      };

      return this.sandboxInfo;
    } catch (error) {
      console.error('[E2BProvider] Error creating sandbox:', error);
      throw error;
    }
  }

  async reconnect(sandboxId: string): Promise<boolean> {
    const id = String(sandboxId || '').trim();
    if (!id) return false;

    try {
      const apiKey = this.getApiKey();
      const timeoutMs = this.getTimeoutMs();

      const sandbox = await E2BSandbox.connect(id, { apiKey, timeoutMs });
      this.sandboxInstance = sandbox;
      this.sandbox = sandbox;

      const url = this.toPreviewUrl(sandbox.getHost(5173));
      this.sandboxInfo = {
        sandboxId: sandbox.sandboxId,
        url,
        provider: 'e2b',
        createdAt: new Date(),
        templateTarget: 'vite',
        devPort: 5173,
      };

      return true;
    } catch (error) {
      console.error('[E2BProvider] Failed to reconnect to sandbox:', {
        sandboxId: id,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async runCommand(command: string): Promise<CommandResult> {
    if (!this.sandboxInstance) {
      throw new Error('No active sandbox');
    }

    try {
      const root = this.resolveSandboxRoot();
      // Execute via shell so pipes/redirects/&&/quotes work correctly.
      const wrapped = `sh -c ${JSON.stringify(command)}`;
      const result: any = await this.sandboxInstance.commands.run(wrapped, {
        cwd: root,
        timeoutMs: Math.max(60_000, Number(process.env.SANDBOX_COMMAND_TIMEOUT_MS) || 120_000),
      });

      return {
        stdout: String(result?.stdout || ''),
        stderr: String(result?.stderr || ''),
        exitCode: Number(result?.exitCode ?? 0),
        success: Number(result?.exitCode ?? 0) === 0,
      };
    } catch (error: any) {
      // E2B throws CommandExitError on non-zero exit code but still carries stdout/stderr/exitCode.
      const exitCode = Number(error?.exitCode ?? 1);
      return {
        stdout: String(error?.stdout || ''),
        stderr: String(error?.stderr || error?.message || 'Command failed'),
        exitCode,
        success: exitCode === 0,
      };
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.sandboxInstance) {
      throw new Error('No active sandbox');
    }

    const root = this.resolveSandboxRoot();
    const fullPath = path.startsWith('/') ? path : `${root}/${path}`;
    await this.sandboxInstance.files.write(fullPath, content);
    this.existingFiles.add(path);
  }

  async readFile(path: string): Promise<string> {
    if (!this.sandboxInstance) {
      throw new Error('No active sandbox');
    }

    const root = this.resolveSandboxRoot();
    const fullPath = path.startsWith('/') ? path : `${root}/${path}`;
    return await this.sandboxInstance.files.read(fullPath);
  }

  async listFiles(directory: string = '/app'): Promise<string[]> {
    // Use find for recursive listing (fast + consistent with other providers).
    const dir = directory || this.resolveSandboxRoot();
    const result = await this.runCommand(
      `find ${dir} -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/build/*" | sed "s|^${dir}/||"`
    );
    if (!result.success) return [];
    return result.stdout.split('\n').map(l => l.trim()).filter(Boolean);
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    if (!this.sandboxInstance) {
      throw new Error('No active sandbox');
    }

    const pkgs = Array.isArray(packages) ? packages.filter(Boolean) : [];
    if (pkgs.length === 0) {
      return { stdout: '', stderr: '', exitCode: 0, success: true };
    }

    const root = this.resolveSandboxRoot();
    const flags = String(process.env.NPM_FLAGS || '').trim();
    const cacheDir = '/tmp/npm-cache';

    // Preflight: fail fast (with a clear message) if node_modules is not writable.
    // This usually means the template was built with root-owned /app/node_modules.
    try {
      const check = await this.runCommand(
        `cd ${root} && (test -d node_modules || mkdir -p node_modules) && (test -w node_modules && echo OK || echo NO)`
      );
      const ok = /\bOK\b/.test(String(check.stdout || ''));

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'lib/sandbox/providers/e2b-provider.ts:installPackages:preflight',message:'e2b installPackages node_modules writable preflight',data:{sandboxId:String(this.sandboxInfo?.sandboxId||''),root,pkgs:pkgs.slice(0,10),checkExitCode:Number(check.exitCode??0),checkSuccess:Boolean(check.success),checkStdout:String(check.stdout||'').slice(0,200),checkStderr:String(check.stderr||'').slice(0,200),ok,e2bTemplateId:String(process.env.E2B_TEMPLATE_ID||process.env.E2B_TEMPLATE||'')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!ok) {
        try {
          const diag = await this.runCommand(
            `id -a 2>/dev/null || true; ` +
              `echo "PWD=$(pwd)" 2>/dev/null || true; ` +
              `ls -ld /app /app/node_modules 2>/dev/null || true; ` +
              `(test -w /app && echo APP_WRITABLE || echo APP_NOT_WRITABLE) 2>/dev/null || true; ` +
              `(test -w /app/node_modules && echo NODE_MODULES_WRITABLE || echo NODE_MODULES_NOT_WRITABLE) 2>/dev/null || true`
          );
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'lib/sandbox/providers/e2b-provider.ts:installPackages:preflight-diag',message:'e2b installPackages preflight diagnostics',data:{sandboxId:String(this.sandboxInfo?.sandboxId||''),diagExitCode:Number(diag.exitCode??0),diagStdout:String(diag.stdout||'').slice(0,800),diagStderr:String(diag.stderr||'').slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        } catch {
          // ignore
        }
        // Self-heal: in some E2B templates the sandbox runtime user is `user` (uid 1001),
        // while `/app` is owned by the `node` user from the base image (uid 1000).
        // We can still install dependencies by running npm as `node`.

        const nodeUser = 'node';
        const nodeCmd =
          `mkdir -p ${cacheDir} && ` +
          `HOME=/tmp NPM_CONFIG_CACHE=${cacheDir} npm_config_cache=${cacheDir} ` +
          `npm install ${flags ? `${flags} ` : ''}${pkgs.join(' ')}`.trim();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'lib/sandbox/providers/e2b-provider.ts:installPackages:fallback-node-start',message:'e2b installPackages fallback to run npm as node user',data:{sandboxId:String(this.sandboxInfo?.sandboxId||''),root,pkgs:pkgs.slice(0,10),user:nodeUser},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        try {
          const result: any = await this.sandboxInstance.commands.run(`sh -c ${JSON.stringify(nodeCmd)}`, {
            cwd: root,
            timeoutMs: Math.max(10 * 60_000, Number(process.env.SANDBOX_NPM_INSTALL_TIMEOUT_MS) || 0),
            user: nodeUser as any,
          });

          const exitCode = Number(result?.exitCode ?? 0);
          const out: CommandResult = {
            stdout: String(result?.stdout || ''),
            stderr: String(result?.stderr || ''),
            exitCode,
            success: exitCode === 0,
          };

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'lib/sandbox/providers/e2b-provider.ts:installPackages:fallback-node-result',message:'e2b installPackages fallback npm result',data:{sandboxId:String(this.sandboxInfo?.sandboxId||''),success:Boolean(out.success),exitCode:Number(out.exitCode||0),stdoutSnippet:String(out.stdout||'').slice(0,300),stderrSnippet:String(out.stderr||'').slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          if (out.success) {
            void queueE2BTemplateBakeCandidates({
              packages: pkgs,
              source: 'e2b.installPackages(node_fallback)',
              status: 'pending',
            }).catch(() => {});
          }

          if (out.success && process.env.AUTO_RESTART_VITE === 'true') {
            await this.restartViteServer();
          }

          return out;
        } catch (error: any) {
          const exitCode = Number(error?.exitCode ?? 1);
          const out: CommandResult = {
            stdout: String(error?.stdout || ''),
            stderr: String(error?.stderr || error?.message || 'npm install failed'),
            exitCode,
            success: exitCode === 0,
          };

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'lib/sandbox/providers/e2b-provider.ts:installPackages:fallback-node-error',message:'e2b installPackages fallback npm threw',data:{sandboxId:String(this.sandboxInfo?.sandboxId||''),exitCode:Number(out.exitCode||0),stderrSnippet:String(out.stderr||'').slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          return {
            stdout: String(check.stdout || ''),
            stderr:
              'npm EACCES: /app/node_modules is not writable by the sandbox runtime user, and the node-user fallback install also failed. ' +
              'Publish the updated template (e2b.Dockerfile fixes /app permissions) and recreate the sandbox.',
            exitCode: 13,
            success: false,
          };
        }
      }
    } catch {
      // If we can't check, proceed and let npm report the underlying error.
    }

    // Avoid EACCES by forcing a writable cache + HOME (some sandboxes run commands as non-root).
    const cmd = `mkdir -p ${cacheDir} && HOME=/tmp NPM_CONFIG_CACHE=${cacheDir} npm_config_cache=${cacheDir} npm install ${flags ? `${flags} ` : ''}${pkgs.join(' ')}`.trim();

    try {
      const result: any = await this.sandboxInstance.commands.run(`sh -c ${JSON.stringify(cmd)}`, {
        cwd: root,
        timeoutMs: Math.max(10 * 60_000, Number(process.env.SANDBOX_NPM_INSTALL_TIMEOUT_MS) || 0),
      });

      const exitCode = Number(result?.exitCode ?? 0);
      const out: CommandResult = {
        stdout: String(result?.stdout || ''),
        stderr: String(result?.stderr || ''),
        exitCode,
        success: exitCode === 0,
      };

      if (out.success) {
        // Best-effort: queue these deps for template baking (server-side).
        // Never block the user flow on queue persistence.
        void queueE2BTemplateBakeCandidates({
          packages: pkgs,
          source: 'e2b.installPackages',
          status: 'pending',
        }).catch(() => {});
      }

      if (out.success && process.env.AUTO_RESTART_VITE === 'true') {
        await this.restartViteServer();
      }

      return out;
    } catch (error: any) {
      const exitCode = Number(error?.exitCode ?? 1);
      return {
        stdout: String(error?.stdout || ''),
        stderr: String(error?.stderr || error?.message || 'npm install failed'),
        exitCode,
        success: exitCode === 0,
      };
    }
  }

  async setupViteApp(): Promise<void> {
    if (!this.sandboxInstance) {
      throw new Error('No active sandbox');
    }

    const root = this.resolveSandboxRoot();
    const pkgPath = `${root}/package.json`;
    const hasPackageJson = await this.sandboxInstance.files.exists(pkgPath).catch(() => false);

    // If the template already contains a Vite app, don't overwrite it.
    if (!hasPackageJson) {
      await this.sandboxInstance.files.makeDir(`${root}/src`).catch(() => {});

      const packageJson = {
        name: "sandbox-app",
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite --host",
          build: "vite build",
          preview: "vite preview"
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "react-router-dom": "^6.22.3",
          "@supabase/supabase-js": "^2.45.0"
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.0.0",
          vite: "^5.4.0",
          tailwindcss: "^3.3.0",
          postcss: "^8.4.31",
          autoprefixer: "^10.4.16"
        }
      };

      await this.sandboxInstance.files.write(pkgPath, JSON.stringify(packageJson, null, 2));

      const viteConfigPath = `${root}/vite.config.js`;
      const viteConfig = `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    host: '0.0.0.0',\n    port: 5173,\n    strictPort: true,\n    // E2B preview domains are ephemeral; disable host check for reliability.\n    allowedHosts: true,\n    hmr: {\n      overlay: false,\n      clientPort: 443,\n      protocol: 'wss'\n    }\n  }\n})`;
      await this.sandboxInstance.files.write(viteConfigPath, viteConfig);

      const tailwindConfigPath = `${root}/tailwind.config.js`;
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: [\n    \"./index.html\",\n    \"./src/**/*.{js,ts,jsx,tsx}\",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n`;
      await this.sandboxInstance.files.write(tailwindConfigPath, tailwindConfig);

      const postcssConfigPath = `${root}/postcss.config.js`;
      const postcssConfig = `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`;
      await this.sandboxInstance.files.write(postcssConfigPath, postcssConfig);

      const indexHtmlPath = `${root}/index.html`;
      const indexHtml = `<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Sandbox App</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.jsx\"></script>\n  </body>\n</html>`;
      await this.sandboxInstance.files.write(indexHtmlPath, indexHtml);

      const mainPath = `${root}/src/main.jsx`;
      const mainJsx = `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)`;
      await this.sandboxInstance.files.write(mainPath, mainJsx);

      const appPath = `${root}/src/App.jsx`;
      const appJsx = `function App() {\n  return (\n    <div className=\"min-h-screen bg-gray-900 text-white flex items-center justify-center p-4\">\n      <div className=\"text-center max-w-2xl\">\n        <p className=\"text-lg text-gray-400\">\n          E2B Sandbox Ready<br/>\n          Start building your React app with Vite and Tailwind CSS!\n        </p>\n      </div>\n    </div>\n  )\n}\n\nexport default App`;
      await this.sandboxInstance.files.write(appPath, appJsx);

      const cssPath = `${root}/src/index.css`;
      const indexCss = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;\n  background-color: rgb(17 24 39);\n}\n`;
      await this.sandboxInstance.files.write(cssPath, indexCss);
    }

    // Ensure dependencies exist (skip if template already includes them).
    const hasNodeModules = await this.sandboxInstance.files.exists(`${root}/node_modules`).catch(() => false);
    if (!hasNodeModules) {
      const timeoutMs = Math.max(10 * 60_000, Number(process.env.SANDBOX_NPM_INSTALL_TIMEOUT_MS) || 0);
      const cacheDir = '/tmp/npm-cache';
      await this.sandboxInstance.commands.run(
        `sh -c ${JSON.stringify(`mkdir -p ${cacheDir} && HOME=/tmp NPM_CONFIG_CACHE=${cacheDir} npm_config_cache=${cacheDir} npm install`)}`,
        {
        cwd: root,
        timeoutMs,
        }
      );
    }

    // Start/Restart Vite (idempotent).
    await this.restartViteServer();

    // Track initial files (best-effort)
    this.existingFiles.add('src/App.jsx');
    this.existingFiles.add('src/main.jsx');
    this.existingFiles.add('src/index.css');
    this.existingFiles.add('index.html');
    this.existingFiles.add('package.json');
    this.existingFiles.add('vite.config.js');
    this.existingFiles.add('tailwind.config.js');
    this.existingFiles.add('postcss.config.js');
  }

  async restartViteServer(): Promise<void> {
    if (!this.sandboxInstance) {
      throw new Error('No active sandbox');
    }

    const root = this.resolveSandboxRoot();

    // Kill existing Vite processes (best-effort) and clear old logs
    await this.runCommand('pkill -f vite || true');
    await this.runCommand('rm -f /tmp/vite.log || true');

    // Workaround: in some E2B sandboxes `/app` can be non-writable for the Vite process.
    // Vite bundles the config to `vite.config.*.timestamp-*.mjs` in the same directory as the config file,
    // so we place a runtime config under `/tmp` (writable) and start Vite with `--config`.
    await this.runCommand('mkdir -p /tmp/vite-cache || true');
    const tmpConfigPath = '/tmp/vite.runtime.config.mjs';
    // Avoid `@vitejs/plugin-react` here because E2B sandboxes can have module-resolution quirks
    // when Vite bundles config under `/tmp`, leading to missing `react-refresh`.
    // Vite can compile JSX via esbuild without the React plugin (no fast refresh, but reliable).
    const tmpViteConfig = `export default {
  cacheDir: '/tmp/vite-cache',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // E2B preview domains are ephemeral; disable host check for reliability.
    allowedHosts: true,
    hmr: {
      overlay: false,
      clientPort: 443,
      protocol: 'wss'
    }
  }
}
`;
    await this.sandboxInstance.files.write(tmpConfigPath, tmpViteConfig).catch(() => {});

    // Start Vite (nohup + background) so the command returns immediately
    const startCmd = `nohup ./node_modules/.bin/vite --config ${tmpConfigPath} > /tmp/vite.log 2>&1 &`;
    await this.runCommand(startCmd);

    const check = await this.ensureViteListening(35_000);

    if (!check.ok) {
      // One more attempt: reinstall deps (in case node_modules missing) and retry.
      const hasNodeModules = await this.sandboxInstance.files.exists(`${root}/node_modules`).catch(() => false);
      if (!hasNodeModules) {
        const timeoutMs = Math.max(10 * 60_000, Number(process.env.SANDBOX_NPM_INSTALL_TIMEOUT_MS) || 0);
        const cacheDir = '/tmp/npm-cache';
        await this.sandboxInstance.commands.run(
          `sh -c ${JSON.stringify(`mkdir -p ${cacheDir} && HOME=/tmp NPM_CONFIG_CACHE=${cacheDir} npm_config_cache=${cacheDir} npm install`)}`,
          { cwd: root, timeoutMs }
        );
      }

      await this.runCommand('pkill -f vite || true');
      await this.runCommand('rm -f /tmp/vite.log || true');
      await this.runCommand(startCmd);

      const check2 = await this.ensureViteListening(35_000);
      if (!check2.ok) {
        const tail = check2.logTail || check.logTail || '';
        throw new Error(
          `Vite failed to start on port 5173 in E2B sandbox.\n` +
            (tail ? `\n--- /tmp/vite.log (tail) ---\n${tail}` : '')
        );
      }
    }

    // Refresh preview URL (host is derived from sandboxId + domain).
    if (this.sandboxInfo) {
      this.sandboxInfo.url = this.toPreviewUrl(this.sandboxInstance.getHost(5173));
    }
  }

  getSandboxUrl(): string | null {
    return this.sandboxInfo?.url || null;
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  async terminate(): Promise<void> {
    if (this.sandboxInstance) {
      try {
        await this.sandboxInstance.kill();
      } catch (e) {
        console.error('[E2BProvider] Failed to terminate sandbox:', e);
      }
    }
    this.sandboxInstance = null;
    this.sandbox = null;
    this.sandboxInfo = null;
  }

  isAlive(): boolean {
    return !!this.sandboxInstance;
  }

  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    if (!this.sandboxInstance) {
      return { healthy: false, error: 'No sandbox instance' };
    }
    try {
      const running = await this.sandboxInstance.isRunning({ requestTimeoutMs: 3000 });
      if (!running) return { healthy: false, error: 'SANDBOX_STOPPED' };
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error?.message || String(error) };
    }
  }
}

