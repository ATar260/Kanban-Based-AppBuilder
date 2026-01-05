import { NextRequest, NextResponse } from 'next/server';
import { parseMorphEdits, applyMorphEditToFile } from '@/lib/morph-fast-apply';
// Sandbox import not needed - using global sandbox from sandbox-manager
import type { SandboxState } from '@/types/sandbox';
import type { ConversationState } from '@/types/conversation';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import path from 'path';

declare global {
  var conversationState: ConversationState | null;
  var activeSandboxProvider: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
  var installedPackagesCache: Map<string, Set<string>>; // sandboxId -> Set<packageName>
}

interface ParsedResponse {
  explanation: string;
  template: string;
  files: Array<{ path: string; content: string }>;
  packages: string[];
  commands: string[];
  structure: string | null;
}

function parseAIResponse(response: string): ParsedResponse {
  const sections = {
    files: [] as Array<{ path: string; content: string }>,
    commands: [] as string[],
    packages: [] as string[],
    structure: null as string | null,
    explanation: '',
    template: ''
  };

  // Function to extract packages from import statements
  function extractPackagesFromCode(content: string): string[] {
    const packages: string[] = [];
    // Match ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
    let importMatch;

    while ((importMatch = importRegex.exec(content)) !== null) {
      const importPath = importMatch[1];
      // Skip relative imports and built-in React
      if (!importPath.startsWith('.') && !importPath.startsWith('/') &&
        importPath !== 'react' && importPath !== 'react-dom' &&
        !importPath.startsWith('@/')) {
        // Extract package name (handle scoped packages like @heroicons/react)
        const packageName = importPath.startsWith('@')
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];

        if (!packages.includes(packageName)) {
          packages.push(packageName);

          // Log important packages for debugging
          if (packageName === 'react-router-dom' || packageName.includes('router') || packageName.includes('icon')) {
            console.log(`[apply-ai-code-stream] Detected package from imports: ${packageName}`);
          }
        }
      }
    }

    return packages;
  }

  // Parse file sections - handle duplicates and prefer complete versions
  const fileMap = new Map<string, { content: string; isComplete: boolean }>();

  // First pass: Find all file declarations
  // Robust file block parsing:
  // - Prefer explicit `</file>` terminator when present
  // - If a file is truncated (missing `</file>`), stop at the next `<file path="...">` instead of consuming the rest
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|(?=<file path=")|$)/g;
  let match;
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    const hasClosingTag = match[0].includes('</file>');

    // Check if this file already exists in our map
    const existing = fileMap.get(filePath);

    // Decide whether to keep this version
    let shouldReplace = false;
    if (!existing) {
      shouldReplace = true; // First occurrence
    } else if (!existing.isComplete && hasClosingTag) {
      shouldReplace = true; // Replace incomplete with complete
      console.log(`[apply-ai-code-stream] Replacing incomplete ${filePath} with complete version`);
    } else if (existing.isComplete && hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true; // Replace with longer complete version
      console.log(`[apply-ai-code-stream] Replacing ${filePath} with longer complete version`);
    } else if (!existing.isComplete && !hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true; // Both incomplete, keep longer one
    }

    if (shouldReplace) {
      // Additional validation: reject obviously broken content
      if (content.includes('...') && !content.includes('...props') && !content.includes('...rest')) {
        console.warn(`[apply-ai-code-stream] Warning: ${filePath} contains ellipsis, may be truncated`);
        // Still use it if it's the only version we have
        if (!existing) {
          fileMap.set(filePath, { content, isComplete: hasClosingTag });
        }
      } else {
        fileMap.set(filePath, { content, isComplete: hasClosingTag });
      }
    }
  }

  // Convert map to array for sections.files
  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[apply-ai-code-stream] Warning: File ${path} appears to be truncated (no closing tag)`);
    }

    sections.files.push({
      path,
      content
    });

    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }

  // Also parse markdown code blocks with file paths
  const markdownFileRegex = /```(?:file )?path="([^"]+)"\n([\s\S]*?)```/g;
  while ((match = markdownFileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    sections.files.push({
      path: filePath,
      content: content
    });

    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }

  // Parse plain text format like "Generated Files: Header.jsx, index.css"
  const generatedFilesMatch = response.match(/Generated Files?:\s*([^\n]+)/i);
  if (generatedFilesMatch) {
    // Split by comma first, then trim whitespace, to preserve filenames with dots
    const filesList = generatedFilesMatch[1]
      .split(',')
      .map(f => f.trim())
      .filter(f => f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css') || f.endsWith('.json') || f.endsWith('.html'));
    console.log(`[apply-ai-code-stream] Detected generated files from plain text: ${filesList.join(', ')}`);

    // Try to extract the actual file content if it follows
    for (const fileName of filesList) {
      // Look for the file content after the file name
      const fileContentRegex = new RegExp(`${fileName}[\\s\\S]*?(?:import[\\s\\S]+?)(?=Generated Files:|Applying code|$)`, 'i');
      const fileContentMatch = response.match(fileContentRegex);
      if (fileContentMatch) {
        // Extract just the code part (starting from import statements)
        const codeMatch = fileContentMatch[0].match(/^(import[\s\S]+)$/m);
        if (codeMatch) {
          const filePath = fileName.includes('/') ? fileName : `src/components/${fileName}`;
          sections.files.push({
            path: filePath,
            content: codeMatch[1].trim()
          });
          console.log(`[apply-ai-code-stream] Extracted content for ${filePath}`);

          // Extract packages from this file
          const filePackages = extractPackagesFromCode(codeMatch[1]);
          for (const pkg of filePackages) {
            if (!sections.packages.includes(pkg)) {
              sections.packages.push(pkg);
              console.log(`[apply-ai-code-stream] Package detected from imports: ${pkg}`);
            }
          }
        }
      }
    }
  }

  // Also try to parse if the response contains raw JSX/JS code blocks
  const codeBlockRegex = /```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const content = match[1].trim();
    // Try to detect the file name from comments or context
    const fileNameMatch = content.match(/\/\/\s*(?:File:|Component:)\s*([^\n]+)/);
    if (fileNameMatch) {
      const fileName = fileNameMatch[1].trim();
      const filePath = fileName.includes('/') ? fileName : `src/components/${fileName}`;

      // Don't add duplicate files
      if (!sections.files.some(f => f.path === filePath)) {
        sections.files.push({
          path: filePath,
          content: content
        });

        // Extract packages
        const filePackages = extractPackagesFromCode(content);
        for (const pkg of filePackages) {
          if (!sections.packages.includes(pkg)) {
            sections.packages.push(pkg);
          }
        }
      }
    }
  }

  // Parse commands
  const cmdRegex = /<command>(.*?)<\/command>/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  // Parse packages - support both <package> and <packages> tags
  const pkgRegex = /<package>(.*?)<\/package>/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    sections.packages.push(match[1].trim());
  }

  // Also parse <packages> tag with multiple packages
  const packagesRegex = /<packages>([\s\S]*?)<\/packages>/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesContent = packagesMatch[1].trim();
    // Split by newlines or commas
    const packagesList = packagesContent.split(/[\n,]+/)
      .map(pkg => pkg.trim())
      .filter(pkg => pkg.length > 0);
    sections.packages.push(...packagesList);
  }

  // Parse structure
  const structureMatch = /<structure>([\s\S]*?)<\/structure>/;
  const structResult = response.match(structureMatch);
  if (structResult) {
    sections.structure = structResult[1].trim();
  }

  // Parse explanation
  const explanationMatch = /<explanation>([\s\S]*?)<\/explanation>/;
  const explResult = response.match(explanationMatch);
  if (explResult) {
    sections.explanation = explResult[1].trim();
  }

  // Parse template
  const templateMatch = /<template>(.*?)<\/template>/;
  const templResult = response.match(templateMatch);
  if (templResult) {
    sections.template = templResult[1].trim();
  }

  return sections;
}

export async function POST(request: NextRequest) {
  try {
    const { response, isEdit = false, packages = [], sandboxId } = await request.json();

    if (!response) {
      return NextResponse.json({
        error: 'response is required'
      }, { status: 400 });
    }

    // Debug log the response
    console.log('[apply-ai-code-stream] Received response to parse:');
    console.log('[apply-ai-code-stream] Response length:', response.length);
    console.log('[apply-ai-code-stream] Response preview:', response.substring(0, 500));
    console.log('[apply-ai-code-stream] isEdit:', isEdit);
    console.log('[apply-ai-code-stream] packages:', packages);

    // Parse the AI response
    const parsed = parseAIResponse(response);
    const morphEnabled = Boolean(isEdit && process.env.MORPH_API_KEY);
    const morphEdits = morphEnabled ? parseMorphEdits(response) : [];
    console.log('[apply-ai-code-stream] Morph Fast Apply mode:', morphEnabled);
    if (morphEnabled) {
      console.log('[apply-ai-code-stream] Morph edits found:', morphEdits.length);
    }
    
    // Log what was parsed
    console.log('[apply-ai-code-stream] Parsed result:');
    console.log('[apply-ai-code-stream] Files found:', parsed.files.length);
    if (parsed.files.length > 0) {
      parsed.files.forEach(f => {
        console.log(`[apply-ai-code-stream] - ${f.path} (${f.content.length} chars)`);
      });
    }
    console.log('[apply-ai-code-stream] Packages found:', parsed.packages);

    // Initialize existingFiles if not already
    if (!global.existingFiles) {
      global.existingFiles = new Set<string>();
    }

    // Try to get provider from sandbox manager first
    let provider = sandboxId ? sandboxManager.getProvider(sandboxId) : sandboxManager.getActiveProvider();

    // Fall back to global state if not found in manager
    if (!provider) {
      provider = global.activeSandboxProvider;
    }

    // If we have a sandboxId but no provider, try to get or create one
    if (!provider && sandboxId) {
      console.log(`[apply-ai-code-stream] No provider found for sandbox ${sandboxId}, attempting to get or create...`);

      try {
        provider = await sandboxManager.getOrCreateProvider(sandboxId);

        // If we got a new provider (not reconnected), we need to create a new sandbox
        if (!provider.getSandboxInfo()) {
          console.log(`[apply-ai-code-stream] Creating new sandbox since reconnection failed for ${sandboxId}`);
          await provider.createSandbox();
          await provider.setupViteApp();
          sandboxManager.registerSandbox(sandboxId, provider);
        }

        // Update legacy global state
        global.activeSandboxProvider = provider;
        console.log(`[apply-ai-code-stream] Successfully got provider for sandbox ${sandboxId}`);
      } catch (providerError) {
        console.error(`[apply-ai-code-stream] Failed to get or create provider for sandbox ${sandboxId}:`, providerError);
        return NextResponse.json({
          success: false,
          error: `Failed to create sandbox provider for ${sandboxId}. The sandbox may have expired.`,
          results: {
            filesCreated: [],
            packagesInstalled: [],
            commandsExecuted: [],
            errors: [`Sandbox provider creation failed: ${(providerError as Error).message}`]
          },
          explanation: parsed.explanation,
          structure: parsed.structure,
          parsedFiles: parsed.files,
          message: `Parsed ${parsed.files.length} files but couldn't apply them - sandbox reconnection failed.`
        }, { status: 500 });
      }
    }

    // If we still don't have a provider, create a new one
    if (!provider) {
      console.log(`[apply-ai-code-stream] No active provider found, creating new sandbox...`);
      try {
        const { SandboxFactory } = await import('@/lib/sandbox/factory');
        provider = SandboxFactory.create();
        const sandboxInfo = await provider.createSandbox();
        await provider.setupViteApp();

        // Register with sandbox manager
        sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);

        // Store in legacy global state
        global.activeSandboxProvider = provider;
        global.sandboxData = {
          sandboxId: sandboxInfo.sandboxId,
          url: sandboxInfo.url
        };

        console.log(`[apply-ai-code-stream] Created new sandbox successfully`);
      } catch (createError) {
        console.error(`[apply-ai-code-stream] Failed to create new sandbox:`, createError);
        return NextResponse.json({
          success: false,
          error: `Failed to create new sandbox: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
          results: {
            filesCreated: [],
            packagesInstalled: [],
            commandsExecuted: [],
            errors: [`Sandbox creation failed: ${createError instanceof Error ? createError.message : 'Unknown error'}`]
          },
          explanation: parsed.explanation,
          structure: parsed.structure,
          parsedFiles: parsed.files,
          message: `Parsed ${parsed.files.length} files but couldn't apply them - sandbox creation failed.`
        }, { status: 500 });
      }
    }

    // Create a response stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Function to send progress updates
    const sendProgress = async (data: any) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Start processing in background (pass provider and request to the async function)
    (async (providerInstance, req) => {
      const results = {
        filesCreated: [] as string[],
        filesUpdated: [] as string[],
        packagesInstalled: [] as string[],
        packagesAlreadyInstalled: [] as string[],
        packagesFailed: [] as string[],
        commandsExecuted: [] as string[],
        errors: [] as string[]
      };

      try {
        await sendProgress({
          type: 'start',
          message: 'Starting code application...',
          totalSteps: 3
        });
        if (morphEnabled) {
          await sendProgress({ type: 'info', message: 'Morph Fast Apply enabled' });
          await sendProgress({ type: 'info', message: `Parsed ${morphEdits.length} Morph edits` });
          if (morphEdits.length === 0) {
            console.warn('[apply-ai-code-stream] Morph enabled but no <edit> blocks found; falling back to full-file flow');
            await sendProgress({ type: 'warning', message: 'Morph enabled but no <edit> blocks found; falling back to full-file flow' });
          }
        }
        
        // Step 1: Install packages (with caching optimization)
        const packagesArray = Array.isArray(packages) ? packages : [];
        const parsedPackages = Array.isArray(parsed.packages) ? parsed.packages : [];

        // Initialize package cache if not exists
        if (!global.installedPackagesCache) {
          global.installedPackagesCache = new Map();
        }
        
        const currentSandboxId = sandboxId || providerInstance.getSandboxInfo()?.sandboxId || 'default';
        if (!global.installedPackagesCache.has(currentSandboxId)) {
          global.installedPackagesCache.set(currentSandboxId, new Set(['react', 'react-dom'])); // Pre-installed
        }
        const installedInSandbox = global.installedPackagesCache.get(currentSandboxId)!;

        // Combine and deduplicate packages
        const allPackages = [...packagesArray.filter(pkg => pkg && typeof pkg === 'string'), ...parsedPackages];

        // OPTIMIZATION: Filter out already installed packages from cache
        const uniquePackages = [...new Set(allPackages)]
          .filter(pkg => pkg && typeof pkg === 'string' && pkg.trim() !== '')
          .filter(pkg => !installedInSandbox.has(pkg)); // Skip already installed

        // Log cache hits
        const cachedCount = allPackages.filter(pkg => installedInSandbox.has(pkg)).length;
        if (cachedCount > 0) {
          console.log(`[apply-ai-code-stream] OPTIMIZATION: Skipped ${cachedCount} already-installed packages`);
          results.packagesAlreadyInstalled = allPackages.filter(pkg => installedInSandbox.has(pkg));
        }

        if (uniquePackages.length > 0) {
          await sendProgress({
            type: 'step',
            step: 1,
            message: `Installing ${uniquePackages.length} packages...`,
            packages: uniquePackages
          });

          // Use streaming package installation
          try {
            // Construct the API URL properly for both dev and production
            const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
            const host = req.headers.get('host') || 'localhost:3000';
            const apiUrl = `${protocol}://${host}/api/install-packages`;

            const installResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                packages: uniquePackages,
                sandboxId: sandboxId || providerInstance.getSandboxInfo()?.sandboxId
              })
            });

            if (installResponse.ok && installResponse.body) {
              const reader = installResponse.body.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                if (!chunk) continue;
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));

                      // Forward package installation progress
                      await sendProgress({
                        type: 'package-progress',
                        ...data
                      });

                      // Track results and update cache
                      if (data.type === 'success' && data.installedPackages) {
                        results.packagesInstalled = data.installedPackages;
                        // Update the installed packages cache
                        for (const pkg of data.installedPackages) {
                          installedInSandbox.add(pkg);
                        }
                      }
                    } catch (parseError) {
                      console.debug('Error parsing terminal output:', parseError);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('[apply-ai-code-stream] Error installing packages:', error);
            await sendProgress({
              type: 'warning',
              message: `Package installation skipped (${(error as Error).message}). Continuing with file creation...`
            });
            results.errors.push(`Package installation failed: ${(error as Error).message}`);
          }
        } else {
          await sendProgress({
            type: 'step',
            step: 1,
            message: 'No additional packages to install, skipping...'
          });
        }

        // Step 2: Create/update files
        const filesArray = Array.isArray(parsed.files) ? parsed.files : [];
        await sendProgress({
          type: 'step',
          step: 2,
          message: `Creating ${filesArray.length} files...`
        });

        // Filter out config files that shouldn't be created
        const configFiles = ['tailwind.config.js', 'vite.config.js', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.js'];
        // Files that we *do* allow creating, but must remain at repo root (do not prefix into src/)
        const rootFiles = ['.env.example'];
        let filteredFiles = filesArray.filter(file => {
          if (!file || typeof file !== 'object') return false;
          const fileName = (file.path || '').split('/').pop() || '';
          return !configFiles.includes(fileName);
        });

        // If Morph is enabled and we have edits, apply them before file writes
        const morphUpdatedPaths = new Set<string>();
        if (morphEnabled && morphEdits.length > 0) {
          const morphSandbox = (global as any).activeSandbox || providerInstance;
          if (!morphSandbox) {
            console.warn('[apply-ai-code-stream] No sandbox available to apply Morph edits');
            await sendProgress({ type: 'warning', message: 'No sandbox available to apply Morph edits' });
          } else {
            await sendProgress({ type: 'info', message: `Applying ${morphEdits.length} fast edits via Morph...` });
            for (const [idx, edit] of morphEdits.entries()) {
              try {
                await sendProgress({ type: 'file-progress', current: idx + 1, total: morphEdits.length, fileName: edit.targetFile, action: 'morph-applying' });
                const result = await applyMorphEditToFile({
                  sandbox: morphSandbox,
                  targetPath: edit.targetFile,
                  instructions: edit.instructions,
                  updateSnippet: edit.update
                });
                if (result.success && result.normalizedPath) {
                  console.log('[apply-ai-code-stream] Morph updated', result.normalizedPath);
                  morphUpdatedPaths.add(result.normalizedPath);
                  if (results.filesUpdated) results.filesUpdated.push(result.normalizedPath);
                  await sendProgress({ type: 'file-complete', fileName: result.normalizedPath, action: 'morph-updated' });
                } else {
                  const msg = result.error || 'Unknown Morph error';
                  console.error('[apply-ai-code-stream] Morph apply failed for', edit.targetFile, msg);
                  if (results.errors) results.errors.push(`Morph apply failed for ${edit.targetFile}: ${msg}`);
                  await sendProgress({ type: 'file-error', fileName: edit.targetFile, error: msg });
                }
              } catch (err) {
                const msg = (err as Error).message;
                console.error('[apply-ai-code-stream] Morph apply exception for', edit.targetFile, msg);
                if (results.errors) results.errors.push(`Morph apply exception for ${edit.targetFile}: ${msg}`);
                await sendProgress({ type: 'file-error', fileName: edit.targetFile, error: msg });
              }
            }
          }
        }

        // Avoid overwriting Morph-updated files in the file write loop
        if (morphUpdatedPaths.size > 0) {
          filteredFiles = filteredFiles.filter(file => {
            if (!file?.path) return true;
            let normalizedPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
            const fileName = normalizedPath.split('/').pop() || '';
            if (!normalizedPath.startsWith('src/') &&
                !normalizedPath.startsWith('public/') &&
                normalizedPath !== 'index.html' &&
                !configFiles.includes(fileName) &&
                !rootFiles.includes(fileName)) {
              normalizedPath = 'src/' + normalizedPath;
            }
            return !morphUpdatedPaths.has(normalizedPath);
          });
        }

        // Write-order matters for Vite: if we write src/App.jsx before its imported components exist,
        // Vite can briefly throw 500s / import-analysis errors during HMR. To reduce this, write leaf
        // modules first and entry points last.
        const normalizeGeneratedPath = (p: string) => {
          let normalizedPath = p.startsWith('/') ? p.slice(1) : p;
          const fileName = normalizedPath.split('/').pop() || '';
          if (!normalizedPath.startsWith('src/') &&
              !normalizedPath.startsWith('public/') &&
              normalizedPath !== 'index.html' &&
              !configFiles.includes(fileName) &&
              !rootFiles.includes(fileName)) {
            normalizedPath = 'src/' + normalizedPath;
          }
          return normalizedPath;
        };

        const writeRank = (normalizedPath: string) => {
          // Lower rank writes first
          if (normalizedPath.startsWith('src/components/')) return 10;
          if (normalizedPath.startsWith('src/')) return 20;
          if (normalizedPath.startsWith('public/')) return 30;
          if (normalizedPath.endsWith('src/index.css')) return 40;
          // Entry points last
          if (normalizedPath === 'src/App.jsx' || normalizedPath === 'src/App.tsx') return 90;
          if (normalizedPath === 'src/main.jsx' || normalizedPath === 'src/main.tsx') return 95;
          if (normalizedPath === 'src/index.jsx' || normalizedPath === 'src/index.tsx') return 95;
          if (normalizedPath === 'index.html') return 99;
          return 50;
        };

        filteredFiles = [...filteredFiles].sort((a, b) => {
          const aNorm = normalizeGeneratedPath(a.path);
          const bNorm = normalizeGeneratedPath(b.path);
          const rankDiff = writeRank(aNorm) - writeRank(bNorm);
          if (rankDiff !== 0) return rankDiff;
          // Prefer deeper paths first (leaf modules), then stable by path
          const depthDiff = bNorm.split('/').length - aNorm.split('/').length;
          if (depthDiff !== 0) return depthDiff;
          return aNorm.localeCompare(bNorm);
        });

        // Some generators produce TSX entrypoints (App.tsx / main.tsx) but the Vite template still boots
        // from src/main.jsx → src/App.jsx. We patch the runtime entry to point at the generated TSX app
        // so the preview actually updates.
        const normalizedPathsSet = new Set(filteredFiles.map(f => normalizeGeneratedPath(f.path)));
        const appImportPath =
          normalizedPathsSet.has('src/App.tsx') ? './App.tsx' :
          normalizedPathsSet.has('src/App.ts') ? './App.ts' :
          null;
        const desiredEntry =
          normalizedPathsSet.has('src/main.tsx') ? '/src/main.tsx' :
          normalizedPathsSet.has('src/main.ts') ? '/src/main.ts' :
          null;
        const shouldPatchIndexHtml = Boolean(desiredEntry) && !normalizedPathsSet.has('index.html');
        // Only patch the template `src/main.jsx` when we *don't* have a TS entrypoint to point `index.html` at.
        // If we generate `src/main.tsx`, we must update `index.html` to load it; otherwise React Router context
        // can be missing (the default template `main.jsx` renders `<App />` without a `<BrowserRouter>`).
        const shouldPatchExistingMainJsx =
          !desiredEntry &&
          Boolean(appImportPath) &&
          !normalizedPathsSet.has('src/main.jsx');

        // Track the final written content so we can do post-write validation/repairs (e.g. missing imports).
        const writtenFilesContent = new Map<string, string>();
        
        for (const [index, file] of filteredFiles.entries()) {
          try {
            // Send progress for each file
            await sendProgress({
              type: 'file-progress',
              current: index + 1,
              total: filteredFiles.length,
              fileName: file.path,
              action: 'creating'
            });

            // Normalize the file path
            let normalizedPath = file.path;
            if (normalizedPath.startsWith('/')) {
              normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith('src/') &&
              !normalizedPath.startsWith('public/') &&
              normalizedPath !== 'index.html' &&
              !configFiles.includes(normalizedPath.split('/').pop() || '') &&
              !rootFiles.includes(normalizedPath.split('/').pop() || '')) {
              normalizedPath = 'src/' + normalizedPath;
            }

            const isUpdate = global.existingFiles.has(normalizedPath);

            // Remove any CSS imports from JSX/JS files (we're using Tailwind).
            // Keep the global Tailwind entry import (./index.css) since Vite needs one CSS entrypoint.
            let fileContent = file.content;
            if (file.path.endsWith('.jsx') || file.path.endsWith('.js') || file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
              fileContent = fileContent.replace(/import\s+['"]\.\/(?!index\.css)[^'"]+\.css['"];?\s*\n?/g, '');

              // If we're writing an entry file, make sure it points to the TS app when present.
              if (appImportPath && (normalizedPath === 'src/main.tsx' || normalizedPath === 'src/main.ts')) {
                // IMPORTANT: avoid `\s*` here because it can swallow the trailing newline and break the next import line
                // (e.g. `import App ...\nimport './index.css'` -> `import App ...import './index.css'`).
                fileContent = fileContent.replace(
                  /import\s+App\s+from\s+['"]\.\/App(?:\.[jt]sx?)?['"][ \t]*;?/g,
                  `import App from '${appImportPath}'`
                );
                if (!/import\s+['"]\.\/index\.css['"]/.test(fileContent)) {
                  // Keep Tailwind styles in the runtime bundle.
                  fileContent = fileContent.replace(
                    /(import\s+ReactDOM[^;]*;?\s*\n)/,
                    `$1import './index.css'\n`
                  );
                }
              }
            }

            // Fix common Tailwind CSS errors in CSS files
            if (file.path.endsWith('.css')) {
              // Replace shadow-3xl with shadow-2xl (shadow-3xl doesn't exist)
              fileContent = fileContent.replace(/shadow-3xl/g, 'shadow-2xl');
              // Replace any other non-existent shadow utilities
              fileContent = fileContent.replace(/shadow-4xl/g, 'shadow-2xl');
              fileContent = fileContent.replace(/shadow-5xl/g, 'shadow-2xl');
            }

            // Store the final content we'll write (used later for missing-import placeholder generation)
            writtenFilesContent.set(normalizedPath, fileContent);

            // Create directory if needed
            const dirPath = normalizedPath.includes('/') ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) : '';
            if (dirPath) {
              await providerInstance.runCommand(`mkdir -p ${dirPath}`);
            }

            // Write the file using provider
            await providerInstance.writeFile(normalizedPath, fileContent);

            // Update file cache
            if (global.sandboxState?.fileCache) {
              global.sandboxState.fileCache.files[normalizedPath] = {
                content: fileContent,
                lastModified: Date.now()
              };
            }

            if (isUpdate) {
              if (results.filesUpdated) results.filesUpdated.push(normalizedPath);
            } else {
              if (results.filesCreated) results.filesCreated.push(normalizedPath);
              if (global.existingFiles) global.existingFiles.add(normalizedPath);
            }

            await sendProgress({
              type: 'file-complete',
              fileName: normalizedPath,
              action: isUpdate ? 'updated' : 'created'
            });
          } catch (error) {
            if (results.errors) {
              results.errors.push(`Failed to create ${file.path}: ${(error as Error).message}`);
            }
            await sendProgress({
              type: 'file-error',
              fileName: file.path,
              error: (error as Error).message
            });
          }
        }

        // Patch the Vite entrypoint so the sandbox boots the generated app.
        // - If we generated `src/main.tsx`, update `index.html` to load it.
        // - Otherwise, patch the template `src/main.jsx` to import the generated TS/TSX App.
        if (shouldPatchIndexHtml && desiredEntry) {
          try {
            const existingIndex = await providerInstance.readFile('index.html');
            const patchedIndex = existingIndex.replace(/\/src\/main\.(jsx|js|tsx|ts)/g, desiredEntry);

            if (patchedIndex !== existingIndex) {
              await providerInstance.writeFile('index.html', patchedIndex);

              // Update file cache
              if (global.sandboxState?.fileCache) {
                global.sandboxState.fileCache.files['index.html'] = {
                  content: patchedIndex,
                  lastModified: Date.now()
                };
              }

              // Track for subsequent edits
              if (global.existingFiles) global.existingFiles.add('index.html');

              if (results.filesUpdated) results.filesUpdated.push('index.html');

              await sendProgress({
                type: 'file-complete',
                fileName: 'index.html',
                action: 'updated'
              });
            }
          } catch (e) {
            console.warn('[apply-ai-code-stream] Failed to patch index.html entrypoint:', e);
          }
        } else if (shouldPatchExistingMainJsx && appImportPath) {
          try {
            const existingMain = await providerInstance.readFile('src/main.jsx');
            // IMPORTANT: avoid `\s*` here because it can swallow the trailing newline and concatenate imports.
            const patchedMain = existingMain
              .replace(/import\s+App\s+from\s+['"]\.\/App\.jsx['"][ \t]*;?/g, `import App from '${appImportPath}'`)
              .replace(/import\s+App\s+from\s+['"]\.\/App['"][ \t]*;?/g, `import App from '${appImportPath}'`);

            if (patchedMain !== existingMain) {
              await providerInstance.writeFile('src/main.jsx', patchedMain);

              if (global.sandboxState?.fileCache) {
                global.sandboxState.fileCache.files['src/main.jsx'] = {
                  content: patchedMain,
                  lastModified: Date.now()
                };
              }

              if (global.existingFiles) global.existingFiles.add('src/main.jsx');
              if (results.filesUpdated) results.filesUpdated.push('src/main.jsx');

              await sendProgress({
                type: 'file-complete',
                fileName: 'src/main.jsx',
                action: 'updated'
              });
            }
          } catch (e) {
            console.warn('[apply-ai-code-stream] Failed to patch src/main.jsx entrypoint:', e);
          }
        }

        // Safety net: if the AI references local modules it didn't actually generate, Vite will hard-fail
        // import-analysis and the preview becomes unusable. Detect missing relative imports and create
        // minimal placeholder modules so the sandbox can boot and the user can iteratively refine.
        try {
          const existingFiles = new Set(await providerInstance.listFiles());
          const createdPlaceholders = new Set<string>();

          const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.json'] as const;

          const shouldSkipSource = (src: string) => {
            const lower = src.toLowerCase();
            return (
              lower.endsWith('.css') ||
              lower.endsWith('.scss') ||
              lower.endsWith('.sass') ||
              lower.endsWith('.less') ||
              lower.endsWith('.svg') ||
              lower.endsWith('.png') ||
              lower.endsWith('.jpg') ||
              lower.endsWith('.jpeg') ||
              lower.endsWith('.gif') ||
              lower.endsWith('.webp')
            );
          };

          const extractRelativeImports = (content: string) => {
            const sources = new Set<string>();
            const fromRe = /\b(?:import|export)\s+(?:type\s+)?[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g;
            const sideEffectRe = /\bimport\s+['"]([^'"]+)['"]/g;
            const dynamicRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

            for (const re of [fromRe, sideEffectRe, dynamicRe]) {
              let m: RegExpExecArray | null;
              while ((m = re.exec(content)) !== null) {
                sources.add(m[1]);
              }
            }
            return [...sources].filter(s => s.startsWith('.'));
          };

          const getDefaultImportName = (content: string, source: string) => {
            const re = new RegExp(String.raw`^\s*import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|\s+from)\s+['"]${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'm');
            const match = content.match(re);
            return match?.[1];
          };

          const ensurePlaceholder = async (importerPath: string, source: string, importerContent: string) => {
            if (shouldSkipSource(source)) return;

            const importerDir = path.posix.dirname(importerPath);
            const resolvedBase = path.posix.normalize(path.posix.join(importerDir, source));

            // Avoid writing outside the sandbox root
            if (resolvedBase.startsWith('..')) return;

            const ext = path.posix.extname(resolvedBase);
            const candidates: string[] = [];
            if (ext) {
              candidates.push(resolvedBase);
            } else {
              for (const e of EXTS) {
                candidates.push(resolvedBase + e);
                candidates.push(path.posix.join(resolvedBase, `index${e}`));
              }
            }

            const exists = candidates.some(c =>
              existingFiles.has(c) ||
              writtenFilesContent.has(c) ||
              createdPlaceholders.has(c)
            );

            if (exists) return;

            const defaultImport = getDefaultImportName(importerContent, source);
            const componentLike =
              Boolean(defaultImport && defaultImport[0] === defaultImport[0].toUpperCase()) ||
              resolvedBase.includes('/pages/') ||
              resolvedBase.includes('/components/');

            const importerIsTs = importerPath.endsWith('.ts') || importerPath.endsWith('.tsx');
            const placeholderExt = ext || (componentLike ? (importerIsTs ? '.tsx' : '.jsx') : (importerIsTs ? '.ts' : '.js'));

            const placeholderPath = ext ? resolvedBase : resolvedBase + placeholderExt;

            const componentName = defaultImport || path.posix.basename(placeholderPath, path.posix.extname(placeholderPath)) || 'Placeholder';

            const placeholderContent = componentLike
              ? `export default function ${componentName}() {\n  return (\n    <div className=\"p-6\">\n      <h1 className=\"text-xl font-semibold\">${componentName}</h1>\n      <p className=\"text-sm text-gray-600\">Placeholder generated automatically. Implement this module next.</p>\n    </div>\n  );\n}\n`
              : `// Placeholder generated automatically. Implement this module next.\nexport default {};\n`;

            await providerInstance.writeFile(placeholderPath, placeholderContent);

            createdPlaceholders.add(placeholderPath);
            existingFiles.add(placeholderPath);

            if (global.sandboxState?.fileCache) {
              global.sandboxState.fileCache.files[placeholderPath] = {
                content: placeholderContent,
                lastModified: Date.now()
              };
            }
            if (global.existingFiles) global.existingFiles.add(placeholderPath);
            if (results.filesCreated) results.filesCreated.push(placeholderPath);

            await sendProgress({
              type: 'file-complete',
              fileName: placeholderPath,
              action: 'created'
            });
          };

          for (const [importerPath, importerContent] of writtenFilesContent.entries()) {
            if (!/\.(tsx|ts|jsx|js)$/.test(importerPath)) continue;
            const sources = extractRelativeImports(importerContent);
            for (const src of sources) {
              await ensurePlaceholder(importerPath, src, importerContent);
            }
          }
        } catch (e) {
          console.warn('[apply-ai-code-stream] Failed missing-import placeholder pass:', e);
        }

        // Step 3: Execute commands
        const commandsArray = Array.isArray(parsed.commands) ? parsed.commands : [];
        if (commandsArray.length > 0) {
          await sendProgress({
            type: 'step',
            step: 3,
            message: `Executing ${commandsArray.length} commands...`
          });

          for (const [index, cmd] of commandsArray.entries()) {
            try {
              await sendProgress({
                type: 'command-progress',
                current: index + 1,
                total: parsed.commands.length,
                command: cmd,
                action: 'executing'
              });

              // Use provider runCommand
              const result = await providerInstance.runCommand(cmd);

              // Get command output from provider result
              const stdout = result.stdout;
              const stderr = result.stderr;

              if (stdout) {
                await sendProgress({
                  type: 'command-output',
                  command: cmd,
                  output: stdout,
                  stream: 'stdout'
                });
              }

              if (stderr) {
                await sendProgress({
                  type: 'command-output',
                  command: cmd,
                  output: stderr,
                  stream: 'stderr'
                });
              }

              if (results.commandsExecuted) {
                results.commandsExecuted.push(cmd);
              }

              await sendProgress({
                type: 'command-complete',
                command: cmd,
                exitCode: result.exitCode,
                success: result.exitCode === 0
              });
            } catch (error) {
              if (results.errors) {
                results.errors.push(`Failed to execute ${cmd}: ${(error as Error).message}`);
              }
              await sendProgress({
                type: 'command-error',
                command: cmd,
                error: (error as Error).message
              });
            }
          }
        }

        // Send final results
        await sendProgress({
          type: 'complete',
          results,
          explanation: parsed.explanation,
          structure: parsed.structure,
          message: `Successfully applied ${results.filesCreated.length} files`
        });

        // Track applied files in conversation state
        if (global.conversationState && results.filesCreated.length > 0) {
          const messages = global.conversationState.context.messages;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
              lastMessage.metadata = {
                ...lastMessage.metadata,
                editedFiles: results.filesCreated
              };
            }
          }

          // Track applied code in project evolution
          if (global.conversationState.context.projectEvolution) {
            global.conversationState.context.projectEvolution.majorChanges.push({
              timestamp: Date.now(),
              description: parsed.explanation || 'Code applied',
              filesAffected: results.filesCreated || []
            });
          }

          global.conversationState.lastUpdated = Date.now();
        }

      } catch (error) {
        await sendProgress({
          type: 'error',
          error: (error as Error).message
        });
      } finally {
        await writer.close();
      }
    })(provider, request);

    // Return the stream
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Apply AI code stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse AI code' },
      { status: 500 }
    );
  }
}