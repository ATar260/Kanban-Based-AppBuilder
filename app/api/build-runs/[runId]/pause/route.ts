import { NextRequest, NextResponse } from 'next/server';
import { buildRunManager } from '@/lib/build-orchestrator/run-manager';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = buildRunManager.getRun(runId);
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 });

  buildRunManager.pause(runId);
  return NextResponse.json({ success: true });
}

