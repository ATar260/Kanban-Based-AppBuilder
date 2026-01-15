import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

type PoolTarget = 'baseline' | 'burst' | number;

export async function GET() {
  // Warm sandbox pooling/prewarming is disabled (single-sandbox workflow).
  const poolEnabled = false;
  return NextResponse.json({
    success: true,
    poolEnabled,
    targets: sandboxManager.getPoolTargets(),
    pool: sandboxManager.getPoolStatus(),
  });
}

export async function POST(request: NextRequest) {
  try {
    // Warm sandbox pooling/prewarming is disabled (single-sandbox workflow).
    // We still accept the request for backwards compatibility with older clients,
    // but do not create/adopt/scale any sandboxes.
    const poolEnabled = false;
    const body = await request.json().catch(() => null);
    const targetRaw: PoolTarget | undefined = body?.target;
    const targets = sandboxManager.getPoolTargets();
    const resolvedTarget = targets.baseline;

    return NextResponse.json({
      success: true,
      poolEnabled,
      requestedTarget: targetRaw ?? 'burst',
      resolvedTarget,
      targets,
      adopted: { adopted: 0, attempted: 0 },
      pool: sandboxManager.getPoolStatus(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Failed to update sandbox pool' },
      { status: 500 }
    );
  }
}

