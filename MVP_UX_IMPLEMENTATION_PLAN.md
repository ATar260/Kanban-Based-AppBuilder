# Paynto A.I. - MVP UX Implementation Plan

## Overview
This document is the comprehensive implementation plan for the "Overnight" MVP UI/UX workflows for the Paynto A.I. platform. It combines task tracking, technical specifications, and MCP (Model Context Protocol) integration details.

---

# PART 1: USER EXPERIENCE WORKFLOWS

## 1. Entry Points (3 Options)

### Option A: Build from Prompt (Greenfield)
```
User Action: Types natural language prompt
Example: "Build a CRM for real estate agents"
System Response:
  1. Validates prompt
  2. Calls /api/plan-build
  3. AI generates 12-15 tickets
  4. Displays plan in Kanban
  5. Awaits user approval to build
```

### Option B: Clone from URL
```
User Action: Enters website URL to clone
Example: "stripe.com"
System Response:
  1. Scrapes website (screenshot + content)
  2. Analyzes structure and design
  3. Calls /api/plan-build with context
  4. AI generates tickets based on scraped site
  5. Displays plan in Kanban
```

### Option C: Import from GitHub (Brownfield)
```
User Action: Connects GitHub, selects repository
System Response:
  1. OAuth flow → GitHub connection
  2. Fetches repository structure
  3. Parses existing codebase
  4. AI generates tickets to extend/modify
  5. Displays plan in Kanban
```

---

## 2. Planning Phase

### Auto-Planning Flow
```
Input: User prompt or scraped content
Process:
  1. AI analyzes request
  2. Breaks down into discrete tickets
  3. Estimates complexity (XS, S, M, L, XL)
  4. Identifies dependencies
  5. Detects required user inputs (API keys, etc.)
Output: BuildPlan with 12-15 KanbanTickets
```

### Plan Refinement
```
User Actions Available:
  - Edit ticket title/description
  - Add new tickets
  - Remove tickets (with dependency warnings)
  - Reorder tickets (drag-drop)
  - Provide required inputs

UI Elements:
  - Inline editing
  - "Add Step" button
  - Dependency visualization
  - "Move to Pipeline" button (commits plan)
```

---

## 3. Execution Phase (Kanban Command Center)

### View Modes
| Mode | Description |
|------|-------------|
| Kanban Board | Source of truth - ticket management |
| App Preview | Live sandbox showing built application |
| Split View | Side-by-side (optional) |

### Build Modes

#### Auto-Build Mode
```
Trigger: User clicks "Auto-Build"
Behavior:
  - Tickets move automatically: Backlog → Generating → Applying → Testing → Done
  - Real-time progress updates
  - Pause button available at any time
  - Resume continues from last ticket
```

#### Manual Build Mode
```
Trigger: User enables "Manual Build" toggle
Behavior:
  - "Build This" button on each ticket
  - User authorizes each ticket individually
  - Skip/defer ticket options
```

### Human-in-the-Loop (Stuck State)
```
Trigger: Ticket requires user input (API key, credential, clarification)
Behavior:
  - Ticket moves to "Awaiting Input" column
  - Visual highlighting (pulsing border)
  - User clicks ticket → Input modal appears
  - User provides input
  - Ticket resumes to "Backlog"
```

---

## 4. Board Logic & Guardrails

### Column Progression
```
Valid Flow:
  Backlog → Generating → Applying → Testing → Done

Invalid Actions:
  - Cannot skip columns (ToDo → Done blocked)
  - Cannot move to non-adjacent column directly
```

### Backward Regression (Undo)
```
Trigger: User drags ticket from Done/Review back to Backlog
Behavior:
  1. Warning modal: "Moving this back will remove the associated feature code. Proceed?"
  2. If confirmed:
     - Soft-delete/comment out associated code
     - Trigger auto-refactor for stability
     - Reset ticket status
  3. If cancelled: No action
```

---

