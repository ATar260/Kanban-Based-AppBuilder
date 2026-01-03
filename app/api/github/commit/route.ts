// GitHub Commit API - Create commits and push files
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    try {
        const body = await request.json();
        const { repoFullName, branch, message, files } = body;

        if (!repoFullName || !branch || !message || !files) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const [owner, repo] = repoFullName.split('/');
        const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

        // Step 1: Get the current commit SHA for the branch
        const refResponse = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!refResponse.ok) {
            // Branch might not exist, try to create it from default branch
            const repoInfoResponse = await fetch(baseUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });

            if (!repoInfoResponse.ok) {
                return NextResponse.json(
                    { error: 'Repository not found or inaccessible' },
                    { status: 404 }
                );
            }

            const repoInfo = await repoInfoResponse.json();

            // Get default branch ref
            const defaultRefResponse = await fetch(
                `${baseUrl}/git/refs/heads/${repoInfo.default_branch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                }
            );

            if (!defaultRefResponse.ok) {
                return NextResponse.json(
                    { error: 'Could not get default branch' },
                    { status: 500 }
                );
            }

            const defaultRef = await defaultRefResponse.json();

            // Create new branch from default
            const createBranchResponse = await fetch(`${baseUrl}/git/refs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: `refs/heads/${branch}`,
                    sha: defaultRef.object.sha,
                }),
            });

            if (!createBranchResponse.ok) {
                const err = await createBranchResponse.json();
                return NextResponse.json(
                    { error: `Could not create branch: ${err.message}` },
                    { status: 500 }
                );
            }
        }

        // Step 2: Get the current tree
        const latestRefResponse = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        const latestRef = await latestRefResponse.json();
        const latestCommitSha = latestRef.object.sha;

        const commitResponse = await fetch(`${baseUrl}/git/commits/${latestCommitSha}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        const latestCommit = await commitResponse.json();
        const baseTreeSha = latestCommit.tree.sha;

        // Step 3: Create blobs for each file
        const treeItems = await Promise.all(
            files.map(async (file: { path: string; content: string }) => {
                const blobResponse = await fetch(`${baseUrl}/git/blobs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: file.content,
                        encoding: 'utf-8',
                    }),
                });

                const blob = await blobResponse.json();

                return {
                    path: file.path.startsWith('/') ? file.path.substring(1) : file.path,
                    mode: '100644' as const,
                    type: 'blob' as const,
                    sha: blob.sha,
                };
            })
        );

        // Step 4: Create a new tree
        const treeResponse = await fetch(`${baseUrl}/git/trees`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeItems,
            }),
        });

        const newTree = await treeResponse.json();

        // Step 5: Create a new commit
        const newCommitResponse = await fetch(`${baseUrl}/git/commits`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                tree: newTree.sha,
                parents: [latestCommitSha],
            }),
        });

        const newCommit = await newCommitResponse.json();

        // Step 6: Update the branch reference
        const updateRefResponse = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sha: newCommit.sha,
                force: false,
            }),
        });

        if (!updateRefResponse.ok) {
            const err = await updateRefResponse.json();
            return NextResponse.json(
                { error: `Failed to update branch: ${err.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            sha: newCommit.sha,
            url: `https://github.com/${repoFullName}/commit/${newCommit.sha}`,
            message: message,
            filesCommitted: files.length,
        });

    } catch (error: any) {
        console.error('[GitHub Commit] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Commit failed' },
            { status: 500 }
        );
    }
}
