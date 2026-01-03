import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { validateAIProvider } from '@/lib/api-validation';
import { appConfig } from '@/config/app.config';

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
}

const PLANNING_PROMPT = `You are a build planner for a React application generator. Analyze the user's request and break it down into discrete, buildable feature tickets.

RULES:
1. Create FINE-GRAINED tickets (12-15 tickets for a typical landing page)
2. Each ticket should be a single, focused feature/component
3. Order tickets by build sequence (dependencies first)
4. Layout/structure tickets come before content tickets
5. Styling/theme tickets come after components exist
6. Integration tickets (data, API) come last
7. DATABASE tickets should be created EARLY in the build when data persistence is needed

For each ticket provide:
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

COMPLEXITY GUIDE:
- XS: Single simple element (button, icon)
- S: Simple component (card, badge)
- M: Medium component with logic (form, modal)
- L: Complex component (data table, chart)
- XL: Full feature with multiple parts (auth flow)

Return ONLY a valid JSON object with this structure:
{
  "tickets": [...],
  "totalEstimatedTime": "~X-Y minutes",
  "summary": "Brief build overview"
}`;

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

          let parsed;
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
          const tickets = (parsed.tickets || []).map((ticket: PlanTicket, index: number) => {
            const requiresInput = ticket.requiresInput || (ticket.type === 'integration' && ticket.inputRequests && ticket.inputRequests.length > 0);
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
                const depIndex = parsed.tickets.findIndex((t: PlanTicket) => t.title === depTitle);
                return depIndex >= 0 ? `ticket-${baseTime}-${depIndex}` : null;
              }).filter(Boolean),
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
