import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { validateAIProvider } from '@/lib/api-validation';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

declare global {
  var activeSandboxProvider: any;
}

const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : process.env.OPENAI_BASE_URL,
});

const AUTO_REFACTOR_PROMPT = `You are an expert code cleanup agent. After a feature was soft-deleted (code commented out), you need to clean up the codebase to maintain stability.

Your tasks:
1. Remove any broken imports that reference deleted/commented code
2. Remove unused variables that were only used by the deleted code
3. Fix any TypeScript errors caused by the deletion
4. Clean up any dangling references
5. Ensure the code compiles and runs

Rules:
- Only make minimal changes necessary for stability
- Do NOT remove the commented-out code itself
- Preserve all other functionality
- Add helpful comments if needed

Return your response as a JSON object:
{
  "changes": [
    {
      "file": "path/to/file.tsx",
      "description": "Brief description of change",
      "original": "original code snippet",
      "fixed": "fixed code snippet"
    }
  ],
  "summary": "Brief summary of changes made"
}

ONLY return valid JSON.`;

interface RefactorRequest {
  sandboxId: string;
  affectedFiles: string[];
  ticketId?: string;
}

interface RefactorChange {
  file: string;
  description: string;
  original: string;
  fixed: string;
}

interface RefactorResult {
  changes: RefactorChange[];
  summary: string;
}

export async function POST(request: NextRequest) {
  const validation = validateAIProvider();
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const body: RefactorRequest = await request.json();
    const { sandboxId, affectedFiles, ticketId } = body;

    if (!sandboxId) {
      return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 });
    }

    if (!affectedFiles || affectedFiles.length === 0) {
      return NextResponse.json({ success: true, changes: [], summary: 'No files to refactor' });
    }

    const provider = global.activeSandboxProvider || await sandboxManager.getOrCreateProvider(sandboxId);
    if (!provider) {
      return NextResponse.json({ error: 'No active sandbox found' }, { status: 400 });
    }

    const fileContents: Array<{ path: string; content: string }> = [];
    for (const filePath of affectedFiles) {
      try {
        const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        const content = await provider.readFile(normalizedPath);
        fileContents.push({ path: filePath, content });
      } catch {
        // Skip files that can't be read
      }
    }

    if (fileContents.length === 0) {
      return NextResponse.json({ success: true, changes: [], summary: 'No readable files found' });
    }

    const filesContent = fileContents
      .map(f => `// FILE: ${f.path}\n${f.content}`)
      .join('\n\n---\n\n');

    const { text } = await generateText({
      model: openai('gpt-5-mini'),
      messages: [
        { role: 'system', content: AUTO_REFACTOR_PROMPT },
        {
          role: 'user',
          content: `Analyze and refactor the following files after soft-deletion${ticketId ? ` (Ticket: ${ticketId})` : ''}:\n\n${filesContent}`,
        },
      ],
      temperature: 0.2,
      maxOutputTokens: 4000,
    });

    let result: RefactorResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { changes: [], summary: 'No changes needed' };
      }
    } catch {
      result = { changes: [], summary: 'Analysis complete - no automated changes' };
    }

    const appliedChanges: RefactorChange[] = [];
    for (const change of result.changes) {
      try {
        const normalizedPath = change.file.startsWith('/') ? change.file : `/${change.file}`;
        const currentContent = await provider.readFile(normalizedPath);

        if (currentContent.includes(change.original)) {
          const newContent = currentContent.replace(change.original, change.fixed);
          await provider.writeFile(normalizedPath, newContent);
          appliedChanges.push(change);
        }
      } catch {
        // Skip changes that fail
      }
    }

    return NextResponse.json({
      success: true,
      analyzedFiles: affectedFiles.length,
      changesApplied: appliedChanges.length,
      changes: appliedChanges,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error('[auto-refactor] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
