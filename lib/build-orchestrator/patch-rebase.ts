import { diff_match_patch } from 'diff-match-patch';

export type Snapshot = Record<string, string>;

export type RebasePatchFilesResult = {
  ok: boolean;
  rebasedPatchFiles: Record<string, string>;
  rebasedPaths: string[];
  failedPaths: string[];
  patchTextByPath: Record<string, string>;
  errorsByPath: Record<string, string>;
};

function hasOwn(obj: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Deterministically rebase "full file" patches produced against `baseSnapshot`
 * onto the current `mainSnapshot` by applying a diff (base -> patch) to main.
 *
 * This is a best-effort 3-way-ish merge:
 * - If the patch applies cleanly, we return the rebased file content.
 * - If it does not apply cleanly, we mark the file as failed so an LLM can
 *   resolve it with full context (base/current/patch).
 */
export function rebasePatchFiles(params: {
  baseSnapshot: Snapshot;
  mainSnapshot: Snapshot;
  patchFiles: Record<string, string>;
  onlyPaths?: string[];
}): RebasePatchFilesResult {
  const { baseSnapshot, mainSnapshot, patchFiles, onlyPaths } = params;

  const dmp = new diff_match_patch();

  const rebasedPatchFiles: Record<string, string> = { ...(patchFiles || {}) };
  const rebasedPaths: string[] = [];
  const failedPaths: string[] = [];
  const patchTextByPath: Record<string, string> = {};
  const errorsByPath: Record<string, string> = {};

  const paths = Array.from(new Set((onlyPaths?.length ? onlyPaths : Object.keys(patchFiles || {})).filter(Boolean)));

  for (const path of paths) {
    const baseHas = hasOwn(baseSnapshot, path);
    const mainHas = hasOwn(mainSnapshot, path);

    const baseContent = baseHas ? baseSnapshot[path] : null;
    const mainContent = mainHas ? mainSnapshot[path] : null;
    const patchContent = rebasedPatchFiles[path] ?? '';

    // If both base and main don't have the file, it's a new file (safe).
    if (!baseHas && !mainHas) {
      continue;
    }

    // If patch already matches main, safe.
    if (patchContent === mainContent) continue;

    // If patch didn't actually change the file relative to base, safe.
    if (patchContent === baseContent) continue;

    // If base or main is missing, we can't safely do a deterministic 3-way apply.
    // Let the LLM resolve with full context (including file existence semantics).
    if (!baseHas || !mainHas) {
      failedPaths.push(path);
      try {
        const patches = dmp.patch_make(baseContent ?? '', patchContent);
        patchTextByPath[path] = dmp.patch_toText(patches);
      } catch (e: any) {
        errorsByPath[path] = e?.message || String(e || 'Rebase failed');
      }
      continue;
    }

    // If main hasn't changed since base, then no rebase required.
    if (baseContent === mainContent) continue;

    try {
      const patches = dmp.patch_make(baseContent ?? '', patchContent);
      patchTextByPath[path] = dmp.patch_toText(patches);
      const [rebasedText, results] = dmp.patch_apply(patches, mainContent ?? '');
      const allApplied = Array.isArray(results) && results.every(Boolean);

      if (!allApplied) {
        failedPaths.push(path);
        errorsByPath[path] = `Patch did not apply cleanly (${(results || []).filter(Boolean).length}/${(results || []).length} hunks applied)`;
        continue;
      }

      rebasedPatchFiles[path] = String(rebasedText ?? '');
      rebasedPaths.push(path);
    } catch (e: any) {
      failedPaths.push(path);
      errorsByPath[path] = e?.message || String(e || 'Rebase failed');
    }
  }

  return {
    ok: failedPaths.length === 0,
    rebasedPatchFiles,
    rebasedPaths,
    failedPaths,
    patchTextByPath,
    errorsByPath,
  };
}

