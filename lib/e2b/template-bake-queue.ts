import { supabaseAdmin } from '@/lib/supabase';

type BakeQueueStatus = 'pending' | 'baked' | 'failed' | 'ignored';
type BakeDepType = 'dependency' | 'devDependency';

function isBakeQueueEnabled(): boolean {
  // Only server-side usage with service role key (bypasses RLS).
  return Boolean(supabaseAdmin && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizePackageName(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Reject obvious non-registry specifiers (paths, urls, git).
  if (raw.startsWith('.') || raw.startsWith('/') || raw.startsWith('file:')) return null;
  if (raw.includes('://')) return null;
  if (raw.startsWith('git+') || raw.endsWith('.git')) return null;

  // Strip version/tag/range for queue key purposes: "@scope/name@1.2.3" -> "@scope/name"
  // Keep scoped names intact.
  if (raw.startsWith('@')) {
    // @scope/name@ver
    const m = raw.match(/^(@[^/]+\/[^@]+)(?:@.+)?$/);
    return m ? m[1] : null;
  }
  // name@ver
  const m = raw.match(/^([^@]+)(?:@.+)?$/);
  return m ? m[1] : null;
}

function isValidNpmName(name: string): boolean {
  // Pragmatic validation: allow typical npm names (scoped + unscoped).
  // This is intentionally stricter than npm’s full grammar to reduce risk.
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name);
}

function inferDepType(pkg: string): BakeDepType {
  const p = pkg.toLowerCase();
  if (p.startsWith('@types/')) return 'devDependency';
  if (p.includes('eslint') || p.includes('prettier')) return 'devDependency';
  if (p.startsWith('@vitejs/') || p === 'vite') return 'devDependency';
  return 'dependency';
}

export async function queueE2BTemplateBakeCandidates(args: {
  packages: string[];
  source: string;
  status?: BakeQueueStatus; // usually 'pending'
  depType?: BakeDepType; // optional override
}): Promise<{ queued: string[]; skipped: string[] }> {
  const enabled = isBakeQueueEnabled();
  if (!enabled) return { queued: [], skipped: Array.isArray(args.packages) ? args.packages : [] };

  const pkgsRaw = Array.isArray(args.packages) ? args.packages : [];
  const dedup = new Set<string>();
  const queued: string[] = [];
  const skipped: string[] = [];

  const maxPerCall = 25;
  for (const raw of pkgsRaw) {
    if (queued.length >= maxPerCall) break;
    const normalized = normalizePackageName(raw);
    if (!normalized || !isValidNpmName(normalized)) {
      skipped.push(String(raw || ''));
      continue;
    }
    if (dedup.has(normalized)) continue;
    dedup.add(normalized);

    const dep_type = args.depType || inferDepType(normalized);
    const status: BakeQueueStatus = args.status || 'pending';

    try {
      // Upsert-by-PK to preserve accumulation across sandboxes.
      // We keep `first_seen_at` stable and update `last_seen_at` + `seen_count`.
      const nowIso = new Date().toISOString();
      const { data: existing, error: selErr } = await (supabaseAdmin as any)
        .from('e2b_template_bake_queue')
        .select('package_name, seen_count, status, dep_type, first_seen_at')
        .eq('package_name', normalized)
        .maybeSingle();

      if (selErr) {
        skipped.push(normalized);
        continue;
      }

      if (existing?.package_name) {
        const nextCount = Number(existing.seen_count || 0) + 1;
        const nextStatus: BakeQueueStatus =
          existing.status === 'baked' ? 'baked' : status; // don't downgrade baked -> pending

        const { error: updErr } = await (supabaseAdmin as any)
          .from('e2b_template_bake_queue')
          .update({
            last_seen_at: nowIso,
            seen_count: nextCount,
            dep_type: existing.dep_type || dep_type,
            status: nextStatus,
          })
          .eq('package_name', normalized);

        if (updErr) {
          skipped.push(normalized);
          continue;
        }
      } else {
        const { error: insErr } = await (supabaseAdmin as any)
          .from('e2b_template_bake_queue')
          .insert({
            package_name: normalized,
            dep_type,
            first_seen_at: nowIso,
            last_seen_at: nowIso,
            seen_count: 1,
            status,
            last_error: null,
            baked_at: null,
          });

        if (insErr) {
          skipped.push(normalized);
          continue;
        }
      }

      queued.push(normalized);
    } catch {
      skipped.push(normalized);
    }
  }

  return { queued, skipped };
}

