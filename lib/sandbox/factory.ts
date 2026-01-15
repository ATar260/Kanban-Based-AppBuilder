import { SandboxProvider, SandboxProviderConfig } from './types';
import { ModalProvider } from './providers/modal-provider';
import { VercelProvider } from './providers/vercel-provider';

export class SandboxFactory {
  static getPreferredProvider(): 'auto' | 'modal' | 'vercel' {
    const raw = String(process.env.SANDBOX_PROVIDER || process.env.PREFERRED_SANDBOX_PROVIDER || '')
      .trim()
      .toLowerCase();
    if (raw === 'vercel') return 'vercel';
    if (raw === 'modal') return 'modal';
    return 'auto';
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
    const modalOk = this.isModalConfigured(resolvedConfig);
    const vercelOk = this.isVercelConfigured(resolvedConfig);

    // IMPORTANT:
    // - "auto" should be reliable and low-surprise. We prefer Modal when both are configured.
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
    } else if (preferred === 'modal') {
      if (modalOk) {
        console.log(`[SandboxFactory] Creating Modal sandbox (SANDBOX_PROVIDER=modal)`);
        return new ModalProvider(resolvedConfig);
      }
      if (vercelOk) {
        console.log(`[SandboxFactory] Creating Vercel sandbox (fallback; Modal not configured)`);
        return new VercelProvider(resolvedConfig);
      }
    } else {
      // auto
      if (modalOk) {
        console.log(`[SandboxFactory] Creating Modal sandbox (auto)`);
        return new ModalProvider(resolvedConfig);
      }
      if (vercelOk) {
        console.log(`[SandboxFactory] Creating Vercel sandbox (auto; Modal not configured)`);
        return new VercelProvider(resolvedConfig);
      }
    }

    // Default to Modal (will fail with a helpful error upstream)
    console.log(`[SandboxFactory] No sandbox provider configured; defaulting to Modal provider instance`);
    return new ModalProvider(resolvedConfig);
  }
  
  static async createWithFallback(config?: SandboxProviderConfig): Promise<SandboxProvider> {
    if (!this.isProviderAvailable()) {
      throw new Error(
        'No sandbox provider configured. Set MODAL_TOKEN_ID/MODAL_TOKEN_SECRET (Modal) or VERCEL_OIDC_TOKEN (or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID).'
      );
    }
    
    const provider = this.create(config);
    await provider.createSandbox();
    console.log(`[SandboxFactory] Successfully created sandbox`);
    return provider;
  }
  
  static getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.isModalConfigured()) providers.push('modal');
    if (this.isVercelConfigured()) providers.push('vercel');
    return providers;
  }
  
  static isProviderAvailable(): boolean {
    return this.isModalConfigured() || this.isVercelConfigured();
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
