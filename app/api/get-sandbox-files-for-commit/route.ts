import { NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import type { SandboxState } from '@/types/sandbox';
import { shJoin, shQuote } from '@/lib/sandbox/sh';

declare global {
  // eslint-disable-next-line no-var
  var activeSandboxProvider: any;
  // eslint-disable-next-line no-var
  var sandboxState: SandboxState;
}

const MAX_FILE_BYTES = 200_000; // 200KB per file for commits

const ROOT_ALLOWLIST = new Set<string>([
  './index.html',
  './package.json',
  './package-lock.json',
  './tsconfig.json',
  './tsconfig.app.json',
  './tsconfig.node.json',
  './vite.config.ts',
  './vite.config.js',
  './tailwind.config.js',
  './tailwind.config.cjs',
  './postcss.config.js',
  './.env.example',
]);

function isAllowedPath(path: string): boolean {
  if (ROOT_ALLOWLIST.has(path)) return true;
  return path.startsWith('./src/') || path.startsWith('./public/');
}

export async function GET() {
  try {
    const provider =
      sandboxManager.getActiveProvider() ||
      global.activeSandboxProvider ||
      global.sandboxState?.sandbox;

    if (!provider) {
      return NextResponse.json({ success: false, error: 'No active sandbox' }, { status: 404 });
    }

    const findCmd = [
      'find',
      '.',
      '-name',
      'node_modules',
      '-prune',
      '-o',
      '-name',
      '.git',
      '-prune',
      '-o',
      '-name',
      'dist',
      '-prune',
      '-o',
      '-name',
      'build',
      '-prune',
      '-o',
      '-type',
      'f',
      '-print',
    ];

    const findResult = await provider.runCommand(shJoin(findCmd));
    if (findResult.exitCode !== 0) {
      return NextResponse.json(
        { success: false, error: findResult.stderr || 'Failed to list files' },
        { status: 500 },
      );
    }

    const allFiles = (findResult.stdout || '').split('\n').filter((f: string) => f.trim());
    const allowedFiles = allFiles.filter(isAllowedPath);

    const files: Record<string, string> = {};
    let skippedLargeFiles = 0;

    for (const filePath of allowedFiles) {
      try {
        const sizeResult = await provider.runCommand(`wc -c -- ${shQuote(filePath)}`);
        if (sizeResult.exitCode !== 0) continue;

        const sizeToken = (sizeResult.stdout || '').trim().split(/\s+/)[0];
        const fileSize = parseInt(sizeToken, 10);
        if (!Number.isFinite(fileSize)) continue;

        if (fileSize > MAX_FILE_BYTES) {
          skippedLargeFiles += 1;
          continue;
        }

        const catResult = await provider.runCommand(`cat -- ${shQuote(filePath)}`);
        if (catResult.exitCode === 0) {
          const relativePath = filePath.replace(/^\.\//, '');
          files[relativePath] = catResult.stdout || '';
        }
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      success: true,
      files,
      fileCount: Object.keys(files).length,
      skippedLargeFiles,
    });
  } catch (error) {
    console.error('[get-sandbox-files-for-commit] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}



