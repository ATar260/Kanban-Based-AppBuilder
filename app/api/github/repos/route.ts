// GitHub Repositories API
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getGitHubToken } from '@/lib/auth';

async function getToken(request: NextRequest): Promise<string | null> {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
        const token = await getGitHubToken(session.user.id);
        if (token) return token;
    }
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    return null;
}

// GET - List user's repositories
export async function GET(request: NextRequest) {
    const token = await getToken(request);

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json(
                { error: error.message || 'Failed to fetch repos' },
                { status: response.status }
            );
        }

        const repos = await response.json();

        // Map to our simplified format
        const mappedRepos = repos.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            private: repo.private,
            defaultBranch: repo.default_branch,
            htmlUrl: repo.html_url,
            cloneUrl: repo.clone_url,
            updatedAt: repo.updated_at,
        }));

        return NextResponse.json(mappedRepos);

    } catch (error: any) {
        console.error('[GitHub Repos] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal error' },
            { status: 500 }
        );
    }
}

// POST - Create a new repository
export async function POST(request: NextRequest) {
    const token = await getToken(request);

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();

        const response = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: body.name,
                description: body.description || 'Created by Paynto A.I.',
                private: body.private || false,
                auto_init: body.auto_init !== false, // Default to true
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json(
                { error: error.message || 'Failed to create repo' },
                { status: response.status }
            );
        }

        const repo = await response.json();

        return NextResponse.json({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            private: repo.private,
            defaultBranch: repo.default_branch,
            htmlUrl: repo.html_url,
            cloneUrl: repo.clone_url,
            updatedAt: repo.updated_at,
        });

    } catch (error: any) {
        console.error('[GitHub Repos] Error creating repo:', error);
        return NextResponse.json(
            { error: error.message || 'Internal error' },
            { status: 500 }
        );
    }
}
