import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { BuildBlueprint } from '@/types/build-blueprint';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

type TemplateTarget = 'vite' | 'next';

interface ScaffoldRequest {
  sandboxId: string;
  // Back-compat: older clients used `template`, newer ones use `templateTarget`.
  template?: TemplateTarget;
  templateTarget?: TemplateTarget;
  blueprint: BuildBlueprint;
}

function toPascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function safeRouteIdToComponentName(routeId: string): string {
  const cleaned = routeId.replace(/[^a-zA-Z0-9_]/g, '_');
  const base = toPascalCase(cleaned);
  return base.length > 0 ? base : 'Page';
}

function stripLeadingSlash(p: string): string {
  return p.startsWith('/') ? p.slice(1) : p;
}

function getDir(filePath: string): string {
  return path.posix.dirname(filePath);
}

function makeSeedValue(fieldName: string, idx: number): any {
  const name = fieldName.toLowerCase();
  if (name === 'id') return `${idx + 1}`;
  if (name.includes('email')) return `user${idx + 1}@example.com`;
  if (name.includes('name')) return `Demo ${idx + 1}`;
  if (name.includes('title')) return `Item ${idx + 1}`;
  if (name.includes('created') || name.includes('updated')) return new Date(Date.now() - idx * 86400000).toISOString();
  if (name.includes('count') || name.includes('quantity')) return idx + 1;
  return `Value ${idx + 1}`;
}

function buildMockSeedFile(blueprint: BuildBlueprint, template: TemplateTarget): { filePath: string; content: string } {
  const entities = blueprint.entities && blueprint.entities.length > 0
    ? blueprint.entities
    : [{
      name: 'Item',
      description: 'Fallback demo entity',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'createdAt', type: 'string', required: true },
      ],
      seedCount: 5,
    }];

  const seedObj: Record<string, any[]> = {};
  for (const entity of entities) {
    const count = typeof entity.seedCount === 'number' && entity.seedCount > 0 ? entity.seedCount : 5;
    seedObj[entity.name] = Array.from({ length: count }).map((_, idx) => {
      const record: Record<string, any> = {};
      for (const field of Array.isArray(entity.fields) ? entity.fields : []) {
        const rawName = (field as any)?.name;
        const key = typeof rawName === 'string' ? rawName.trim() : '';
        if (!key) continue;
        record[key] = makeSeedValue(key, idx);
      }

      // Always ensure an id is present for CRUD-ish flows, even if the blueprint was incomplete.
      if (record.id == null) {
        record.id = makeSeedValue('id', idx);
      }
      return record;
    });
  }

  if (template === 'next') {
    return {
      filePath: 'lib/data/seed.ts',
      content: `export const seedData = ${JSON.stringify(seedObj, null, 2)} as const;\n`,
    };
  }

  return {
    filePath: 'src/lib/data/seed.js',
    content: `export const seedData = ${JSON.stringify(seedObj, null, 2)};\n`,
  };
}

