import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import Anthropic from '@anthropic-ai/sdk';

declare global {
  var activeSandboxProvider: any;
}

const anthropic = new Anthropic();
const MAX_FIX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  try {
    const { maxAttempts = MAX_FIX_ATTEMPTS } = await request.json();
    
    const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }

    const results: any = {
      attempts: [],
      finalStatus: 'pending',
      totalAttempts: 0
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[auto-fix-tests] Attempt ${attempt}/${maxAttempts}`);
      
      const testResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/run-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'all' })
      });
      
      const testResults = await testResponse.json();
      
      results.attempts.push({
        attempt,
        testResults: {
          passed: testResults.summary?.passed || 0,
          failed: testResults.summary?.failed || 0,
          total: testResults.summary?.total || 0
        }
      });
      results.totalAttempts = attempt;

      if (testResults.success || testResults.summary?.failed === 0) {
        results.finalStatus = 'passed';
        results.message = `All tests passing after ${attempt} attempt(s)`;
        break;
      }

      const failures = extractFailures(testResults);
      
      if (failures.length === 0) {
        results.finalStatus = 'no_failures_detected';
        results.message = 'Tests failed but no specific failures could be extracted';
        break;
      }

      const fixes = await analyzeAndGenerateFixes(provider, failures);
      
      if (fixes.length === 0) {
        results.finalStatus = 'no_fixes_generated';
        results.message = 'Could not generate fixes for the failures';
        break;
      }

      for (const fix of fixes) {
        try {
          const currentContent = await provider.readFile(fix.file);
          const newContent = applyFix(currentContent, fix);
          await provider.writeFile(fix.file, newContent);
          results.attempts[attempt - 1].fixesApplied = results.attempts[attempt - 1].fixesApplied || [];
          results.attempts[attempt - 1].fixesApplied.push({
            file: fix.file,
            description: fix.description
          });
        } catch (error: any) {
          console.error(`[auto-fix-tests] Failed to apply fix to ${fix.file}:`, error);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (results.finalStatus === 'pending') {
      results.finalStatus = 'max_attempts_reached';
      results.message = `Could not fix all tests after ${maxAttempts} attempts`;
    }

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('[auto-fix-tests] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

function extractFailures(testResults: any): any[] {
  const failures: any[] = [];

  if (testResults.tests?.playwright?.details) {
    for (const suite of testResults.tests.playwright.details) {
      for (const spec of suite.specs || []) {
        if (spec.ok === false) {
          failures.push({
            type: 'playwright',
            test: spec.title,
            error: spec.tests?.[0]?.results?.[0]?.error?.message || 'Unknown error',
            file: suite.file
          });
        }
      }
    }
  }

  if (testResults.tests?.accessibility?.violations) {
    for (const violation of testResults.tests.accessibility.violations) {
      failures.push({
        type: 'accessibility',
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes
      });
    }
  }

  if (testResults.tests?.lighthouse?.scores) {
    const scores = testResults.tests.lighthouse.scores;
    if (scores.performance < 50) {
      failures.push({
        type: 'performance',
        score: scores.performance,
        description: 'Performance score below 50'
      });
    }
    if (scores.accessibility < 80) {
      failures.push({
        type: 'lighthouse_accessibility',
        score: scores.accessibility,
        description: 'Accessibility score below 80'
      });
    }
  }

  if (testResults.tests?.console?.errors) {
    for (const error of testResults.tests.console.errors) {
      failures.push({
        type: 'console',
        error
      });
    }
  }

  return failures;
}

async function analyzeAndGenerateFixes(provider: any, failures: any[]): Promise<any[]> {
  const fixes: any[] = [];
  
  const relevantFiles: Record<string, string> = {};
  const fileList = await provider.listFiles('/app/src');
  
  for (const file of fileList.slice(0, 15)) {
    if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      try {
        relevantFiles[file] = await provider.readFile(`/app/src/${file}`);
      } catch {}
    }
  }

  const failuresSummary = failures.map(f => {
    if (f.type === 'playwright') {
      return `Playwright test "${f.test}" failed: ${f.error}`;
    }
    if (f.type === 'accessibility') {
      return `Accessibility violation [${f.id}] (${f.impact}): ${f.description}`;
    }
    if (f.type === 'console') {
      return `Console error: ${f.error}`;
    }
    if (f.type === 'performance') {
      return `Low performance score: ${f.score}/100`;
    }
    return JSON.stringify(f);
  }).join('\n');

  const filesContext = Object.entries(relevantFiles)
    .map(([name, content]) => `=== ${name} ===\n${content.slice(0, 2000)}`)
    .join('\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Analyze these test failures and generate fixes.

TEST FAILURES:
${failuresSummary}

SOURCE FILES:
${filesContext.slice(0, 15000)}

For each failure, provide a fix in this exact JSON format:
{
  "fixes": [
    {
      "file": "src/filename.tsx",
      "description": "Brief description of fix",
      "searchReplace": {
        "search": "exact string to find",
        "replace": "replacement string"
      }
    }
  ]
}

Focus on:
1. Adding missing ARIA labels for accessibility
2. Fixing broken element selectors
3. Adding missing error handling
4. Fixing console errors

Return ONLY valid JSON, no explanation.`
    }]
  });

  const content = message.content[0];
  if (content.type === 'text') {
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.fixes || [];
      }
    } catch (e) {
      console.error('[auto-fix-tests] Failed to parse AI response:', e);
    }
  }

  return fixes;
}

function applyFix(content: string, fix: any): string {
  if (fix.searchReplace) {
    return content.replace(fix.searchReplace.search, fix.searchReplace.replace);
  }
  return content;
}
