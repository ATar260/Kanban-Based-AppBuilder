# Timbs A.I. - MVP UX Implementation Plan

## Overview
This document is the comprehensive implementation plan for the "Overnight" MVP UI/UX workflows for the Timbs A.I. platform. It combines task tracking, technical specifications, and MCP (Model Context Protocol) integration details.

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
- [ ] **Option A (Build from Prompt):** 
  - Natural language prompt input
  - Template suggestions (Landing Page, Dashboard, E-commerce, etc.)
  - "Start Building" button → Creates plan
- [ ] **Option B (Clone from URL):**
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
**Status:** 🟡 Partially Complete  
**Priority:** High  
**Estimated Effort:** M

**Current State:** GitHub connection exists, basic save functionality

**Tasks:**
- [ ] "Export to GitHub" button in header
- [ ] Create new repository modal
  - Repository name input
  - Public/Private toggle
  - Description (optional)
- [ ] Push to existing repository option
  - Select from connected repos
  - Branch selection/creation
  - Commit message input
- [ ] Automatic commit after each ticket completion (optional toggle)
- [ ] View repository link after export
- [ ] Push status indicator

**Files to Create/Modify:**
- `components/versioning/ExportToGitHub.tsx` (new)
- `components/versioning/CreateRepoModal.tsx` (new)
- `app/api/github/create-repo/route.ts` (new)
- `app/api/github/push-code/route.ts` (new)
- `lib/versioning/github.ts` (enhance)

---

## Phase 2: The Planning Interface

### 2.1 Auto-Planning System
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** M

**Current State:** `/api/plan-build` exists and creates tickets

**Tasks:**
- [ ] Enhance plan display with clear structure
- [ ] Show estimated time for each task
- [ ] Display dependencies visually
- [ ] Add plan summary header with totals

**Files to Modify:**
- `components/kanban/PlanView.tsx` (new)
- `app/api/plan-build/route.ts` (enhance)

---

### 2.2 Plan Refinement UI
**Status:** 🔴 Not Started  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [ ] Enable inline editing of ticket titles/descriptions
- [ ] Add "Add Step" button to insert new tickets
- [ ] Add "Remove Step" with dependency check
- [ ] Reorder tickets with drag-and-drop
- [ ] Show dependency warnings when editing

**Files to Create/Modify:**
- `components/kanban/TicketEditor.tsx` (enhance)
- `components/planning/PlanEditor.tsx` (new)

---

### 2.3 "Move to Pipeline" Transition
**Status:** 🔴 Not Started  
**Priority:** Critical  
**Estimated Effort:** S

**Tasks:**
- [ ] Add prominent "Move to Pipeline" button
- [ ] Create transition animation from Plan → Kanban
- [ ] Lock plan after commit (read-only unless explicitly unlocked)
- [ ] Store finalized plan state

**Files to Create/Modify:**
- `components/planning/PipelineTransition.tsx` (new)
- `hooks/usePlanState.ts` (new)

---

## Phase 3: Execution Phase (Kanban Command Center)

### 3.1 View Mode Toggle
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** S

**Current State:** Code/View/Kanban tabs exist

**Tasks:**
- [ ] Rename tabs to "Kanban Board" and "App Preview"
- [ ] Make toggle more prominent
- [ ] Persist view preference
- [ ] Add split-view option (both views side-by-side)

**Files to Modify:**
- `app/generation/page.tsx`
- `components/kanban/KanbanBoard.tsx`

---

### 3.2 Auto-Build Mode
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** M

**Current State:** Build execution exists via `handleStartKanbanBuild`

**Tasks:**
- [ ] Add "Auto-Build" button (prominent, gradient style)
- [ ] Real-time ticket movement animation
- [ ] Progress indicators on each ticket
- [ ] "Pause" button to halt at any point
- [ ] Resume functionality after pause

**Files to Modify:**
- `components/kanban/KanbanBoard.tsx`
- `components/kanban/KanbanTicket.tsx`
- `hooks/useKanbanBoard.ts`

---

