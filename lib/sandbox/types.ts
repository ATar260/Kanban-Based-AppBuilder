export interface SandboxFile {
  path: string;
  content: string;
  lastModified?: number;
}

export interface SandboxInfo {
  sandboxId: string;
  url: string;
  provider: 'modal';
  createdAt: Date;
  templateTarget?: TemplateTarget;
  devPort?: number;
  persistent?: boolean;
  persistentUrl?: string;
  expiresAt?: Date;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface SandboxProviderConfig {
  modal?: {
    tokenId?: string;
    tokenSecret?: string;
  };
}

export type TemplateTarget = 'vite' | 'next';

export abstract class SandboxProvider {
  protected config: SandboxProviderConfig;
  protected sandbox: any;
  protected sandboxInfo: SandboxInfo | null = null;

  constructor(config: SandboxProviderConfig) {
    this.config = config;
  }

  abstract createSandbox(): Promise<SandboxInfo>;
  abstract runCommand(command: string): Promise<CommandResult>;
  abstract writeFile(path: string, content: string): Promise<void>;
  abstract readFile(path: string): Promise<string>;
  abstract listFiles(directory?: string): Promise<string[]>;
  abstract installPackages(packages: string[]): Promise<CommandResult>;
  abstract getSandboxUrl(): string | null;
  abstract getSandboxInfo(): SandboxInfo | null;
  abstract terminate(): Promise<void>;
  abstract isAlive(): boolean;
  
  async makePersistent(): Promise<{ persistentUrl: string; expiresAt: Date } | null> {
    return null;
  }
  
  async extendLifetime(hours: number): Promise<boolean> {
    return false;
  }
  
  // Optional methods that providers can override
  async setupViteApp(): Promise<void> {
    // Default implementation for setting up a Vite React app
    throw new Error('setupViteApp not implemented for this provider');
  }

  async setupNextApp(): Promise<void> {
    // Default implementation for setting up a Next.js app
    throw new Error('setupNextApp not implemented for this provider');
  }
  
  async restartViteServer(): Promise<void> {
    // Default implementation for restarting Vite
    throw new Error('restartViteServer not implemented for this provider');
  }

  async restartNextServer(): Promise<void> {
    // Default implementation for restarting Next.js dev server
    throw new Error('restartNextServer not implemented for this provider');
  }
}