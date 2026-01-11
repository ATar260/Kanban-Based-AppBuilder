import { NextRequest, NextResponse } from 'next/server';
import { buildRunManager } from '@/lib/build-orchestrator/run-manager';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = buildRunManager.getRun(runId);
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 });

  return NextResponse.json({
    success: true,
    run: {
      runId: run.runId,
      status: run.status,
      paused: run.paused,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      currentTicketId: run.currentTicketId,
      error: run.error,
      tickets: run.tickets,
      plan: run.input.plan,
    },
  });
}