## 5. GitHub Integration

### Import Flow
```
1. User clicks "Import from GitHub"
2. OAuth authentication
3. Repository selector modal
4. Branch selection
5. Code analysis
6. Plan generation
```

### Export Flow
```
1. User clicks "Export to GitHub"
2. Options:
   a. Create new repository (name, public/private)
   b. Push to existing repository (branch selector)
3. Commit message input
4. Push execution
5. Success → Link to repository
```

### Auto-Commit (Optional)
```
Toggle: "Auto-commit after each ticket"
Behavior: After ticket completion → Auto-push to selected repo
```

---

# PART 2: IMPLEMENTATION TASKS

## Phase 1: Onboarding & Project Initiation

### 1.1 Entry Choice Screen (3 Options)
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** M

**Current State:** Build and Clone exist in SidebarInput

**Tasks:**
- [ ] Create unified entry component with three distinct paths
- [x] **Option A (Build from Prompt):** ✅ Done
  - Natural language prompt input
  - Template suggestions (Landing Page, Dashboard, E-commerce, etc.)
  - "Start Building" button → Creates plan
- [x] **Option B (Clone from URL):** ✅ Done
  - URL input field
  - Style preferences
  - Quick clone examples (Stripe, Linear, Vercel)
  - "Clone Website" button → Creates plan based on scraped site
- [ ] **Option C (Import from GitHub):**
  - "Import from GitHub" button
  - GitHub OAuth flow (already implemented)
  - Repository selection modal with search
  - Branch selection
  - Parse existing codebase structure → Creates plan to extend/modify

**Files to Create/Modify:**
- `components/onboarding/EntryChoice.tsx` (new)
- `components/onboarding/GitHubImport.tsx` (new)
- `components/onboarding/RepoSelector.tsx` (new)
- `app/api/import-github-repo/route.ts` (new)
- `app/generation/page.tsx` (modify to integrate)

---

### 1.2 GitHub Export Functionality
**Status:** ✅ Complete  
**Priority:** High  
**Estimated Effort:** M

**Current State:** Fully implemented with ExportToGitHub component

**Tasks:**
- [x] "Export to GitHub" button in header
- [x] Create new repository modal
  - Repository name input
  - Public/Private toggle
  - Description (optional)
- [x] Push to existing repository option
  - Select from connected repos
  - Branch selection/creation
  - Commit message input
- [ ] Automatic commit after each ticket completion (optional toggle)
- [x] View repository link after export
- [x] Push status indicator

**Files Created:**
- `components/versioning/ExportToGitHub.tsx` ✅
- `app/api/github/repos/route.ts` ✅ (GET + POST)
- `app/api/github/commit/route.ts` ✅
- `lib/versioning/github.ts` ✅

---

## Phase 2: The Planning Interface

### 2.1 Auto-Planning System
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** M

**Current State:** `/api/plan-build` exists and creates tickets

**Tasks:**
- [x] Plan display with clear structure
- [x] Estimated complexity for each task
- [x] Dependencies identification
- [x] Plan summary with totals

---

### 2.2 Plan Refinement UI
**Status:** ✅ Complete  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [x] Enable inline editing of ticket titles/descriptions
- [x] Add "Add Step" button to insert new tickets
- [x] Remove tickets with confirmation
- [x] Reorder tickets with drag-and-drop
- [x] Show dependency warnings when editing

**Files Created/Modified:**
- `components/kanban/TicketEditor.tsx` ✅

---

### 2.3 "Move to Pipeline" Transition
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** S

**Tasks:**
- [x] Add prominent "Move to Pipeline" button
- [x] Confirmation before locking plan
- [x] Lock plan after commit (read-only unless explicitly unlocked)
- [x] Unlock & Edit Plan option

**Files Created:**
- `components/planning/PipelineTransition.tsx` ✅
- `components/planning/index.ts` ✅

---

## Phase 3: Execution Phase (Kanban Command Center)

