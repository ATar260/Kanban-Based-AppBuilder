import { NextRequest, NextResponse } from 'next/server';
import { getUsageActor } from '@/lib/usage/identity';
import { getUsageSnapshotForActor } from '@/lib/usage/persistence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await getUsageActor(request);
    const snapshot = await getUsageSnapshotForActor(actor);

    return NextResponse.json({
      success: true,
      actor: {
        tier: actor.tier,
        isAuthenticated: actor.isAuthenticated,
      },
      usage: snapshot,
      upgradeUrl: '/pricing',
    });
  } catch (error) {
    console.error('[usage] Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

