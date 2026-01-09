import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { validateAIProvider } from '@/lib/api-validation';
import { appConfig } from '@/config/app.config';
import type { BuildBlueprint, BlueprintRoute, DataMode, RouteKind, TemplateTarget, ThemeAccent, ThemePreset } from '@/types/build-blueprint';
import { aiGenerationLimiter } from '@/lib/rateLimit';
import { getUsageActor } from '@/lib/usage/identity';
import { consumeAiGenerationForActor } from '@/lib/usage/persistence';
import { PROMPT_INJECTION_GUARDRAILS } from '@/lib/prompt-security';

export const dynamic = 'force-dynamic';

const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : process.env.OPENAI_BASE_URL,
});

interface InputRequest {
  id: string;
  type: 'api_key' | 'credential' | 'env_var' | 'url' | 'text';
  label: string;
  placeholder: string;
  description?: string;
  required: boolean;
  sensitive?: boolean;
}

interface DatabaseConfig {
  provider: 'supabase' | 'firebase' | 'mongodb' | 'postgres' | 'mysql' | 'sqlite';
  tables?: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable?: boolean; primary?: boolean }>;
  }>;
  autoSetup?: boolean;
}

interface PlanTicket {
  title: string;
  description: string;
  type: 'component' | 'feature' | 'layout' | 'styling' | 'integration' | 'config' | 'database';
  priority: 'critical' | 'high' | 'medium' | 'low';
  complexity: 'XS' | 'S' | 'M' | 'L' | 'XL';
  estimatedFiles: number;
  dependencies: string[];
  requiresInput?: boolean;
  inputRequests?: InputRequest[];
  databaseConfig?: DatabaseConfig;
  blueprintRefs?: {
    routeIds?: string[];
    flowIds?: string[];
    entityNames?: string[];
  };
}

interface PlanningResponse {
  blueprint?: Partial<BuildBlueprint>;
  tickets?: PlanTicket[];
  totalEstimatedTime?: string;
  summary?: string;
}

const SUPABASE_INPUT_REQUESTS: InputRequest[] = [
  {
    id: 'supabase_url',
    type: 'url',
    label: 'Supabase URL',
    placeholder: 'https://xxxxxxxxxxxx.supabase.co',
    description: 'Your Supabase project URL (Project Settings → API).',
    required: true,
    sensitive: false,
  },
  {
    id: 'supabase_anon_key',
    type: 'api_key',
    label: 'Supabase Anon Key',
    placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
    description: 'Your Supabase public anon key (Project Settings → API).',
    required: true,
    sensitive: true,
  },
];

function ensureSupabaseInputs(ticket: PlanTicket): PlanTicket {
  const text = `${ticket.title}\n${ticket.description ?? ''}`.toLowerCase();
  const needsSupabase =
    text.includes('supabase') ||
    ticket.databaseConfig?.provider === 'supabase';

  if (!needsSupabase) return ticket;

  const existing = ticket.inputRequests ?? [];
  const existingIds = new Set(existing.map(r => r.id));
  const merged = [...existing];
  for (const req of SUPABASE_INPUT_REQUESTS) {
    if (!existingIds.has(req.id)) merged.push(req);
  }

  return {
    ...ticket,
    requiresInput: true,
    inputRequests: merged,
  };
}

