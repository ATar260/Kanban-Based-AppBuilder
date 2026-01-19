import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getSandboxHealthSnapshot } from '@/lib/sandbox/healer';

export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var activeSandboxProvider: any;
}

function normalizeModulePath(raw: string): string {
  let p = String(raw || '').trim();
  if (!p) return '';
  // Strip query/hash from Vite URLs.
  p = p.split('?')[0].split('#')[0];
  // Strip leading slash.
  if (p.startsWith('/')) p = p.slice(1);
  // Basic traversal guard.
  if (p.includes('..')) return '';
  return p;
}

function basenameNoExt(p: string): string {
  const file = p.split('/').pop() || '';
  const name = file.replace(/\.[^.]+$/, '');
  return name;
}

function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

function hasDefaultExport(src: string): boolean {
  return /\bexport\s+default\b/.test(src);
}

function hasNamedExport(src: string, name: string): boolean {
  if (!name) return false;
  const n = name.replace(/[$]/g, '\\$');
  return (
    new RegExp(`\\bexport\\s+(?:const|let|var|function|class)\\s+${n}\\b`).test(src) ||
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${n}\\b[^}]*\\}`).test(src)
  );
}

function hasIdentifierDeclared(src: string, name: string): boolean {
  if (!name) return false;
  const n = name.replace(/[$]/g, '\\$');
  return (
    new RegExp(`\\bfunction\\s+${n}\\b`).test(src) ||
    new RegExp(`\\bclass\\s+${n}\\b`).test(src) ||
    new RegExp(`\\bconst\\s+${n}\\b`).test(src) ||
    new RegExp(`\\blet\\s+${n}\\b`).test(src) ||
    new RegExp(`\\bvar\\s+${n}\\b`).test(src)
  );
}

function findDefaultIdentifier(src: string): string | null {
  // export default function Name() {}
  let m = src.match(/\bexport\s+default\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/);
  if (m?.[1]) return m[1];
  // export default class Name {}
  m = src.match(/\bexport\s+default\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/);
  if (m?.[1]) return m[1];
  // export default Name;
  m = src.match(/\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/);
  if (m?.[1]) return m[1];
  return null;
}

function findSingleExportedName(src: string): string | null {
  const out: string[] = [];
  const re = /\bexport\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) out.push(m[1]);
    if (out.length >= 3) break;
  }
  if (out.length === 1) return out[0];
  return null;
}

function applyExportFix(args: {
  src: string;
  modulePath: string;
  missingExportName: string;
}): { patched: string; changed: boolean; reason: string } {
  const src = String(args.src || '');
  const missing = String(args.missingExportName || '').trim();
  const base = basenameNoExt(args.modulePath || '');

  if (!missing) return { patched: src, changed: false, reason: 'missing_export_name_required' };
  if (missing !== 'default' && !isValidIdentifier(missing)) {
    return { patched: src, changed: false, reason: 'invalid_named_export' };
  }

  if (missing === 'default') {
    if (hasDefaultExport(src)) return { patched: src, changed: false, reason: 'already_has_default' };

    // Prefer exporting a symbol matching the filename (Card.jsx -> Card).
    const preferred = isValidIdentifier(base) && hasIdentifierDeclared(src, base) ? base : null;
    const singleExport = findSingleExportedName(src);
    const candidate = preferred || singleExport || null;
    if (!candidate) return { patched: src, changed: false, reason: 'no_candidate_for_default' };

    const patched = `${src.replace(/\s*$/, '')}\n\nexport default ${candidate};\n`;
    return { patched, changed: true, reason: `added_default_from_${candidate}` };
  }

  // named export
  if (hasNamedExport(src, missing)) return { patched: src, changed: false, reason: 'already_exports_named' };

  // If the identifier exists in the module, just export it.
  if (hasIdentifierDeclared(src, missing)) {
    const patched = `${src.replace(/\s*$/, '')}\n\nexport { ${missing} };\n`;
    return { patched, changed: true, reason: 'exported_existing_identifier' };
  }

  // If there is a default export with an identifier, alias it.
  const defaultId = findDefaultIdentifier(src);
  if (defaultId) {
    const patched = `${src.replace(/\s*$/, '')}\n\nexport { ${defaultId} as ${missing} };\n`;
    return { patched, changed: true, reason: `aliased_default_${defaultId}_as_${missing}` };
  }

  // If filename symbol exists, alias it.
  if (isValidIdentifier(base) && hasIdentifierDeclared(src, base)) {
    const patched = `${src.replace(/\s*$/, '')}\n\nexport { ${base} as ${missing} };\n`;
    return { patched, changed: true, reason: `aliased_${base}_as_${missing}` };
  }

  return { patched: src, changed: false, reason: 'no_candidate_for_named' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sandboxId = String(body?.sandboxId || body?.sandbox || '').trim();
    const modulePath = normalizeModulePath(String(body?.modulePath || body?.path || ''));
    const missingExportName = String(body?.missingExportName || body?.exportName || '').trim();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H13',location:'app/api/sandbox-fix-exports/route.ts:POST:start',message:'sandbox-fix-exports request',data:{sandboxId:sandboxId.slice(0,32),modulePath:modulePath.slice(0,200),missingExportName:missingExportName.slice(0,40)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (!sandboxId) {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }
    if (!modulePath) {
      return NextResponse.json({ success: false, error: 'modulePath is required' }, { status: 400 });
    }
    if (!missingExportName) {
      return NextResponse.json({ success: false, error: 'missingExportName is required' }, { status: 400 });
    }

    const activeProvider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    let provider: any =
      sandboxManager.getProvider(sandboxId) ||
      (activeProvider?.getSandboxInfo?.()?.sandboxId === sandboxId ? activeProvider : null);
    if (!provider) {
      try {
        provider = await sandboxManager.getOrCreateProvider(sandboxId);
        const info = provider?.getSandboxInfo?.();
        if (!info || info.sandboxId !== sandboxId) provider = null;
      } catch {
        provider = null;
      }
    }
    if (!provider || !provider.getSandboxInfo?.()) {
      return NextResponse.json({ success: false, error: `No sandbox provider for sandboxId: ${sandboxId}` }, { status: 404 });
    }

    const original = await provider.readFile(modulePath);
    const src = typeof original === 'string' ? original : String(original || '');
    if (!src) {
      return NextResponse.json({ success: false, error: `File is empty or missing: ${modulePath}` }, { status: 404 });
    }

    const { patched, changed, reason } = applyExportFix({ src, modulePath, missingExportName });
    if (changed) {
      await provider.writeFile(modulePath, patched);
    }

    // Restart Vite so the browser re-imports the module graph.
    try {
      if (typeof provider.restartViteServer === 'function') {
        await provider.restartViteServer();
      } else {
        await provider.runCommand('pkill -f vite || true');
        await provider.runCommand('nohup npm run dev > /tmp/vite.log 2>&1 &');
      }
    } catch {
      // ignore; health snapshot will reveal if it actually came back
    }

    const snapshot = await getSandboxHealthSnapshot(provider);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c77dad7d-5856-4f46-a321-cf824026609f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H13',location:'app/api/sandbox-fix-exports/route.ts:POST:result',message:'sandbox-fix-exports result',data:{sandboxId:sandboxId.slice(0,32),modulePath:modulePath.slice(0,200),missingExportName:missingExportName.slice(0,40),applied:Boolean(changed),reason:String(reason).slice(0,120),healthyForPreview:Boolean(snapshot?.healthyForPreview),missingCount:Array.isArray(snapshot?.missingPackages)?snapshot.missingPackages.length:0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      applied: Boolean(changed),
      reason,
      healthy: Boolean(snapshot?.healthyForPreview),
      snapshot,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}

