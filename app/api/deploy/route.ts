import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface DeployRequest {
  provider: 'vercel' | 'netlify';
  projectName: string;
  repoUrl?: string;
  branch?: string;
  envVars?: Record<string, string>;
  templateTarget?: 'vite' | 'next';
  target?: 'preview' | 'production';
}

interface VercelDeployment {
  id: string;
  url: string;
  readyState: string;
  createdAt: number;
}

interface NetlifyDeployment {
  id: string;
  url: string;
  state: string;
  created_at: string;
}

async function deployToVercel(options: {
  projectName: string;
  repoUrl?: string;
  branch?: string;
  envVars?: Record<string, string>;
  templateTarget?: 'vite' | 'next';
  target?: 'preview' | 'production';
}): Promise<{ success: boolean; deploymentUrl?: string; error?: string }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { success: false, error: 'VERCEL_TOKEN not configured' };
  }

  const normalizeGitHubRepo = (input?: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim().replace(/\.git$/i, '');
    try {
      const u = new URL(trimmed);
      if (u.hostname === 'github.com' || u.hostname.endsWith('.github.com')) {
        const repo = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
        return repo && repo.includes('/') ? repo : null;
      }
    } catch {
      // not a URL
    }
    // Accept org/repo
    return /^[^/]+\/[^/]+$/.test(trimmed) ? trimmed : null;
  };

  const slugifyProjectName = (name: string): string => {
    const base = String(name || 'paynto-app')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .replace(/-+/g, '-');
    return base.length > 0 ? base.slice(0, 52) : 'paynto-app';
  };

  try {
    const teamId = process.env.VERCEL_TEAM_ID;
    const baseUrl = 'https://api.vercel.com';

    const repo = normalizeGitHubRepo(options.repoUrl);
    if (!repo) {
      return { success: false, error: 'repoUrl must be a GitHub repo URL or "org/repo"' };
    }

    const projectName = slugifyProjectName(options.projectName);
    const framework = options.templateTarget === 'vite' ? 'vite' : 'nextjs';

    // Try to fetch existing project by name first
    const existingRes = await fetch(
      `${baseUrl}/v9/projects/${encodeURIComponent(projectName)}${teamId ? `?teamId=${teamId}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let projectId: string | null = null;
    if (existingRes.ok) {
      const existing = await existingRes.json();
      projectId = existing.id;
    } else if (existingRes.status === 404) {
      const createRes = await fetch(`${baseUrl}/v9/projects${teamId ? `?teamId=${teamId}` : ''}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          framework,
          gitRepository: {
            type: 'github',
            repo,
          },
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.json().catch(() => ({}));
        return { success: false, error: error.error?.message || 'Failed to create Vercel project' };
      }

      const created = await createRes.json();
      projectId = created.id;
    } else {
      const error = await existingRes.json().catch(() => ({}));
      return { success: false, error: error.error?.message || 'Failed to read Vercel project' };
    }

    if (!projectId) {
      return { success: false, error: 'Failed to resolve Vercel project id' };
    }

    if (options.envVars && Object.keys(options.envVars).length > 0) {
      const envPromises = Object.entries(options.envVars).map(([key, value]) =>
        fetch(
          `${baseUrl}/v10/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ''}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key,
              value,
              type: 'encrypted',
              target: ['production', 'preview', 'development'],
            }),
          }
        )
      );
      await Promise.allSettled(envPromises);
    }

    const deployRes = await fetch(
      `${baseUrl}/v13/deployments${teamId ? `?teamId=${teamId}` : ''}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          project: projectId,
          target: options.target || 'preview',
          gitSource: {
            type: 'github',
            repo,
            ref: options.branch || 'main',
          },
        }),
      }
    );

    if (!deployRes.ok) {
      const error = await deployRes.json();
      return { success: false, error: error.error?.message || 'Deployment failed' };
    }

    const deployment: VercelDeployment = await deployRes.json();
    return {
      success: true,
      deploymentUrl: `https://${deployment.url}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function deployToNetlify(options: {
  projectName: string;
  repoUrl?: string;
  branch?: string;
  templateTarget?: 'vite' | 'next';
}): Promise<{ success: boolean; deploymentUrl?: string; error?: string }> {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) {
    return { success: false, error: 'NETLIFY_TOKEN not configured' };
  }

  try {
    const baseUrl = 'https://api.netlify.com/api/v1';

    const siteRes = await fetch(`${baseUrl}/sites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        repo: options.repoUrl ? {
          provider: 'github',
          repo: options.repoUrl,
          branch: options.branch || 'main',
          cmd: 'npm run build',
          dir: options.templateTarget === 'vite' ? 'dist' : '.next',
        } : undefined,
      }),
    });

    if (!siteRes.ok) {
      const error = await siteRes.json();
      return { success: false, error: error.message || 'Failed to create site' };
    }

    const site = await siteRes.json();

    if (options.repoUrl) {
      const buildRes = await fetch(`${baseUrl}/sites/${site.id}/builds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (buildRes.ok) {
        const build = await buildRes.json();
        return {
          success: true,
          deploymentUrl: site.ssl_url || site.url,
        };
      }
    }

    return {
      success: true,
      deploymentUrl: site.ssl_url || site.url,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DeployRequest = await request.json();
    const { provider, projectName, repoUrl, branch, envVars, templateTarget, target } = body;

    if (!provider || !projectName) {
      return NextResponse.json(
        { error: 'Provider and projectName are required' },
        { status: 400 }
      );
    }

    let result;
    if (provider === 'vercel') {
      result = await deployToVercel({ projectName, repoUrl, branch, envVars, templateTarget, target });
    } else if (provider === 'netlify') {
      result = await deployToNetlify({ projectName, repoUrl, branch, templateTarget });
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Use "vercel" or "netlify"' },
        { status: 400 }
      );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        provider,
        deploymentUrl: result.deploymentUrl,
        message: `Deployed to ${provider} successfully`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[deploy] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const vercelConfigured = !!process.env.VERCEL_TOKEN;
  const netlifyConfigured = !!process.env.NETLIFY_TOKEN;

  return NextResponse.json({
    providers: {
      vercel: { configured: vercelConfigured },
      netlify: { configured: netlifyConfigured },
    },
  });
}