const PLANNING_PROMPT = `${PROMPT_INJECTION_GUARDRAILS}

You are a build planner for a React application generator. Analyze the user's request and break it down into discrete, buildable feature tickets.

RULES:
1. Create FINE-GRAINED tickets (12-15 tickets for a typical landing page)
2. Each ticket should be a single, focused feature/component
3. Order tickets by build sequence (dependencies first)
4. Layout/structure tickets come before content tickets
5. Styling/theme tickets come after components exist
6. Integration tickets (data, API) come last
7. DATABASE tickets should be created EARLY in the build when data persistence is needed
8. Always produce a BUILD BLUEPRINT (routes/navigation/flows/entities) so the build can be validated for breadth and completeness

For each ticket provide (inside "tickets"):
- title: Short, descriptive name (e.g., "Hero Title & Subtitle")
- description: What it includes (1-2 sentences)
- type: One of [component, feature, layout, styling, integration, config, database]
- priority: One of [critical, high, medium, low]
- complexity: One of [XS, S, M, L, XL] based on code complexity
- estimatedFiles: Number of files (1-5)
- dependencies: Array of ticket titles this depends on (empty if none)
- requiresInput: Boolean - TRUE if this ticket needs API keys, credentials, or external service configuration from the user
- inputRequests: Array of input requests if requiresInput is true. Each request has:
  - id: unique identifier (e.g., "stripe_api_key", "supabase_url")
  - type: One of [api_key, credential, env_var, url, text]
  - label: Human-readable label (e.g., "Stripe API Key")
  - placeholder: Example value (e.g., "sk_test_...")
  - description: Optional explanation of what this is for
  - required: Boolean
  - sensitive: Boolean - true for secrets/keys
- databaseConfig: (Only for type=database) Object with:
  - provider: One of [supabase, firebase, mongodb, postgres, mysql, sqlite]
  - tables: Array of table definitions with name and columns
  - autoSetup: Boolean - true to auto-generate schema and CRUD operations
  - connectionString: optional connection string (only if user provided one)

BUILD BLUEPRINT (required in "blueprint"):
- templateTarget: One of ["vite","next"]
  - Choose "vite" for simple marketing sites / clones / single-page apps
  - Choose "next" for multi-page apps, auth, dashboards, server APIs, database-backed apps
- dataMode: One of ["mock","real_optional","real_required"]
  - Default to "real_optional" unless the user explicitly requires a real DB before anything can work
- theme (required): Object describing the visual design system/vibe for the generated app:
  - preset: One of ["modern_light","modern_dark","fintech_dark","playful_light","editorial_light"]
  - accent: One of ["indigo","blue","emerald","rose","amber","cyan","violet"]
  - vibe: 2-5 words describing the style (e.g., "sleek, premium, minimal")
  THEME RULES:
  - Pick a theme that matches the user's request/vibe (not the same for every app)
  - Dashboards/admin apps often work best with modern_dark or fintech_dark
  - Blogs/content apps often work best with editorial_light
  - Playful/consumer apps can use playful_light
  - Keep the theme consistent across scaffolding + all tickets unless the user asks to change it
- routes: Array of routes the user should be able to navigate to, each with:
  - id: stable identifier (snake_case)
  - kind: "page" or "section"
  - path: "/dashboard" for pages, "#features" for sections
  - title: human title
  - navLabel: label for navigation
  - description: optional
- navigation: Object with:
  - items: array of { label, routeId } that covers ALL routes users should reach from nav
- NAVIGATION QUALITY RULES (critical):
  - Every nav item MUST resolve to a real route in blueprint.routes. Do NOT invent extra nav items that aren't routable.
  - NEVER use placeholders like "#" (or route.path exactly "#"). If you want a section, use a real section id like "#features".
  - For dashboards/admin apps, prefer kind="page" routes (not sections) so clicks are end-to-end navigations.
  - If you include nav labels like Reports/Users/Settings/Help, you MUST include page routes for them (e.g. "/reports", "/users", "/settings", "/help").
- entities (optional): Array of data entities with fields
- flows (optional): Array of user flows, each with steps that describe what \"working\" means

IMPORTANT - DETECT INTEGRATIONS REQUIRING USER INPUT:
- Payment processing (Stripe, PayPal) → needs API keys
- Authentication (Auth0, Clerk, Supabase Auth) → needs credentials/URLs
- Database connections (Supabase, Firebase, MongoDB) → needs connection strings
- Email services (SendGrid, Mailgun, Resend) → needs API keys
- Analytics (Google Analytics, Mixpanel) → needs tracking IDs
- Storage (AWS S3, Cloudinary) → needs credentials
- AI/ML services (OpenAI, Anthropic) → needs API keys
- Maps (Google Maps, Mapbox) → needs API keys
- Any third-party API integration → needs API keys or credentials

DATABASE AUTO-HOOKUP:
When the app needs data persistence (user accounts, products, posts, etc.):
1. Create a "database" type ticket EARLY in the plan
2. Detect the best provider based on context:
   - E-commerce/complex → Supabase or Firebase
   - Simple blog/portfolio → SQLite
   - Real-time features → Firebase
   - Auth needed → Supabase
3. Include databaseConfig with:
   - provider: The detected database provider
   - tables: Array of tables with columns based on data requirements
   - autoSetup: true (to auto-generate schema, types, and CRUD helpers)
4. Add inputRequests for connection credentials
5. All data-dependent tickets should list the database ticket as a dependency

MOCK-FIRST STRATEGY (default):
If the user needs persistence or CRUD, default to dataMode="real_optional" and:
1. Include a \"Data layer (mock-first)\" ticket early that sets up adapters + seeded demo data
2. Include a separate optional \"Enable Supabase (optional)\" ticket that requires input (do NOT block the build)
3. Ensure tickets that depend on data depend on the mock-first data layer ticket, not the optional real DB ticket

DASHBOARD DEFAULT ROUTES (when the prompt indicates \"dashboard\"/\"admin\" and the user did not specify pages):
- Include at least these PAGE routes in the blueprint so nav is end-to-end:\n  - / (Dashboard)\n  - /reports\n  - /users\n  - /settings\n  - /help\n- Ensure navigation.items covers them all.

COMPLEXITY GUIDE:
- XS: Single simple element (button, icon)
- S: Simple component (card, badge)
- M: Medium component with logic (form, modal)
- L: Complex component (data table, chart)
- XL: Full feature with multiple parts (auth flow)

Return ONLY a valid JSON object with this structure:
{
  "blueprint": { ... },
  "tickets": [...],
  "totalEstimatedTime": "~X-Y minutes",
  "summary": "Brief build overview"
}`;