function buildMockClientFiles(template: TemplateTarget): Array<{ filePath: string; content: string }> {
  if (template === 'next') {
    return [
      {
        filePath: 'lib/data/mockClient.ts',
        content: `import { seedData } from './seed';\n\nexport type EntityName = keyof typeof seedData;\n\nexport interface DataClient {\n  list<T extends EntityName>(entity: T): Array<(typeof seedData)[T][number]>;\n  create<T extends EntityName>(entity: T, record: Partial<(typeof seedData)[T][number]>): (typeof seedData)[T][number];\n  update<T extends EntityName>(entity: T, id: string, patch: Partial<(typeof seedData)[T][number]>): (typeof seedData)[T][number] | null;\n  remove<T extends EntityName>(entity: T, id: string): boolean;\n}\n\nexport function createMockDataClient(): DataClient {\n  const db: any = JSON.parse(JSON.stringify(seedData));\n\n  return {\n    list(entity) {\n      return Array.isArray(db[entity]) ? db[entity] : [];\n    },\n    create(entity, record) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : (db[entity] = []);\n      const id = String(Date.now());\n      const created = { id, ...record };\n      collection.push(created);\n      return created;\n    },\n    update(entity, id, patch) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex((r: any) => String(r.id) === String(id));\n      if (idx === -1) return null;\n      collection[idx] = { ...collection[idx], ...patch };\n      return collection[idx];\n    },\n    remove(entity, id) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex((r: any) => String(r.id) === String(id));\n      if (idx === -1) return false;\n      collection.splice(idx, 1);\n      return true;\n    },\n  };\n}\n`,
      },
      {
        filePath: 'lib/data/index.ts',
        content: `import { createMockDataClient } from './mockClient';\n\nexport type { DataClient } from './mockClient';\n\nexport function createDataClient() {\n  // Mock-first strategy: always works immediately.\n  // Optional real DB upgrade will swap this client when env vars/credentials are present.\n  return createMockDataClient();\n}\n`,
      },
    ];
  }

  return [
    {
      filePath: 'src/lib/data/mockClient.js',
      content: `import { seedData } from './seed.js';\n\nexport function createMockDataClient() {\n  const db = JSON.parse(JSON.stringify(seedData));\n\n  return {\n    list(entity) {\n      return Array.isArray(db[entity]) ? db[entity] : [];\n    },\n    create(entity, record) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : (db[entity] = []);\n      const id = String(Date.now());\n      const created = { id, ...record };\n      collection.push(created);\n      return created;\n    },\n    update(entity, id, patch) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex(r => String(r.id) === String(id));\n      if (idx === -1) return null;\n      collection[idx] = { ...collection[idx], ...patch };\n      return collection[idx];\n    },\n    remove(entity, id) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex(r => String(r.id) === String(id));\n      if (idx === -1) return false;\n      collection.splice(idx, 1);\n      return true;\n    }\n  };\n}\n`,
    },
    {
      filePath: 'src/lib/data/index.js',
      content: `import { createMockDataClient } from './mockClient.js';\n\nexport function createDataClient() {\n  // Mock-first strategy: always works immediately.\n  // Optional real DB upgrade will swap this client when credentials are provided.\n  return createMockDataClient();\n}\n`,
    },
  ];
}

function buildDataModeBanner(template: TemplateTarget): { filePath: string; content: string } {
  if (template === 'next') {
    return {
      filePath: 'components/DataModeBanner.tsx',
      content: `export function DataModeBanner() {\n  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);\n\n  return (\n    <div className=\"w-full border border-gray-800 bg-gray-900/40 rounded-lg p-4\">\n      <div className=\"text-sm font-medium\">Data mode</div>\n      <div className=\"mt-1 text-sm text-gray-300\">\n        {hasSupabase ? 'Supabase env vars detected. The app will use Supabase when the real data adapter is enabled.' : 'Using seeded demo data (mock-first).'}\n      </div>\n      {!hasSupabase ? (\n        <div className=\"mt-2 text-xs text-gray-400\">\n          To enable Supabase later, add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.\n        </div>\n      ) : null}\n    </div>\n  );\n}\n`,
    };
  }

  return {
    filePath: 'src/components/DataModeBanner.jsx',
    content: `export function DataModeBanner() {\n  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);\n\n  return (\n    <div className=\"w-full border border-gray-200 bg-gray-50 rounded-lg p-4\">\n      <div className=\"text-sm font-medium text-gray-900\">Data mode</div>\n      <div className=\"mt-1 text-sm text-gray-700\">\n        {hasSupabase ? 'Supabase env vars detected. The app will use Supabase when the real data adapter is enabled.' : 'Using seeded demo data (mock-first).'}\n      </div>\n      {!hasSupabase ? (\n        <div className=\"mt-2 text-xs text-gray-600\">\n          To enable Supabase later, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n        </div>\n      ) : null}\n    </div>\n  );\n}\n`,
  };
}

