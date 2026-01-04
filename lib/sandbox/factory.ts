import { SandboxProvider, SandboxProviderConfig } from './types';
import { VercelProvider } from './providers/vercel-provider';

export class SandboxFactory {
  static create(provider?: string, config?: SandboxProviderConfig): SandboxProvider {
    const selectedProvider = provider || process.env.SANDBOX_PROVIDER || 'vercel';
    
    console.log(`[SandboxFactory] Creating provider: ${selectedProvider}`);
    
    if (selectedProvider.toLowerCase() !== 'vercel') {
      throw new Error(`Unknown sandbox provider: ${selectedProvider}. Supported provider: vercel`);
    }
    
    return new VercelProvider(config || {});
  }
  
  static async createWithFallback(config?: SandboxProviderConfig): Promise<SandboxProvider> {
    if (!this.isProviderAvailable('vercel')) {
      throw new Error('Vercel sandbox provider not configured');
    }
    
    console.log(`[SandboxFactory] Creating Vercel sandbox`);
    const provider = this.create('vercel', config);
    await provider.createSandbox();
    console.log(`[SandboxFactory] Successfully created sandbox with Vercel`);
    return provider;
  }
  
  static getAvailableProviders(): string[] {
    return ['vercel'];
  }
  
  static isProviderAvailable(provider: string): boolean {
    if (provider.toLowerCase() !== 'vercel') {
      return false;
    }
    return !!process.env.VERCEL_OIDC_TOKEN || 
           (!!process.env.VERCEL_TOKEN && !!process.env.VERCEL_TEAM_ID && !!process.env.VERCEL_PROJECT_ID);
  }
}
