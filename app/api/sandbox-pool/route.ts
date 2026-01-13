import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

type PoolTarget = 'baseline' | 'burst' | number;

export async function GET() {
  const poolEnabled = process.env.SANDBOX_POOL_ENABLED === 'true';
  return NextResponse.json({
    success: true,
    poolEnabled,
    targets: sandboxManager.getPoolTargets(),
    pool: sandboxManager.getPoolStatus(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const poolEnabled = process.env.SANDBOX_POOL_ENABLED === 'true';
    const body = await request.json().catch(() => null);
    const targetRaw: PoolTarget | undefined = body?.target;
    const knownSandboxIds: string[] | undefined = Array.isArray(body?.knownSandboxIds)
      ? body.knownSandboxIds.filter((x: any) => typeof x === 'string')
      : undefined;

    const targets = sandboxManager.getPoolTargets();
    const resolvedTarget =
      targetRaw === 'baseline'
        ? targets.baseline
        : targetRaw === 'burst'
          ? targets.burst
          : typeof targetRaw === 'number' && Number.isFinite(targetRaw)
            ? Math.floor(targetRaw)
            : targets.burst;

    // Burst warmup runs in the background so the endpoint stays responsive.
    // Best-effort: adopt any known warm sandboxes first (client can supply ids from previous sessions).
    let adopted = { adopted: 0, attempted: 0 };
    if (knownSandboxIds && knownSandboxIds.length > 0) {
      try {
        adopted = await sandboxManager.adoptKnownSandboxes(knownSandboxIds);
      } catch {
        adopted = { adopted: 0, attempted: knownSandboxIds.length };
      }
    }

    if (targetRaw === 'baseline') {
      // Best-effort scale down immediately.
      void sandboxManager.shrinkPool(resolvedTarget);
    } else {
      void sandboxManager.ensureWarmPool(resolvedTarget);
    }

    return NextResponse.json({
      success: true,
      poolEnabled,
      requestedTarget: targetRaw ?? 'burst',
      resolvedTarget,
      targets,
      adopted,
      pool: sandboxManager.getPoolStatus(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Failed to update sandbox pool' },
      { status: 500 }
    );
  }
}

