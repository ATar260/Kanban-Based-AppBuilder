# Open Lovable - Multi-Tenant Platform Architecture

## Overview

Transform Open Lovable from a single-user tool into a **multi-tenant SaaS platform** where users can:
1. Sign up and create accounts
2. Build web applications using AI
3. Save projects persistently
4. Deploy and host their applications
5. Manage custom domains
6. Collaborate with team members

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
│  │  /api/auth/*        - Authentication (NextAuth.js)                   │  │
│  │  /api/projects/*    - Project CRUD                                   │  │
│  │  /api/generate/*    - AI Code Generation                             │  │
│  │  /api/deploy/*      - Deployment Management                          │  │
│  │  /api/billing/*     - Stripe Integration                             │  │
│  │  /api/teams/*       - Team Management                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         PAGES                                         │  │
│  │                                                                       │  │
│  │  /                  - Landing Page                                   │  │
│  │  /login             - Authentication                                 │  │
│  │  /dashboard         - User Dashboard                                 │  │
│  │  /project/[id]      - Project Editor                                 │  │
│  │  /project/[id]/deploy - Deployment Settings                          │  │
│  │  /settings          - Account Settings                               │  │
│  │  /billing           - Subscription Management                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────┬─────────────────────┬─────────────────────┬─────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────────────────┐
│    DATABASE       │ │   FILE STORAGE    │ │      EXTERNAL SERVICES        │
│   (PostgreSQL)    │ │  (S3/R2/Supabase) │ │                               │
│                   │ │                   │ │  ┌─────────────────────────┐  │
│  - Users          │ │  - Project Files  │ │  │    AI PROVIDERS         │  │
│  - Teams          │ │  - Assets         │ │  │  - OpenAI               │  │
│  - Projects       │ │  - Screenshots    │ │  │  - Anthropic            │  │
│  - Deployments    │ │  - Backups        │ │  │  - Groq                  │  │
│  - Subscriptions  │ │                   │ │  └─────────────────────────┘  │
│  - Usage          │ │                   │ │                               │
│                   │ │                   │ │  ┌─────────────────────────┐  │
└───────────────────┘ └───────────────────┘ │  │    SANDBOX PROVIDERS    │  │
                                            │  │  - Vercel Sandbox       │  │
                                            │  │  - E2B                   │  │
                                            │  └─────────────────────────┘  │
                                            │                               │
                                            │  ┌─────────────────────────┐  │
                                            │  │    DEPLOYMENT TARGETS   │  │
                                            │  │  - Vercel               │  │
                                            │  │  - Cloudflare Pages     │  │
                                            │  │  - Netlify              │  │
                                            │  └─────────────────────────┘  │
                                            │                               │
                                            │  ┌─────────────────────────┐  │
                                            │  │    PAYMENTS             │  │
                                            │  │  - Stripe               │  │
                                            │  └─────────────────────────┘  │
                                            └───────────────────────────────┘
```

---

## Database Schema (PostgreSQL + Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// AUTHENTICATION & USERS
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  password      String?   // For email/password auth
  
  // OAuth connections
  accounts      Account[]
  sessions      Session[]
  
  // Platform data
  teams         TeamMember[]
  projects      Project[]
  
  // Billing
  stripeCustomerId String?   @unique
  subscription     Subscription?
  
  // Metadata
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLoginAt   DateTime?
  
  // Usage tracking
  usage         Usage[]
  
  @@map("users")
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
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ============================================
// TEAMS & COLLABORATION
// ============================================

model Team {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  image       String?
  
  // Team settings
  settings    Json     @default("{}")
  
  // Relations
  members     TeamMember[]
  projects    Project[]
  invitations TeamInvitation[]
  
  // Billing (team-level)
  stripeCustomerId String?   @unique
  subscription     TeamSubscription?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("teams")
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      TeamRole @default(MEMBER)
  
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([teamId, userId])
  @@map("team_members")
}

model TeamInvitation {
  id        String   @id @default(cuid())
  teamId    String
  email     String
  role      TeamRole @default(MEMBER)
  token     String   @unique
  expiresAt DateTime
  
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())

  @@map("team_invitations")
}

enum TeamRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

// ============================================
// PROJECTS
// ============================================

model Project {
  id          String   @id @default(cuid())
  name        String
  slug        String
  description String?
  
  // Ownership (either user or team)
  userId      String?
  teamId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  team        Team?    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  // Project settings
  framework   Framework @default(REACT_VITE)
  settings    Json      @default("{}")
  
  // Current state
  files       ProjectFile[]
  versions    ProjectVersion[]
  
  // Deployment
  deployments Deployment[]
  customDomain String?
  
  // AI context
  conversationHistory Json @default("[]")
  
  // Metadata
  isPublic    Boolean  @default(false)
  thumbnail   String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lastEditedAt DateTime?

  @@unique([userId, slug])
  @@unique([teamId, slug])
  @@map("projects")
}

model ProjectFile {
  id        String   @id @default(cuid())
  projectId String
  path      String   // e.g., "src/components/Header.jsx"
  content   String   @db.Text
  
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectId, path])
  @@map("project_files")
}

model ProjectVersion {
  id          String   @id @default(cuid())
  projectId   String
  version     Int
  name        String?  // Optional version name
  description String?
  
  // Snapshot of files at this version
  files       Json     // { path: content } map
  
  // Who created this version
  createdBy   String?
  
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime @default(now())

  @@unique([projectId, version])
  @@map("project_versions")
}

enum Framework {
  REACT_VITE
  NEXT_JS
  VUE_VITE
  SVELTE
  ASTRO
}

// ============================================
// DEPLOYMENTS
// ============================================

model Deployment {
  id          String   @id @default(cuid())
  projectId   String
  
  // Deployment target
  provider    DeploymentProvider
  providerId  String?  // ID from the deployment provider
  
  // Status
  status      DeploymentStatus @default(PENDING)
  url         String?
  
  // Version deployed
  versionId   String?
  
  // Build info
  buildLogs   String?  @db.Text
  buildTime   Int?     // seconds
  
  // Domain
  customDomain String?
  sslStatus   SSLStatus @default(PENDING)
  
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deployedAt  DateTime?

  @@map("deployments")
}

enum DeploymentProvider {
  VERCEL
  CLOUDFLARE
  NETLIFY
  RAILWAY
  SELF_HOSTED
}

enum DeploymentStatus {
  PENDING
  BUILDING
  DEPLOYING
  READY
  FAILED
  CANCELLED
}

enum SSLStatus {
  PENDING
  PROVISIONING
  ACTIVE
  FAILED
}

// ============================================
// BILLING & SUBSCRIPTIONS
// ============================================

model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  
  stripeSubscriptionId String   @unique
  stripePriceId        String
  stripeStatus         String
  
  plan                 Plan     @default(FREE)
  
  // Limits based on plan
  projectLimit         Int      @default(3)
  deploymentLimit      Int      @default(1)
  aiRequestsLimit      Int      @default(100)
  teamMemberLimit      Int      @default(1)
  
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean  @default(false)
  
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@map("subscriptions")
}

model TeamSubscription {
  id                   String   @id @default(cuid())
  teamId               String   @unique
  
  stripeSubscriptionId String   @unique
  stripePriceId        String
  stripeStatus         String
  
  plan                 Plan     @default(TEAM)
  
  // Team limits
  projectLimit         Int      @default(50)
  deploymentLimit      Int      @default(20)
  aiRequestsLimit      Int      @default(5000)
  teamMemberLimit      Int      @default(10)
  
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean  @default(false)
  
  team                 Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@map("team_subscriptions")
}

enum Plan {
  FREE
  PRO
  TEAM
  ENTERPRISE
}

// ============================================
// USAGE TRACKING
// ============================================

model Usage {
  id        String   @id @default(cuid())
  userId    String
  
  // What was used
  type      UsageType
  amount    Int      @default(1)
  
  // Context
  projectId String?
  metadata  Json     @default("{}")
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())

  @@index([userId, type, createdAt])
  @@map("usage")
}

enum UsageType {
  AI_REQUEST
  SANDBOX_MINUTE
  DEPLOYMENT
  STORAGE_GB
  BANDWIDTH_GB
}
```

---

## Authentication System

### Tech Stack
- **NextAuth.js v5** (Auth.js) - Authentication framework
- **Prisma Adapter** - Database integration
- **Providers**: Email/Password, Google, GitHub

### Implementation

```typescript
// lib/auth.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        
        if (!user || !user.password) return null
        
        const isValid = await bcrypt.compare(
          credentials.password, 
          user.password
        )
        
        if (!isValid) return null
        
        return user
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
})
```

### Middleware

```typescript
// middleware.ts
import { auth } from "@/lib/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  const isPublicPage = ['/', '/pricing', '/about'].includes(req.nextUrl.pathname)
  const isApiRoute = req.nextUrl.pathname.startsWith('/api')
  const isPublicApi = req.nextUrl.pathname.startsWith('/api/auth')

  // Allow public pages and auth API
  if (isPublicPage || isPublicApi) return

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/dashboard', req.nextUrl))
  }

  // Protect dashboard and API routes
  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

---

## Deployment Pipeline

### Flow

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
│  4. Upload        │ - Upload build artifacts to provider
│     Artifacts     │ - Vercel / Cloudflare / Netlify
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  5. Configure     │ - Set environment variables
│     Deployment    │ - Configure custom domain (if any)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  6. Deploy        │ - Trigger deployment
│                   │ - Wait for completion
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  7. Update        │ - Save deployment URL
│     Database      │ - Update project status
└───────────────────┘
```

### Deployment Service

```typescript
// lib/deployment/deploy.ts

import { prisma } from '@/lib/prisma'
import { VercelDeployer } from './providers/vercel'
import { CloudflareDeployer } from './providers/cloudflare'

interface DeployOptions {
  projectId: string
  userId: string
  provider: 'VERCEL' | 'CLOUDFLARE'
  customDomain?: string
}

export async function deployProject(options: DeployOptions) {
  const { projectId, userId, provider } = options
  
  // 1. Check permissions & quota
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true }
  })
  
  const deploymentCount = await prisma.deployment.count({
    where: { 
      project: { userId },
      status: 'READY'
    }
  })
  
  if (deploymentCount >= (user?.subscription?.deploymentLimit || 1)) {
    throw new Error('Deployment limit reached. Upgrade your plan.')
  }
  
  // 2. Get project files
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: true }
  })
  
  if (!project) throw new Error('Project not found')
  
  // 3. Create deployment record
  const deployment = await prisma.deployment.create({
    data: {
      projectId,
      provider,
      status: 'BUILDING'
    }
  })
  
  try {
    // 4. Build project in sandbox
    const buildResult = await buildInSandbox(project.files)
    
    // 5. Deploy to provider
    const deployer = provider === 'VERCEL' 
      ? new VercelDeployer() 
      : new CloudflareDeployer()
    
    const result = await deployer.deploy({
      files: buildResult.outputFiles,
      projectName: project.slug,
      customDomain: options.customDomain
    })
    
    // 6. Update deployment record
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'READY',
        url: result.url,
        providerId: result.deploymentId,
        deployedAt: new Date()
      }
    })
    
    // 7. Track usage
    await prisma.usage.create({
      data: {
        userId,
        type: 'DEPLOYMENT',
        projectId
      }
    })
    
    return { success: true, url: result.url }
    
  } catch (error) {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'FAILED',
        buildLogs: error.message
      }
    })
    throw error
  }
}
```

---

## Billing System (Stripe)

### Plans

| Plan | Price | Projects | Deployments | AI Requests | Team Members |
|------|-------|----------|-------------|-------------|--------------|
| Free | $0/mo | 3 | 1 | 100/mo | 1 |
| Pro | $20/mo | 20 | 10 | 2,000/mo | 1 |
| Team | $50/mo | 50 | 25 | 5,000/mo | 10 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

### Stripe Integration

```typescript
// app/api/billing/webhook/route.ts

import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!
  
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
  
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      await handleCheckoutComplete(session)
      break
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object
      await handleSubscriptionUpdate(subscription)
      break
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      await handleSubscriptionCancel(subscription)
      break
    }
  }
  
  return Response.json({ received: true })
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const plan = session.metadata?.plan as Plan
  
  const limits = getPlanLimits(plan)
  
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: session.subscription as string,
      stripePriceId: session.metadata?.priceId!,
      stripeStatus: 'active',
      plan,
      ...limits,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    update: {
      stripeSubscriptionId: session.subscription as string,
      stripePriceId: session.metadata?.priceId!,
      stripeStatus: 'active',
      plan,
      ...limits
    }
  })
}
```

---

## File Storage

### Options

1. **Supabase Storage** - Easy, integrated with Postgres
2. **Cloudflare R2** - Cheap, S3-compatible
3. **AWS S3** - Industry standard
4. **Vercel Blob** - Simple, Vercel-native

### Recommended: Cloudflare R2

```typescript
// lib/storage/r2.ts

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
})

export async function uploadProjectFiles(
  projectId: string, 
  files: Record<string, string>
) {
  const uploads = Object.entries(files).map(([path, content]) => {
    return r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: `projects/${projectId}/${path}`,
      Body: content,
      ContentType: getContentType(path)
    }))
  })
  
  await Promise.all(uploads)
}

export async function getProjectFiles(projectId: string) {
  // List and retrieve all files for a project
  // ...
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up PostgreSQL database (Supabase/Neon/PlanetScale)
- [ ] Configure Prisma with schema
- [ ] Implement NextAuth.js authentication
- [ ] Create auth middleware
- [ ] Basic user dashboard

### Phase 2: Project Management (Week 3-4)
- [ ] Project CRUD API
- [ ] File storage integration
- [ ] Project versioning
- [ ] Convert existing generation page to use database

### Phase 3: Deployment System (Week 5-6)
- [ ] Vercel deployment integration
- [ ] Build pipeline
- [ ] Deployment status tracking
- [ ] Custom domain support

### Phase 4: Billing (Week 7-8)
- [ ] Stripe integration
- [ ] Subscription management
- [ ] Usage tracking
- [ ] Plan limits enforcement

### Phase 5: Teams & Collaboration (Week 9-10)
- [ ] Team creation/management
- [ ] Team invitations
- [ ] Role-based permissions
- [ ] Shared projects

### Phase 6: Polish & Scale (Week 11-12)
- [ ] Performance optimization
- [ ] Error handling
- [ ] Monitoring & analytics
- [ ] Documentation

---

## Environment Variables (Production)

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# Storage
R2_ENDPOINT="https://..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="open-lovable-projects"

# Deployment Providers
VERCEL_TOKEN="..."
VERCEL_TEAM_ID="..."
CLOUDFLARE_API_TOKEN="..."
CLOUDFLARE_ACCOUNT_ID="..."

# AI Providers (existing)
OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."
GROQ_API_KEY="..."

# Sandbox (existing)
SANDBOX_PROVIDER="vercel"
VERCEL_OIDC_TOKEN="..."
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

## Next Steps

1. **Choose your stack:**
   - Database: Supabase (easiest) or Neon (best DX)
   - Storage: Cloudflare R2 (cheapest) or Supabase Storage
   - Deployment: Start with Vercel only

2. **Start with Phase 1:**
   - Run `npx prisma init`
   - Copy the schema above
   - Set up NextAuth.js

3. **Need help implementing?** I can create the actual code files for any phase.
