import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { ModalClient } from 'modal';

export class ModalProvider extends SandboxProvider {
  private modal: ModalClient;
  private modalSandbox: any = null;
  private modalApp: any = null;
  private tunnelUrl: string | null = null;
  private existingFiles: Set<string> = new Set();

  constructor(config: any) {
    super(config);
    this.modal = new ModalClient();
  }

  async createSandbox(): Promise<SandboxInfo> {
    try {
      if (this.modalSandbox) {
        await this.terminate();
      }

      this.existingFiles.clear();

      this.modalApp = await this.modal.apps.fromName('open-lovable-sandbox', {
        createIfMissing: true,
      });

      const image = this.modal.images.fromRegistry('node:22-slim');

      // For demo/build runs, sandboxes need to survive longer idle periods.
      // Default to 4 hours (configurable) to better match Vercel sandbox behavior and avoid preview disconnects.
      const defaultTimeoutMs = 4 * 60 * 60 * 1000; // 4 hours
      const envTimeoutMs = Number(process.env.MODAL_SANDBOX_TIMEOUT_MS);
      const timeoutMs = Number.isFinite(envTimeoutMs) && envTimeoutMs > 0 ? envTimeoutMs : defaultTimeoutMs;

      this.modalSandbox = await this.modal.sandboxes.create(this.modalApp, image, {
        timeoutMs,
        workdir: '/app',
        encryptedPorts: [5173],
      });

      const sandboxId = this.modalSandbox.id || `modal_${Date.now()}`;

      const tunnels = await this.modalSandbox.tunnels();
      console.log('[ModalProvider] Initial tunnels:', JSON.stringify(tunnels, null, 2));
      this.tunnelUrl = tunnels[5173]?.url || null;
      console.log('[ModalProvider] Tunnel URL for port 5173:', this.tunnelUrl);

      this.sandbox = this.modalSandbox;
      
      if (!this.tunnelUrl) {
        console.warn('[ModalProvider] No tunnel URL available yet - will fetch after Vite starts');
      }
      
      this.sandboxInfo = {
        sandboxId,
        url: this.tunnelUrl || 'pending',
        provider: 'modal',
        createdAt: new Date(),
      };

      return this.sandboxInfo;
    } catch (error) {
      console.error('[ModalProvider] Error creating sandbox:', error);
      throw error;
    }
  }

  async runCommand(command: string): Promise<CommandResult> {
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    try {
      // Execute via shell so pipes/redirects/&&/quotes work correctly.
      const process = await this.modalSandbox.exec(['sh', '-c', command]);

      const stdout = await process.stdout.readText();
      const stderr = await process.stderr.readText();
      const exitCode = await process.wait();

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: exitCode || 0,
        success: exitCode === 0,
      };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message || 'Command failed',
        exitCode: 1,
        success: false,
      };
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    const fullPath = path.startsWith('/') ? path : `/app/${path}`;

    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir) {
      await this.modalSandbox.exec(['mkdir', '-p', dir]);
    }

    const escapedContent = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''");

    await this.modalSandbox.exec(['sh', '-c', `cat > '${fullPath}' << 'EOFMARKER'\n${content}\nEOFMARKER`]);

    this.existingFiles.add(path);
  }

  async readFile(path: string): Promise<string> {
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    const fullPath = path.startsWith('/') ? path : `/app/${path}`;
    const process = await this.modalSandbox.exec(['cat', fullPath]);
    const content = await process.stdout.readText();

    return content;
  }

  async listFiles(directory: string = '/app'): Promise<string[]> {
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    const result = await this.runCommand(
      `find ${directory} -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" | sed "s|^${directory}/||"`
    );

    if (!result.success) {
      return [];
    }

    return result.stdout.split('\n').filter((line: string) => line.trim() !== '');
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    const flags = process.env.NPM_FLAGS || '';
    const args = ['npm', 'install'];
    if (flags) args.push(...flags.split(' '));
    args.push(...packages);

    const proc = await this.modalSandbox.exec(args);
    const stdout = await proc.stdout.readText();
    const stderr = await proc.stderr.readText();
    const exitCode = await proc.wait();

    if (exitCode === 0 && process.env.AUTO_RESTART_VITE === 'true') {
      await this.restartViteServer();
    }

    return {
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: exitCode || 0,
      success: exitCode === 0,
    };
  }

  async setupViteApp(): Promise<void> {
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    await this.modalSandbox.exec(['mkdir', '-p', '/app/src']);

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

    await this.writeFile('package.json', JSON.stringify(packageJson, null, 2));

    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow Modal tunnel domains (and other sandbox domains) to load the preview without host blocking.
    allowedHosts: [
      '.modal.host',
      '.vercel.run',
      '.e2b.dev',
      'localhost',
    ],
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    }
  }
})`;

    await this.writeFile('vite.config.js', viteConfig);

    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;

    await this.writeFile('tailwind.config.js', tailwindConfig);

    const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

    await this.writeFile('postcss.config.js', postcssConfig);

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

    await this.writeFile('index.html', indexHtml);

    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

    await this.writeFile('src/main.jsx', mainJsx);

    const appJsx = `function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <p className="text-lg text-gray-400">
          Modal Sandbox Ready<br/>
          Start building your React app with Vite and Tailwind CSS!
        </p>
      </div>
    </div>
  )
}

