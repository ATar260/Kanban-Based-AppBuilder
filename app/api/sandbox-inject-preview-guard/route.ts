import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { ensureSandboxPreviewGuardInjected } from '@/lib/sandbox/preview-guard-injection';

declare global {
  // eslint-disable-next-line no-var
  var activeSandboxProvider: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sandboxId = String(body?.sandboxId || body?.sandbox || '').trim();
    if (!sandboxId) {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }

    const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    const provider: any =
      sandboxManager.getProvider(sandboxId) ||
      (activeProvider?.getSandboxInfo?.()?.sandboxId === sandboxId ? activeProvider : null) ||
      (await sandboxManager.getOrCreateProvider(sandboxId).catch(() => null));

    if (!provider || !provider.getSandboxInfo?.()) {
      return NextResponse.json({ success: false, error: `No sandbox provider for sandboxId: ${sandboxId}` }, { status: 404 });
    }

    const info = provider.getSandboxInfo?.();
    const templateTarget = String(info?.templateTarget || '').trim();
    if (templateTarget && templateTarget !== 'vite') {
      return NextResponse.json({ success: true, changed: false, skipped: true, reason: 'non-vite' });
    }

    const res = await ensureSandboxPreviewGuardInjected({ provider });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H8',location:'app/api/sandbox-inject-preview-guard/route.ts:POST',message:'sandbox preview-guard injection result',data:{sandboxId,provider:String(info?.provider||''),changed:Boolean(res.changed),error:res.error?String(res.error).slice(0,200):undefined},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ success: true, changed: Boolean(res.changed), error: res.error || null });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}