function inferTemplateTarget(prompt: string): TemplateTarget {
  const text = prompt.toLowerCase();
  const nextSignals = [
    'next.js',
    'nextjs',
    'server',
    'server action',
    'server-side',
    'api route',
    'api routes',
    'backend',
    'database',
    'postgres',
    'prisma',
    'auth',
    'login',
    'signup',
    'dashboard',
    'admin',
    'multi-tenant',
    'billing',
    'stripe',
  ];
  if (nextSignals.some(s => text.includes(s))) return 'next';
  return 'vite';
}

function inferThemePreset(prompt: string): ThemePreset {
  const text = prompt.toLowerCase();
  if (/\b(dark|night|cyber|neo|terminal|hacker|devtool)\b/.test(text)) return 'modern_dark';
  if (/\b(fintech|finance|bank|banking|payments|crypto|trading|portfolio|invoice)\b/.test(text)) return 'fintech_dark';
  if (/\b(blog|editorial|magazine|news|writer|writing|publishing)\b/.test(text)) return 'editorial_light';
  if (/\b(playful|kids|children|toy|fun|cute)\b/.test(text)) return 'playful_light';
  return 'modern_light';
}

function inferThemeAccent(prompt: string): ThemeAccent {
  const text = prompt.toLowerCase();
  if (/\b(emerald|green)\b/.test(text)) return 'emerald';
  if (/\b(rose|pink|magenta)\b/.test(text)) return 'rose';
  if (/\b(amber|orange|gold|yellow)\b/.test(text)) return 'amber';
  if (/\b(cyan|teal)\b/.test(text)) return 'cyan';
  if (/\b(violet|purple)\b/.test(text)) return 'violet';
  if (/\b(blue)\b/.test(text)) return 'blue';
  return 'indigo';
}

