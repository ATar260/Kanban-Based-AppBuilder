import { SandboxProvider } from './types';
import { SandboxFactory } from './factory';

interface SandboxInfo {
  sandboxId: string;
  provider: SandboxProvider;
  createdAt: Date;
  lastAccessed: Date;
  inUse: boolean;
}

interface PooledSandbox {
  provider: SandboxProvider;
  sandboxId: string;
  createdAt: Date;
  isWarmed: boolean;
}

class SandboxManager {
  private sandboxes: Map<string, SandboxInfo> = new Map();
  private activeSandboxId: string | null = null;
  
  // OPTIMIZATION: Sandbox pool for reuse
  private sandboxPool: PooledSandbox[] = [];
  private readonly MAX_POOL_SIZE = 2;
  private isPrewarming = false;

  /**
   * Get or create a sandbox provider for the given sandbox ID
   */
  async getOrCreateProvider(sandboxId: string): Promise<SandboxProvider> {
    // Check if we already have this sandbox
    const existing = this.sandboxes.get(sandboxId);
    if (existing) {
      existing.lastAccessed = new Date();
      return existing.provider;
    }

    // Try to reconnect to existing sandbox
    
    try {
      const provider = SandboxFactory.create();
      
      // For E2B provider, try to reconnect
      if (provider.constructor.name === 'E2BProvider') {
        // E2B sandboxes can be reconnected using the sandbox ID
        const reconnected = await (provider as any).reconnect(sandboxId);
        if (reconnected) {
          this.sandboxes.set(sandboxId, {
            sandboxId,
            provider,
            createdAt: new Date(),
            lastAccessed: new Date(),
            inUse: true
          });
          this.activeSandboxId = sandboxId;
          return provider;
        }
      }
      
      // For Vercel or if reconnection failed, return the new provider
      // The caller will need to handle creating a new sandbox
      return provider;
    } catch (error) {
      console.error(`[SandboxManager] Error reconnecting to sandbox ${sandboxId}:`, error);
      throw error;
    }
  }

  /**
   * Register a new sandbox
   */
  registerSandbox(sandboxId: string, provider: SandboxProvider): void {
    this.sandboxes.set(sandboxId, {
      sandboxId,
      provider,
      createdAt: new Date(),
      lastAccessed: new Date(),
      inUse: true
    });
    this.activeSandboxId = sandboxId;
    
    // Start pre-warming another sandbox in background
    this.prewarmSandbox();
  }

  /**
   * Get the active sandbox provider
   */
  getActiveProvider(): SandboxProvider | null {
    if (!this.activeSandboxId) {
      return null;
    }
    
    const sandbox = this.sandboxes.get(this.activeSandboxId);
    if (sandbox) {
      sandbox.lastAccessed = new Date();
      return sandbox.provider;
    }
    
    return null;
  }

  /**
   * Get a specific sandbox provider
   */
  getProvider(sandboxId: string): SandboxProvider | null {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      sandbox.lastAccessed = new Date();
      return sandbox.provider;
    }
    return null;
  }

  /**
   * Set the active sandbox
   */
  setActiveSandbox(sandboxId: string): boolean {
    if (this.sandboxes.has(sandboxId)) {
      this.activeSandboxId = sandboxId;
      return true;
    }
    return false;
  }

  /**
   * Terminate a sandbox
   */
  async terminateSandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      try {
        await sandbox.provider.terminate();
      } catch (error) {
        console.error(`[SandboxManager] Error terminating sandbox ${sandboxId}:`, error);
      }
      this.sandboxes.delete(sandboxId);
      
      if (this.activeSandboxId === sandboxId) {
        this.activeSandboxId = null;
      }
    }
  }

  /**
   * Terminate all sandboxes
   */
  async terminateAll(): Promise<void> {
    const promises = Array.from(this.sandboxes.values()).map(sandbox => 
      sandbox.provider.terminate().catch(err => 
        console.error(`[SandboxManager] Error terminating sandbox ${sandbox.sandboxId}:`, err)
      )
    );
    
    await Promise.all(promises);
    this.sandboxes.clear();
    this.activeSandboxId = null;
  }

  /**
   * Clean up old sandboxes (older than maxAge milliseconds)
   */
  async cleanup(maxAge: number = 3600000): Promise<void> {
    const now = new Date();
    const toDelete: string[] = [];
    
    for (const [id, info] of this.sandboxes.entries()) {
      const age = now.getTime() - info.lastAccessed.getTime();
      if (age > maxAge) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      await this.terminateSandbox(id);
    }
  }

  // OPTIMIZATION: Get a sandbox from pool or create new
  async getPooledSandbox(): Promise<SandboxProvider | null> {
    // Check if we have a warmed sandbox in the pool
    const pooled = this.sandboxPool.shift();
    if (pooled) {
      console.log(`[SandboxManager] OPTIMIZATION: Reusing pooled sandbox ${pooled.sandboxId}`);
      
      // Start pre-warming another sandbox in background
      this.prewarmSandbox();
      
      return pooled.provider;
    }
    
    return null;
  }

  // OPTIMIZATION: Pre-warm a sandbox in background
  async prewarmSandbox(): Promise<void> {
    if (this.isPrewarming || this.sandboxPool.length >= this.MAX_POOL_SIZE) {
      return;
    }
    
    this.isPrewarming = true;
    console.log('[SandboxManager] OPTIMIZATION: Pre-warming sandbox in background...');
    
    try {
      const provider = SandboxFactory.create();
      const sandboxInfo = await provider.createSandbox();
      await provider.setupViteApp();
      
      this.sandboxPool.push({
        provider,
        sandboxId: sandboxInfo.sandboxId,
        createdAt: new Date(),
        isWarmed: true
      });
      
      console.log(`[SandboxManager] OPTIMIZATION: Pre-warmed sandbox ${sandboxInfo.sandboxId} ready`);
    } catch (error) {
      console.error('[SandboxManager] Failed to pre-warm sandbox:', error);
    } finally {
      this.isPrewarming = false;
    }
  }

  // OPTIMIZATION: Return sandbox to pool for reuse
  async returnToPool(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox || this.sandboxPool.length >= this.MAX_POOL_SIZE) {
      return false;
    }
    
    // Clean the sandbox files for reuse
    try {
      await sandbox.provider.runCommand('rm -rf src/* && mkdir -p src/components');
      
      this.sandboxPool.push({
        provider: sandbox.provider,
        sandboxId,
        createdAt: sandbox.createdAt,
        isWarmed: true
      });
      
      this.sandboxes.delete(sandboxId);
      console.log(`[SandboxManager] OPTIMIZATION: Returned sandbox ${sandboxId} to pool`);
      return true;
    } catch (error) {
      console.error(`[SandboxManager] Failed to return sandbox to pool:`, error);
      return false;
    }
  }

  // Get pool status for monitoring
  getPoolStatus(): { poolSize: number; maxSize: number; isPrewarming: boolean } {
    return {
      poolSize: this.sandboxPool.length,
      maxSize: this.MAX_POOL_SIZE,
      isPrewarming: this.isPrewarming
    };
  }
}

// Export singleton instance
export const sandboxManager = new SandboxManager();

// Also maintain backward compatibility with global state
declare global {
  var sandboxManager: SandboxManager;
}

// Ensure the global reference points to our singleton
global.sandboxManager = sandboxManager;