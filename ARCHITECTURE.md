# Paynto A.I. - Multi-Tenant Platform Architecture

## Overview

Transform Paynto A.I. from a single-user tool into a **multi-tenant SaaS platform** where users can:
1. Sign up and create accounts ✅ Implemented
2. Build web applications using AI ✅ Implemented
3. Save projects persistently ✅ Implemented (localStorage + DB ready)
4. Deploy and host their applications 🔴 Planned
5. Manage custom domains 🔴 Planned
6. Collaborate with team members 🔴 Planned

---

## Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Authentication | ✅ Complete | NextAuth.js + GitHub OAuth |
| User Dashboard | ✅ Complete | Project listing, create, delete |
| Project Storage | ✅ Complete | Prisma schema ready, localStorage fallback |
| AI Code Generation | ✅ Complete | Multi-provider, streaming |
| Sandbox System | ✅ Complete | Vercel Sandbox with auto-recovery |
| Kanban Workflow | ✅ Complete | 7-column board, auto/manual build |
| GitHub Export | ✅ Complete | Create repo, push files |
| Version Control | ✅ Complete | Local versioning system |
| Deployment Pipeline | 🔴 Not Started | Architecture defined |
| Billing/Stripe | 🔴 Not Started | Schema defined |
| Team Collaboration | 🔴 Not Started | Schema defined |
| Usage Tracking | 🟡 Partial | Rate limiting done |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS                                          │
│                    (Browser / Mobile)                                       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE / CDN LAYER                                    │
│                    (Vercel Edge / Cloudflare)                               │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Static    │  │   Auth      │  │  Rate       │  │  Custom     │        │
│  │   Assets    │  │   Middleware│  │  Limiting   │  │  Domains    │        │
│  │     ✅      │  │     ✅      │  │     ✅      │  │     🔴      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                   │
│                        (Next.js 15 App)                                     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         API ROUTES                                    │  │
│  │                                                                       │  │
│  │  /api/auth/*           - Authentication (NextAuth.js)        ✅      │  │
│  │  /api/projects/*       - Project CRUD                        ✅      │  │
│  │  /api/generate/*       - AI Code Generation                  ✅      │  │
│  │  /api/plan-build       - AI Build Planning                   ✅      │  │
│  │  /api/apply-ai-code-stream - Code Application                ✅      │  │
│  │  /api/github/*         - GitHub Integration                  ✅      │  │
│  │  /api/scrape-*         - Website Scraping                    ✅      │  │
│  │  /api/deploy/*         - Deployment Management               🔴      │  │
│  │  /api/billing/*        - Stripe Integration                  🔴      │  │
│  │  /api/teams/*          - Team Management                     🔴      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         PAGES                                         │  │
│  │                                                                       │  │
│  │  /                     - Landing Page                        ✅      │  │
│  │  /login                - Authentication                      ✅      │  │
│  │  /dashboard            - User Dashboard                      ✅      │  │
│  │  /generation           - Project Editor + Kanban             ✅      │  │
│  │  /project/[id]/deploy  - Deployment Settings                 🔴      │  │
│  │  /settings             - Account Settings                    🔴      │  │
│  │  /billing              - Subscription Management             🔴      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────┬─────────────────────┬─────────────────────┬─────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────────────────┐
│    DATABASE       │ │   FILE STORAGE    │ │      EXTERNAL SERVICES        │
│   (PostgreSQL)    │ │  (S3/R2/Supabase) │ │                               │
│       ✅          │ │       🔴          │ │  ┌─────────────────────────┐  │
│                   │ │                   │ │  │    AI PROVIDERS    ✅   │  │
│  - Users     ✅   │ │  - Project Files  │ │  │  - OpenAI               │  │
│  - Teams     🔴   │ │  - Assets         │ │  │  - Anthropic            │  │
│  - Projects  ✅   │ │  - Screenshots    │ │  │  - Groq                 │  │
│  - Versions  ✅   │ │  - Backups        │ │  │  - Google Gemini        │  │
│  - Deployments 🔴 │ │                   │ │  └─────────────────────────┘  │
│  - Subscriptions🔴│ │                   │ │                               │
│  - Usage     🟡   │ │                   │ │  ┌─────────────────────────┐  │
│                   │ │                   │ │  │  SANDBOX PROVIDERS ✅   │  │
└───────────────────┘ └───────────────────┘ │  │  - Vercel Sandbox       │  │
                                            │  │  - E2B (fallback)       │  │
                                            │  └─────────────────────────┘  │
                                            │                               │
                                            │  ┌─────────────────────────┐  │
                                            │  │  DEPLOYMENT TARGETS 🔴  │  │
                                            │  │  - Vercel               │  │
                                            │  │  - Cloudflare Pages     │  │
                                            │  │  - Netlify              │  │
                                            │  └─────────────────────────┘  │
                                            │                               │
                                            │  ┌─────────────────────────┐  │
                                            │  │    PAYMENTS        🔴   │  │
                                            │  │  - Stripe               │  │
                                            │  └─────────────────────────┘  │
                                            │                               │
                                            │  ┌─────────────────────────┐  │
                                            │  │  WEB SCRAPING      ✅   │  │
                                            │  │  - Firecrawl            │  │
                                            │  └─────────────────────────┘  │
                                            └───────────────────────────────┘
```

---

## Database Schema (PostgreSQL + Prisma)

### Currently Implemented ✅

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  accounts      Account[]
  sessions      Session[]
  projects      Project[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Project {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  sandboxId   String?
  sandboxUrl  String?
  mode        String   @default("build")
  sourceUrl   String?
  githubRepo  String?
  githubBranch String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  versions    Version[]
}

model Version {
  id            String   @id @default(cuid())
  projectId     String
  versionNumber Int
  name          String?
  description   String?
  trigger       String?
  filesJson     String?  @db.Text
  packagesJson  String?
  kanbanJson    String?  @db.Text
  fileCount     Int      @default(0)
  totalSize     Int      @default(0)
  gitCommitSha  String?
  createdAt     DateTime @default(now())
  
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, versionNumber])
}
```

### Planned Schema (Future) 🔴

```prisma
// TEAMS & COLLABORATION
model Team {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  members     TeamMember[]
  projects    Project[]
  subscription TeamSubscription?
  createdAt   DateTime @default(now())
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      TeamRole @default(MEMBER)
  team      Team     @relation(fields: [teamId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  @@unique([teamId, userId])
}

enum TeamRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

// DEPLOYMENTS
model Deployment {
  id          String   @id @default(cuid())
  projectId   String
  provider    DeploymentProvider
  status      DeploymentStatus @default(PENDING)
  url         String?
  customDomain String?
  buildLogs   String?  @db.Text
  project     Project  @relation(fields: [projectId], references: [id])
  createdAt   DateTime @default(now())
  deployedAt  DateTime?
}

enum DeploymentProvider {
  VERCEL
  CLOUDFLARE
  NETLIFY
}

enum DeploymentStatus {
  PENDING
  BUILDING
  DEPLOYING
  READY
  FAILED
}

// BILLING
model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  stripeSubscriptionId String   @unique
  plan                 Plan     @default(FREE)
  projectLimit         Int      @default(3)
  aiRequestsLimit      Int      @default(100)
  currentPeriodEnd     DateTime
  user                 User     @relation(fields: [userId], references: [id])
}

enum Plan {
  FREE
  PRO
  TEAM
  ENTERPRISE
}

// USAGE TRACKING
model Usage {
  id        String    @id @default(cuid())
  userId    String
  type      UsageType
  amount    Int       @default(1)
  projectId String?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id])
  @@index([userId, type, createdAt])
}

enum UsageType {
  AI_REQUEST
  SANDBOX_MINUTE
  DEPLOYMENT
}
```

---

## Authentication System ✅ Implemented

### Current Implementation

- **NextAuth.js** with Prisma Adapter
- **GitHub OAuth** provider
- **Database sessions** for security
- **Protected routes** via middleware

### Key Files

| File | Purpose |
|------|---------|
| `app/api/auth/[...nextauth]/route.ts` | Auth API handler |
| `lib/auth-config.ts` | NextAuth configuration |
| `middleware.ts` | Route protection |
| `components/auth/LoginButton.tsx` | Login UI |
| `components/auth/UserMenu.tsx` | User dropdown |
| `components/auth/SessionProvider.tsx` | Session context |

---

## Sandbox System ✅ Implemented

### Features

- **Vercel Sandbox** as primary provider
- **E2B** as fallback option
- **Sandbox pooling** for performance
- **Auto-recovery** on 410 expiration
- **Keep-alive** pings to prevent timeout
- **Package caching** per sandbox session

### Key Files

| File | Purpose |
|------|---------|
| `lib/sandbox/sandbox-manager.ts` | Lifecycle management |
| `lib/sandbox/factory.ts` | Provider abstraction |
| `lib/sandbox/providers/vercel-provider.ts` | Vercel implementation |
| `lib/sandbox/providers/e2b-provider.ts` | E2B implementation |

### Recent Improvements (v1.5.0)

- Robust file parsing (handles truncated AI responses)
- TSX/TS entrypoint auto-patching
- Missing import placeholder generation
- Write-order optimization for Vite HMR stability

---

## Kanban Build System ✅ Implemented

### Workflow Columns

```
Planning → Backlog → Awaiting Input → Generating → Applying → Testing → Done
```

### Features

- **Auto-Build Mode**: Tickets move automatically
- **Manual Build Mode**: User approves each step
- **Human-in-the-Loop**: Pauses for user input
- **Drag-drop validation**: Prevents skipping columns
- **Regression warnings**: Alert on backward movement

### Key Files

| File | Purpose |
|------|---------|
| `components/kanban/KanbanBoard.tsx` | Main board |
| `components/kanban/KanbanColumn.tsx` | Column container |
| `components/kanban/KanbanTicket.tsx` | Ticket card |
| `components/kanban/types.ts` | Type definitions |
| `hooks/useTicketMovement.ts` | Movement validation |

---

## Deployment Pipeline 🔴 Planned

### Target Flow

```
User clicks "Deploy"
        │
        ▼
┌───────────────────┐
│  1. Validate      │ - Check user has deployment quota
│     Permissions   │ - Check project is valid
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  2. Create        │ - Save project version
│     Version       │ - Generate build config
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  3. Build         │ - Run `npm run build` in sandbox
│     Project       │ - Capture build output
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  4. Upload        │ - Upload to Vercel/Cloudflare/Netlify
│     Artifacts     │ - Configure environment
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  5. Deploy        │ - Trigger deployment
│                   │ - Generate preview URL
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  6. Update DB     │ - Save deployment URL
│                   │ - Track usage
└───────────────────┘
```

---

## Billing System 🔴 Planned

### Plans

| Plan | Price | Projects | AI Requests | Deployments |
|------|-------|----------|-------------|-------------|
| Free | $0/mo | 3 | 100/mo | 1 |
| Pro | $20/mo | 20 | 2,000/mo | 10 |
| Team | $50/mo | 50 | 5,000/mo | 25 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

---

## Implementation Phases

### Phase 1: Foundation ✅ Complete
- [x] PostgreSQL database (Prisma schema)
- [x] NextAuth.js authentication
- [x] Auth middleware
- [x] User dashboard
- [x] Project CRUD

### Phase 2: Core Build System ✅ Complete
- [x] AI code generation (multi-provider)
- [x] Sandbox management
- [x] Kanban workflow
- [x] File application with error recovery
- [x] GitHub export

### Phase 3: Safety & Quality 🟡 In Progress
- [x] Drag-drop validation
- [x] Regression warnings
- [x] Soft deletion (code commenting)
- [x] PR Review agents (Bugbot)
- [x] Background Git sync

### Phase 4: Deployment System 🔴 Not Started
- [ ] Vercel deployment integration
- [ ] Build pipeline
- [ ] Deployment status tracking
- [ ] Custom domain support
- [ ] Permanent preview URLs

### Phase 5: Billing 🔴 Not Started
- [ ] Stripe integration
- [ ] Subscription management
- [ ] Usage tracking per user
- [ ] Plan limits enforcement

### Phase 6: Teams & Collaboration 🔴 Not Started
- [ ] Team creation/management
- [ ] Team invitations
- [ ] Role-based permissions
- [ ] Shared projects

---

## Environment Variables

### Currently Required

```env
# Sandbox
SANDBOX_PROVIDER=vercel
VERCEL_TOKEN=xxx
VERCEL_TEAM_ID=team_xxx
VERCEL_PROJECT_ID=prj_xxx

# AI Providers (at least one)
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GROQ_API_KEY=xxx
GEMINI_API_KEY=xxx

# Website Scraping
FIRECRAWL_API_KEY=xxx

# Authentication (optional)
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://your-domain.com
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Fast Edits (optional)
MORPH_API_KEY=xxx
```

### Future (Deployment & Billing)

```env
# Deployment Providers
VERCEL_DEPLOY_TOKEN=xxx
CLOUDFLARE_API_TOKEN=xxx
NETLIFY_AUTH_TOKEN=xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# File Storage
R2_ENDPOINT=https://xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=paynto-projects
```

---

## Cost Projections

### Infrastructure (per month)

| Service | Free Tier | Growth | Scale |
|---------|-----------|--------|-------|
| Vercel (hosting) | Free | $20 | $150 |
| Database (Supabase) | Free | $25 | $100 |
| Storage (R2) | Free | $5 | $50 |
| Sandboxes | Variable | $100 | $500 |
| AI APIs | Variable | $200 | $2000 |
| **Total** | **~$0** | **~$350** | **~$2800** |

### Revenue Model

| 100 users | 1,000 users | 10,000 users |
|-----------|-------------|--------------|
| 10% Pro ($20) = $200 | 10% Pro = $2,000 | 10% Pro = $20,000 |
| 2% Team ($50) = $100 | 2% Team = $1,000 | 2% Team = $10,000 |
| **MRR: $300** | **MRR: $3,000** | **MRR: $30,000** |

---

## Related Documentation

- `MVP_UX_IMPLEMENTATION_PLAN.md` - Feature status and roadmap
- `DEPLOYMENT.md` - Production deployment guide
- `config/app.config.ts` - Application configuration