### 3.3 Manual Build Mode
**Status:** 🟡 Partially Complete  
**Priority:** High  
**Estimated Effort:** M

**Current State:** `buildMode` state exists

**Tasks:**
- [ ] Add Manual/Auto toggle switch
- [ ] "Build This" button on individual tickets
- [ ] Confirmation before building each ticket
- [ ] Skip/defer ticket options

**Files to Modify:**
- `components/kanban/KanbanBoard.tsx`
- `components/kanban/KanbanTicket.tsx`

---

### 3.4 Human-in-the-Loop (Stuck State) UI
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** L

**Current State:** `awaiting_input` status and `InputRequestModal` exist

**Tasks:**
- [ ] Dedicated "Feedback Required" column/section
- [ ] Visual highlighting of blocked tickets (pulsing border)
- [ ] Clear input requirements display
- [ ] One-click credential/API key input
- [ ] Resume ticket after input provided

**Files to Modify:**
- `components/kanban/KanbanBoard.tsx`
- `components/kanban/InputRequestModal.tsx`
- `components/kanban/KanbanColumn.tsx`

---

## Phase 4: Board Logic & Guardrails

### 4.1 Forward Movement Restrictions
**Status:** 🔴 Not Started  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [ ] Implement drag-drop validation rules
- [ ] Prevent ToDo → PR Review direct movement
- [ ] Show visual feedback on invalid drops
- [ ] Enforce sequential column progression

**Files to Create/Modify:**
- `components/kanban/DragDropGuards.tsx` (new)
- `hooks/useTicketMovement.ts` (new)
- `components/kanban/KanbanColumn.tsx`

---

### 4.2 Backward Regression (Undo Logic)
**Status:** 🔴 Not Started  
**Priority:** High  
**Estimated Effort:** L

**Tasks:**
- [ ] Detect backward ticket movement
- [ ] Warning modal: "Moving this back will remove the associated feature code. Proceed?"
- [ ] Soft-delete/comment out associated code on confirmation
- [ ] Auto-refactor trigger for stability
- [ ] Undo history tracking

**Files to Create/Modify:**
- `components/kanban/RegressionWarningModal.tsx` (new)
- `hooks/useCodeRegression.ts` (new)
- `app/api/rollback-feature/route.ts` (new)

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

**Files to Create/Modify:**
- `components/kanban/PRReviewColumn.tsx` (new)
- `app/api/review-code/route.ts` (new)
- `components/kanban/types.ts` (add new status)

---

## Phase 6: Multi-Tenant Architecture

### 6.1 User Authentication & Identity
**Status:** 🔴 Not Started  
**Priority:** Critical  
**Estimated Effort:** L

**Tasks:**
- [ ] Implement authentication (Clerk, Auth0, or Supabase Auth)
- [ ] User registration/login flows
- [ ] OAuth providers (Google, GitHub, Email)
- [ ] Session management
- [ ] Protected routes middleware
- [ ] User profile storage

**Files to Create/Modify:**
- `app/api/auth/[...nextauth]/route.ts` or Clerk setup
- `middleware.ts` (route protection)
- `lib/auth.ts` (auth utilities)
- `components/auth/LoginModal.tsx`
- `components/auth/UserMenu.tsx`

---

### 6.2 Data Isolation & Project Ownership
**Status:** 🔴 Not Started  
**Priority:** Critical  
**Estimated Effort:** L

**Tasks:**
- [ ] Database schema with `user_id` on all resources
- [ ] Projects table (id, user_id, name, created_at, etc.)
- [ ] Plans table linked to projects
- [ ] Tickets table linked to plans
- [ ] Sandbox sessions linked to projects
- [ ] Row-level security policies (if using Supabase)
- [ ] API route validation (user can only access own data)

**Database Schema:**
```sql
users (id, email, name, avatar_url, created_at)
projects (id, user_id, name, description, status, created_at, updated_at)
plans (id, project_id, prompt, tickets_json, status, created_at)
sandboxes (id, project_id, sandbox_id, url, created_at, expires_at)
github_connections (id, user_id, access_token, username, connected_at)
tickets (id, plan_id, title, description, type, status, order)
```