function buildNextNav(blueprint: BuildBlueprint): { filePath: string; content: string } {
  const items = blueprint.navigation?.items || [];
  const navLinks = items.map(i => {
    const route = blueprint.routes.find(r => r.id === i.routeId);
    const href = route?.kind === 'section'
      ? `/${route.path.startsWith('#') ? route.path : `#${route.path}`}`
      : (route?.path || '/');
    return `{ label: ${JSON.stringify(i.label)}, href: ${JSON.stringify(href)} }`;
  }).join(',\n  ');

  return {
    filePath: 'components/NavBar.tsx',
    content: `import Link from 'next/link';\n\nconst navItems = [\n  ${navLinks}\n];\n\nexport function NavBar() {\n  return (\n    <header className=\"w-full border-b border-gray-900 bg-black/40 backdrop-blur\">\n      <div className=\"mx-auto w-full max-w-5xl px-4 py-4 flex items-center justify-between\">\n        <div className=\"text-sm font-semibold\">App</div>\n        <nav className=\"flex items-center gap-4\">\n          {navItems.map(item => (\n            <Link key={item.href} href={item.href} className=\"text-sm text-gray-300 hover:text-white transition-colors\">\n              {item.label}\n            </Link>\n          ))}\n        </nav>\n      </div>\n    </header>\n  );\n}\n`,
  };
}

function buildViteNav(blueprint: BuildBlueprint, useRouter: boolean): { filePath: string; content: string } {
  const items = blueprint.navigation?.items || [];
  const resolved = items.map(i => {
    const route = blueprint.routes.find(r => r.id === i.routeId);
    return {
      label: i.label,
      kind: route?.kind || 'page',
      path: route?.path || '/',
    };
  });

  if (useRouter) {
    const linkItems = resolved.map(i => {
      if (i.kind === 'section') {
        const href = i.path.startsWith('#') ? `/${i.path}` : i.path;
        return `<a key="${href}" href="${href}" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">${i.label}</a>`;
      }
      return `<Link key="${i.path}" to="${i.path}" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">${i.label}</Link>`;
    }).join('\n          ');

    return {
      filePath: 'src/components/NavBar.jsx',
      content: `import { Link } from 'react-router-dom';\n\nexport function NavBar() {\n  return (\n    <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur">\n      <div className="mx-auto w-full max-w-5xl px-4 py-4 flex items-center justify-between">\n        <div className="text-sm font-semibold text-gray-900">App</div>\n        <nav className="flex items-center gap-4">\n          ${linkItems}\n        </nav>\n      </div>\n    </header>\n  );\n}\n`,
    };
  }

  const linkItems = resolved.map(i => {
    const href = i.kind === 'section' ? (i.path.startsWith('#') ? i.path : `#${i.path}`) : (i.path || '#');
    return `<a key="${href}" href="${href}" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">${i.label}</a>`;
  }).join('\n          ');

  return {
    filePath: 'src/components/NavBar.jsx',
    content: `export function NavBar() {\n  return (\n    <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur">\n      <div className="mx-auto w-full max-w-5xl px-4 py-4 flex items-center justify-between">\n        <div className="text-sm font-semibold text-gray-900">App</div>\n        <nav className="flex items-center gap-4">\n          ${linkItems}\n        </nav>\n      </div>\n    </header>\n  );\n}\n`,
  };
}

