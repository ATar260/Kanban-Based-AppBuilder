import { SandboxProvider, SandboxProviderConfig } from './types';
import { E2BProvider } from './providers/e2b-provider';
import { VercelProvider } from './providers/vercel-provider';

export class SandboxFactory {
  private static providerPriority = ['vercel', 'e2b']; // Vercel first (faster)
  
  static create(provider?: string, config?: SandboxProviderConfig): SandboxProvider {
    // Use environment variable if provider not specified
    const selectedProvider = provider || process.env.SANDBOX_PROVIDER || this.autoSelectProvider();
    
    console.log(`[SandboxFactory] Creating provider: ${selectedProvider}`);
    
    switch (selectedProvider.toLowerCase()) {
      case 'e2b':
        return new E2BProvider(config || {});
      
      case 'vercel':
        return new VercelProvider(config || {});
      
      default:
        throw new Error(`Unknown sandbox provider: ${selectedProvider}. Supported providers: e2b, vercel`);
    }
  }
  
  // OPTIMIZATION: Auto-select the best available provider
  static autoSelectProvider(): string {
    for (const provider of this.providerPriority) {
      if (this.isProviderAvailable(provider)) {
        console.log(`[SandboxFactory] Auto-selected provider: ${provider}`);
        return provider;
      }
    }
    console.warn('[SandboxFactory] No providers available, defaulting to e2b');
    return 'e2b';
  }
  
  // OPTIMIZATION: Create with automatic fallback
  static async createWithFallback(config?: SandboxProviderConfig): Promise<SandboxProvider> {
    for (const providerName of this.providerPriority) {
      if (!this.isProviderAvailable(providerName)) continue;
      
      try {
        console.log(`[SandboxFactory] Trying provider: ${providerName}`);
        const provider = this.create(providerName, config);
        await provider.createSandbox();
        console.log(`[SandboxFactory] Successfully created sandbox with: ${providerName}`);
        return provider;
      } catch (error) {
        console.warn(`[SandboxFactory] Provider ${providerName} failed:`, error);
        // Continue to next provider
      }
    }
    throw new Error('All sandbox providers failed');
  }
  
  static getAvailableProviders(): string[] {
    return ['e2b', 'vercel'];
  }
  
  static isProviderAvailable(provider: string): boolean {
    switch (provider.toLowerCase()) {
      case 'e2b':
        return !!process.env.E2B_API_KEY;
      
      case 'vercel':
        return !!process.env.VERCEL_OIDC_TOKEN || 
               (!!process.env.VERCEL_TOKEN && !!process.env.VERCEL_TEAM_ID && !!process.env.VERCEL_PROJECT_ID);
      
      default:
        return false;
    }
  }
}