### 3.1 View Mode Toggle
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** S

**Current State:** Code/View/Kanban tabs exist and work

**Tasks:**
- [x] Toggle between Kanban Board and App Preview
- [x] Persist view preference
- [ ] Add split-view option (both views side-by-side)

---

### 3.2 Auto-Build Mode
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** M

**Tasks:**
- [x] "Start Build" button (gradient style)
- [x] Real-time ticket movement
- [x] Progress indicators on each ticket
- [x] "Pause" button to halt at any point
- [x] Resume functionality after pause

---

### 3.3 Manual Build Mode
**Status:** ✅ Complete  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [x] Manual/Auto toggle switch
- [x] "Build This" button on individual tickets
- [x] Skip/defer ticket options

---

### 3.4 Human-in-the-Loop (Stuck State) UI
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** L

**Tasks:**
- [x] `awaiting_input` status handling
- [x] Visual highlighting of blocked tickets
- [x] Input modal for user responses
- [x] Resume ticket after input provided

---

## Phase 4: Board Logic & Guardrails

### 4.1 Forward Movement Restrictions
**Status:** ✅ Complete  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [x] Implement drag-drop validation rules
- [x] Prevent skipping columns (ToDo → Done blocked)
- [x] Show visual feedback on invalid drops
- [x] Enforce sequential column progression

**Files Created:**
- `hooks/useTicketMovement.ts` ✅

---

### 4.2 Backward Regression (Undo Logic)
**Status:** ✅ Complete  
**Priority:** High  
**Estimated Effort:** L

**Tasks:**
- [x] Detect backward ticket movement
- [x] Warning modal with clear messaging
- [x] Confirmation flow before reverting
- [ ] Auto-refactor trigger for stability (future)
- [ ] Undo history tracking (future)

**Files Created:**
- `components/kanban/RegressionWarningModal.tsx` ✅

---

## Phase 5: Quality Assurance

### 5.1 PR Review Column
**Status:** 🔴 Not Started  
**Priority:** Medium  
**Estimated Effort:** L

**Tasks:**
- [ ] Add "PR Review" column before "Done"
- [ ] Automated code review via AI agent
- [ ] Status checks display on tickets
- [ ] Approve/Request Changes actions
- [ ] Auto-approve for passing checks

---

## Phase 6: Multi-Tenant Architecture

### 6.1 User Authentication & Identity
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** L

**Tasks:**
- [x] Implement authentication (NextAuth.js with GitHub)
- [x] User registration/login flows
- [x] OAuth providers (GitHub)
- [x] Session management (database sessions)
- [x] Protected routes middleware
- [x] User profile storage

**Files Created:**
- `app/api/auth/[...nextauth]/route.ts` ✅
- `middleware.ts` ✅
- `lib/auth.ts` ✅
- `lib/prisma.ts` ✅
- `components/auth/LoginButton.tsx` ✅
- `components/auth/UserMenu.tsx` ✅
- `components/auth/SessionProvider.tsx` ✅
- `types/next-auth.d.ts` ✅

---

### 6.2 Data Isolation & Project Ownership
**Status:** ✅ Complete  
**Priority:** Critical  
**Estimated Effort:** L

**Tasks:**
- [x] Database schema with `userId` on all resources
- [x] Projects table (id, userId, name, created_at, etc.)
- [x] Versions table linked to projects
- [x] API route validation (user can only access own data)

**Database Schema (Prisma):**
```prisma
model User {
  id, email, name, image, createdAt, updatedAt
  accounts, sessions, projects
}

model Project {
  id, userId, name, description, sandboxId, sandboxUrl
  mode, sourceUrl, githubRepo, githubBranch
  createdAt, updatedAt, versions
}

model Version {
  id, projectId, versionNumber, name, description
  trigger, filesJson, packagesJson, kanbanJson
  fileCount, totalSize, gitCommitSha, createdAt
}
```

