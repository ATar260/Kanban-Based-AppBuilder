import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getGitHubToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

interface RepoFile {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
}

interface TreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.env',
  '.env.local',
  '.env.production',
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

const SUPPORTED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.mdx',
  '.css', '.scss', '.less', '.sass',
  '.html', '.htm',
  '.yml', '.yaml',
  '.toml',
  '.env.example',
  '.gitignore',
  '.prettierrc', '.eslintrc',
];

const MAX_FILE_SIZE = 500 * 1024;

function shouldIncludeFile(path: string, size?: number): boolean {
  if (IGNORED_PATHS.some(ignored => path.includes(ignored))) {
    return false;
  }

  if (size && size > MAX_FILE_SIZE) {
    return false;
  }

  const ext = '.' + path.split('.').pop()?.toLowerCase();
  const fileName = path.split('/').pop() || '';

  if (SUPPORTED_EXTENSIONS.includes(ext)) return true;
  if (fileName === 'Dockerfile') return true;
  if (fileName === 'Makefile') return true;
  if (fileName.startsWith('.') && SUPPORTED_EXTENSIONS.some(e => fileName.endsWith(e.slice(1)))) return true;

  return false;
}

async function fetchFileContent(
  token: string | null,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  return null;
}

async function fetchRepoTree(
  token: string | null,
  owner: string,
  repo: string,
  branch: string
): Promise<TreeItem[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch tree: ${response.status}`);
  }

  const data = await response.json();
  return data.tree || [];
}

export async function POST(request: NextRequest) {
  const token = await getToken(request);

  try {
    const body = await request.json();
    const { repoFullName, branch = 'main', maxFiles = 100 } = body;

    if (!repoFullName) {
      return NextResponse.json({ error: 'repoFullName is required' }, { status: 400 });
    }

    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Invalid repository format' }, { status: 400 });
    }

    const effectiveMaxFiles = token ? maxFiles : Math.min(maxFiles, 50);
    const tree = await fetchRepoTree(token, owner, repo, branch);

    const filesToFetch = tree
      .filter(item => item.type === 'blob' && shouldIncludeFile(item.path, item.size))
      .slice(0, effectiveMaxFiles);

    const files: RepoFile[] = [];
    const errors: string[] = [];

    const batchSize = 10;
    for (let i = 0; i < filesToFetch.length; i += batchSize) {
      const batch = filesToFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async item => {
          const content = await fetchFileContent(token, owner, repo, item.path);
          if (content !== null) {
            files.push({
              path: item.path,
              content,
              encoding: 'utf-8',
              size: item.size || content.length,
            });
          }
        })
      );

      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          errors.push(`Failed to fetch ${batch[idx].path}`);
        }
      });
    }

    return NextResponse.json({
      success: true,
      repoFullName,
      branch,
      totalFilesInRepo: tree.filter(i => i.type === 'blob').length,
      importedFiles: files.length,
      unauthenticated: !token,
      files,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[GitHub Import] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = await getToken(request);

  const { searchParams } = new URL(request.url);
  const repoFullName = searchParams.get('repo');
  const branch = searchParams.get('branch') || 'main';

  if (!repoFullName) {
    return NextResponse.json({ error: 'repo parameter is required' }, { status: 400 });
  }

  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    return NextResponse.json({ error: 'Invalid repository format' }, { status: 400 });
  }

  try {
    const tree = await fetchRepoTree(token, owner, repo, branch);

    const allFiles = tree.filter(i => i.type === 'blob');
    const importableFiles = allFiles.filter(i => shouldIncludeFile(i.path, i.size));

    return NextResponse.json({
      repoFullName,
      branch,
      totalFiles: allFiles.length,
      importableFiles: importableFiles.length,
      unauthenticated: !token,
      files: importableFiles.map(f => ({
        path: f.path,
        size: f.size,
      })),
    });
  } catch (error: any) {
    console.error('[GitHub Import] Preview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
