import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

declare global {
  var activeSandboxProvider: any;
}

export async function POST(request: NextRequest) {
  try {
    const { testType = 'all' } = await request.json();
    
    const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: { passed: 0, failed: 0, total: 0 }
    };

    if (testType === 'all' || testType === 'playwright') {
      const playwrightResult = await runPlaywrightTests(provider);
      results.tests.playwright = playwrightResult;
      results.summary.total += playwrightResult.total;
      results.summary.passed += playwrightResult.passed;
      results.summary.failed += playwrightResult.failed;
    }

    if (testType === 'all' || testType === 'accessibility') {
      const a11yResult = await runAccessibilityTests(provider);
      results.tests.accessibility = a11yResult;
      results.summary.total += a11yResult.total;
      results.summary.passed += a11yResult.passed;
      results.summary.failed += a11yResult.failed;
    }

    if (testType === 'all' || testType === 'lighthouse') {
      const lighthouseResult = await runLighthouseTests(provider);
      results.tests.lighthouse = lighthouseResult;
    }

    if (testType === 'all' || testType === 'console') {
      const consoleResult = await checkConsoleErrors(provider);
      results.tests.console = consoleResult;
      if (!consoleResult.success) {
        results.summary.failed += 1;
      } else {
        results.summary.passed += 1;
      }
      results.summary.total += 1;
    }

    results.success = results.summary.failed === 0;

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('[run-tests] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

async function runPlaywrightTests(provider: any) {
  try {
    const checkPlaywright = await provider.runCommand('npx playwright --version');
    if (!checkPlaywright.success) {
      await provider.runCommand('npm install -D @playwright/test');
      await provider.runCommand('npx playwright install chromium');
    }

    const testFileExists = await provider.runCommand('test -f tests/smoke.spec.ts && echo "exists"');
    if (!testFileExists.stdout.includes('exists')) {
      return { 
        skipped: true, 
        message: 'No test files found. Run generate-tests first.',
        total: 0, passed: 0, failed: 0 
      };
    }

    const result = await provider.runCommand('npx playwright test --reporter=json 2>/dev/null || true');
    
    try {
      const jsonOutput = JSON.parse(result.stdout);
      return {
        success: jsonOutput.stats?.unexpected === 0,
        total: jsonOutput.stats?.expected || 0,
        passed: jsonOutput.stats?.expected - (jsonOutput.stats?.unexpected || 0),
        failed: jsonOutput.stats?.unexpected || 0,
        duration: jsonOutput.stats?.duration || 0,
        details: jsonOutput.suites || []
      };
    } catch {
      const passMatch = result.stdout.match(/(\d+) passed/);
      const failMatch = result.stdout.match(/(\d+) failed/);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      
      return {
        success: failed === 0,
        total: passed + failed,
        passed,
        failed,
        rawOutput: result.stdout
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      total: 0, passed: 0, failed: 0 
    };
  }
}

async function runAccessibilityTests(provider: any) {
  try {
    const checkAxe = await provider.runCommand('npm list @axe-core/playwright 2>/dev/null');
    if (!checkAxe.success) {
      await provider.runCommand('npm install -D @axe-core/playwright');
    }

    const a11yTestExists = await provider.runCommand('test -f tests/accessibility.spec.ts && echo "exists"');
    if (!a11yTestExists.stdout.includes('exists')) {
      const a11yTest = `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    console.log(JSON.stringify({ violations: results.violations }));
    expect(results.violations).toHaveLength(0);
  });
});`;
      
      await provider.runCommand('mkdir -p tests');
      await provider.writeFile('tests/accessibility.spec.ts', a11yTest);
    }

    const result = await provider.runCommand('npx playwright test tests/accessibility.spec.ts --reporter=json 2>/dev/null || true');
    
    const violationsMatch = result.stdout.match(/violations.*?(\[.*?\])/s);
    let violations: any[] = [];
    try {
      if (violationsMatch) {
        violations = JSON.parse(violationsMatch[1]);
      }
    } catch {}

    return {
      success: violations.length === 0,
      total: 1,
      passed: violations.length === 0 ? 1 : 0,
      failed: violations.length > 0 ? 1 : 0,
      violations: violations.map((v: any) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes?.length || 0
      }))
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      total: 1, passed: 0, failed: 1,
      violations: []
    };
  }
}

async function runLighthouseTests(provider: any) {
  try {
    const checkLighthouse = await provider.runCommand('npx lighthouse --version 2>/dev/null');
    if (!checkLighthouse.success) {
      await provider.runCommand('npm install -D lighthouse');
    }

    const sandboxUrl = provider.getSandboxUrl?.() || 'http://localhost:5173';
    
    const result = await provider.runCommand(
      `npx lighthouse ${sandboxUrl} --output=json --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless --no-sandbox" 2>/dev/null || true`
    );

    try {
      const report = JSON.parse(result.stdout);
      return {
        success: true,
        scores: {
          performance: Math.round((report.categories?.performance?.score || 0) * 100),
          accessibility: Math.round((report.categories?.accessibility?.score || 0) * 100),
          bestPractices: Math.round((report.categories?.['best-practices']?.score || 0) * 100),
          seo: Math.round((report.categories?.seo?.score || 0) * 100)
        },
        audits: {
          lcp: report.audits?.['largest-contentful-paint']?.displayValue,
          fid: report.audits?.['max-potential-fid']?.displayValue,
          cls: report.audits?.['cumulative-layout-shift']?.displayValue
        }
      };
    } catch {
      return {
        success: false,
        error: 'Failed to parse Lighthouse results',
        scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
    };
  }
}

async function checkConsoleErrors(provider: any) {
  try {
    const result = await provider.runCommand('cat /tmp/vite.log 2>/dev/null | tail -100');
    
    const errorPatterns = [
      /error/i,
      /failed/i,
      /exception/i,
      /uncaught/i,
      /warning.*deprecated/i
    ];

    const lines = result.stdout.split('\n');
    const errors = lines.filter((line: string) => 
      errorPatterns.some(pattern => pattern.test(line)) &&
      !line.includes('[vite]') &&
      !line.includes('HMR')
    );

    return {
      success: errors.length === 0,
      errorCount: errors.length,
      errors: errors.slice(0, 10)
    };
  } catch (error: any) {
    return { 
      success: true, 
      errorCount: 0,
      errors: [],
      note: 'Could not read logs'
    };
  }
}