**Files Created:**
- `prisma/schema.prisma` ✅
- `app/api/projects/route.ts` ✅
- `app/api/projects/[id]/route.ts` ✅

---

### 6.3 Project Management Dashboard
**Status:** ✅ Complete  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [x] "My Projects" dashboard page
- [x] Project cards with preview thumbnails
- [x] Create new project flow
- [x] Resume existing project
- [x] Delete project with confirmation
- [ ] Project search and filters (future)
- [ ] Recent projects quick access (future)

**Files Created:**
- `app/dashboard/page.tsx` ✅

---

### 6.4 Usage Tracking & Limits
**Status:** 🟡 Partially Complete  
**Priority:** Medium  
**Estimated Effort:** M

**Tasks:**
- [x] Rate limiting utility created
- [ ] Track API calls per user (AI generations, sandbox time)
- [ ] Usage limits by tier (Free, Pro, Enterprise)
- [ ] Usage display in UI
- [ ] Limit enforcement on API routes
- [ ] Upgrade prompts when limits reached

**Files Created:**
- `lib/rateLimit.ts` ✅

---

### 6.5 Team Collaboration (Future)
**Status:** 🔴 Not Started  
**Priority:** Low (Post-MVP)  
**Estimated Effort:** XL

---

### 6.6 Sandbox Isolation
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** S

**Current State:** Vercel sandbox provider exists

**Tasks:**
- [x] Users get sandbox instances
- [ ] Sandbox cleanup on session end
- [ ] Sandbox timeout/expiry handling
- [ ] Resource limits per sandbox
- [ ] Persistent sandbox option (paid feature)

---

# PART 3: TECHNICAL SPECIFICATIONS

## API Endpoints

### Planning
```
POST /api/plan-build ✅
  Input: { prompt: string, context?: object }
  Output: SSE stream of tickets + plan

POST /api/generate-ui-options
  Input: { prompt: string }
  Output: { options: UIDesign[] }
```

### Execution
```
POST /api/generate-ai-code-stream ✅
  Input: { prompt: string, model: string, context: object }
  Output: SSE stream of code chunks

POST /api/apply-code ✅
  Input: { sandboxId: string, files: FileContent[] }
  Output: { success: boolean }
```

### GitHub
```
GET /api/github/repos ✅
  Output: { repos: Repository[] }

POST /api/github/repos ✅ (create new repo)
  Input: { name: string, private: boolean }
  Output: { repo: Repository }

POST /api/github/commit ✅
  Input: { repoFullName: string, files: FileContent[], message: string }
  Output: { sha: string, url: string }
```

### Projects
```
GET /api/projects ✅
  Output: { projects: Project[] }

POST /api/projects ✅
  Input: { name: string, description?: string }
  Output: { project: Project }

GET /api/projects/:id ✅
  Output: { project: Project }

PATCH /api/projects/:id ✅
  Input: { name?, description?, sandboxId?, githubRepo? }
  Output: { project: Project }

DELETE /api/projects/:id ✅
  Output: { success: boolean }
```

### Auth
```
GET/POST /api/auth/[...nextauth] ✅
  NextAuth.js endpoints for GitHub OAuth
```

---

## UI Component Inventory

### Entry Components
- `SidebarInput.tsx` ✅ - Prompt and URL input
- `EntryChoice.tsx` - 3-option selector (future)

### Planning Components
- `TicketEditor.tsx` ✅ - Single ticket edit modal
- `PipelineTransition.tsx` ✅ - Move to Pipeline button

### Execution Components
- `KanbanBoard.tsx` ✅ - Main board
- `KanbanColumn.tsx` ✅ - Column container
- `KanbanTicket.tsx` ✅ - Ticket card
- `InputRequestModal.tsx` ✅ - User input modal
- `RegressionWarningModal.tsx` ✅ - Backward move warning

