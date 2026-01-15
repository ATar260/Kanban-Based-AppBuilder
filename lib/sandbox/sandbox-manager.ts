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
  private prewarmInFlight = 0;
  private ensureWarmPoolPromise: Promise<void> | null = null;
  private lastCleanupAt: number = 0;
  private lastPoolActivityAt: number = Date.now();
  private desiredPoolSize: number;
  private readonly POOL_BASELINE_SIZE: number;
  private readonly POOL_BURST_SIZE: number;
  
  // Resource limiting / lifecycle controls
  //
  // IMPORTANT: Warm sandbox pooling/prewarming is intentionally disabled.
  // We run a single-sandbox workflow now to avoid background sandbox churn and billing surprises.
  // (Leaving the implementation in place makes it easy to re-enable later if we ever want it back.)
  private readonly POOL_ENABLED = false;
  private readonly PREWARM_ENABLED = false;
  private readonly DEFAULT_POOL_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly CLEANUP_DEBOUNCE_MS = 30 * 1000; // avoid thrashing when many requests hit
  private readonly DEFAULT_POOL_SCALE_DOWN_IDLE_MS = 10 * 60 * 1000; // 10 minutes
  private readonly PREWARM_CONCURRENCY: number;

  constructor() {
    const clampInt = (n: unknown, min: number, max: number): number | null => {
      const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : NaN;
      if (!Number.isFinite(v)) return null;
      return Math.max(min, Math.min(v, max));
    };

    const envMax = clampInt(Number(process.env.SANDBOX_MAX_POOL_SIZE || process.env.SANDBOX_POOL_SIZE), 0, 10);
    // Keep it bounded to avoid runaway costs by misconfig.
    this.MAX_POOL_SIZE = envMax ?? 10;

    const baseline = clampInt(Number(process.env.SANDBOX_POOL_BASELINE), 0, this.MAX_POOL_SIZE) ?? 2;
    const burst = clampInt(Number(process.env.SANDBOX_POOL_BURST), 0, this.MAX_POOL_SIZE) ?? this.MAX_POOL_SIZE;

    this.POOL_BASELINE_SIZE = Math.max(0, Math.min(baseline, this.MAX_POOL_SIZE));
    this.POOL_BURST_SIZE = Math.max(this.POOL_BASELINE_SIZE, Math.min(burst, this.MAX_POOL_SIZE));
    this.desiredPoolSize = this.POOL_BASELINE_SIZE;

    const envConc = clampInt(Number(process.env.SANDBOX_PREWARM_CONCURRENCY), 1, 5);
    this.PREWARM_CONCURRENCY = envConc ?? 2;
  }

  private desiredProviderId(): 'vercel' | 'modal' | null {
    const pref = SandboxFactory.getPreferredProvider();
    if (pref === 'vercel') return 'vercel';
    if (pref === 'modal') return 'modal';

    // auto: prefer Modal when configured, else Vercel
    const disableVercel = process.env.SANDBOX_DISABLE_VERCEL === 'true';
    const modalOk = Boolean(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
    const vercelOk = !disableVercel && (
      Boolean(process.env.VERCEL_OIDC_TOKEN) ||
      Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID)
    );
    if (modalOk) return 'modal';
    if (vercelOk) return 'vercel';
    return null;
  }

  private pooledProviderId(p: PooledSandbox): string | null {
    try {
      const info: any = p?.provider?.getSandboxInfo?.();
      const v = info?.provider;
      if (v === 'vercel' || v === 'modal') return v;
    } catch {
      // ignore
    }
    const id = String(p?.sandboxId || '');
    if (id.startsWith('modal_')) return 'modal';
    if (id.startsWith('sbx_') || id.startsWith('vercel_')) return 'vercel';
    return null;
  }

  private getAllKnownSandboxIds(): Set<string> {
    const ids = new Set<string>();
    for (const id of this.sandboxes.keys()) ids.add(id);
    for (const p of this.sandboxPool) {
      if (p?.sandboxId) ids.add(p.sandboxId);
    }
    return ids;
  }

  async adoptKnownSandboxes(sandboxIds: string[]): Promise<{ adopted: number; attempted: number }> {
    if (!this.POOL_ENABLED) return { adopted: 0, attempted: 0 };

    const unique = Array.from(new Set((sandboxIds || []).map(s => String(s || '').trim()).filter(Boolean)));
    const attempted = unique.length;
    if (attempted === 0) return { adopted: 0, attempted: 0 };

    const known = this.getAllKnownSandboxIds();
    let adopted = 0;

    for (const id of unique) {
      if (this.sandboxPool.length >= this.MAX_POOL_SIZE) break;
      if (known.has(id)) continue;

      try {
        const provider = SandboxFactory.create();
        const ok = await provider.reconnect(id);
        const info = provider.getSandboxInfo?.();
        if (!ok || !info?.sandboxId) continue;
        if (info.sandboxId !== id) continue;

        this.sandboxPool.push({
          provider,
          sandboxId: id,
          createdAt: new Date(),
          isWarmed: true,
        });
        known.add(id);
        adopted += 1;
      } catch {
        // ignore failed adoption attempts
      }
    }

    return { adopted, attempted };
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
  registerSandbox(sandboxId: string, provider: SandboxProvider, opts?: { setActive?: boolean; inUse?: boolean }): void {
    this.sandboxes.set(sandboxId, {
      sandboxId,
      provider,
      createdAt: new Date(),
      lastAccessed: new Date(),
      inUse: opts?.inUse === true
    });
    const setActive = opts?.setActive !== false;
    if (setActive) {
      this.activeSandboxId = sandboxId;
    }
    this.lastPoolActivityAt = Date.now();
    
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

  markInUse(sandboxId: string, inUse: boolean): void {
    const info = this.sandboxes.get(sandboxId);
    if (!info) return;
    info.inUse = Boolean(inUse);
    info.lastAccessed = new Date();
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
      if (info.inUse) continue;
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

    // If we've previously burst the pool, opportunistically scale back down to baseline when idle.
    const envIdle = Number(process.env.SANDBOX_POOL_SCALE_DOWN_IDLE_MS);
    const scaleDownIdleMs =
      Number.isFinite(envIdle) && envIdle > 0 ? envIdle : this.DEFAULT_POOL_SCALE_DOWN_IDLE_MS;

    if (this.sandboxPool.length > this.POOL_BASELINE_SIZE && nowMs - this.lastPoolActivityAt > scaleDownIdleMs) {
      await this.shrinkPool(this.POOL_BASELINE_SIZE);
      this.desiredPoolSize = this.POOL_BASELINE_SIZE;
    }
  }

  // OPTIMIZATION: Get a sandbox from pool or create new
  async getPooledSandbox(): Promise<SandboxProvider | null> {
    if (!this.POOL_ENABLED) return null;

    // If the preferred provider changed (e.g. switching from Modal to Vercel), drop mismatched pooled sandboxes
    // so we don't keep handing out the wrong provider and so prewarm can refill with the desired provider.
    const desired = this.desiredProviderId();
    if (desired) {
      const keep: PooledSandbox[] = [];
      const drop: PooledSandbox[] = [];
      for (const p of this.sandboxPool) {
        const pid = this.pooledProviderId(p);
        if (!pid || pid === desired) keep.push(p);
        else drop.push(p);
      }
      if (drop.length > 0) {
        this.sandboxPool = keep;
        void Promise.allSettled(
          drop.map(p =>
            p.provider
              .terminate()
              .catch(err => console.warn(`[SandboxManager] Failed to terminate mismatched pooled sandbox ${p.sandboxId}:`, err))
          )
        );
      }
    }

    // Check if we have a warmed sandbox in the pool
    const pooled = this.sandboxPool.shift();
    if (pooled) {
      console.log(`[SandboxManager] OPTIMIZATION: Reusing pooled sandbox ${pooled.sandboxId}`);
      this.lastPoolActivityAt = Date.now();
      
      // Start pre-warming another sandbox in background
      const target = this.desiredPoolSize;
      if (target > 0 && this.PREWARM_ENABLED) {
        void this.ensureWarmPool(target);
      } else if (this.PREWARM_ENABLED) {
        this.prewarmSandbox();
      }
      
      return pooled.provider;
    }
    
    return null;
  }

  // OPTIMIZATION: Pre-warm a sandbox in background
  async prewarmSandbox(): Promise<void> {
    if (!this.POOL_ENABLED) return;

    if (this.prewarmInFlight >= this.PREWARM_CONCURRENCY || this.sandboxPool.length + this.prewarmInFlight >= this.MAX_POOL_SIZE) {
      return;
    }
    
    this.prewarmInFlight += 1;
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
      this.prewarmInFlight = Math.max(0, this.prewarmInFlight - 1);
    }
  }

  /**
   * Ensure the warm pool reaches a desired size (bounded and concurrency-limited).
   * This is used for “burst to N” demo readiness, and can be triggered on-demand.
   */
  async ensureWarmPool(targetSize: number): Promise<void> {
    if (!this.POOL_ENABLED) return;

    const target = Math.max(0, Math.min(Math.floor(targetSize || 0), this.MAX_POOL_SIZE));
    this.desiredPoolSize = target;
    this.lastPoolActivityAt = Date.now();

    if (target <= this.sandboxPool.length) return;

    if (this.ensureWarmPoolPromise) {
      await this.ensureWarmPoolPromise;
      return;
    }

    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

    const promise = (async () => {
      while (this.sandboxPool.length < target) {
        const remaining = target - this.sandboxPool.length;
        const availableSlots = Math.max(0, this.PREWARM_CONCURRENCY - this.prewarmInFlight);
        const toStart = Math.min(remaining, availableSlots);

        if (toStart <= 0) {
          await sleep(250);
          continue;
        }

        await Promise.allSettled(Array.from({ length: toStart }).map(() => this.prewarmSandbox()));
      }
    })();

    this.ensureWarmPoolPromise = promise.finally(() => {
      this.ensureWarmPoolPromise = null;
    });

    await this.ensureWarmPoolPromise;
  }

  async shrinkPool(targetSize: number): Promise<void> {
    if (!this.POOL_ENABLED) return;
    const target = Math.max(0, Math.min(Math.floor(targetSize || 0), this.MAX_POOL_SIZE));
    if (this.sandboxPool.length <= target) return;

    // Kill oldest pooled sandboxes first.
    const sorted = [...this.sandboxPool].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const keep = sorted.slice(sorted.length - target);
    const kill = sorted.slice(0, Math.max(0, sorted.length - target));
    this.sandboxPool = keep;

    await Promise.allSettled(
      kill.map(p => p.provider.terminate().catch(err =>
        console.error(`[SandboxManager] Error terminating pooled sandbox ${p.sandboxId}:`, err)
      ))
    );
  }

  getPoolTargets(): { baseline: number; burst: number; desired: number } {
    return {
      baseline: this.POOL_BASELINE_SIZE,
      burst: this.POOL_BURST_SIZE,
      desired: this.desiredPoolSize,
    };
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
        createdAt: new Date(),
        isWarmed: true
      });
      
      this.sandboxes.delete(sandboxId);
      this.lastPoolActivityAt = Date.now();
      console.log(`[SandboxManager] OPTIMIZATION: Returned sandbox ${sandboxId} to pool`);
      return true;
    } catch (error) {
      console.error(`[SandboxManager] Failed to return sandbox to pool:`, error);
      return false;
    }
  }

  // Get pool status for monitoring
  getPoolStatus(): {
    sandboxIds: string[];
    poolSize: number;
    maxSize: number;
    inFlight: number;
    isPrewarming: boolean;
    baselineSize: number;
    burstSize: number;
    desiredSize: number;
  } {
    return {
      sandboxIds: this.sandboxPool.map(p => p.sandboxId).filter(Boolean),
      poolSize: this.sandboxPool.length,
      maxSize: this.MAX_POOL_SIZE,
      inFlight: this.prewarmInFlight,
      isPrewarming: this.prewarmInFlight > 0,
      baselineSize: this.POOL_BASELINE_SIZE,
      burstSize: this.POOL_BURST_SIZE,
      desiredSize: this.desiredPoolSize,
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