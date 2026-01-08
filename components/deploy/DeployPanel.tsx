'use client';

import { useState } from 'react';
import { useDeploy, DeployProvider } from '@/hooks/useDeploy';

interface DeployPanelProps {
  projectName: string;
  repoUrl?: string;
  branch?: string;
  templateTarget?: 'vite' | 'next';
  onDeployComplete?: (url: string) => void;
  className?: string;
}

export default function DeployPanel({
  projectName,
  repoUrl,
  branch = 'main',
  templateTarget,
  onDeployComplete,
  className = '',
}: DeployPanelProps) {
  const deploy = useDeploy();
  const [selectedProvider, setSelectedProvider] = useState<DeployProvider>('vercel');

  const handleDeploy = async () => {
    const url = await deploy.deploy({
      provider: selectedProvider,
      projectName,
      repoUrl,
      branch,
      templateTarget,
      target: 'preview',
    });

    if (url && onDeployComplete) {
      onDeployComplete(url);
    }
  };

  const hasProviders = deploy.availableProviders.vercel || deploy.availableProviders.netlify;

  return (
    <div className={`bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span>🚀</span>
          Deploy Project
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {!hasProviders ? (
          <div className="text-center py-4">
            <p className="text-zinc-400 text-sm">No deployment providers configured.</p>
            <p className="text-zinc-500 text-xs mt-2">
              Set VERCEL_TOKEN or NETLIFY_TOKEN environment variables.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {deploy.availableProviders.vercel && (
                <button
                  onClick={() => setSelectedProvider('vercel')}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedProvider === 'vercel'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 76 65" fill="currentColor">
                      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                    </svg>
                    <span className="font-medium text-white">Vercel</span>
                  </div>
                  {selectedProvider === 'vercel' && (
                    <div className="text-xs text-blue-400 mt-1">Selected</div>
                  )}
                </button>
              )}
              {deploy.availableProviders.netlify && (
                <button
                  onClick={() => setSelectedProvider('netlify')}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedProvider === 'netlify'
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
                      <path d="M161.58 119.54l14.35-14.35-14.35-14.35 14.35-14.35-57.4-57.4-14.35 14.35-14.35-14.35-14.35 14.35-57.4 57.4 14.35 14.35-14.35 14.35 14.35 14.35L3.08 133.54 0 136.62l119.38 119.38 3.08-3.08 14-14.35 14.35 14.35 14.35-14.35 57.4-57.4-14.35-14.35 14.35-14.35-14.35-14.35 14.35-14.35-61.03-14.23zm-42.2 104.73L25.65 130.54l7.27-7.27 93.73 93.73-7.27 7.27z"/>
                    </svg>
                    <span className="font-medium text-white">Netlify</span>
                  </div>
                  {selectedProvider === 'netlify' && (
                    <div className="text-xs text-teal-400 mt-1">Selected</div>
                  )}
                </button>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Project:</span>
                <span className="text-white">{projectName}</span>
              </div>
              {repoUrl && (
                <div className="flex justify-between text-zinc-400">
                  <span>Repository:</span>
                  <span className="text-white truncate max-w-[200px]">{repoUrl}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Branch:</span>
                <span className="text-white">{branch}</span>
              </div>
            </div>

            {deploy.error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">{deploy.error}</p>
              </div>
            )}

            {deploy.lastDeployment && (
              <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
                <p className="text-green-400 text-sm">
                  Deployed to {deploy.lastDeployment.provider}:
                </p>
                <a
                  href={deploy.lastDeployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-300 text-sm hover:underline break-all"
                >
                  {deploy.lastDeployment.url}
                </a>
              </div>
            )}

            <button
              onClick={handleDeploy}
              disabled={deploy.isDeploying}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {deploy.isDeploying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Deploying...
                </span>
              ) : (
                `Deploy to ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}`
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
