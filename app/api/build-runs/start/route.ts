import { NextRequest, NextResponse } from 'next/server';
import { buildRunManager } from '@/lib/build-orchestrator/run-manager';
import type { BuildRunInput } from '@/lib/build-orchestrator/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parseBool = (v: any): boolean | undefined => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
      }
      return undefined;
    };

    const sandboxId = String(body?.sandboxId || '').trim();
    const model = String(body?.model || '').trim();
    const plan = body?.plan;
    const tickets = body?.tickets;
    const uiStyle = body?.uiStyle;
    const onlyTicketId = typeof body?.onlyTicketId === 'string' ? body.onlyTicketId : undefined;
    const maxConcurrencyRaw = body?.maxConcurrency;
    const maxConcurrency =
      typeof maxConcurrencyRaw === 'number' && Number.isFinite(maxConcurrencyRaw) && maxConcurrencyRaw > 0
        ? Math.max(1, Math.min(Math.floor(maxConcurrencyRaw), 10))
        : undefined;
    const skipPrReview = parseBool(body?.skipPrReview);
    const skipIntegrationGate = parseBool(body?.skipIntegrationGate);

    if (!sandboxId) {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ success: false, error: 'model is required' }, { status: 400 });
    }
    if (!plan || typeof plan !== 'object') {
      return NextResponse.json({ success: false, error: 'plan is required' }, { status: 400 });
    }
    if (!Array.isArray(tickets)) {
      return NextResponse.json({ success: false, error: 'tickets must be an array' }, { status: 400 });
    }

    const input: BuildRunInput = {
      plan,
      tickets,
      sandboxId,
      model,
      uiStyle,
      onlyTicketId,
      maxConcurrency,
      skipPrReview,
      skipIntegrationGate,
    };

    const baseUrl = new URL(request.url).origin;
    const run = buildRunManager.createRun(input, baseUrl);

    // Kick the run asynchronously (Phase 1: single worker). SSE clients can attach immediately.
    void buildRunManager.start(run.runId);

    return NextResponse.json({ success: true, runId: run.runId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to start build run' }, { status: 500 });
  }
}

