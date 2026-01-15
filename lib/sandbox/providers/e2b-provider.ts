import { Sandbox as E2BSandbox } from 'e2b';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';

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
    const cmd = `npm install ${flags ? `${flags} ` : ''}${pkgs.join(' ')}`.trim();

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
          "react-dom": "^18.2.0"
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
      const viteConfig = `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    host: '0.0.0.0',\n    port: 5173,\n    strictPort: true,\n    // Allow sandbox preview domains to load the preview without host blocking.\n    allowedHosts: [\n      '.e2b.dev',\n      '.modal.host',\n      '.vercel.run',\n      'localhost',\n    ],\n    hmr: {\n      clientPort: 443,\n      protocol: 'wss'\n    }\n  }\n})`;
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
      await this.sandboxInstance.commands.run(`sh -c ${JSON.stringify('npm install')}`, {
        cwd: root,
        timeoutMs,
      });
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

    // Kill existing Vite processes (best-effort)
    await this.runCommand('pkill -f vite || true');

    // Start Vite in background
    await this.sandboxInstance.commands.run(
      `sh -c ${JSON.stringify('npm run dev -- --host 0.0.0.0 --port 5173 --strictPort')}`,
      { cwd: root, background: true }
    );

    // Best-effort small wait to reduce immediate preview errors (no hard dependency).
    await new Promise(resolve => setTimeout(resolve, 2000));

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