function normalizeBlueprint(raw: PlanningResponse['blueprint'] | undefined, prompt: string): BuildBlueprint {
  const inferredTemplate = inferTemplateTarget(prompt);
  const templateTarget = (raw?.templateTarget === 'next' || raw?.templateTarget === 'vite')
    ? raw.templateTarget
    : inferredTemplate;

  const dataMode: DataMode =
    raw?.dataMode === 'mock' || raw?.dataMode === 'real_optional' || raw?.dataMode === 'real_required'
      ? raw.dataMode
      : 'real_optional';

  const routes = Array.isArray(raw?.routes) ? raw!.routes as any[] : [];
  const normalizedRoutes: BlueprintRoute[] = routes
    .filter(r => r && typeof r === 'object')
    .map((r, idx): BlueprintRoute => {
      const id =
        typeof r.id === 'string' && r.id.trim().length > 0 ? r.id.trim() : `route_${idx}`;
      const kind: RouteKind = r.kind === 'section' ? 'section' : 'page';
      let path =
        typeof r.path === 'string' && r.path.trim().length > 0
          ? r.path.trim()
          : (kind === 'section' ? '#home' : '/');
      // Normalize placeholder section anchors.
      if (kind === 'section' && path.trim() === '#') path = '#home';
      const title =
        typeof r.title === 'string' && r.title.trim().length > 0 ? r.title.trim() : id;
      const navLabel =
        typeof r.navLabel === 'string' && r.navLabel.trim().length > 0 ? r.navLabel.trim() : title;
      return {
        id,
        kind,
        path,
        title,
        description: typeof r.description === 'string' ? r.description : undefined,
        navLabel,
        requiresAuth: Boolean(r.requiresAuth),
      };
    });

  const safeRoutes: BlueprintRoute[] = normalizedRoutes.length > 0 ? normalizedRoutes : [
    {
      id: 'home',
      kind: 'page',
      path: '/',
      title: 'Home',
      navLabel: 'Home',
    }
  ];

  // If the prompt is clearly an admin/dashboard request but the model returned only a single page route,
  // enforce a minimal end-to-end set of common dashboard pages so nav clicks can work.
  const promptLower = prompt.toLowerCase();
  const looksLikeDashboard = promptLower.includes('dashboard') || promptLower.includes('admin');
  const pageCount = safeRoutes.filter(r => r.kind === 'page').length;
  if (looksLikeDashboard && pageCount < 2) {
    const ensureRoute = (route: any) => {
      const existingById = safeRoutes.find(r => r.id === route.id);
      if (existingById) return;
      const existingByPath = safeRoutes.find(r => r.kind === 'page' && r.path === route.path);
      if (existingByPath) {
        existingByPath.title = existingByPath.title || route.title;
        (existingByPath as any).navLabel = (existingByPath as any).navLabel || route.navLabel;
        return;
      }
      safeRoutes.push(route);
    };

    ensureRoute({ id: 'dashboard', kind: 'page', path: '/', title: 'Dashboard', navLabel: 'Dashboard' });
    ensureRoute({ id: 'reports', kind: 'page', path: '/reports', title: 'Reports', navLabel: 'Reports' });
    ensureRoute({ id: 'users', kind: 'page', path: '/users', title: 'Users', navLabel: 'Users' });
    ensureRoute({ id: 'settings', kind: 'page', path: '/settings', title: 'Settings', navLabel: 'Settings' });
    ensureRoute({ id: 'help', kind: 'page', path: '/help', title: 'Help', navLabel: 'Help' });
  }

  const rawNavItems = (raw?.navigation as any)?.items;
  const navItems = Array.isArray(rawNavItems)
    ? rawNavItems
        .filter((i: any) => i && typeof i === 'object')
        .map((i: any) => {
          const label =
            typeof i.label === 'string' && i.label.trim().length > 0 ? i.label.trim() : 'Home';
          const routeId =
            typeof i.routeId === 'string' && i.routeId.trim().length > 0 ? i.routeId.trim() : 'home';
          return { label, routeId };
        })
    : [];

  // Ensure nav covers all routes (by id).
  const navRouteIds = new Set(navItems.map(i => i.routeId));
  const mergedNavItems = [...navItems];
  for (const r of safeRoutes) {
    if (!navRouteIds.has(r.id)) {
      mergedNavItems.push({ label: r.navLabel ?? r.title, routeId: r.id });
    }
  }

  const entities = Array.isArray(raw?.entities) ? (raw!.entities as any[]) : undefined;

  const flowsRaw = Array.isArray(raw?.flows) ? (raw!.flows as any[]) : undefined;
  const flows = Array.isArray(flowsRaw)
    ? flowsRaw
        .filter(f => f && typeof f === 'object')
        .map((f, idx) => {
          const name = typeof f.name === 'string' && f.name.trim().length > 0 ? f.name.trim() : `Flow ${idx + 1}`;
          const inferredId = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          const id =
            typeof f.id === 'string' && f.id.trim().length > 0
              ? f.id.trim()
              : (inferredId.length > 0 ? inferredId : `flow_${idx}`);

          const steps = Array.isArray(f.steps)
            ? f.steps
                .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
                .map((s: string) => s.trim())
            : [];

          const routeIds = Array.isArray(f.routeIds)
            ? f.routeIds.filter((rid: any) => typeof rid === 'string' && rid.trim().length > 0)
            : undefined;

          return {
            id,
            name,
            description: typeof f.description === 'string' ? f.description : '',
            steps: steps.length > 0 ? steps : ['Define the steps for this flow.'],
            routeIds: routeIds && routeIds.length > 0 ? routeIds : undefined,
          };
        })
    : undefined;

  const allowedPresets: ThemePreset[] = ['modern_light', 'modern_dark', 'fintech_dark', 'playful_light', 'editorial_light'];
  const allowedAccents: ThemeAccent[] = ['indigo', 'blue', 'emerald', 'rose', 'amber', 'cyan', 'violet'];

  const rawTheme: any = (raw as any)?.theme;
  const preset: ThemePreset =
    rawTheme && typeof rawTheme === 'object' && allowedPresets.includes(rawTheme.preset)
      ? rawTheme.preset
      : inferThemePreset(prompt);

  const accent: ThemeAccent =
    rawTheme && typeof rawTheme === 'object' && allowedAccents.includes(rawTheme.accent)
      ? rawTheme.accent
      : inferThemeAccent(prompt);

  const vibe: string | undefined =
    rawTheme && typeof rawTheme === 'object' && typeof rawTheme.vibe === 'string' && rawTheme.vibe.trim().length > 0
      ? rawTheme.vibe.trim().slice(0, 60)
      : undefined;

  return {
    templateTarget,
    dataMode,
    theme: { preset, accent, vibe },
    routes: safeRoutes,
    navigation: { items: mergedNavItems },
    entities: entities as any,
    flows: flows as any,
  };
}