function buildVitePages(blueprint: BuildBlueprint): Array<{ filePath: string; content: string }> {
  const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
  const sectionRoutes = blueprint.routes.filter(r => r.kind === 'section');

  const pages: Array<{ filePath: string; content: string }> = [];

  // Home page
  const homeSections = sectionRoutes.map(r => {
    const id = r.path.startsWith('#') ? r.path.slice(1) : r.path.replace(/^#/, '');
    return `      <section id="${id}" className="py-16 border-t border-gray-200">\n        <h2 className="text-2xl font-semibold text-gray-900">${r.title}</h2>\n        <p className="mt-2 text-sm text-gray-700">${r.description || 'Section content goes here.'}</p>\n      </section>`;
  }).join('\n\n');

  pages.push({
    filePath: 'src/pages/Home.jsx',
    content: `import { DataModeBanner } from '../components/DataModeBanner.jsx';\n\nexport default function Home() {\n  return (\n    <div className="mx-auto w-full max-w-5xl px-4 py-10">\n      <h1 className="text-3xl font-semibold text-gray-900">Home</h1>\n      <p className="mt-2 text-sm text-gray-700">Scaffolded from blueprint routes and navigation.</p>\n\n      <div className="mt-6">\n        <DataModeBanner />\n      </div>\n\n${homeSections ? `\n${homeSections}\n` : ''}\n    </div>\n  );\n}\n`,
  });

  for (const route of pageRoutes) {
    if (route.path === '/' || route.id === 'home') continue;
    const name = safeRouteIdToComponentName(route.id);
    pages.push({
      filePath: `src/pages/${name}.jsx`,
      content: `import { DataModeBanner } from '../components/DataModeBanner.jsx';\n\nexport default function ${name}() {\n  return (\n    <div className="mx-auto w-full max-w-5xl px-4 py-10">\n      <h1 className="text-3xl font-semibold text-gray-900">${route.title}</h1>\n      <p className="mt-2 text-sm text-gray-700">${route.description || 'Page scaffolded from blueprint.'}</p>\n\n      <div className="mt-6">\n        <DataModeBanner />\n      </div>\n    </div>\n  );\n}\n`,
    });
  }

  return pages;
}

function buildViteApp(blueprint: BuildBlueprint): { filePath: string; content: string; packagesToInstall: string[] } {
  const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
  const useRouter = pageRoutes.length > 1;

  const packagesToInstall = useRouter ? ['react-router-dom'] : [];

  if (!useRouter) {
    return {
      filePath: 'src/App.jsx',
      packagesToInstall,
      content: `import { NavBar } from './components/NavBar.jsx';\nimport Home from './pages/Home.jsx';\n\nexport default function App() {\n  return (\n    <div className=\"min-h-screen bg-white\">\n      <NavBar />\n      <Home />\n    </div>\n  );\n}\n`,
    };
  }

  const routeImports: string[] = [`import Home from './pages/Home.jsx';`];
  const routeElements: string[] = [`<Route path="/" element={<Home />} />`];

  for (const r of pageRoutes) {
    if (r.path === '/' || r.id === 'home') continue;
    const name = safeRouteIdToComponentName(r.id);
    routeImports.push(`import ${name} from './pages/${name}.jsx';`);
    routeElements.push(`<Route path="${r.path}" element={<${name} />} />`);
  }

  return {
    filePath: 'src/App.jsx',
    packagesToInstall,
    content: `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';\nimport { NavBar } from './components/NavBar.jsx';\n${routeImports.join('\n')}\n\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <div className=\"min-h-screen bg-white\">\n        <NavBar />\n        <main>\n          <Routes>\n            ${routeElements.join('\n            ')}\n            <Route path=\"*\" element={<Navigate to=\"/\" replace />} />\n          </Routes>\n        </main>\n      </div>\n    </BrowserRouter>\n  );\n}\n`,
  };
}

function buildNextPages(blueprint: BuildBlueprint): Array<{ filePath: string; content: string }> {
  const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
  const pages: Array<{ filePath: string; content: string }> = [];

  for (const route of pageRoutes) {
    const folder = route.path === '/' ? '' : stripLeadingSlash(route.path);
    const safeFolder = folder
      .split('/')
      .filter(Boolean)
      .map(seg => seg.replace(/[^a-zA-Z0-9_-]/g, ''))
      .filter(Boolean)
      .join('/');

    const filePath = route.path === '/' ? 'app/page.tsx' : `app/${safeFolder}/page.tsx`;
    pages.push({
      filePath,
      content: `import { DataModeBanner } from '@/components/DataModeBanner';\n\nexport default function Page() {\n  return (\n    <main className=\"mx-auto w-full max-w-5xl px-4 py-10\">\n      <h1 className=\"text-3xl font-semibold\">${route.title}</h1>\n      <p className=\"mt-2 text-sm text-gray-300\">${route.description || 'Page scaffolded from blueprint.'}</p>\n      <div className=\"mt-6\">\n        <DataModeBanner />\n      </div>\n    </main>\n  );\n}\n`,
    });
  }

  return pages;
}

function buildNextLayoutOverride(): { filePath: string; content: string } {
  return {
    filePath: 'app/layout.tsx',
    content: `import './globals.css';\nimport { NavBar } from '@/components/NavBar';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body className=\"min-h-screen bg-gray-950 text-white\">\n        <NavBar />\n        {children}\n      </body>\n    </html>\n  );\n}\n`,
  };
}

async function writeFilesToSandbox(opts: {
  provider: any;
  files: Array<{ filePath: string; content: string }>;
}) {
  const { provider, files } = opts;

  const written: string[] = [];

  for (const f of files) {
    const dir = getDir(f.filePath);
    if (dir && dir !== '.' && dir !== '/') {
      await provider.runCommand(`mkdir -p ${dir}`);
    }
    await provider.writeFile(f.filePath, f.content);
    written.push(f.filePath);

    if (global.existingFiles) {
      global.existingFiles.add(f.filePath);
    }

    if (global.sandboxState?.fileCache) {
      global.sandboxState.fileCache.files[f.filePath] = {
        content: f.content,
        lastModified: Date.now(),
      };
    }
  }

  return written;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScaffoldRequest;
    const sandboxId = body.sandboxId;
    const template = body.template ?? body.templateTarget;
    const blueprint = body.blueprint;

    if (!sandboxId) {
      return NextResponse.json({ success: false, error: 'sandboxId is required' }, { status: 400 });
    }
    if (!template || (template !== 'vite' && template !== 'next')) {
      return NextResponse.json({ success: false, error: 'template must be vite or next' }, { status: 400 });
    }
    if (!blueprint || typeof blueprint !== 'object') {
      return NextResponse.json({ success: false, error: 'blueprint is required' }, { status: 400 });
    }

    // Prefer an already-registered provider for this sandboxId. If not present,
    // fall back to the legacy global provider *only if it matches the sandboxId*.
    // Note: `getOrCreateProvider` may return a fresh (unconnected) provider for some
    // providers (e.g., Vercel), so it must be the last resort.
    const legacyProvider = (global as any).activeSandboxProvider;
    const legacyMatches =
      legacyProvider &&
      typeof legacyProvider.getSandboxInfo === 'function' &&
      legacyProvider.getSandboxInfo()?.sandboxId === sandboxId;

    const provider =
      sandboxManager.getProvider(sandboxId) ||
      (legacyMatches ? legacyProvider : null) ||
      (await sandboxManager.getOrCreateProvider(sandboxId));

    if (!provider) {
      return NextResponse.json({ success: false, error: 'No sandbox provider available' }, { status: 400 });
    }
    if (typeof provider.getSandboxInfo === 'function' && !provider.getSandboxInfo()) {
      return NextResponse.json(
        { success: false, error: 'Sandbox is not active. Create a sandbox before scaffolding.' },
        { status: 400 }
      );
    }

    const files: Array<{ filePath: string; content: string }> = [];
    const packagesToInstall: string[] = [];

    // Shared: mock-first data adapter + seed data + data mode banner
    files.push(buildMockSeedFile(blueprint, template));
    files.push(...buildMockClientFiles(template));
    files.push(buildDataModeBanner(template));

    if (template === 'next') {
      files.push(buildNextNav(blueprint));
      files.push(buildNextLayoutOverride());
      files.push(...buildNextPages(blueprint));
    } else {
      const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
      const useRouter = pageRoutes.length > 1;
      files.push(buildViteNav(blueprint, useRouter));
      files.push(...buildVitePages(blueprint));
      const appFile = buildViteApp(blueprint);
      files.push({ filePath: appFile.filePath, content: appFile.content });
      packagesToInstall.push(...appFile.packagesToInstall);
    }

    // Install required packages (e.g., router for multi-page Vite builds)
    const uniquePackages = [...new Set(packagesToInstall)];
    let packagesInstalled: string[] = [];
    if (uniquePackages.length > 0 && typeof provider.installPackages === 'function') {
      const result = await provider.installPackages(uniquePackages);
      if (result?.success) {
        packagesInstalled = uniquePackages;
      }
    }

    const filesWritten = await writeFilesToSandbox({ provider, files });

    // Persist templateTarget on the server-side sandbox state for later steps.
    if (global.sandboxState?.fileCache) {
      global.sandboxState.fileCache.templateTarget = template;
    }
    if (global.sandboxState?.sandboxData) {
      (global.sandboxState.sandboxData as any).templateTarget = template;
    }

    return NextResponse.json({
      success: true,
      template,
      sandboxId,
      filesWritten,
      packagesInstalled,
    });
  } catch (error: any) {
    console.error('[scaffold-project] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to scaffold project' },
      { status: 500 }
    );
  }
}


