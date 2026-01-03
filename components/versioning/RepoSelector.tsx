'use client';

import { useState, useEffect } from 'react';
import { GitHubRepo } from '@/lib/versioning/types';
import { fetchUserRepos, createRepository, getGitHubConnection } from '@/lib/versioning/github';
import { generateRepoName } from '@/lib/versioning/utils';

interface RepoSelectorProps {
    projectDescription: string;
    onSelect: (repo: GitHubRepo, branch: string, isNew: boolean) => void;
    onCancel: () => void;
}

export function RepoSelector({ projectDescription, onSelect, onCancel }: RepoSelectorProps) {
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New repo form
    const [newRepoName, setNewRepoName] = useState(() => generateRepoName(projectDescription));
    const [isPrivate, setIsPrivate] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Existing repo selection
    const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
    const [branch, setBranch] = useState('main');
    const [searchQuery, setSearchQuery] = useState('');

    // Load repos when switching to existing mode
    useEffect(() => {
        if (mode === 'existing' && repos.length === 0) {
            loadRepos();
        }
    }, [mode]);

    const loadRepos = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const userRepos = await fetchUserRepos();
            setRepos(userRepos);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRepo = async () => {
        if (!newRepoName.trim()) return;

        setIsCreating(true);
        setError(null);

        try {
            const repo = await createRepository(
                newRepoName.trim(),
                isPrivate,
                `Created by Timbs A.I.: ${projectDescription.substring(0, 100)}`
            );

            onSelect(repo, repo.defaultBranch, true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectExisting = () => {
        if (!selectedRepo) return;
        onSelect(selectedRepo, branch, false);
    };

    const filteredRepos = repos.filter(repo =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const connection = getGitHubConnection();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white">Select GitHub Repository</h2>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Connected account */}
                    {connection?.username && (
                        <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
                            <img
                                src={connection.avatarUrl}
                                alt={connection.username}
                                className="w-5 h-5 rounded-full"
                            />
                            <span>Connected as @{connection.username}</span>
                        </div>
                    )}

                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setMode('new')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'new'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                        >
                            Create New
                        </button>
                        <button
                            onClick={() => setMode('existing')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'existing'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                        >
                            Use Existing
                        </button>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* New repo form */}
                    {mode === 'new' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Repository Name</label>
                                <input
                                    type="text"
                                    value={newRepoName}
                                    onChange={(e) => setNewRepoName(e.target.value)}
                                    placeholder="my-awesome-project"
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPrivate}
                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-400">Make repository private</span>
                            </label>
                        </div>
                    )}

                    {/* Existing repo selection */}
                    {mode === 'existing' && (
                        <div className="space-y-4">
                            {/* Search */}
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search repositories..."
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />

                            {/* Repo list */}
                            <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-lg">
                                {isLoading ? (
                                    <div className="p-8 text-center text-gray-500">
                                        Loading repositories...
                                    </div>
                                ) : filteredRepos.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        No repositories found
                                    </div>
                                ) : (
                                    filteredRepos.map(repo => (
                                        <button
                                            key={repo.id}
                                            onClick={() => {
                                                setSelectedRepo(repo);
                                                setBranch(repo.defaultBranch);
                                            }}
                                            className={`w-full px-4 py-3 text-left border-b border-gray-800 last:border-0 hover:bg-gray-800 transition-colors ${selectedRepo?.id === repo.id ? 'bg-blue-500/10' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-white">{repo.name}</span>
                                                {repo.private && (
                                                    <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded">Private</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {repo.fullName}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Branch input */}
                            {selectedRepo && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Branch</label>
                                    <input
                                        type="text"
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}
                                        placeholder="main"
                                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>

                    {mode === 'new' ? (
                        <button
                            onClick={handleCreateRepo}
                            disabled={!newRepoName.trim() || isCreating}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                        >
                            {isCreating ? 'Creating...' : 'Create Repository'}
                        </button>
                    ) : (
                        <button
                            onClick={handleSelectExisting}
                            disabled={!selectedRepo}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                        >
                            Connect Repository
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