function shouldIncludeMockDataLayer(blueprint: BuildBlueprint, prompt: string): boolean {
  if (blueprint.entities && blueprint.entities.length > 0) return true;
  const text = prompt.toLowerCase();
  return /\b(database|db|crud|persist|storage|seed|supabase|firebase|mongodb|postgres|mysql|sqlite|prisma)\b/.test(text);
}

function ensureMockFirstDataTickets(tickets: PlanTicket[], blueprint: BuildBlueprint, prompt: string): PlanTicket[] {
  const needsData = shouldIncludeMockDataLayer(blueprint, prompt);
  // Caller passes prompt into normalizeBlueprint; we still want a conservative behavior here.
  if (!needsData) return tickets;

  const hasDataLayer = tickets.some(t => (t.title || '').toLowerCase().includes('data layer') || t.type === 'database');
  const base: PlanTicket[] = [...tickets];

  if (!hasDataLayer) {
    base.unshift({
      title: 'Data layer (mock-first)',
      description: 'Set up a mock-first data adapter with seeded demo data and a switchable real adapter (optional).',
      type: 'database',
      priority: 'critical',
      complexity: 'M',
      estimatedFiles: 3,
      dependencies: [],
      requiresInput: false,
      inputRequests: [],
      databaseConfig: { provider: 'sqlite', autoSetup: false },
      blueprintRefs: {
        entityNames: blueprint.entities?.map(e => e.name) ?? [],
      },
    });
  }

  // Ensure an optional Supabase ticket exists (does not block anything).
  const hasSupabaseOptional = base.some(t => (t.title || '').toLowerCase().includes('supabase'));
  if (!hasSupabaseOptional) {
    base.push({
      title: 'Enable Supabase (optional)',
      description: 'Optional: configure Supabase credentials to use a real hosted database instead of mock demo data.',
      type: 'database',
      priority: 'low',
      complexity: 'S',
      estimatedFiles: 1,
      dependencies: [],
      requiresInput: true,
      inputRequests: [],
      databaseConfig: { provider: 'supabase', autoSetup: false },
    });
  }

  // Ensure data-dependent tickets depend on the mock-first data layer ticket title, not on Supabase.
  const dataLayerTitle = 'Data layer (mock-first)';
  return base.map(t => {
    if (t.title === dataLayerTitle) return t;
    if ((t.title || '').toLowerCase().includes('supabase')) return t;
    const typeSignals = ['feature', 'integration'] as const;
    const text = `${t.title}\n${t.description ?? ''}`.toLowerCase();
    const looksDataDependent =
      typeSignals.includes(t.type as any) ||
      /\b(data|crud|save|load|create|update|delete|list|search|filter|db|database|api)\b/.test(text);
    if (!looksDataDependent) return t;

    const deps = Array.isArray(t.dependencies) ? t.dependencies : [];
    if (deps.includes(dataLayerTitle)) return t;
    return { ...t, dependencies: [dataLayerTitle, ...deps] };
  });
}

