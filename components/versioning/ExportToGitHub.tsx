'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { isGitHubConnected, getGitHubConnection, fetchUserRepos, createRepository, commitFiles } from '@/lib/versioning/github';
import type { GitHubRepo } from '@/lib/versioning/types';

interface ExportToGitHubProps {
  files: Array<{ path: string; content: string }>;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

type ExportMode = 'select' | 'new' | 'existing';

export function ExportToGitHub({ files, onSuccess, onError, className = '' }: ExportToGitHubProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ExportMode>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [commitMessage, setCommitMessage] = useState('Update from Timbs A.I.');
  const [branch, setBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isConnected = isGitHubConnected() || !!session?.user;
  const connection = getGitHubConnection();

  useEffect(() => {
    if (isOpen && isConnected && mode === 'existing' && repos.length === 0) {
      loadRepos();
    }
  }, [isOpen, isConnected, mode]);

  const loadRepos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedRepos = await fetchUserRepos();
      setRepos(fetchedRepos);
    } catch (err: any) {
      setError(err.message || 'Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAndPush = async () => {
    if (!newRepoName.trim()) {
      setError('Repository name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const repo = await createRepository(newRepoName.trim(), newRepoPrivate, newRepoDescription);
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await commitFiles({
        repoFullName: repo.fullName,
        branch: 'main',
        message: commitMessage || 'Initial commit from Timbs A.I.',
        files: files.map(f => ({ path: f.path, content: f.content }))
      });

      if (result.success) {
        setSuccess(`Successfully pushed to ${repo.htmlUrl}`);
        onSuccess?.(repo.htmlUrl);
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        throw new Error(result.error || 'Push failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create repository');
      onError?.(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushToExisting = async () => {
    if (!selectedRepo) {
      setError('Please select a repository');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await commitFiles({
        repoFullName: selectedRepo.fullName,
        branch: branch || selectedRepo.defaultBranch,
        message: commitMessage || 'Update from Timbs A.I.',
        files: files.map(f => ({ path: f.path, content: f.content }))
      });

      if (result.success) {
        setSuccess(`Successfully pushed to ${selectedRepo.htmlUrl}`);
        onSuccess?.(result.url || selectedRepo.htmlUrl);
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        throw new Error(result.error || 'Push failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to push to repository');
      onError?.(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={files.length === 0}
        className={`flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
        Export to GitHub
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Export to GitHub</h2>
              <button
                onClick={() => { setIsOpen(false); setMode('select'); setError(null); setSuccess(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {success ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-600 font-medium">{success}</p>
                </div>
              ) : mode === 'select' ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Export {files.length} files to GitHub
                  </p>
                  <button
                    onClick={() => setMode('new')}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="font-medium text-gray-900">Create New Repository</div>
                    <div className="text-sm text-gray-500">Start fresh with a new repo</div>
                  </button>
                  <button
                    onClick={() => setMode('existing')}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="font-medium text-gray-900">Push to Existing Repository</div>
                    <div className="text-sm text-gray-500">Update an existing repo</div>
                  </button>
                </div>
              ) : mode === 'new' ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setMode('select')}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repository Name *</label>
                    <input
                      type="text"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                      placeholder="my-awesome-project"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={newRepoDescription}
                      onChange={(e) => setNewRepoDescription(e.target.value)}
                      placeholder="Built with Timbs A.I."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="private"
                      checked={newRepoPrivate}
                      onChange={(e) => setNewRepoPrivate(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <label htmlFor="private" className="text-sm text-gray-700">Private repository</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commit Message</label>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Initial commit from Timbs A.I."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleCreateAndPush}
                    disabled={isLoading || !newRepoName.trim()}
                    className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create & Push'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setMode('select')}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Repository</label>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <select
                        value={selectedRepo?.fullName || ''}
                        onChange={(e) => {
                          const repo = repos.find(r => r.fullName === e.target.value);
                          setSelectedRepo(repo || null);
                          if (repo) setBranch(repo.defaultBranch);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        <option value="">Select a repository...</option>
                        {repos.map(repo => (
                          <option key={repo.id} value={repo.fullName}>
                            {repo.fullName} {repo.private ? '🔒' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commit Message</label>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Update from Timbs A.I."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handlePushToExisting}
                    disabled={isLoading || !selectedRepo}
                    className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Pushing...
                      </>
                    ) : (
                      'Push to Repository'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