**Files to Create/Modify:**
- `lib/db/schema.ts` (Prisma or Drizzle schema)
- `lib/db/queries.ts` (data access layer)
- All API routes (add user context)

---

### 6.3 Project Management Dashboard
**Status:** 🔴 Not Started  
**Priority:** High  
**Estimated Effort:** M

**Tasks:**
- [ ] "My Projects" dashboard page
- [ ] Project cards with preview thumbnails
- [ ] Create new project flow
- [ ] Resume existing project
- [ ] Delete/archive project
- [ ] Project search and filters
- [ ] Recent projects quick access

**Files to Create/Modify:**
- `app/dashboard/page.tsx` (new)
- `components/dashboard/ProjectCard.tsx` (new)
- `components/dashboard/ProjectGrid.tsx` (new)
- `app/api/projects/route.ts` (new)

---

### 6.4 Usage Tracking & Limits
**Status:** 🔴 Not Started  
**Priority:** Medium  
**Estimated Effort:** M

**Tasks:**
- [ ] Track API calls per user (AI generations, sandbox time)
- [ ] Usage limits by tier (Free, Pro, Enterprise)
- [ ] Usage display in UI
- [ ] Limit enforcement on API routes
- [ ] Upgrade prompts when limits reached
- [ ] Usage reset on billing cycle

**Usage Limits by Tier:**
| Tier | AI Generations/day | Sandbox Hours | Storage |
|------|-------------------|---------------|---------|
| Free | 10 | 2 | 100MB |
| Pro | 100 | 24 | 5GB |
| Enterprise | Unlimited | Unlimited | Unlimited |

**Files to Create/Modify:**
- `lib/usage/tracking.ts` (new)
- `lib/usage/limits.ts` (new)
- `components/billing/UsageIndicator.tsx` (new)
- `app/api/usage/route.ts` (new)

---

### 6.5 Team Collaboration (Future)
**Status:** 🔴 Not Started  
**Priority:** Low (Post-MVP)  
**Estimated Effort:** XL

**Tasks:**
- [ ] Team/Organization model
- [ ] Invite team members
- [ ] Role-based permissions (Owner, Editor, Viewer)
- [ ] Shared projects within team
- [ ] Real-time collaboration (presence indicators)
- [ ] Activity feed / audit log

---

### 6.6 Sandbox Isolation
**Status:** 🟡 Partially Complete  
**Priority:** Critical  
**Estimated Effort:** S

**Current State:** Vercel sandbox provider exists

**Tasks:**
- [ ] Each user gets isolated sandbox instances
- [ ] Sandbox cleanup on session end
- [ ] Sandbox timeout/expiry handling
- [ ] Resource limits per sandbox
- [ ] Persistent sandbox option (paid feature)

**Files to Modify:**
- `lib/sandbox/factory.ts`
- `app/api/create-ai-sandbox-v2/route.ts`

---

# PART 3: TECHNICAL SPECIFICATIONS

## API Endpoints

### Planning
```
POST /api/plan-build
  Input: { prompt: string, context?: object }
  Output: SSE stream of tickets + plan

POST /api/generate-ui-options
  Input: { prompt: string }
  Output: { options: UIDesign[] }
```

### Execution
```
POST /api/generate-ai-code-stream
  Input: { prompt: string, model: string, context: object }
  Output: SSE stream of code chunks

POST /api/apply-code
  Input: { sandboxId: string, files: FileContent[] }
  Output: { success: boolean }
```

### GitHub
```
GET /api/github/repos
  Output: { repos: Repository[] }

POST /api/github/create-repo
  Input: { name: string, private: boolean }
  Output: { url: string }

POST /api/github/push
  Input: { repoId: string, files: FileContent[], message: string }
  Output: { commitUrl: string }
```

### Projects
```
GET /api/projects
  Output: { projects: Project[] }

POST /api/projects
  Input: { name: string, description?: string }
  Output: { project: Project }

DELETE /api/projects/:id
  Output: { success: boolean }
```

---

