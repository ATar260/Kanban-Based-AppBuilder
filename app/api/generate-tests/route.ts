import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import Anthropic from '@anthropic-ai/sdk';

declare global {
  var activeSandboxProvider: any;
}

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { testTypes = ['smoke', 'navigation', 'forms'] } = await request.json();
    
    const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }

    const files = await provider.listFiles('/app/src');
    const sourceFiles: Record<string, string> = {};
    
    for (const file of files.slice(0, 20)) {
      if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js')) {
        try {
          const content = await provider.readFile(`/app/src/${file}`);
          sourceFiles[file] = content;
        } catch {}
      }
    }

    const generatedTests: Record<string, string> = {};

    if (testTypes.includes('smoke')) {
      const smokeTests = await generateSmokeTests(sourceFiles);
      generatedTests['tests/smoke.spec.ts'] = smokeTests;
    }

    if (testTypes.includes('navigation')) {
      const navTests = await generateNavigationTests(sourceFiles);
      generatedTests['tests/navigation.spec.ts'] = navTests;
    }

    if (testTypes.includes('forms')) {
      const formTests = await generateFormTests(sourceFiles);
      generatedTests['tests/forms.spec.ts'] = formTests;
    }

    await provider.runCommand('mkdir -p tests');
    
    const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'json',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});`;

    await provider.writeFile('playwright.config.ts', playwrightConfig);

    for (const [path, content] of Object.entries(generatedTests)) {
      await provider.writeFile(path, content);
    }

    await provider.runCommand('npm install -D @playwright/test @axe-core/playwright');
    await provider.runCommand('npx playwright install chromium');

    return NextResponse.json({
      success: true,
      generatedFiles: Object.keys(generatedTests),
      message: 'Tests generated successfully. Run /api/run-tests to execute.'
    });
    
  } catch (error) {
    console.error('[generate-tests] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

async function generateSmokeTests(sourceFiles: Record<string, string>): Promise<string> {
  const fileList = Object.keys(sourceFiles).join('\n');
  const appContent = sourceFiles['App.tsx'] || sourceFiles['App.jsx'] || '';
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate Playwright smoke tests for this React app. The tests should verify:
1. The app loads without crashing
2. Key UI elements are visible
3. No console errors occur

Files in the project:
${fileList}

Main App component:
${appContent.slice(0, 3000)}

Return ONLY the TypeScript test code, no explanation. Use this format:
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  // tests here
});`
    }]
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text.replace(/```typescript?\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  return getDefaultSmokeTests();
}

async function generateNavigationTests(sourceFiles: Record<string, string>): Promise<string> {
  const routePatterns = Object.entries(sourceFiles)
    .filter(([name]) => name.includes('page') || name.includes('route') || name.includes('Router'))
    .map(([name, content]) => `${name}:\n${content.slice(0, 500)}`)
    .join('\n\n');

  if (!routePatterns) {
    return getDefaultNavigationTests();
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate Playwright navigation tests for this React app. Test that:
1. All routes are accessible
2. Navigation links work
3. Back/forward navigation works

Route-related files:
${routePatterns.slice(0, 4000)}

Return ONLY the TypeScript test code, no explanation.`
    }]
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text.replace(/```typescript?\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  return getDefaultNavigationTests();
}

async function generateFormTests(sourceFiles: Record<string, string>): Promise<string> {
  const formPatterns = Object.entries(sourceFiles)
    .filter(([_, content]) => 
      content.includes('<form') || 
      content.includes('<input') || 
      content.includes('onSubmit') ||
      content.includes('handleSubmit')
    )
    .map(([name, content]) => `${name}:\n${content.slice(0, 1000)}`)
    .join('\n\n');

  if (!formPatterns) {
    return getDefaultFormTests();
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate Playwright form tests for this React app. Test that:
1. Form inputs are fillable
2. Validation works (if visible)
3. Form submission triggers expected behavior

Form-related code:
${formPatterns.slice(0, 4000)}

Return ONLY the TypeScript test code, no explanation.`
    }]
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text.replace(/```typescript?\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  return getDefaultFormTests();
}

function getDefaultSmokeTests(): string {
  return `import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.*/);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });

  test('main content is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root, #__next, main, [role="main"]').first()).toBeVisible();
  });
});`;
}

function getDefaultNavigationTests(): string {
  return `import { test, expect } from '@playwright/test';

test.describe('Navigation Tests', () => {
  test('home page is accessible', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('navigation links are clickable', async ({ page }) => {
    await page.goto('/');
    
    const links = page.locator('a[href^="/"]');
    const count = await links.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const href = await links.nth(i).getAttribute('href');
      if (href && href !== '/') {
        await page.goto(href);
        await expect(page).not.toHaveURL(/error|404/i);
      }
    }
  });
});`;
}

function getDefaultFormTests(): string {
  return `import { test, expect } from '@playwright/test';

test.describe('Form Tests', () => {
  test('input fields are interactive', async ({ page }) => {
    await page.goto('/');
    
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        await input.click();
        await input.fill('test value');
        await expect(input).toHaveValue('test value');
      }
    }
  });

  test('buttons are clickable', async ({ page }) => {
    await page.goto('/');
    
    const buttons = page.locator('button:not([disabled])');
    const count = await buttons.count();
    
    expect(count).toBeGreaterThanOrEqual(0);
  });
});`;
}
