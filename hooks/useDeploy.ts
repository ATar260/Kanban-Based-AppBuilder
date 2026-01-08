'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

type DeployProvider = 'vercel' | 'netlify';

interface DeployState {
  isDeploying: boolean;
  lastDeployment: {
    provider: DeployProvider;
    url: string;
    timestamp: string;
  } | null;
  error: string | null;
  availableProviders: {
    vercel: boolean;
    netlify: boolean;
  };
}

interface DeployOptions {
  provider: DeployProvider;
  projectName: string;
  repoUrl?: string;
  branch?: string;
  envVars?: Record<string, string>;
  templateTarget?: 'vite' | 'next';
  target?: 'preview' | 'production';
}

export function useDeploy() {
  const [state, setState] = useState<DeployState>({
    isDeploying: false,
    lastDeployment: null,
    error: null,
    availableProviders: {
      vercel: false,
      netlify: false,
    },
  });

  // Refs for loading guards and cleanup
  const isDeployingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function checkProviders() {
      try {
        const res = await fetch('/api/deploy', { signal: controller.signal });
        if (res.ok && mountedRef.current) {
          const data = await res.json();
          setState(prev => ({
            ...prev,
            availableProviders: {
              vercel: data.providers.vercel.configured,
              netlify: data.providers.netlify.configured,
            },
          }));
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('[useDeploy] Failed to check providers:', error);
        }
      }
    }
    checkProviders();

    return () => controller.abort();
  }, []);

  const deploy = useCallback(async (options: DeployOptions): Promise<string | null> => {
    // Guard against concurrent deployments
    if (isDeployingRef.current) {
      console.log('[useDeploy] Deployment already in progress, skipping');
      return null;
    }

    isDeployingRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, isDeploying: true, error: null }));

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Deployment failed');
      }

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isDeploying: false,
          lastDeployment: {
            provider: options.provider,
            url: data.deploymentUrl,
            timestamp: new Date().toISOString(),
          },
        }));
      }

      return data.deploymentUrl;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[useDeploy] Deployment request aborted');
        return null;
      }
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isDeploying: false,
          error: error.message || 'Deployment failed',
        }));
      }
      return null;
    } finally {
      isDeployingRef.current = false;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    deploy,
    clearError,
  };
}

export type { DeployProvider, DeployState, DeployOptions };