## UI Component Inventory

### Entry Components
- `EntryChoice.tsx` - 3-option selector
- `PromptInput.tsx` - Natural language input
- `CloneURLInput.tsx` - URL clone interface
- `GitHubImport.tsx` - Repo selector

### Planning Components
- `PlanView.tsx` - Plan display
- `PlanEditor.tsx` - Inline editing
- `TicketEditor.tsx` - Single ticket edit modal
- `UIOptionsSelector.tsx` - 3 UI design picker

### Execution Components
- `KanbanBoard.tsx` - Main board
- `KanbanColumn.tsx` - Column container
- `KanbanTicket.tsx` - Ticket card
- `InputRequestModal.tsx` - User input modal
- `BuildControls.tsx` - Auto/Manual/Pause buttons

### GitHub Components
- `GitHubConnectButton.tsx` - OAuth trigger
- `ExportToGitHub.tsx` - Export modal
- `RepoSelector.tsx` - Repository picker
- `CreateRepoModal.tsx` - New repo form

### Dashboard Components
- `ProjectGrid.tsx` - All projects
- `ProjectCard.tsx` - Single project
- `UsageIndicator.tsx` - Limits display

### Auth Components
- `LoginButton.tsx` - Login trigger
- `LoginModal.tsx` - Auth modal
- `UserMenu.tsx` - User dropdown

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

## 🔴 Critical Security Issues to Address

### 1. API Key Exposure
**Risk:** HIGH  
**Current Issue:** API keys (OpenAI, GitHub tokens) may be exposed in client-side code or logs

**Mitigations:**
- [ ] All AI API calls go through server-side routes only
- [ ] Never expose API keys in client bundle
- [ ] Use environment variables for all secrets
- [ ] Implement key rotation mechanism
- [ ] Audit logs for API key usage

---

### 2. Sandbox Code Execution
**Risk:** CRITICAL  
**Current Issue:** User-generated code runs in sandboxes - potential for malicious code

**Mitigations:**
- [ ] Sandboxes are fully isolated (Vercel/E2B handles this)
- [ ] No access to host system from sandbox
- [ ] Network restrictions on sandboxes (no outbound to internal services)
- [ ] Sandbox timeout limits (prevent crypto mining)
- [ ] Resource limits (CPU, memory, disk)
- [ ] Code scanning before execution (optional)

---

### 3. User Input Validation
**Risk:** HIGH  
**Current Issue:** Prompts and URLs are user-provided - injection risks

**Mitigations:**
- [ ] Sanitize all user inputs server-side
- [ ] URL validation before scraping
- [ ] Prompt injection protection (system prompt hardening)
- [ ] XSS prevention in rendered content
- [ ] SQL injection prevention (parameterized queries)

---

### 4. Authentication & Authorization
**Risk:** CRITICAL  
**Current Issue:** No user auth currently - all data is public/shared

**Mitigations:**
- [ ] Implement proper auth (Clerk/Auth0/Supabase)
- [ ] JWT token validation on all API routes
- [ ] CSRF protection
- [ ] Secure session management
- [ ] Password policies (if email/password auth)
- [ ] Rate limiting on auth endpoints

---

### 5. GitHub Token Security
**Risk:** HIGH  
**Current Issue:** GitHub OAuth tokens stored - sensitive access

