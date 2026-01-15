/**
 * Minimal shell helpers for building `sh -c "<command>"` strings safely.
 *
 * We primarily use this to:
 * - avoid syntax errors from special tokens like `(` / `)` (e.g., `find ... \\( ... \\)`),
 * - prevent glob expansion (`*.tsx`) by the shell (quote patterns),
 * - and quote file paths robustly (spaces, parentheses, etc).
 */

/**
 * Single-quote a string for POSIX `sh`.
 * Example: hello'world -> 'hello'"'"'world'
 */
export function shQuote(arg: string): string {
  const s = String(arg ?? '');
  // Close quote, insert escaped single quote, reopen.
  return `'${s.replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * Returns true if the token is safe to embed in a `sh -c` command unquoted.
 * This intentionally errs on the side of quoting.
 */
function isSafeUnquotedToken(token: string): boolean {
  // Safe tokens: alphanumerics plus a small set of common command punctuation.
  // Notably excludes: space, quotes, dollar, backticks, parentheses, glob chars.
  return /^[A-Za-z0-9_./:@%+=,-]+$/.test(token);
}

/**
 * Join command tokens into a single shell-safe command string.
 *
 * - `(` and `)` are emitted as `\\(` / `\\)` so the shell doesn't treat them as syntax.
 * - Unsafe tokens (globs like `*.tsx`, or anything with spaces/shell meta) are single-quoted.
 */
export function shJoin(tokens: string[]): string {
  return (tokens || [])
    .map((raw) => {
      const t = String(raw ?? '');
      if (t === '(') return '\\(';
      if (t === ')') return '\\)';
      if (!t) return `''`;
      if (isSafeUnquotedToken(t)) return t;
      return shQuote(t);
    })
    .join(' ');
}

