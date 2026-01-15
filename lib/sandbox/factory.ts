import { SandboxProvider, SandboxProviderConfig } from './types';
import { E2BProvider } from './providers/e2b-provider';
import { ModalProvider } from './providers/modal-provider';
import { VercelProvider } from './providers/vercel-provider';

export class SandboxFactory {
  static getPreferredProvider(): 'auto' | 'e2b' | 'modal' | 'vercel' {
    const raw = String(process.env.SANDBOX_PROVIDER || process.env.PREFERRED_SANDBOX_PROVIDER || '')
      .trim()
      .toLowerCase();
    if (raw === 'e2b') return 'e2b';
    if (raw === 'vercel') return 'vercel';
    if (raw === 'modal') return 'modal';
    return 'auto';
  }

  static isE2BAvailable(): boolean {
    return this.isE2BConfigured();
  }

  static isModalAvailable(): boolean {
    return this.isModalConfigured();
  }

  static isVercelAvailable(): boolean {
    return this.isVercelConfigured();
  }

  static create(config?: SandboxProviderConfig): SandboxProvider {
    const resolvedConfig = config || {};

    const preferred = this.getPreferredProvider();
    const e2bOk = this.isE2BConfigured(resolvedConfig);
    const modalOk = this.isModalConfigured(resolvedConfig);
    const vercelOk = this.isVercelConfigured(resolvedConfig);

    if (preferred === 'e2b') {
      if (e2bOk) {
        console.log(`[SandboxFactory] Creating E2B sandbox (SANDBOX_PROVIDER=e2b)`);
        return new E2BProvider(resolvedConfig);
      }
      if (modalOk) {
        console.log(`[SandboxFactory] Creating Modal sandbox (fallback; E2B not configured)`);
        return new ModalProvider(resolvedConfig);
      }
      if (vercelOk) {
        console.log(`[SandboxFactory] Creating Vercel sandbox (fallback; E2B not configured)`);
        return new VercelProvider(resolvedConfig);
      }
    }

    // IMPORTANT:
    // - "auto" should be reliable and low-surprise. Prefer E2B when configured.
    // - Vercel Sandboxes may return 402 depending on plan/limits; Modal remains the default fallback.
    if (preferred === 'vercel') {
      if (vercelOk) {
        console.log(`[SandboxFactory] Creating Vercel sandbox (SANDBOX_PROVIDER=vercel)`);
        return new VercelProvider(resolvedConfig);
      }
      if (modalOk) {
        console.log(`[SandboxFactory] Creating Modal sandbox (fallback; Vercel not configured)`);
        return new ModalProvider(resolvedConfig);
      }
      if (e2bOk) {
        console.log(`[SandboxFactory] Creating E2B sandbox (fallback; Vercel not configured)`);
        return new E2BProvider(resolvedConfig);
      }
    } else if (preferred === 'modal') {
      if (modalOk) {
        console.log(`[SandboxFactory] Creating Modal sandbox (SANDBOX_PROVIDER=modal)`);
        return new ModalProvider(resolvedConfig);
      }
      if (vercelOk) {
        console.log(`[SandboxFactory] Creating Vercel sandbox (fallback; Modal not configured)`);
        return new VercelProvider(resolvedConfig);
      }
      if (e2bOk) {
        console.log(`[SandboxFactory] Creating E2B sandbox (fallback; Modal not configured)`);
        return new E2BProvider(resolvedConfig);
      }
    } else {
      // auto
      if (e2bOk) {
        console.log(`[SandboxFactory] Creating E2B sandbox (auto)`);
        return new E2BProvider(resolvedConfig);
      }
      if (modalOk) {
        console.log(`[SandboxFactory] Creating Modal sandbox (auto)`);
        return new ModalProvider(resolvedConfig);
      }
      if (vercelOk) {
        console.log(`[SandboxFactory] Creating Vercel sandbox (auto; E2B/Modal not configured)`);
        return new VercelProvider(resolvedConfig);
      }
    }

    // Default to Modal (will fail with a helpful error upstream)
    console.log(`[SandboxFactory] No sandbox provider configured; defaulting to E2B provider instance`);
    return new E2BProvider(resolvedConfig);
  }
  
  static async createWithFallback(config?: SandboxProviderConfig): Promise<SandboxProvider> {
    if (!this.isProviderAvailable()) {
      throw new Error(
        'No sandbox provider configured. Set E2B_API_KEY (E2B), MODAL_TOKEN_ID/MODAL_TOKEN_SECRET (Modal), or VERCEL_OIDC_TOKEN (or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID).'
      );
    }
    
    const provider = this.create(config);
    await provider.createSandbox();
    console.log(`[SandboxFactory] Successfully created sandbox`);
    return provider;
  }
  
  static getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.isE2BConfigured()) providers.push('e2b');
    if (this.isModalConfigured()) providers.push('modal');
    if (this.isVercelConfigured()) providers.push('vercel');
    return providers;
  }
  
  static isProviderAvailable(): boolean {
    return this.isE2BConfigured() || this.isModalConfigured() || this.isVercelConfigured();
  }

  private static isE2BConfigured(config?: SandboxProviderConfig): boolean {
    const apiKey = config?.e2b?.apiKey || process.env.E2B_API_KEY;
    return Boolean(apiKey && String(apiKey).trim().length > 0);
  }

  private static isModalConfigured(_config?: SandboxProviderConfig): boolean {
    return !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
  }

  private static isVercelConfigured(_config?: SandboxProviderConfig): boolean {
    // Opt-out switch (useful if Vercel Sandboxes are not available due to billing/limits).
    if (process.env.SANDBOX_DISABLE_VERCEL === 'true') return false;
    // Support either OIDC or token+team+project for Vercel Sandboxes
    if (process.env.VERCEL_OIDC_TOKEN) return true;
    return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID);
  }
}
