import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TEMPLATE_PKG_PATH = path.resolve('e2b/template/package.json');

function mustEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[autobake] Missing SUPABASE env; skipping.');
    process.exit(0);
  }
}

async function sbFetch(url, init = {}) {
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function npmLatestVersion(pkgName) {
  try {
    const out = execSync(`npm view ${JSON.stringify(pkgName)} version`, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    return out || null;
  } catch (e) {
    return null;
  }
}

function isValidNpmName(name) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(String(name || ''));
}

async function getQueueRows() {
  // Get both baked + pending so the build is cumulative even if repo files are unchanged.
  const url =
    `${SUPABASE_URL.replace(/\/+$/, '')}` +
    `/rest/v1/e2b_template_bake_queue` +
    `?select=package_name,dep_type,status,seen_count,last_seen_at` +
    `&status=in.(pending,baked)` +
    `&order=seen_count.desc,last_seen_at.desc`;
  const res = await sbFetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Supabase read failed (HTTP ${res.status}): ${res.text.slice(0, 200)}`);
  return Array.isArray(res.json) ? res.json : [];
}

async function markStatus(packages, status, fields = {}) {
  if (!packages.length) return;
  // PostgREST update: PATCH ...?package_name=in.("a","b")
  const list = packages.map(p => `"${String(p).replaceAll('"', '\\"')}"`).join(',');
  const url =
    `${SUPABASE_URL.replace(/\/+$/, '')}` +
    `/rest/v1/e2b_template_bake_queue` +
    `?package_name=in.(${list})`;
  const body = JSON.stringify({ status, ...fields });
  const res = await sbFetch(url, { method: 'PATCH', body });
  if (!res.ok) {
    console.log(`[autobake] Warning: failed to update statuses (HTTP ${res.status}): ${res.text.slice(0, 200)}`);
  }
}

async function main() {
  mustEnv();

  const rows = await getQueueRows();
  const bakedRows = rows.filter(r => r.status === 'baked');
  const pendingRows = rows.filter(r => r.status === 'pending');
  if (pendingRows.length === 0) {
    console.log('[autobake] No pending packages. Exiting.');
    return;
  }

  const maxNew = Number(process.env.E2B_AUTOBAKE_MAX_NEW || 25);
  const toBake = pendingRows.slice(0, Number.isFinite(maxNew) && maxNew > 0 ? Math.floor(maxNew) : 25);
  const includeRows = bakedRows.concat(toBake);

  console.log(
    `[autobake] bakedExisting=${bakedRows.length}, pending=${pendingRows.length}, bakingNow=${toBake.length}, includeTotal=${includeRows.length}`
  );

  const pkgJson = JSON.parse(await fs.readFile(TEMPLATE_PKG_PATH, 'utf8'));
  pkgJson.dependencies = pkgJson.dependencies || {};
  pkgJson.devDependencies = pkgJson.devDependencies || {};

  const newlyResolved = [];
  const failed = [];
  const nowIso = new Date().toISOString();

  // Ensure the build is cumulative: always include previously baked deps plus the newest pending ones.
  // Use a dist-tag ("latest") to avoid needing to persist versions in Supabase.
  for (const row of includeRows) {
    const name = String(row.package_name || '').trim();
    if (!name || !isValidNpmName(name)) {
      // Only mark failures for newly-pending packages (avoid flipping already-baked rows).
      if (row.status === 'pending') failed.push({ name, reason: 'invalid_name' });
      continue;
    }

    const depType = row.dep_type === 'devDependency' ? 'devDependencies' : 'dependencies';
    if (pkgJson.dependencies[name] || pkgJson.devDependencies[name]) {
      newlyResolved.push(name);
      continue;
    }

    pkgJson[depType][name] = 'latest';
    newlyResolved.push(name);
  }

  // Write updated template package.json for the Docker build.
  await fs.writeFile(TEMPLATE_PKG_PATH, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

  // Bake via E2B CLI (requires E2B_ACCESS_TOKEN in workflow).
  console.log('[autobake] Building template...');
  execSync('e2b template build -n paynto-vite -d e2b.Dockerfile', { stdio: 'inherit' });
  console.log('[autobake] Publishing template...');
  execSync('e2b template publish -y', { stdio: 'inherit' });

  // Update queue statuses
  const bakedNames = newlyResolved.filter(Boolean);
  const failedNames = failed.map(f => f.name).filter(Boolean);

  // Only mark the just-processed pending packages as baked (don’t touch previously baked rows).
  const toBakeNames = new Set(toBake.map(r => String(r.package_name || '').trim()).filter(Boolean));
  const bakedNow = bakedNames.filter(n => toBakeNames.has(n));
  await markStatus(bakedNow, 'baked', { baked_at: nowIso, last_error: null });

  if (failedNames.length > 0) {
    const errMsg = `autobake_failed:${failed.slice(0, 5).map(f => `${f.name}:${f.reason}`).join(',')}`.slice(0, 180);
    await markStatus(failedNames, 'failed', { last_error: errMsg });
  }

  console.log(`[autobake] Done. baked=${bakedNames.length}, failed=${failedNames.length}`);
}

main().catch(err => {
  console.error('[autobake] Fatal:', err?.message || err);
  process.exit(1);
});

