import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, Database } from '@/lib/supabase';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = data as Project;

    const { data: versions } = await (supabaseAdmin as any)
      .from('versions')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ 
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        mode: project.mode,
        sandboxId: project.sandbox_id,
        sandboxUrl: project.sandbox_url,
        sourceUrl: project.source_url,
        githubRepo: project.github_repo,
        githubBranch: project.github_branch,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        versions: versions || [],
      }
    });
  } catch (error: any) {
    console.error('[Project API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, description, sandboxId, sandboxUrl, githubRepo, githubBranch } = body;

    const { data: existing } = await (supabaseAdmin as any)
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updateData: ProjectUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (sandboxId !== undefined) updateData.sandbox_id = sandboxId;
    if (sandboxUrl !== undefined) updateData.sandbox_url = sandboxUrl;
    if (githubRepo !== undefined) updateData.github_repo = githubRepo;
    if (githubBranch !== undefined) updateData.github_branch = githubBranch;

    const { data, error: updateError } = await (supabaseAdmin as any)
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    const project = data as Project;

    return NextResponse.json({ 
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        mode: project.mode,
        sandboxId: project.sandbox_id,
        sandboxUrl: project.sandbox_url,
        sourceUrl: project.source_url,
        githubRepo: project.github_repo,
        githubBranch: project.github_branch,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      }
    });
  } catch (error: any) {
    console.error('[Project API] Error updating:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { error } = await (supabaseAdmin as any)
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Project API] Error deleting:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
