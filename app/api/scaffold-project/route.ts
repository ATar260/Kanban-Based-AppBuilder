import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { BuildBlueprint } from '@/types/build-blueprint';
import type { UIStyle } from '@/types/ui-style';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

type TemplateTarget = 'vite' | 'next';
type ThemePreset = 'modern_light' | 'modern_dark' | 'fintech_dark' | 'playful_light' | 'editorial_light';
type ThemeAccent = 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';

type UiTheme = {
  preset: ThemePreset;
  accent: ThemeAccent;
  isDark: boolean;
  // Common tokens
  appBg: string;
  text: string;
  mutedText: string;
  border: string;
  cardBg: string;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  headerLink: string;
  bannerBg: string;
  bannerBorder: string;
  bannerText: string;
  bannerMuted: string;
  codeBg: string;
  codeBorder: string;
  codeText: string;
  accentSolid: string; // button bg + hover + focus ring
  accentText: string;
  accentRing: string; // focus ring color (e.g., focus-visible:ring-indigo-500)
};

interface ScaffoldRequest {
  sandboxId: string;
  // Back-compat: older clients used `template`, newer ones use `templateTarget`.
  template?: TemplateTarget;
  templateTarget?: TemplateTarget;
  blueprint: BuildBlueprint;
  uiStyle?: UIStyle;
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

function normalizeHex(input: unknown): string | null {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return null;

  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const expanded = hex
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const h = norm.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const toLinear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(rgb.r);
  const G = toLinear(rgb.g);
  const B = toLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function isHexLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.6;
}

function resolveTheme(blueprint: BuildBlueprint, template: TemplateTarget, uiStyle?: UIStyle): UiTheme {
  const allowedPresets: ThemePreset[] = ['modern_light', 'modern_dark', 'fintech_dark', 'playful_light', 'editorial_light'];
  const allowedAccents: ThemeAccent[] = ['indigo', 'blue', 'emerald', 'rose', 'amber', 'cyan', 'violet'];

  const rawTheme: any = (blueprint as any)?.theme;
  const preset: ThemePreset =
    rawTheme && typeof rawTheme === 'object' && allowedPresets.includes(rawTheme.preset)
      ? rawTheme.preset
      : (template === 'next' ? 'modern_dark' : 'modern_light');

  const accent: ThemeAccent =
    rawTheme && typeof rawTheme === 'object' && allowedAccents.includes(rawTheme.accent)
      ? rawTheme.accent
      : 'indigo';

  const isDark = preset.endsWith('_dark');

  const accentSolidMap: Record<ThemeAccent, string> = {
    indigo: 'bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-indigo-500',
    blue: 'bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-500',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500',
    rose: 'bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500',
    amber: 'bg-amber-600 hover:bg-amber-500 focus-visible:ring-amber-500',
    cyan: 'bg-cyan-600 hover:bg-cyan-500 focus-visible:ring-cyan-500',
    violet: 'bg-violet-600 hover:bg-violet-500 focus-visible:ring-violet-500',
  };

  const accentTextMapDark: Record<ThemeAccent, string> = {
    indigo: 'text-indigo-300',
    blue: 'text-blue-300',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    cyan: 'text-cyan-300',
    violet: 'text-violet-300',
  };

  const accentTextMapLight: Record<ThemeAccent, string> = {
    indigo: 'text-indigo-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    cyan: 'text-cyan-700',
    violet: 'text-violet-700',
  };

  const accentRingMap: Record<ThemeAccent, string> = {
    indigo: 'focus-visible:ring-indigo-500',
    blue: 'focus-visible:ring-blue-500',
    emerald: 'focus-visible:ring-emerald-500',
    rose: 'focus-visible:ring-rose-500',
    amber: 'focus-visible:ring-amber-500',
    cyan: 'focus-visible:ring-cyan-500',
    violet: 'focus-visible:ring-violet-500',
  };

  const cs = uiStyle?.colorScheme;
  const customPrimary = normalizeHex(cs?.primary ?? cs?.accent);
  const customAccent = normalizeHex(cs?.accent ?? cs?.primary);
  const customBackground = normalizeHex(cs?.background);
  const customText = normalizeHex(cs?.text);

  const baseAppBg = isDark
    ? 'bg-gradient-to-b from-gray-950 via-gray-950 to-black'
    : 'bg-gradient-to-b from-gray-50 to-white';
  const baseText = isDark ? 'text-gray-100' : 'text-gray-900';

  const accentSolid = customPrimary
    ? [
        `bg-[${customPrimary}]`,
        'hover:opacity-90',
        `focus-visible:ring-[${customPrimary}]`,
        isHexLight(customPrimary) ? 'text-gray-900' : 'text-white',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-offset-0',
        'transition-opacity',
      ].join(' ')
    : `${accentSolidMap[accent]} text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0`;

  const accentText = customAccent
    ? `text-[${customAccent}]`
    : (isDark ? accentTextMapDark[accent] : accentTextMapLight[accent]);

  const accentRing = customPrimary ? `focus-visible:ring-[${customPrimary}]` : accentRingMap[accent];

  return {
    preset,
    accent,
    isDark,
    appBg: customBackground ? `bg-[${customBackground}]` : baseAppBg,
    text: customText ? `text-[${customText}]` : baseText,
    mutedText: isDark ? 'text-gray-400' : 'text-gray-600',
    border: isDark ? 'border-gray-800' : 'border-gray-200',
    cardBg: isDark ? 'bg-gray-900/40' : 'bg-white',
    headerBg: isDark ? 'bg-black/40' : 'bg-white/80',
    headerBorder: isDark ? 'border-gray-900' : 'border-gray-200',
    headerText: isDark ? 'text-white' : 'text-gray-900',
    headerLink: isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900',
    bannerBg: isDark ? 'bg-gray-900/40' : 'bg-gray-50',
    bannerBorder: isDark ? 'border-gray-800' : 'border-gray-200',
    bannerText: isDark ? 'text-gray-200' : 'text-gray-700',
    bannerMuted: isDark ? 'text-gray-400' : 'text-gray-600',
    codeBg: isDark ? 'bg-black/40' : 'bg-white',
    codeBorder: isDark ? 'border-gray-800' : 'border-gray-200',
    codeText: isDark ? 'text-gray-200' : 'text-gray-700',
    accentSolid,
    accentText,
    accentRing,
  };
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

function buildSupabaseSchemaFile(blueprint: BuildBlueprint, template: TemplateTarget): { filePath: string; content: string } {
  const entities = blueprint.entities && blueprint.entities.length > 0
    ? blueprint.entities
    : [{
      name: 'Item',
      description: 'Fallback demo entity',
      fields: [
        { name: 'id', type: 'uuid', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'createdAt', type: 'timestamptz', required: true },
      ],
      seedCount: 5,
    }];

  const toSnake = (s: string) =>
    String(s || 'items')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'items';

  const mapType = (t: string) => {
    const tt = String(t || '').toLowerCase();
    if (tt.includes('uuid')) return 'uuid';
    if (tt.includes('int')) return 'integer';
    if (tt.includes('number') || tt.includes('float') || tt.includes('double') || tt.includes('numeric')) return 'numeric';
    if (tt.includes('bool')) return 'boolean';
    if (tt.includes('time') || tt.includes('date')) return 'timestamptz';
    return 'text';
  };

  const blocks = entities.map((e) => {
    const table = toSnake(e.name);
    const fields = Array.isArray(e.fields) ? e.fields : [];

    const cols: string[] = [];
    const hasId = fields.some((f: any) => String(f?.name || '').toLowerCase() === 'id');
    if (hasId) {
      cols.push('  id uuid primary key default gen_random_uuid()');
    } else {
      cols.push('  id uuid primary key default gen_random_uuid()');
    }

    for (const f of fields) {
      const rawName = String((f as any)?.name || '').trim();
      if (!rawName) continue;
      if (rawName.toLowerCase() === 'id') continue;
      const col = toSnake(rawName);
      const typ = mapType(String((f as any)?.type || 'text'));
      const required = Boolean((f as any)?.required);
      cols.push(`  ${col} ${typ}${required ? ' not null' : ''}`);
    }

    // Always include timestamps
    cols.push('  created_at timestamptz not null default now()');
    cols.push('  updated_at timestamptz not null default now()');

    return `-- ${e.name}\ncreate table if not exists public.${table} (\n${cols.join(',\n')}\n);\n`;
  });

  const content = `-- Supabase schema for the scaffolded app\n-- Run in Supabase SQL editor.\n\n${blocks.join('\n')}\n`;

  return {
    filePath: template === 'next' ? 'supabase/schema.sql' : 'supabase/schema.sql',
    content,
  };
}

function buildMockClientFiles(template: TemplateTarget): Array<{ filePath: string; content: string }> {
  if (template === 'next') {
    return [
      {
        filePath: 'lib/data/mockClient.ts',
        content: `import { seedData } from './seed';\n\nexport type EntityName = keyof typeof seedData;\n\ntype RowFor<T extends EntityName> = (typeof seedData)[T][number];\n\nexport interface DataClient {\n  list<T extends EntityName>(entity: T): Promise<Array<RowFor<T>>>;\n  create<T extends EntityName>(entity: T, record: Partial<RowFor<T>>): Promise<RowFor<T>>;\n  update<T extends EntityName>(entity: T, id: string, patch: Partial<RowFor<T>>): Promise<RowFor<T> | null>;\n  remove<T extends EntityName>(entity: T, id: string): Promise<boolean>;\n}\n\nexport function createMockDataClient(): DataClient {\n  const db: any = JSON.parse(JSON.stringify(seedData));\n\n  return {\n    async list(entity) {\n      return Array.isArray(db[entity]) ? db[entity] : [];\n    },\n    async create(entity, record) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : (db[entity] = []);\n      const id = String(Date.now());\n      const created = { id, ...record };\n      collection.push(created);\n      return created;\n    },\n    async update(entity, id, patch) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex((r: any) => String(r.id) === String(id));\n      if (idx === -1) return null;\n      collection[idx] = { ...collection[idx], ...patch };\n      return collection[idx];\n    },\n    async remove(entity, id) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex((r: any) => String(r.id) === String(id));\n      if (idx === -1) return false;\n      collection.splice(idx, 1);\n      return true;\n    },\n  };\n}\n`,
      },
      {
        filePath: 'lib/data/supabaseAdapter.ts',
        content: `import { createClient } from '@supabase/supabase-js';\nimport type { DataClient, EntityName } from './mockClient';\n\nfunction toSnake(s: string) {\n  return String(s || '')\n    .trim()\n    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')\n    .replace(/[^a-zA-Z0-9]+/g, '_')\n    .replace(/^_+|_+$/g, '')\n    .toLowerCase();\n}\n\nexport function createSupabaseDataClient(): DataClient {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;\n  if (!url || !anonKey) {\n    throw new Error('Supabase env vars missing');\n  }\n\n  const supabase = createClient(url, anonKey);\n\n  return {\n    async list(entity) {\n      const table = toSnake(String(entity));\n      const { data, error } = await supabase.from(table).select('*').limit(200);\n      if (error) throw error;\n      return (data as any[]) || [];\n    },\n    async create(entity, record) {\n      const table = toSnake(String(entity));\n      const { data, error } = await supabase.from(table).insert(record as any).select('*').single();\n      if (error) throw error;\n      return data as any;\n    },\n    async update(entity, id, patch) {\n      const table = toSnake(String(entity));\n      const { data, error } = await supabase.from(table).update(patch as any).eq('id', id).select('*').maybeSingle();\n      if (error) throw error;\n      return (data as any) || null;\n    },\n    async remove(entity, id) {\n      const table = toSnake(String(entity));\n      const { error } = await supabase.from(table).delete().eq('id', id);\n      if (error) throw error;\n      return true;\n    },\n  };\n}\n`,
      },
      {
        filePath: 'lib/data/index.ts',
        content: `import { createMockDataClient } from './mockClient';\nimport { createSupabaseDataClient } from './supabaseAdapter';\n\nexport type { DataClient, EntityName } from './mockClient';\n\nexport function createDataClient() {\n  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);\n  const mock = createMockDataClient();\n\n  if (!hasSupabase) return mock;\n\n  try {\n    const supa = createSupabaseDataClient();\n    // Wrap so a broken/missing schema doesn't crash the app in real_optional mode.\n    return {\n      async list(entity) {\n        try {\n          return await supa.list(entity);\n        } catch (e) {\n          console.warn('[data] Supabase list failed; falling back to mock', e);\n          return await mock.list(entity);\n        }\n      },\n      async create(entity, record) {\n        try {\n          return await supa.create(entity, record);\n        } catch (e) {\n          console.warn('[data] Supabase create failed; falling back to mock', e);\n          return await mock.create(entity, record);\n        }\n      },\n      async update(entity, id, patch) {\n        try {\n          return await supa.update(entity, id, patch);\n        } catch (e) {\n          console.warn('[data] Supabase update failed; falling back to mock', e);\n          return await mock.update(entity, id, patch);\n        }\n      },\n      async remove(entity, id) {\n        try {\n          return await supa.remove(entity, id);\n        } catch (e) {\n          console.warn('[data] Supabase remove failed; falling back to mock', e);\n          return await mock.remove(entity, id);\n        }\n      },\n    };\n  } catch (e) {\n    console.warn('[data] Supabase client failed; falling back to mock', e);\n    return mock;\n  }\n}\n`,
      },
    ];
  }

  return [
    {
      filePath: 'src/lib/data/mockClient.js',
      content: `import { seedData } from './seed.js';\n\nexport function createMockDataClient() {\n  const db = JSON.parse(JSON.stringify(seedData));\n\n  return {\n    async list(entity) {\n      return Array.isArray(db[entity]) ? db[entity] : [];\n    },\n    async create(entity, record) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : (db[entity] = []);\n      const id = String(Date.now());\n      const created = { id, ...record };\n      collection.push(created);\n      return created;\n    },\n    async update(entity, id, patch) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex(r => String(r.id) === String(id));\n      if (idx === -1) return null;\n      collection[idx] = { ...collection[idx], ...patch };\n      return collection[idx];\n    },\n    async remove(entity, id) {\n      const collection = Array.isArray(db[entity]) ? db[entity] : [];\n      const idx = collection.findIndex(r => String(r.id) === String(id));\n      if (idx === -1) return false;\n      collection.splice(idx, 1);\n      return true;\n    }\n  };\n}\n`,
    },
    {
      filePath: 'src/lib/data/supabaseAdapter.js',
      content: `import { createClient } from '@supabase/supabase-js';\n\nfunction toSnake(s) {\n  return String(s || '')\n    .trim()\n    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')\n    .replace(/[^a-zA-Z0-9]+/g, '_')\n    .replace(/^_+|_+$/g, '')\n    .toLowerCase();\n}\n\nexport function createSupabaseDataClient() {\n  const url = import.meta.env.VITE_SUPABASE_URL;\n  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;\n  if (!url || !anonKey) {\n    throw new Error('Supabase env vars missing');\n  }\n\n  const supabase = createClient(url, anonKey);\n\n  return {\n    async list(entity) {\n      const table = toSnake(entity);\n      const { data, error } = await supabase.from(table).select('*').limit(200);\n      if (error) throw error;\n      return data || [];\n    },\n    async create(entity, record) {\n      const table = toSnake(entity);\n      const { data, error } = await supabase.from(table).insert(record).select('*').single();\n      if (error) throw error;\n      return data;\n    },\n    async update(entity, id, patch) {\n      const table = toSnake(entity);\n      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('*').maybeSingle();\n      if (error) throw error;\n      return data || null;\n    },\n    async remove(entity, id) {\n      const table = toSnake(entity);\n      const { error } = await supabase.from(table).delete().eq('id', id);\n      if (error) throw error;\n      return true;\n    }\n  };\n}\n`,
    },
    {
      filePath: 'src/lib/data/index.js',
      content: `import { createMockDataClient } from './mockClient.js';\nimport { createSupabaseDataClient } from './supabaseAdapter.js';\n\nexport function createDataClient() {\n  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);\n  const mock = createMockDataClient();\n\n  if (!hasSupabase) return mock;\n\n  try {\n    const supa = createSupabaseDataClient();\n    // Wrap so missing tables / RLS / schema issues don't hard-crash the UI in real_optional mode.\n    return {\n      async list(entity) {\n        try {\n          return await supa.list(entity);\n        } catch (e) {\n          console.warn('[data] Supabase list failed; falling back to mock', e);\n          return await mock.list(entity);\n        }\n      },\n      async create(entity, record) {\n        try {\n          return await supa.create(entity, record);\n        } catch (e) {\n          console.warn('[data] Supabase create failed; falling back to mock', e);\n          return await mock.create(entity, record);\n        }\n      },\n      async update(entity, id, patch) {\n        try {\n          return await supa.update(entity, id, patch);\n        } catch (e) {\n          console.warn('[data] Supabase update failed; falling back to mock', e);\n          return await mock.update(entity, id, patch);\n        }\n      },\n      async remove(entity, id) {\n        try {\n          return await supa.remove(entity, id);\n        } catch (e) {\n          console.warn('[data] Supabase remove failed; falling back to mock', e);\n          return await mock.remove(entity, id);\n        }\n      },\n    };\n  } catch (e) {\n    console.warn('[data] Supabase client failed; falling back to mock', e);\n    return mock;\n  }\n}\n`,
    },
  ];
}

function buildDataModeBanner(template: TemplateTarget, ui: UiTheme): { filePath: string; content: string } {
  if (template === 'next') {
    return {
      filePath: 'components/DataModeBanner.tsx',
      content: `export function DataModeBanner() {\n  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);\n\n  return (\n    <div className=\"w-full border rounded-lg p-4 ${ui.bannerBorder} ${ui.bannerBg}\">\n      <div className=\"text-sm font-medium ${ui.isDark ? 'text-white' : 'text-gray-900'}\">Data mode</div>\n      <div className=\"mt-1 text-sm ${ui.bannerText}\">\n        {hasSupabase ? 'Supabase env vars detected — real database mode enabled.' : 'Using seeded demo data (mock-first).'}\n      </div>\n      {!hasSupabase ? (\n        <div className=\"mt-2 text-xs ${ui.bannerMuted}\">\n          To enable Supabase, add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.\n        </div>\n      ) : (\n        <div className=\"mt-2 text-xs ${ui.bannerMuted}\">\n          If you haven’t created tables yet, see <code className=\"px-1 py-0.5 border rounded ${ui.codeBg} ${ui.codeBorder} ${ui.codeText}\">supabase/schema.sql</code>.\n        </div>\n      )}\n    </div>\n  );\n}\n`,
    };
  }

  return {
    filePath: 'src/components/DataModeBanner.jsx',
    content: `export function DataModeBanner() {\n  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);\n\n  return (\n    <div className=\"w-full border rounded-lg p-4 ${ui.bannerBorder} ${ui.bannerBg}\">\n      <div className=\"text-sm font-medium ${ui.isDark ? 'text-white' : 'text-gray-900'}\">Data mode</div>\n      <div className=\"mt-1 text-sm ${ui.bannerText}\">\n        {hasSupabase ? 'Supabase env vars detected — real database mode enabled.' : 'Using seeded demo data (mock-first).'}\n      </div>\n      {!hasSupabase ? (\n        <div className=\"mt-2 text-xs ${ui.bannerMuted}\">\n          To enable Supabase, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n        </div>\n      ) : (\n        <div className=\"mt-2 text-xs ${ui.bannerMuted}\">\n          If you haven’t created tables yet, see <code className=\"px-1 py-0.5 border rounded ${ui.codeBg} ${ui.codeBorder} ${ui.codeText}\">supabase/schema.sql</code>.\n        </div>\n      )}\n    </div>\n  );\n}\n`,
  };
}

function buildBackdropComponent(template: TemplateTarget, ui: UiTheme, uiStyle?: UIStyle): { filePath: string; content: string } {
  const cs = uiStyle?.colorScheme;
  const primary = normalizeHex(cs?.primary ?? cs?.accent);
  const secondary = normalizeHex(cs?.secondary);
  const accent = normalizeHex(cs?.accent ?? cs?.primary);

  const fallbackGradients: Record<ThemeAccent, { g1: string; g2: string }> = {
    indigo: {
      g1: 'from-indigo-500 via-violet-500 to-cyan-400',
      g2: 'from-indigo-600 via-blue-500 to-emerald-400',
    },
    blue: {
      g1: 'from-blue-500 via-cyan-400 to-indigo-500',
      g2: 'from-sky-500 via-blue-500 to-violet-500',
    },
    emerald: {
      g1: 'from-emerald-500 via-cyan-400 to-blue-500',
      g2: 'from-emerald-600 via-teal-500 to-blue-500',
    },
    rose: {
      g1: 'from-rose-500 via-fuchsia-500 to-indigo-500',
      g2: 'from-rose-600 via-amber-400 to-violet-500',
    },
    amber: {
      g1: 'from-amber-400 via-rose-500 to-violet-500',
      g2: 'from-amber-500 via-orange-500 to-rose-500',
    },
    cyan: {
      g1: 'from-cyan-400 via-blue-500 to-violet-500',
      g2: 'from-cyan-500 via-emerald-400 to-blue-500',
    },
    violet: {
      g1: 'from-violet-500 via-fuchsia-500 to-cyan-400',
      g2: 'from-violet-600 via-indigo-500 to-cyan-400',
    },
  };

  const g1 = primary && secondary
    ? `from-[${primary}] via-[${secondary}] to-transparent`
    : (primary && accent ? `from-[${primary}] via-[${accent}] to-transparent` : fallbackGradients[ui.accent].g1);

  const g2 = accent && primary
    ? `from-[${accent}] via-[${primary}] to-transparent`
    : fallbackGradients[ui.accent].g2;

  const blob1Opacity = ui.isDark ? 'opacity-30' : 'opacity-20';
  const blob2Opacity = ui.isDark ? 'opacity-25' : 'opacity-15';
  const overlay = ui.isDark ? 'bg-gradient-to-b from-black/0 via-black/0 to-black/35' : 'bg-gradient-to-b from-white/0 via-white/0 to-white/60';

  if (template === 'next') {
    return {
      filePath: 'components/Backdrop.tsx',
      content: `export function Backdrop() {\n  return (\n    <div aria-hidden className=\"pointer-events-none absolute inset-0 overflow-hidden\">\n      <div className=\"absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full blur-3xl ${blob1Opacity} bg-gradient-to-tr ${g1}\" />\n      <div className=\"absolute -bottom-40 -right-32 h-[36rem] w-[36rem] rounded-full blur-3xl ${blob2Opacity} bg-gradient-to-tr ${g2}\" />\n      <div className=\"absolute inset-0 ${overlay}\" />\n    </div>\n  );\n}\n`,
    };
  }

  return {
    filePath: 'src/components/Backdrop.jsx',
    content: `export function Backdrop() {\n  return (\n    <div aria-hidden className=\"pointer-events-none absolute inset-0 overflow-hidden\">\n      <div className=\"absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full blur-3xl ${blob1Opacity} bg-gradient-to-tr ${g1}\" />\n      <div className=\"absolute -bottom-40 -right-32 h-[36rem] w-[36rem] rounded-full blur-3xl ${blob2Opacity} bg-gradient-to-tr ${g2}\" />\n      <div className=\"absolute inset-0 ${overlay}\" />\n    </div>\n  );\n}\n`,
  };
}

function buildUiKitFiles(template: TemplateTarget, ui: UiTheme): Array<{ filePath: string; content: string }> {
  if (template === 'next') {
    const headingTextClass = ui.isDark ? 'text-white' : 'text-gray-900';
    const bodyTextClass = ui.isDark ? 'text-gray-200' : 'text-gray-700';
    const cardDividerClass = ui.isDark ? 'border-white/10' : 'border-black/10';
    const inputBgClass = ui.isDark ? 'bg-black/30' : 'bg-white/70';
    const placeholderClass = ui.isDark ? 'placeholder:text-gray-400' : 'placeholder:text-gray-500';

    return [
      {
        filePath: 'lib/cn.ts',
        content: `export function cn(...classes: Array<string | false | null | undefined>) {\n  return classes.filter(Boolean).join(' ');\n}\n`,
      },
      {
        filePath: 'components/ui/Button.tsx',
        content:
          `import type * as React from 'react';\n` +
          `import { cn } from '@/lib/cn';\n\n` +
          `export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';\n` +
          `export type ButtonSize = 'sm' | 'md' | 'lg';\n\n` +
          `export function buttonClasses(opts?: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {\n` +
          `  const variant = opts?.variant || 'primary';\n` +
          `  const size = opts?.size || 'md';\n` +
          `  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50';\n` +
          `  const sizes: Record<ButtonSize, string> = {\n` +
          `    sm: 'h-9 px-3 text-sm',\n` +
          `    md: 'h-10 px-4 text-sm',\n` +
          `    lg: 'h-11 px-5 text-base',\n` +
          `  };\n` +
          `  const variants: Record<ButtonVariant, string> = {\n` +
          `    primary: ${JSON.stringify(`${ui.accentSolid} shadow-sm hover:shadow-md`)},\n` +
          `    secondary: ${JSON.stringify(
            `border ${ui.border} ${ui.cardBg} ${headingTextClass} ${ui.isDark ? 'hover:bg-gray-950/40' : 'hover:bg-white/90'} shadow-sm hover:shadow-md`
          )},\n` +
          `    outline: ${JSON.stringify(
            `border ${ui.border} bg-transparent ${headingTextClass} ${ui.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`
          )},\n` +
          `    ghost: ${JSON.stringify(
            `${headingTextClass} ${ui.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`
          )},\n` +
          `    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-500 shadow-sm hover:shadow-md',\n` +
          `  };\n` +
          `  return cn(base, sizes[size], variants[variant], opts?.className);\n` +
          `}\n\n` +
          `export function Button({\n` +
          `  variant = 'primary',\n` +
          `  size = 'md',\n` +
          `  className,\n` +
          `  ...props\n` +
          `}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {\n` +
          `  return <button className={buttonClasses({ variant, size, className })} {...props} />;\n` +
          `}\n`,
      },
      {
        filePath: 'components/ui/Card.tsx',
        content:
          `import type * as React from 'react';\n` +
          `import { cn } from '@/lib/cn';\n\n` +
          `export function Card({ title, subtitle, children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {\n` +
          `  return (\n` +
          `    <section className={cn('rounded-2xl border ${ui.border} ${ui.cardBg} shadow-sm hover:shadow-md transition-shadow', className)}>\n` +
          `      {title ? (\n` +
          `        <header className={cn('px-4 py-3 border-b ${cardDividerClass}')}>\n` +
          `          <div className={cn('text-sm font-semibold ${headingTextClass}')}>{title}</div>\n` +
          `          {subtitle ? <div className={cn('mt-1 text-xs ${ui.mutedText}')}>{subtitle}</div> : null}\n` +
          `        </header>\n` +
          `      ) : null}\n` +
          `      <div className=\"p-4\">{children}</div>\n` +
          `    </section>\n` +
          `  );\n` +
          `}\n`,
      },
      {
        filePath: 'components/ui/Input.tsx',
        content:
          `import type * as React from 'react';\n` +
          `import { cn } from '@/lib/cn';\n\n` +
          `export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {\n` +
          `  return (\n` +
          `    <input\n` +
          `      className={cn(\n` +
          `        'w-full rounded-lg border ${ui.border} ${inputBgClass} px-3 py-2 text-sm ${headingTextClass} ${placeholderClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ${ui.accentRing} disabled:cursor-not-allowed disabled:opacity-50',\n` +
          `        className\n` +
          `      )}\n` +
          `      {...props}\n` +
          `    />\n` +
          `  );\n` +
          `}\n`,
      },
      {
        filePath: 'components/ui/Badge.tsx',
        content:
          `import type * as React from 'react';\n` +
          `import { cn } from '@/lib/cn';\n\n` +
          `export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {\n` +
          `  return (\n` +
          `    <span\n` +
          `      className={cn(\n` +
          `        'inline-flex items-center rounded-full border ${ui.border} ${ui.isDark ? 'bg-white/5' : 'bg-black/5'} px-2.5 py-1 text-xs font-medium ${ui.accentText}',\n` +
          `        className\n` +
          `      )}\n` +
          `      {...props}\n` +
          `    />\n` +
          `  );\n` +
          `}\n`,
      },
    ];
  }

  const headingTextClass = ui.isDark ? 'text-white' : 'text-gray-900';
  const cardDividerClass = ui.isDark ? 'border-white/10' : 'border-black/10';
  const inputBgClass = ui.isDark ? 'bg-black/30' : 'bg-white/70';
  const placeholderClass = ui.isDark ? 'placeholder:text-gray-400' : 'placeholder:text-gray-500';

  return [
    {
      filePath: 'src/lib/cn.js',
      content: `export function cn(...classes) {\n  return classes.flat().filter(Boolean).join(' ');\n}\n`,
    },
    {
      filePath: 'src/components/ui/Button.jsx',
      content:
        `import { cn } from '../../lib/cn.js';\n\n` +
        `export function buttonClasses(opts = {}) {\n` +
        `  const { variant = 'primary', size = 'md', className } = opts;\n` +
        `  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50';\n` +
        `  const sizes = {\n` +
        `    sm: 'h-9 px-3 text-sm',\n` +
        `    md: 'h-10 px-4 text-sm',\n` +
        `    lg: 'h-11 px-5 text-base',\n` +
        `  };\n` +
        `  const variants = {\n` +
        `    primary: ${JSON.stringify(`${ui.accentSolid} shadow-sm hover:shadow-md`)},\n` +
        `    secondary: ${JSON.stringify(
          `border ${ui.border} ${ui.cardBg} ${headingTextClass} ${ui.isDark ? 'hover:bg-gray-950/40' : 'hover:bg-white/90'} shadow-sm hover:shadow-md`
        )},\n` +
        `    outline: ${JSON.stringify(
          `border ${ui.border} bg-transparent ${headingTextClass} ${ui.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`
        )},\n` +
        `    ghost: ${JSON.stringify(
          `${headingTextClass} ${ui.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`
        )},\n` +
        `    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-500 shadow-sm hover:shadow-md',\n` +
        `  };\n` +
        `  return cn(base, sizes[size] || sizes.md, variants[variant] || variants.primary, className);\n` +
        `}\n\n` +
        `export function Button({ variant = 'primary', size = 'md', className, ...props }) {\n` +
        `  return <button className={buttonClasses({ variant, size, className })} {...props} />;\n` +
        `}\n`,
    },
    {
      filePath: 'src/components/ui/Card.jsx',
      content:
        `import { cn } from '../../lib/cn.js';\n\n` +
        `export function Card({ title, subtitle, children, className }) {\n` +
        `  return (\n` +
        `    <section className={cn('rounded-2xl border ${ui.border} ${ui.cardBg} shadow-sm hover:shadow-md transition-shadow', className)}>\n` +
        `      {title ? (\n` +
        `        <header className={cn('px-4 py-3 border-b ${cardDividerClass}')}>\n` +
        `          <div className={cn('text-sm font-semibold ${headingTextClass}')}>{title}</div>\n` +
        `          {subtitle ? <div className={cn('mt-1 text-xs ${ui.mutedText}')}>{subtitle}</div> : null}\n` +
        `        </header>\n` +
        `      ) : null}\n` +
        `      <div className=\"p-4\">{children}</div>\n` +
        `    </section>\n` +
        `  );\n` +
        `}\n`,
    },
    {
      filePath: 'src/components/ui/Input.jsx',
      content:
        `import { cn } from '../../lib/cn.js';\n\n` +
        `export function Input({ className, ...props }) {\n` +
        `  return (\n` +
        `    <input\n` +
        `      className={cn(\n` +
        `        'w-full rounded-lg border ${ui.border} ${inputBgClass} px-3 py-2 text-sm ${headingTextClass} ${placeholderClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ${ui.accentRing} disabled:cursor-not-allowed disabled:opacity-50',\n` +
        `        className\n` +
        `      )}\n` +
        `      {...props}\n` +
        `    />\n` +
        `  );\n` +
        `}\n`,
    },
    {
      filePath: 'src/components/ui/Badge.jsx',
      content:
        `import { cn } from '../../lib/cn.js';\n\n` +
        `export function Badge({ className, ...props }) {\n` +
        `  return (\n` +
        `    <span\n` +
        `      className={cn(\n` +
        `        'inline-flex items-center rounded-full border ${ui.border} ${ui.isDark ? 'bg-white/5' : 'bg-black/5'} px-2.5 py-1 text-xs font-medium ${ui.accentText}',\n` +
        `        className\n` +
        `      )}\n` +
        `      {...props}\n` +
        `    />\n` +
        `  );\n` +
        `}\n`,
    },
  ];
}

function buildNextNav(blueprint: BuildBlueprint, ui: UiTheme): { filePath: string; content: string } {
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
    content: `import Link from 'next/link';\n\nconst navItems = [\n  ${navLinks}\n];\n\nexport function NavBar() {\n  return (\n    <header className=\"w-full border-b backdrop-blur ${ui.headerBorder} ${ui.headerBg}\">\n      <div className=\"mx-auto w-full max-w-5xl px-4 py-4 flex items-center justify-between\">\n        <div className={\"text-sm font-semibold flex items-center gap-2 \" + (${JSON.stringify(ui.headerText)} as const)}>\n          <span>App</span>\n          <span className={\"text-xs \" + (${JSON.stringify(ui.accentText)} as const)}>●</span>\n        </div>\n        <nav className=\"flex items-center gap-4\">\n          {navItems.map(item => (\n            <Link key={item.href} href={item.href} className={\"text-sm transition-colors \" + (${JSON.stringify(ui.headerLink)} as const)}>\n              {item.label}\n            </Link>\n          ))}\n        </nav>\n      </div>\n    </header>\n  );\n}\n`,
  };
}

function buildViteNav(blueprint: BuildBlueprint, useRouter: boolean, ui: UiTheme): { filePath: string; content: string } {
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
        return `<a key="${href}" href="${href}" className="text-sm ${ui.headerLink} transition-colors">${i.label}</a>`;
      }
      return `<Link key="${i.path}" to="${i.path}" className="text-sm ${ui.headerLink} transition-colors">${i.label}</Link>`;
    }).join('\n          ');

    return {
      filePath: 'src/components/NavBar.jsx',
      content: `import { Link } from 'react-router-dom';\n\nexport function NavBar() {\n  return (\n    <header className="w-full border-b backdrop-blur ${ui.headerBorder} ${ui.headerBg}">\n      <div className="mx-auto w-full max-w-5xl px-4 py-4 flex items-center justify-between">\n        <div className={"text-sm font-semibold flex items-center gap-2 " + ${JSON.stringify(ui.headerText)}}>\n          <span>App</span>\n          <span className={"text-xs " + ${JSON.stringify(ui.accentText)}}>●</span>\n        </div>\n        <nav className="flex items-center gap-4">\n          ${linkItems}\n        </nav>\n      </div>\n    </header>\n  );\n}\n`,
    };
  }

  const linkItems = resolved.map(i => {
    const href = i.kind === 'section' ? (i.path.startsWith('#') ? i.path : `#${i.path}`) : (i.path || '#');
    return `<a key="${href}" href="${href}" className="text-sm ${ui.headerLink} transition-colors">${i.label}</a>`;
  }).join('\n          ');

  return {
    filePath: 'src/components/NavBar.jsx',
    content: `export function NavBar() {\n  return (\n    <header className="w-full border-b backdrop-blur ${ui.headerBorder} ${ui.headerBg}">\n      <div className="mx-auto w-full max-w-5xl px-4 py-4 flex items-center justify-between">\n        <div className={"text-sm font-semibold flex items-center gap-2 " + ${JSON.stringify(ui.headerText)}}>\n          <span>App</span>\n          <span className={"text-xs " + ${JSON.stringify(ui.accentText)}}>●</span>\n        </div>\n        <nav className="flex items-center gap-4">\n          ${linkItems}\n        </nav>\n      </div>\n    </header>\n  );\n}\n`,
  };
}

function buildVitePages(blueprint: BuildBlueprint, ui: UiTheme): Array<{ filePath: string; content: string }> {
  const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
  const sectionRoutes = blueprint.routes.filter(r => r.kind === 'section');
  const useRouter = pageRoutes.length > 1;

  const pages: Array<{ filePath: string; content: string }> = [];

  // Home page
  const sectionTitleClass = ui.isDark ? 'text-white' : 'text-gray-900';
  const sectionTextClass = ui.isDark ? 'text-gray-300' : 'text-gray-700';
  const homeSections = sectionRoutes.map(r => {
    const id = r.path.startsWith('#') ? r.path.slice(1) : r.path.replace(/^#/, '');
    return `      <section id="${id}" className="py-16 border-t ${ui.border}">\n        <h2 className="text-2xl font-semibold ${sectionTitleClass}">${r.title}</h2>\n        <p className="mt-2 text-sm ${sectionTextClass}">${r.description || 'Section content goes here.'}</p>\n      </section>`;
  }).join('\n\n');

  /*
  pages.push({
    filePath: 'src/pages/Home.jsx',
    content: `import { useEffect, useMemo, useState } from 'react';\nimport { DataModeBanner } from '../components/DataModeBanner.jsx';\nimport { seedData } from '../lib/data/seed.js';\nimport { createDataClient } from '../lib/data/index.js';\n\nfunction Card({ title, children }) {\n  return (\n    <div className=\"rounded-xl border border-gray-200 bg-white shadow-sm\">\n      {title ? (\n        <div className=\"px-4 py-3 border-b border-gray-100\">\n          <div className=\"text-sm font-semibold text-gray-900\">{title}</div>\n        </div>\n      ) : null}\n      <div className=\"p-4\">{children}</div>\n    </div>\n  );\n}\n\nexport default function Home() {\n  const entityNames = Object.keys(seedData || {});\n  const primaryEntity = entityNames[0] || null;\n\n  const client = useMemo(() => createDataClient(), []);\n  const [rows, setRows] = useState([]);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    let cancelled = false;\n    async function load() {\n      if (!primaryEntity) {\n        setLoading(false);\n        return;\n      }\n      try {\n        const data = await client.list(primaryEntity);\n        if (!cancelled) setRows(Array.isArray(data) ? data.slice(0, 8) : []);\n      } catch (e) {\n        console.warn('[home] Failed to load rows (using seed fallback):', e);\n        if (!cancelled) setRows(Array.isArray(seedData?.[primaryEntity]) ? seedData[primaryEntity].slice(0, 8) : []);\n      } finally {\n        if (!cancelled) setLoading(false);\n      }\n    }\n    load();\n    return () => {\n      cancelled = true;\n    };\n  }, [client, primaryEntity]);\n\n  return (\n    <div className=\"min-h-screen bg-gradient-to-b from-gray-50 to-white\">\n      <div className=\"mx-auto w-full max-w-6xl px-4 py-10\">\n        <div className=\"flex flex-col gap-2\">\n          <h1 className=\"text-3xl font-semibold text-gray-900\">Home</h1>\n          <p className=\"text-sm text-gray-600\">Scaffolded from blueprint routes and navigation — this is the starting point before the build fills in real features.</p>\n        </div>\n\n        <div className=\"mt-6\">\n          <DataModeBanner />\n        </div>\n\n        <div className=\"mt-8 grid grid-cols-1 md:grid-cols-3 gap-4\">\n          <Card title=\"Blueprint\">\n            <div className=\"text-sm text-gray-700\">Routes: <span className=\"font-medium text-gray-900\">${pageRoutes.length}</span></div>\n            <div className=\"mt-1 text-sm text-gray-700\">Entities: <span className=\"font-medium text-gray-900\">{entityNames.length || 0}</span></div>\n            <div className=\"mt-3 text-xs text-gray-500\">Tip: run the build to replace scaffolding with app-specific UI & logic.</div>\n          </Card>\n          <Card title=\"Quick actions\">\n            <div className=\"flex flex-wrap gap-2\">\n              <a href=\"/settings\" className=\"inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50\">Open Settings</a>\n              <a href=\"/help\" className=\"inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50\">Open Help</a>\n            </div>\n          </Card>\n          <Card title=\"Data preview\">\n            <div className=\"text-sm text-gray-700\">Entity: <span className=\"font-medium text-gray-900\">{primaryEntity || '—'}</span></div>\n            <div className=\"mt-1 text-xs text-gray-500\">Shows mock seed data by default, and Supabase data when configured.</div>\n          </Card>\n        </div>\n\n        <div className=\"mt-8\">\n          <Card title={primaryEntity ? `Sample ${primaryEntity} records` : 'Sample records'}>\n            {!primaryEntity ? (\n              <div className=\"text-sm text-gray-600\">No entities found in the blueprint seed.</div>\n            ) : loading ? (\n              <div className=\"text-sm text-gray-600\">Loading…</div>\n            ) : rows.length === 0 ? (\n              <div className=\"text-sm text-gray-600\">No rows returned yet.</div>\n            ) : (\n              <div className=\"overflow-x-auto\">\n                <table className=\"min-w-full text-sm\">\n                  <thead>\n                    <tr className=\"text-left text-gray-500\">\n                      {Object.keys(rows[0] || {}).slice(0, 4).map((k) => (\n                        <th key={k} className=\"py-2 pr-4 font-medium\">{k}</th>\n                      ))}\n                    </tr>\n                  </thead>\n                  <tbody className=\"divide-y divide-gray-100\">\n                    {rows.map((r, idx) => (\n                      <tr key={String(r?.id || idx)} className=\"text-gray-700\">\n                        {Object.keys(rows[0] || {}).slice(0, 4).map((k) => (\n                          <td key={k} className=\"py-2 pr-4\">{String(r?.[k] ?? '')}</td>\n                        ))}\n                      </tr>\n                    ))}\n                  </tbody>\n                </table>\n              </div>\n            )}\n            <div className=\"mt-4 text-xs text-gray-500\">\n              If you enabled Supabase, create tables by running <code className=\"px-1 py-0.5 bg-gray-50 border border-gray-200 rounded\">supabase/schema.sql</code> in Supabase.\n            </div>\n          </Card>\n        </div>\n\n${homeSections ? `\n${homeSections}\n` : ''}\n      </div>\n    </div>\n  );\n}\n`,
  });
  */

  const headingClass = ui.isDark ? 'text-white' : 'text-gray-900';
  const bodyTextClass = ui.isDark ? 'text-gray-300' : 'text-gray-700';
  const tableHeadClass = ui.isDark ? 'text-gray-400' : 'text-gray-500';
  const rowTextClass = ui.isDark ? 'text-gray-200' : 'text-gray-700';
  const rowDividerClass = ui.isDark ? 'divide-gray-800' : 'divide-gray-100';

  const settingsAction = useRouter
    ? `<Link to="/settings" className={buttonClasses({ variant: 'primary' })}>Open Settings</Link>`
    : `<a href="/settings" className={buttonClasses({ variant: 'primary' })}>Open Settings</a>`;
  const helpAction = useRouter
    ? `<Link to="/help" className={buttonClasses({ variant: 'secondary' })}>Open Help</Link>`
    : `<a href="/help" className={buttonClasses({ variant: 'secondary' })}>Open Help</a>`;

  const homePageContent =
    `import { useEffect, useMemo, useState } from 'react';\n` +
    (useRouter ? `import { Link } from 'react-router-dom';\n` : '') +
    `import { DataModeBanner } from '../components/DataModeBanner.jsx';\n` +
    `import { Card } from '../components/ui/Card.jsx';\n` +
    `import { buttonClasses } from '../components/ui/Button.jsx';\n` +
    `import { seedData } from '../lib/data/seed.js';\n` +
    `import { createDataClient } from '../lib/data/index.js';\n\n` +
    `export default function Home() {\n` +
    `  const entityNames = Object.keys(seedData || {});\n` +
    `  const primaryEntity = entityNames[0] || null;\n\n` +
    `  const client = useMemo(() => createDataClient(), []);\n` +
    `  const [rows, setRows] = useState([]);\n` +
    `  const [loading, setLoading] = useState(true);\n\n` +
    `  useEffect(() => {\n` +
    `    let cancelled = false;\n` +
    `    async function load() {\n` +
    `      if (!primaryEntity) {\n` +
    `        setLoading(false);\n` +
    `        return;\n` +
    `      }\n` +
    `      try {\n` +
    `        const data = await client.list(primaryEntity);\n` +
    `        if (!cancelled) setRows(Array.isArray(data) ? data.slice(0, 8) : []);\n` +
    `      } catch (e) {\n` +
    `        console.warn('[home] Failed to load rows (using seed fallback):', e);\n` +
    `        if (!cancelled) setRows(Array.isArray(seedData?.[primaryEntity]) ? seedData[primaryEntity].slice(0, 8) : []);\n` +
    `      } finally {\n` +
    `        if (!cancelled) setLoading(false);\n` +
    `      }\n` +
    `    }\n` +
    `    load();\n` +
    `    return () => {\n` +
    `      cancelled = true;\n` +
    `    };\n` +
    `  }, [client, primaryEntity]);\n\n` +
    `  return (\n` +
    `    <div className="min-h-screen ${ui.appBg} ${ui.text}">\n` +
    `      <div className="mx-auto w-full max-w-6xl px-4 py-10">\n` +
    `        <div className="flex flex-col gap-2">\n` +
    `          <h1 className="text-3xl font-semibold ${headingClass}">Home</h1>\n` +
    `          <p className="text-sm ${ui.mutedText}">Your app shell is ready. Use the navigation to explore pages, and connect Supabase anytime to switch from demo data to a real database.</p>\n` +
    `        </div>\n\n` +
    `        <div className="mt-6">\n` +
    `          <DataModeBanner />\n` +
    `        </div>\n\n` +
    `        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">\n` +
    `          <Card title="Blueprint">\n` +
    `            <div className="text-sm ${bodyTextClass}">Routes: <span className={"font-medium " + ${JSON.stringify(headingClass)}}>${pageRoutes.length}</span></div>\n` +
    `            <div className="mt-1 text-sm ${bodyTextClass}">Entities: <span className={"font-medium " + ${JSON.stringify(headingClass)}}>{entityNames.length || 0}</span></div>\n` +
    `            <div className={"mt-3 text-xs " + ${JSON.stringify(ui.mutedText)}}>Tip: build tickets incrementally to add features, refine UI, and connect real data.</div>\n` +
    `          </Card>\n` +
    `          <Card title="Quick actions">\n` +
    `            <div className="flex flex-wrap gap-2">\n` +
    `              ${settingsAction}\n` +
    `              ${helpAction}\n` +
    `            </div>\n` +
    `          </Card>\n` +
    `          <Card title="Data preview">\n` +
    `            <div className="text-sm ${bodyTextClass}">Entity: <span className={"font-medium " + ${JSON.stringify(headingClass)}}>{primaryEntity || '—'}</span></div>\n` +
    `            <div className={"mt-1 text-xs " + ${JSON.stringify(ui.mutedText)}}>Shows mock seed data by default, and Supabase data when configured.</div>\n` +
    `          </Card>\n` +
    `        </div>\n\n` +
    `        <div className="mt-8">\n` +
    `          <Card title={primaryEntity ? ('Sample ' + primaryEntity + ' records') : 'Sample records'}>\n` +
    `            {!primaryEntity ? (\n` +
    `              <div className={"text-sm " + ${JSON.stringify(ui.mutedText)}}>No entities found in the blueprint seed.</div>\n` +
    `            ) : loading ? (\n` +
    `              <div className={"text-sm " + ${JSON.stringify(ui.mutedText)}}>Loading...</div>\n` +
    `            ) : rows.length === 0 ? (\n` +
    `              <div className={"text-sm " + ${JSON.stringify(ui.mutedText)}}>No rows returned yet.</div>\n` +
    `            ) : (\n` +
    `              <div className="overflow-x-auto">\n` +
    `                <table className="min-w-full text-sm">\n` +
    `                  <thead>\n` +
    `                    <tr className={"text-left " + ${JSON.stringify(tableHeadClass)}}>\n` +
    `                      {Object.keys(rows[0] || {}).slice(0, 4).map((k) => (\n` +
    `                        <th key={k} className="py-2 pr-4 font-medium">{k}</th>\n` +
    `                      ))}\n` +
    `                    </tr>\n` +
    `                  </thead>\n` +
    `                  <tbody className={"divide-y " + ${JSON.stringify(rowDividerClass)}}>\n` +
    `                    {rows.map((r, idx) => (\n` +
    `                      <tr key={String(r?.id || idx)} className=${JSON.stringify(rowTextClass)}>\n` +
    `                        {Object.keys(rows[0] || {}).slice(0, 4).map((k) => (\n` +
    `                          <td key={k} className="py-2 pr-4">{String(r?.[k] ?? '')}</td>\n` +
    `                        ))}\n` +
    `                      </tr>\n` +
    `                    ))}\n` +
    `                  </tbody>\n` +
    `                </table>\n` +
    `              </div>\n` +
    `            )}\n` +
    `            <div className={"mt-4 text-xs " + ${JSON.stringify(ui.mutedText)}}>\n` +
    `              If you enabled Supabase, create tables by running <code className="px-1 py-0.5 border rounded ${ui.codeBg} ${ui.codeBorder} ${ui.codeText}">supabase/schema.sql</code> in Supabase.\n` +
    `            </div>\n` +
    `          </Card>\n` +
    `        </div>\n\n` +
    (homeSections ? `\n${homeSections}\n` : '') +
    `      </div>\n` +
    `    </div>\n` +
    `  );\n` +
    `}\n`;

  pages.push({
    filePath: 'src/pages/Home.jsx',
    content: homePageContent,
  });

  for (const route of pageRoutes) {
    if (route.path === '/' || route.id === 'home') continue;
    const name = safeRouteIdToComponentName(route.id);
    const otherRoute = pageRoutes.find(r => r.path !== route.path) || pageRoutes[0] || { path: '/', title: 'Home' };
    const otherHref = otherRoute?.path || '/';
    const otherLabel = otherRoute?.title || otherHref;

    const goHomeAction = useRouter
      ? `<Link to="/" className={buttonClasses({ variant: 'secondary' })}>Go to Home</Link>`
      : `<a href="/" className={buttonClasses({ variant: 'secondary' })}>Go to Home</a>`;
    const openOtherAction = useRouter
      ? `<Link to="${otherHref}" className={buttonClasses({ variant: 'primary' })}>Open ${otherLabel}</Link>`
      : `<a href="${otherHref}" className={buttonClasses({ variant: 'primary' })}>Open ${otherLabel}</a>`;

    pages.push({
      filePath: `src/pages/${name}.jsx`,
      content:
        `${useRouter ? `import { Link } from 'react-router-dom';\n` : ''}` +
        `import { DataModeBanner } from '../components/DataModeBanner.jsx';\n` +
        `import { Card } from '../components/ui/Card.jsx';\n` +
        `import { buttonClasses } from '../components/ui/Button.jsx';\n\n` +
        `export default function ${name}() {\n` +
        `  return (\n` +
        `    <div className="mx-auto w-full max-w-6xl px-4 py-10">\n` +
        `      <div className="flex flex-col gap-2">\n` +
        `        <h1 className="text-3xl font-semibold ${headingClass}">${route.title}</h1>\n` +
        `        <p className="text-sm ${ui.mutedText}">${route.description || 'This page is ready to be filled with app-specific UI and logic.'}</p>\n` +
        `      </div>\n\n` +
        `      <div className="mt-6">\n` +
        `        <DataModeBanner />\n` +
        `      </div>\n\n` +
        `      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">\n` +
        `        <Card title="Overview">\n` +
        `          <div className="text-sm ${bodyTextClass}">Start by defining the key actions and data for this page.</div>\n` +
        `          <div className="mt-2 text-xs ${ui.mutedText}">Keep UI consistent with the selected theme and palette.</div>\n` +
        `        </Card>\n` +
        `        <Card title="Quick actions">\n` +
        `          <div className="flex flex-wrap gap-2">\n` +
        `            ${goHomeAction}\n` +
        `            ${openOtherAction}\n` +
        `          </div>\n` +
        `        </Card>\n` +
        `        <Card title="Notes">\n` +
        `          <div className="text-sm ${ui.mutedText}">This starter layout will be refined as tickets are implemented.</div>\n` +
        `        </Card>\n` +
        `      </div>\n` +
        `    </div>\n` +
        `  );\n` +
        `}\n`,
    });
  }

  return pages;
}

function buildViteApp(blueprint: BuildBlueprint, ui: UiTheme): { filePath: string; content: string; packagesToInstall: string[] } {
  const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
  const useRouter = pageRoutes.length > 1;

  const packagesToInstall = [
    ...(useRouter ? ['react-router-dom'] : []),
    // Used by the optional Supabase adapter; harmless if env vars are not set.
    '@supabase/supabase-js',
  ];

  if (!useRouter) {
    return {
      filePath: 'src/App.jsx',
      packagesToInstall,
      content: `import { NavBar } from './components/NavBar.jsx';\nimport { Backdrop } from './components/Backdrop.jsx';\nimport Home from './pages/Home.jsx';\n\nexport default function App() {\n  return (\n    <div className=\"min-h-screen ${ui.appBg} ${ui.text} relative\">\n      <Backdrop />\n      <div className=\"relative\">\n        <NavBar />\n        <Home />\n      </div>\n    </div>\n  );\n}\n`,
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
    content: `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';\nimport { NavBar } from './components/NavBar.jsx';\nimport { Backdrop } from './components/Backdrop.jsx';\n${routeImports.join('\n')}\n\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <div className=\"min-h-screen ${ui.appBg} ${ui.text} relative\">\n        <Backdrop />\n        <div className=\"relative\">\n          <NavBar />\n          <main>\n            <Routes>\n              ${routeElements.join('\n              ')}\n              <Route path=\"*\" element={<Navigate to=\"/\" replace />} />\n            </Routes>\n          </main>\n        </div>\n      </div>\n    </BrowserRouter>\n  );\n}\n`,
  };
}

function buildNextPages(blueprint: BuildBlueprint, ui: UiTheme): Array<{ filePath: string; content: string }> {
  const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
  const pages: Array<{ filePath: string; content: string }> = [];
  const headingClass = ui.isDark ? 'text-white' : 'text-gray-900';
  const bodyTextClass = ui.isDark ? 'text-gray-300' : 'text-gray-700';

  for (const route of pageRoutes) {
    const otherRoute = pageRoutes.find(r => r.path !== route.path) || pageRoutes[0] || { path: '/', title: 'Home' };
    const otherHref = otherRoute?.path || '/';
    const otherLabel = otherRoute?.title || otherHref;

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
      content:
        `import Link from 'next/link';\n` +
        `import { DataModeBanner } from '@/components/DataModeBanner';\n` +
        `import { Card } from '@/components/ui/Card';\n` +
        `import { buttonClasses } from '@/components/ui/Button';\n\n` +
        `export default function Page() {\n` +
        `  return (\n` +
        `    <main className=\"mx-auto w-full max-w-6xl px-4 py-10\">\n` +
        `      <div className=\"flex flex-col gap-2\">\n` +
        `        <h1 className=\"text-3xl font-semibold ${headingClass}\">${route.title}</h1>\n` +
        `        <p className=\"text-sm ${ui.mutedText}\">${route.description || 'This page is ready to be filled with app-specific UI and logic.'}</p>\n` +
        `      </div>\n\n` +
        `      <div className=\"mt-6\">\n` +
        `        <DataModeBanner />\n` +
        `      </div>\n\n` +
        `      <div className=\"mt-8 grid grid-cols-1 md:grid-cols-3 gap-4\">\n` +
        `        <Card title=\"Overview\">\n` +
        `          <div className=\"text-sm ${bodyTextClass}\">Start by defining the key actions and data for this page.</div>\n` +
        `          <div className=\"mt-2 text-xs ${ui.mutedText}\">Keep UI consistent with the selected theme and palette.</div>\n` +
        `        </Card>\n` +
        `        <Card title=\"Quick actions\">\n` +
        `          <div className=\"flex flex-wrap gap-2\">\n` +
        `            <Link href=\"/\" className={buttonClasses({ variant: 'secondary' })}>Go to Home</Link>\n` +
        `            <Link href=${JSON.stringify(otherHref)} className={buttonClasses({ variant: 'primary' })}>Open ${otherLabel}</Link>\n` +
        `          </div>\n` +
        `        </Card>\n` +
        `        <Card title=\"Notes\">\n` +
        `          <div className=\"text-sm ${ui.mutedText}\">This starter layout will be refined as tickets are implemented.</div>\n` +
        `        </Card>\n` +
        `      </div>\n` +
        `    </main>\n` +
        `  );\n` +
        `}\n`,
    });
  }

  return pages;
}

function buildNextLayoutOverride(ui: UiTheme): { filePath: string; content: string } {
  return {
    filePath: 'app/layout.tsx',
    content: `import './globals.css';\nimport { NavBar } from '@/components/NavBar';\nimport { Backdrop } from '@/components/Backdrop';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body className=\"min-h-screen ${ui.appBg} ${ui.text} relative\">\n        <Backdrop />\n        <div className=\"relative\">\n          <NavBar />\n          {children}\n        </div>\n      </body>\n    </html>\n  );\n}\n`,
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
    const ui = resolveTheme(blueprint, template, body.uiStyle);

    // Shared: mock-first data adapter + seed data + data mode banner
    files.push(buildMockSeedFile(blueprint, template));
    files.push(...buildMockClientFiles(template));
    files.push(buildDataModeBanner(template, ui));
    files.push(buildBackdropComponent(template, ui, body.uiStyle));
    files.push(...buildUiKitFiles(template, ui));
    files.push(buildSupabaseSchemaFile(blueprint, template));

    if (template === 'next') {
      files.push(buildNextNav(blueprint, ui));
      files.push(buildNextLayoutOverride(ui));
      files.push(...buildNextPages(blueprint, ui));

      // Next template also uses the Supabase adapter file; ensure dependency exists.
      packagesToInstall.push('@supabase/supabase-js');
    } else {
      const pageRoutes = blueprint.routes.filter(r => r.kind === 'page');
      const useRouter = pageRoutes.length > 1;
      files.push(buildViteNav(blueprint, useRouter, ui));
      files.push(...buildVitePages(blueprint, ui));
      const appFile = buildViteApp(blueprint, ui);
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