### GitHub Components
- `GitHubConnectButton.tsx` ✅ - OAuth trigger
- `ExportToGitHub.tsx` ✅ - Export modal with create/push options
- `RepoSelector.tsx` ✅ - Repository picker

### Dashboard Components
- `app/dashboard/page.tsx` ✅ - Project dashboard

### Auth Components
- `LoginButton.tsx` ✅ - Login trigger
- `UserMenu.tsx` ✅ - User dropdown
- `SessionProvider.tsx` ✅ - NextAuth session wrapper

---

## State Management

### Global State (Jotai/React Context)
```typescript
interface AppState {
  user: User | null;
  currentProject: Project | null;
  plan: BuildPlan | null;
  tickets: KanbanTicket[];
  isBuilding: boolean;
  isPaused: boolean;
  buildMode: 'auto' | 'manual';
  sandboxData: SandboxData | null;
  githubConnection: GitHubConnection | null;
}
```

### Persistence
- Plans: LocalStorage + Database (when auth enabled)
- Tickets: LocalStorage + Database
- User preferences: LocalStorage
- Sandbox sessions: Server-side only

---

# PART 4: SECURITY CONSIDERATIONS

## Security Implementation Status

### 1. API Key Exposure
**Risk:** HIGH  
**Status:** 🟡 Partial

**Mitigations:**
- [x] All AI API calls go through server-side routes only
- [x] Use environment variables for all secrets
- [ ] Implement key rotation mechanism
- [ ] Audit logs for API key usage

---

### 2. Sandbox Code Execution
**Risk:** CRITICAL  
**Status:** ✅ Done

**Mitigations:**
- [x] Sandboxes are fully isolated (Vercel handles this)
- [x] No access to host system from sandbox
- [x] Sandbox timeout limits

---

### 3. User Input Validation
**Risk:** HIGH  
**Status:** 🟡 Partial

**Mitigations:**
- [x] URL validation before scraping
- [x] SQL injection prevention (Prisma parameterized queries)
- [ ] Prompt injection protection (system prompt hardening)
- [ ] XSS prevention in rendered content

---

### 4. Authentication & Authorization
**Risk:** CRITICAL  
**Status:** ✅ Done

**Mitigations:**
- [x] Implement proper auth (NextAuth.js)
- [x] Session validation on API routes
- [x] Secure session management (database sessions)
- [x] httpOnly cookies for session

---

### 5. GitHub Token Security
**Risk:** HIGH  
**Status:** ✅ Done

**Mitigations:**
- [x] Tokens stored in database via NextAuth Account model
- [x] Minimal OAuth scopes (repo only)
- [x] Secure token retrieval (server-side only)
- [x] Never log tokens

---

### 6. Rate Limiting & DDoS Protection
**Risk:** MEDIUM  
**Status:** ✅ Done

**Mitigations:**
- [x] Rate limiting utility created (`lib/rateLimit.ts`)
- [x] Configurable limits per endpoint type
- [x] IP-based and user-based limiting
- [x] Vercel DDoS protection (platform-level)

---

## Security Checklist for Launch

| Item | Status | Priority |
|------|--------|----------|
| API keys server-side only | ✅ Done | Critical |
| Sandbox isolation verified | ✅ Done (Vercel) | Critical |
| User authentication | ✅ Done (NextAuth) | Critical |
| Input sanitization | ✅ Done (Zod schemas) | Critical |
| GitHub token security | ✅ Done (DB storage) | High |
| Rate limiting | ✅ Done | High |
| Secrets handling | 🟡 Partial | High |
| HTTPS everywhere | ✅ Done (Vercel) | Critical |
| CORS configured | 🟡 Partial | Medium |
| Security headers | ✅ Done | Medium |

---

# PART 5: IMPLEMENTATION SCHEDULE

## Sprint 1: Core Flow (Days 1-3) ✅
1. ✅ Plan creation from prompt
2. ✅ Kanban display with columns
3. ✅ Start Build button
4. ✅ Entry options (Build/Clone)
5. ✅ View mode toggle

