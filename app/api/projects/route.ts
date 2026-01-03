import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('[Projects API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, sandboxId, sandboxUrl, mode, sourceUrl } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        sandboxId: sandboxId || null,
        sandboxUrl: sandboxUrl || null,
        mode: mode || 'prompt',
        sourceUrl: sourceUrl || null,
      },
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('[Projects API] Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