export async function POST(request: NextRequest) {
  const validation = validateAIProvider();
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const { prompt, context } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Rate-limit + monthly usage limit gate (best-effort; in-memory counters by user/ip)
    const actor = await getUsageActor(request);
    const rl = await aiGenerationLimiter(request, actor.userId || actor.key);
    if (rl instanceof NextResponse) return rl;

    const usage = await consumeAiGenerationForActor(actor, 1);
    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: 'Usage limit reached for this month. Upgrade to continue.',
          code: 'USAGE_LIMIT_REACHED',
          usage: usage.snapshot,
          upgradeUrl: '/pricing',
        },
        { status: 402 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'planning_start' })}\n\n`));

          const modelId = appConfig.ai.defaultModel.replace('openai/', '');
          const { text } = await generateText({
            model: openai(modelId),
            messages: [
              { role: 'system', content: PLANNING_PROMPT },
              { 
                role: 'user', 
                content: `Build request: ${prompt}${context?.existingFiles ? `\n\nExisting files: ${context.existingFiles.join(', ')}` : ''}` 
              }
            ],
            temperature: 0.3,
            maxOutputTokens: 4000,
          });

          let parsed: PlanningResponse;
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsed = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('No JSON found in response');
            }
          } catch (parseError) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              message: 'Failed to parse plan' 
            })}\n\n`));
            controller.close();
            return;
          }

          const baseTime = Date.now();
          const blueprint = normalizeBlueprint(parsed.blueprint, prompt);
          const rawTickets = Array.isArray(parsed.tickets) ? parsed.tickets : [];
          const ticketsWithData = ensureMockFirstDataTickets(rawTickets, blueprint, prompt);

          // Emit blueprint early so the client can show coverage immediately (optional)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'blueprint', blueprint })}\n\n`));

          const tickets = ticketsWithData
            .map((ticket: PlanTicket) => ensureSupabaseInputs(ticket))
            .map((ticket: PlanTicket, index: number) => {
              const requiresInput =
                Boolean(ticket.requiresInput) ||
                (ticket.type === 'integration' && ticket.inputRequests && ticket.inputRequests.length > 0) ||
                (ticket.type === 'database' && ticket.inputRequests && ticket.inputRequests.length > 0);
            return {
              id: `ticket-${baseTime}-${index}`,
              ...ticket,
              status: requiresInput ? 'awaiting_input' : 'backlog',
              actualFiles: [],
              blockedBy: [],
              progress: 0,
              previewAvailable: false,
              retryCount: 0,
              userModified: false,
              order: index,
              requiresInput,
              inputRequests: ticket.inputRequests || [],
              userInputs: {},
              dependencies: ticket.dependencies.map((depTitle: string) => {
                const depIndex = ticketsWithData.findIndex((t: PlanTicket) => t.title === depTitle);
                return depIndex >= 0 ? `ticket-${baseTime}-${depIndex}` : null;
              }).filter(Boolean),
              blueprintRefs: ticket.blueprintRefs,
            };
          });

          for (const ticket of tickets) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'ticket', 
              ticket 
            })}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'plan_complete',
            plan: {
              id: `plan-${baseTime}`,
              prompt,
              blueprint,
              templateTarget: blueprint.templateTarget,
              dataMode: blueprint.dataMode,
              tickets,
              totalEstimatedTime: parsed.totalEstimatedTime || '~2-3 minutes',
              totalFiles: tickets.reduce((sum: number, t: any) => sum + t.estimatedFiles, 0),
              summary: parsed.summary,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'ready',
            }
          })}\n\n`));

          controller.close();
        } catch (error: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error.message 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[plan-build] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