**Mitigations:**
- [ ] Encrypt tokens at rest
- [ ] Minimal OAuth scopes (only what's needed)
- [ ] Token refresh mechanism
- [ ] Revoke tokens on user logout/disconnect
- [ ] Never log tokens
- [ ] Secure token storage (httpOnly cookies or encrypted DB)

---

### 6. Secrets in Generated Code
**Risk:** MEDIUM  
**Current Issue:** Users may input API keys for integrations (Stripe, etc.)

**Mitigations:**
- [ ] Store user secrets encrypted in DB, not in code
- [ ] Generate .env files with placeholders
- [ ] Never commit secrets to GitHub exports
- [ ] Warn users about secret exposure
- [ ] Auto-detect and mask secrets in logs

---

### 7. Rate Limiting & DDoS Protection
**Risk:** MEDIUM  
**Current Issue:** No rate limiting on expensive operations

**Mitigations:**
- [ ] Rate limit AI generation endpoints (per user, per IP)
- [ ] Rate limit sandbox creation
- [ ] Rate limit GitHub API calls
- [ ] Implement request queuing for heavy operations
- [ ] Use Vercel/Cloudflare DDoS protection

---

### 8. Data Privacy & GDPR
**Risk:** MEDIUM  
**Current Issue:** User data handling needs compliance

**Mitigations:**
- [ ] Privacy policy page
- [ ] Data deletion capability (right to be forgotten)
- [ ] Data export capability
- [ ] Cookie consent (if using analytics)
- [ ] Clear data retention policies
- [ ] Anonymize logs

---

## Security Checklist for Launch

| Item | Status | Priority |
|------|--------|----------|
| API keys server-side only | 🟡 Partial | Critical |
| Sandbox isolation verified | ✅ Done (Vercel) | Critical |
| User authentication | 🔴 Not Started | Critical |
| Input sanitization | 🟡 Partial | Critical |
| GitHub token encryption | 🔴 Not Started | High |
| Rate limiting | 🔴 Not Started | High |
| Secrets handling | 🔴 Not Started | High |
| HTTPS everywhere | ✅ Done (Vercel) | Critical |
| CORS configured | 🟡 Partial | Medium |
| Security headers | 🔴 Not Started | Medium |

---

# PART 5: IMPLEMENTATION SCHEDULE

## Sprint 1: Core Flow (Days 1-3)
1. ✅ Plan creation from prompt (DONE)
2. ✅ Kanban display with columns (DONE)
3. ✅ Start Build button (DONE)
4. Entry Choice screen refinement
5. View mode toggle cleanup

## Sprint 2: Build Execution (Days 4-6)
1. Auto-Build with real-time updates
2. Pause/Resume functionality
3. Manual Build mode toggle
4. Human-in-the-Loop improvements

## Sprint 3: Guardrails & Quality (Days 7-9)
1. Forward movement restrictions
2. Backward regression with warnings
3. PR Review column
4. Code rollback logic

## Sprint 4: Polish (Days 10-12)
1. GitHub import/export flow
2. "Come up with 3 UIs" feature
3. Animations and transitions
4. Error handling and edge cases

## Sprint 5: Multi-Tenant (Days 13-18)
1. User authentication
2. Data isolation
3. Project dashboard
4. Usage tracking

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
| "Export to GitHub" Button | 🔴 Not Started | High |
| Create New Repo Modal | 🔴 Not Started | High |
| Push to Existing Repo | 🔴 Not Started | Medium |
| **Planning** | | |
| "Come up with 3 UIs" Button | 🔴 Not Started | Medium |
| "Move to Pipeline" Button | 🔴 Not Started | Critical |
| Plan Edit Mode | 🔴 Not Started | High |
| **Build Execution** | | |
| "Auto-Build" Button | 🟡 Partial (Start Build) | Critical |
| Pause/Resume Buttons | ✅ Done | Critical |
| "Manual Build" Toggle | 🟡 Partial | High |
| **Views & Navigation** | | |
| View Toggle (Kanban/Preview) | ✅ Done | Critical |
| Split View Option | 🔴 Not Started | Low |
| **Guardrails** | | |
| Warning Modals (backward movement) | 🔴 Not Started | High |
| Drag-Drop Restrictions | 🔴 Not Started | High |
| **Auth & Multi-Tenant** | | |
| Login Button | 🟡 Partial | Critical |
| User Menu | 🟡 Partial | Critical |
| Project Dashboard | 🔴 Not Started | High |

---

## Notes

- All ticket movements should animate smoothly
- Loading states should show skeleton UI
- Error states should provide clear recovery options
- Mobile responsiveness is secondary for MVP
- Focus on desktop experience first
- **Security audit recommended before public launch**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-03 | Initial combined specification |
| 1.1.0 | 2026-01-03 | Added multi-tenant, security, MCP specs |