## Sprint 2: Build Execution (Days 4-6) ✅
1. ✅ Auto-Build with real-time updates
2. ✅ Pause/Resume functionality
3. ✅ Manual Build mode toggle
4. ✅ Human-in-the-Loop improvements

## Sprint 3: Guardrails & Quality (Days 7-9) ✅
1. ✅ Forward movement restrictions
2. ✅ Backward regression with warnings
3. 🔴 PR Review column (future)
4. 🔴 Code rollback logic (future)

## Sprint 4: Polish (Days 10-12) ✅
1. ✅ GitHub export flow
2. 🔴 "Come up with 3 UIs" feature (future)
3. 🟡 Animations and transitions
4. ✅ Error handling and edge cases

## Sprint 5: Multi-Tenant (Days 13-18) ✅
1. ✅ User authentication (NextAuth.js)
2. ✅ Data isolation (Prisma + user ownership)
3. ✅ Project dashboard
4. 🟡 Usage tracking (rate limiting done)

---

## Key UI Elements Checklist

| Element | Status | Priority |
|---------|--------|----------|
| **Entry Options** | | |
| Prompt Input Field (Build) | ✅ Done | Critical |
| Clone URL Input | ✅ Done | Critical |
| "Import from GitHub" Button | 🟡 Partial | High |
| **GitHub Integration** | | |
| GitHub Connect | ✅ Done | High |
| "Export to GitHub" Button | ✅ Done | High |
| Create New Repo Modal | ✅ Done | High |
| Push to Existing Repo | ✅ Done | Medium |
| **Planning** | | |
| "Come up with 3 UIs" Button | 🔴 Not Started | Medium |
| "Move to Pipeline" Button | ✅ Done | Critical |
| Plan Edit Mode | ✅ Done | High |
| **Build Execution** | | |
| "Auto-Build" Button | ✅ Done | Critical |
| Pause/Resume Buttons | ✅ Done | Critical |
| "Manual Build" Toggle | ✅ Done | High |
| **Views & Navigation** | | |
| View Toggle (Kanban/Preview) | ✅ Done | Critical |
| Split View Option | 🔴 Not Started | Low |
| **Guardrails** | | |
| Warning Modals (backward movement) | ✅ Done | High |
| Drag-Drop Restrictions | ✅ Done | High |
| **Auth & Multi-Tenant** | | |
| Login Button | ✅ Done | Critical |
| User Menu | ✅ Done | Critical |
| Project Dashboard | ✅ Done | High |

---

## Deployment Checklist

### Environment Variables Required
```env
# Required Services
FIRECRAWL_API_KEY=...              # Website scraping

# AI Provider (at least one)
OPENAI_API_KEY=...                 # https://platform.openai.com

# Sandbox (Vercel)
VERCEL_TOKEN=...                   # Personal access token
VERCEL_TEAM_ID=team_xxxxxxxxx      # Your Vercel team ID
VERCEL_PROJECT_ID=prj_xxxxxxxxx    # Your Vercel project ID
SANDBOX_PROVIDER=vercel

# Authentication (optional - for user accounts)
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### Pre-Launch Commands
```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push
```

---

## Notes

- All ticket movements animate smoothly ✅
- Loading states show skeleton UI 🟡
- Error states provide clear recovery options ✅
- Mobile responsiveness is secondary for MVP
- Focus on desktop experience first
- Build continues when tickets require input (skips them) ✅
- Auth is optional - users can use app without signing in ✅

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-03 | Initial combined specification |
| 1.1.0 | 2026-01-03 | Added multi-tenant, security, MCP specs |
| 1.2.0 | 2026-01-03 | Updated with implementation progress - Auth, Dashboard, GitHub Export, Guardrails complete |
| 1.3.0 | 2026-01-03 | Production hardening - Security headers, input validation (Zod), middleware auth, build skips awaiting_input tickets |
