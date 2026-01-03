// GitHub Integration Module
// Handles OAuth, repository management, and commits

import { GitHubConnection, GitHubRepo, GitHubCommitRequest, GitHubCommitResult } from './types';

const GITHUB_STORAGE_KEY = 'timbs-ai:github-connection';

// ============================================
// CONNECTION MANAGEMENT
// ============================================

export function getGitHubConnection(): GitHubConnection | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(GITHUB_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

export function saveGitHubConnection(connection: GitHubConnection): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GITHUB_STORAGE_KEY, JSON.stringify(connection));
}

export function clearGitHubConnection(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(GITHUB_STORAGE_KEY);
}

export function isGitHubConnected(): boolean {
    const connection = getGitHubConnection();
    return !!connection?.connected && !!connection?.accessToken;
}

// ============================================
// OAUTH FLOW
// ============================================

export function initiateGitHubOAuth(): void {
    // Redirect to our OAuth endpoint which will redirect to GitHub
    const redirectUri = `${window.location.origin}/api/github/auth`;
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
        console.error('[GitHub] NEXT_PUBLIC_GITHUB_CLIENT_ID not configured');
        return;
    }

    const state = generateOAuthState();
    sessionStorage.setItem('github-oauth-state', state);

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'repo');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
}

function generateOAuthState(): string {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

export function validateOAuthState(state: string): boolean {
    const savedState = sessionStorage.getItem('github-oauth-state');
    sessionStorage.removeItem('github-oauth-state');
    return savedState === state;
}

// ============================================
// API CALLS
// ============================================

export async function fetchUserRepos(): Promise<GitHubRepo[]> {
    const connection = getGitHubConnection();
    if (!connection?.accessToken) {
        throw new Error('GitHub not connected');
    }

    const response = await fetch('/api/github/repos', {
        headers: {
            'Authorization': `Bearer ${connection.accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch repositories');
    }

    return response.json();
}

export async function createRepository(
    name: string,
    isPrivate: boolean = false,
    description?: string
): Promise<GitHubRepo> {
    const connection = getGitHubConnection();
    if (!connection?.accessToken) {
        throw new Error('GitHub not connected');
    }

    const response = await fetch('/api/github/repos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${connection.accessToken}`
        },
        body: JSON.stringify({
            name,
            private: isPrivate,
            description,
            auto_init: true
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create repository');
    }

    return response.json();
}

export async function commitFiles(request: GitHubCommitRequest): Promise<GitHubCommitResult> {
    const connection = getGitHubConnection();
    if (!connection?.accessToken) {
        return { success: false, error: 'GitHub not connected' };
    }

    try {
        const response = await fetch('/api/github/commit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${connection.accessToken}`
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.message || 'Commit failed' };
        }

        const result = await response.json();
        return {
            success: true,
            sha: result.sha,
            url: result.url
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getRepoUrl(repoFullName: string): string {
    return `https://github.com/${repoFullName}`;
}

export function getCommitUrl(repoFullName: string, sha: string): string {
    return `https://github.com/${repoFullName}/commit/${sha}`;
}

export function getBranchUrl(repoFullName: string, branch: string): string {
    return `https://github.com/${repoFullName}/tree/${branch}`;
}
