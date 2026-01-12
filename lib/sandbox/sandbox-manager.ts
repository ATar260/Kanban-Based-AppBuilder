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
  private readonly MAX_POOL_SIZE: number;
  private isPrewarming = false;
  private lastCleanupAt: number = 0;
  
  // Resource limiting / lifecycle controls
  private readonly POOL_ENABLED = process.env.SANDBOX_POOL_ENABLED === 'true';
  private readonly PREWARM_ENABLED =
    process.env.SANDBOX_PREWARM_ENABLED === 'true' || process.env.SANDBOX_PREWARM === 'true';
  private readonly DEFAULT_POOL_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly CLEANUP_DEBOUNCE_MS = 30 * 1000; // avoid thrashing when many requests hit

  constructor() {
    const envSize = Number(process.env.SANDBOX_POOL_SIZE || process.env.SANDBOX_MAX_POOL_SIZE);
    const size = Number.isFinite(envSize) && envSize > 0 ? Math.floor(envSize) : 2;
    // Keep it bounded to avoid runaway costs by misconfig.
    this.MAX_POOL_SIZE = Math.max(0, Math.min(size, 10));
  }

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

      // Providers may support reconnecting to an existing sandbox by ID (e.g., Vercel Sandboxes).
      try {
        const reconnected = await provider.reconnect(sandboxId);
        const info = provider.getSandboxInfo?.();
        if (reconnected && info?.sandboxId) {
          this.sandboxes.set(info.sandboxId, {
            sandboxId: info.sandboxId,
            provider,
            createdAt: new Date(),
            lastAccessed: new Date(),
            inUse: true,
          });
          this.activeSandboxId = info.sandboxId;
          return provider;
        }
      } catch (e) {
        console.warn(`[SandboxManager] Provider reconnect failed for sandbox ${sandboxId}:`, e);
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
  registerSandbox(sandboxId: string, provider: SandboxProvider, opts?: { setActive?: boolean }): void {
    this.sandboxes.set(sandboxId, {
      sandboxId,
      provider,
      createdAt: new Date(),
      lastAccessed: new Date(),
      inUse: true
    });
    const setActive = opts?.setActive !== false;
    if (setActive) {
      this.activeSandboxId = sandboxId;
    }
    
    // Start pre-warming another sandbox in background (optional; can be expensive)
    if (this.POOL_ENABLED && this.PREWARM_ENABLED) {
      this.prewarmSandbox();
    }
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
   * Clear the active provider (for stopped sandboxes)
   */
  clearActiveProvider(): void {
    if (this.activeSandboxId) {
      this.sandboxes.delete(this.activeSandboxId);
      this.activeSandboxId = null;
    }
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

    // Also terminate any pooled sandboxes (they may still be running)
    const pooled = this.sandboxPool.splice(0, this.sandboxPool.length);
    await Promise.all(
      pooled.map(p => p.provider.terminate().catch(err =>
        console.error(`[SandboxManager] Error terminating pooled sandbox ${p.sandboxId}:`, err)
      ))
    );
  }

  /**
   * Clean up old sandboxes (older than maxAge milliseconds)
   */
  async cleanup(maxAge: number = 3600000): Promise<void> {
    const nowMs = Date.now();
    if (nowMs - this.lastCleanupAt < this.CLEANUP_DEBOUNCE_MS) {
      return;
    }
    this.lastCleanupAt = nowMs;

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

    // Also clean up pooled sandboxes that have been sitting around too long (resource limit)
    const poolTtlMs = (() => {
      const env = Number(process.env.SANDBOX_POOL_TTL_MS);
      if (Number.isFinite(env) && env > 0) return env;
      return this.DEFAULT_POOL_TTL_MS;
    })();

    if (this.sandboxPool.length > 0) {
      const keep: PooledSandbox[] = [];
      const kill: PooledSandbox[] = [];
      for (const pooled of this.sandboxPool) {
        const ageMs = now.getTime() - pooled.createdAt.getTime();
        if (ageMs > poolTtlMs) {
          kill.push(pooled);
        } else {
          keep.push(pooled);
        }
      }
      this.sandboxPool = keep;
      await Promise.all(
        kill.map(p => p.provider.terminate().catch(err =>
          console.error(`[SandboxManager] Error terminating stale pooled sandbox ${p.sandboxId}:`, err)
        ))
      );
    }
  }

  // OPTIMIZATION: Get a sandbox from pool or create new
  async getPooledSandbox(): Promise<SandboxProvider | null> {
    if (!this.POOL_ENABLED) return null;

    // Check if we have a warmed sandbox in the pool
    const pooled = this.sandboxPool.shift();
    if (pooled) {
      console.log(`[SandboxManager] OPTIMIZATION: Reusing pooled sandbox ${pooled.sandboxId}`);
      
      // Start pre-warming another sandbox in background
      if (this.PREWARM_ENABLED) {
        this.prewarmSandbox();
      }
      
      return pooled.provider;
    }
    
    return null;
  }

  // OPTIMIZATION: Pre-warm a sandbox in background
  async prewarmSandbox(): Promise<void> {
    if (!this.POOL_ENABLED) return;

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
    if (!this.POOL_ENABLED) return false;

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