export default App`;

    await this.writeFile('src/App.jsx', appJsx);

    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}`;

    await this.writeFile('src/index.css', indexCss);

    const npmInstall = await this.modalSandbox.exec(['npm', 'install']);
    await npmInstall.wait();
    console.log('[ModalProvider] npm install completed');

    await this.modalSandbox.exec(['sh', '-c', 'pkill -f vite || true']);

    await this.modalSandbox.exec(['sh', '-c', 'nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/vite.log 2>&1 &']);

    await new Promise(resolve => setTimeout(resolve, 7000));

    // Refresh tunnel URL after Vite starts - retry up to 5 times
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const tunnels = await this.modalSandbox.tunnels();
        console.log(`[ModalProvider] Tunnel check attempt ${attempt + 1}:`, JSON.stringify(tunnels, null, 2));
        if (tunnels[5173]?.url) {
          this.tunnelUrl = tunnels[5173].url;
          if (this.sandboxInfo && this.tunnelUrl) {
            this.sandboxInfo.url = this.tunnelUrl;
          }
          console.log('[ModalProvider] Tunnel URL ready:', this.tunnelUrl);
          break;
        }
      } catch (e) {
        console.log(`[ModalProvider] Tunnel check attempt ${attempt + 1} failed:`, e);
      }
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

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
    if (!this.modalSandbox) {
      throw new Error('No active sandbox');
    }

    await this.modalSandbox.exec(['sh', '-c', 'pkill -f vite || true']);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.modalSandbox.exec(['sh', '-c', 'nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/vite.log 2>&1 &']);
    await new Promise(resolve => setTimeout(resolve, 7000));

    // Refresh tunnel URL - retry up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const tunnels = await this.modalSandbox.tunnels();
        if (tunnels[5173]?.url) {
          this.tunnelUrl = tunnels[5173].url;
          if (this.sandboxInfo && this.tunnelUrl) {
            this.sandboxInfo.url = this.tunnelUrl;
          }
          console.log('[ModalProvider] Tunnel URL refreshed:', this.tunnelUrl);
          break;
        }
      } catch (e) {
        console.log(`[ModalProvider] Tunnel refresh attempt ${attempt + 1} failed:`, e);
      }
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  getSandboxUrl(): string | null {
    return this.sandboxInfo?.url || null;
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  async terminate(): Promise<void> {
    if (this.modalSandbox) {
      try {
        await this.modalSandbox.terminate();
      } catch (e) {
        console.error('Failed to terminate Modal sandbox:', e);
      }
      this.modalSandbox = null;
      this.sandbox = null;
      this.sandboxInfo = null;
      this.tunnelUrl = null;
    }
  }

  isAlive(): boolean {
    return !!this.modalSandbox;
  }

  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    if (!this.modalSandbox) {
      return { healthy: false, error: 'No sandbox instance' };
    }

    try {
      const process = await this.modalSandbox.exec(['echo', 'health-check']);
      const exitCode = await process.wait();
      return { healthy: exitCode === 0 };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  async makePersistent(): Promise<{ persistentUrl: string; expiresAt: Date } | null> {
    if (!this.modalSandbox || !this.sandboxInfo) {
      return null;
    }

    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      this.sandboxInfo.persistent = true;
      this.sandboxInfo.persistentUrl = this.sandboxInfo.url;
      this.sandboxInfo.expiresAt = expiresAt;

      return {
        persistentUrl: this.sandboxInfo.url,
        expiresAt,
      };
    } catch (error) {
      console.error('[ModalProvider] Failed to make sandbox persistent:', error);
      return null;
    }
  }

  async extendLifetime(hours: number): Promise<boolean> {
    if (!this.modalSandbox || !this.sandboxInfo) {
      return false;
    }

    try {
      const newExpiry = new Date(Date.now() + hours * 60 * 60 * 1000);
      this.sandboxInfo.expiresAt = newExpiry;
      return true;
    } catch (error) {
      console.error('[ModalProvider] Failed to extend sandbox lifetime:', error);
      return false;
    }
  }
}
