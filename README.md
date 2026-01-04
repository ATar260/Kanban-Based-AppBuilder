# Paynto A.I. - Open Source AI App Builder

Build production-ready React applications with AI. Clone websites, generate from prompts, and export to GitHub.

## Features

- **AI Code Generation** - Multi-provider support (OpenAI, Anthropic, Google, Groq)
- **Live Preview** - Real-time sandbox with Vite + React + Tailwind
- **Website Cloning** - Scrape and recreate any website
- **GitHub Integration** - OAuth login, export to repos
- **Project Dashboard** - Save, manage, and resume projects (requires login)
- **Kanban Planning** - AI-generated build plans with tickets

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/firecrawl/open-lovable.git
cd open-lovable
pnpm install  # or npm install / yarn install
```

### 2. Database Setup (Optional - required for user accounts)

```bash
# Create PostgreSQL database, then:
npx prisma generate
npx prisma db push
```

### 3. Configure Environment

Create `.env.local`:

```env
# =================================================================
# REQUIRED SERVICES
# =================================================================
FIRECRAWL_API_KEY=your_firecrawl_api_key    # https://firecrawl.dev

# =================================================================
# AI PROVIDER - At least one required
# =================================================================
OPENAI_API_KEY=your_openai_api_key        # https://platform.openai.com
ANTHROPIC_API_KEY=your_anthropic_api_key  # https://console.anthropic.com
GEMINI_API_KEY=your_gemini_api_key        # https://aistudio.google.com/app/apikey
GROQ_API_KEY=your_groq_api_key            # https://console.groq.com

# =================================================================
# SANDBOX PROVIDER - Choose ONE: Vercel (default) or E2B
# =================================================================
SANDBOX_PROVIDER=vercel  # or 'e2b'

# Vercel Sandbox (production)
VERCEL_TOKEN=vercel_xxxxxxxxxxxx          # Personal access token
VERCEL_TEAM_ID=team_xxxxxxxxx             # Your Vercel team ID
VERCEL_PROJECT_ID=prj_xxxxxxxxx           # Your Vercel project ID

# E2B Sandbox (alternative)
# E2B_API_KEY=your_e2b_api_key            # https://e2b.dev

# =================================================================
# AUTHENTICATION (Optional - for user accounts & dashboard)
# =================================================================
DATABASE_URL=postgresql://user:password@localhost:5432/timbs_ai
NEXTAUTH_SECRET=your_secret_here          # Generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# GitHub OAuth - Create app at https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# =================================================================
# FAST APPLY (Optional - for faster code edits)
# =================================================================
MORPH_API_KEY=your_morphllm_api_key       # https://morphllm.com/dashboard
```

### 4. Run

```bash
pnpm dev  # or npm run dev / yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables (see below)
4. Add Vercel Postgres database (or use external PostgreSQL)
5. Run `npx prisma db push` after first deploy
6. Deploy

### Environment Variables Checklist

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_API_KEY` | Yes | Website scraping |
| `OPENAI_API_KEY` | Yes (or other AI) | AI generation |
| `VERCEL_TOKEN` | Yes | Sandbox creation |
| `VERCEL_TEAM_ID` | Yes | Sandbox creation |
| `VERCEL_PROJECT_ID` | Yes | Sandbox creation |
| `DATABASE_URL` | For auth | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | For auth | Session encryption key |
| `NEXTAUTH_URL` | For auth | Your app URL (e.g., https://your-app.vercel.app) |
| `GITHUB_CLIENT_ID` | For auth | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | For auth | GitHub OAuth secret |

### GitHub OAuth Setup

1. Go to https://github.com/settings/developers
2. Create new OAuth App
3. Set Homepage URL to your app URL
4. Set Authorization callback URL to `https://your-app.vercel.app/api/auth/callback/github`
5. Copy Client ID and Client Secret to env vars

## Architecture

```
app/
  api/              # API routes
  dashboard/        # Project management (auth required)
  generation/       # AI builder interface (public)
  login/            # Authentication
components/
  auth/             # Login components
  kanban/           # Build planning
  versioning/       # GitHub export
lib/
  auth.ts           # NextAuth config
  prisma.ts         # Database client
  sandbox/          # Sandbox providers
prisma/
  schema.prisma     # Database schema
```

## License

MIT
