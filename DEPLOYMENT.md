# Paynto A.I. - Production Deployment Guide

## Architecture Overview

**Paynto A.I.** is an AI-powered website builder with:
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **AI Providers**: OpenAI, Anthropic, Google Gemini, Groq (via Vercel AI SDK)
- **Sandboxes**: Vercel Sandbox (primary) or E2B (alternative)
- **Web Scraping**: Firecrawl (for cloning websites)
- **Auth**: NextAuth.js with GitHub OAuth
- **Database**: PostgreSQL via Prisma (optional for multi-user)

---

## Required API Keys & Services

### Tier 1: Essential (Must Have)

| Service | Purpose | Get Key |
|---------|---------|---------|
| **Sandbox Provider** (choose one) | | |
| └─ Vercel Sandbox | Code execution (recommended) | `vercel link` then `vercel env pull` |
| └─ E2B | Alternative sandbox | https://e2b.dev |
| **AI Provider** (need at least one) | | |
| └─ Vercel AI Gateway | Multi-model access | https://vercel.com/dashboard/ai-gateway |
| └─ OpenAI | GPT-4/GPT-5 | https://platform.openai.com |
| └─ Anthropic | Claude | https://console.anthropic.com |
| └─ Groq | Fast inference (Kimi K2) | https://console.groq.com |

### Tier 2: Feature Enhancements (Optional)

| Service | Purpose | Get Key |
|---------|---------|---------|
| Firecrawl | Website scraping/cloning | https://firecrawl.dev |
| GitHub OAuth | Save to GitHub repos | https://github.com/settings/developers |
| Morph | Fast code edits | https://morphllm.com |
| PostgreSQL | Multi-user persistence | Supabase/Neon/Railway |

---

## Deployment Options

### Option 1: Vercel (Recommended)

```bash
# 1. Fork/clone the repo
git clone https://github.com/your-org/paynto-ai
cd paynto-ai

# 2. Install dependencies
npm install

# 3. Link to Vercel
vercel link

# 4. Set environment variables in Vercel Dashboard
#    Or use vercel env pull for local dev

# 5. Deploy
vercel --prod
```

**Vercel Dashboard Settings:**
- Environment Variables: Add all keys from `.env.example`
- Functions: Increase timeout to 60s for AI generation
- Edge Config: Not required

### Option 2: Self-Hosted (Docker/VPS)

```bash
# 1. Clone and build
git clone https://github.com/your-org/paynto-ai
cd paynto-ai
npm install
npm run build

# 2. Create .env from .env.example
cp .env.example .env
# Edit .env with your keys

# 3. Start production server
npm start
# Runs on port 3000
```

**Nginx config example:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;  # For long AI generations
    }
}
```

### Option 3: Docker

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t paynto-ai .
docker run -p 3000:3000 --env-file .env paynto-ai
```

---

## Environment Variables

Create `.env` with:

```env
# SANDBOX - Choose ONE
SANDBOX_PROVIDER=vercel
VERCEL_OIDC_TOKEN=xxx  # From `vercel env pull`
# OR for production:
# VERCEL_TOKEN=xxx
# VERCEL_TEAM_ID=team_xxx
# VERCEL_PROJECT_ID=prj_xxx

# OR use E2B
# SANDBOX_PROVIDER=e2b
# E2B_API_KEY=xxx

# AI PROVIDERS - Need at least one
AI_GATEWAY_API_KEY=xxx         # Recommended: Access all models
# Or individual:
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GEMINI_API_KEY=xxx
GROQ_API_KEY=xxx

# OPTIONAL FEATURES
FIRECRAWL_API_KEY=xxx          # Website cloning
MORPH_API_KEY=xxx              # Fast edits

# AUTHENTICATION (Optional - for multi-user)
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=xxx            # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://your-domain.com
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

---

## Cost Estimates

| Service | Free Tier | Production Cost |
|---------|-----------|-----------------|
| Vercel Sandbox | Limited | ~$0.002/min |
| E2B | 100 hours/month | $0.16/hour |
| OpenAI GPT-4 | None | ~$0.03/1K tokens |
| Anthropic Claude | $5 credit | ~$0.015/1K tokens |
| Groq (Kimi K2) | Free tier | Free/generous |
| Firecrawl | 500 pages/month | $16/month+ |

**Estimated costs per user session:** $0.10-0.50 depending on AI usage

---

## Security Checklist

- [x] All AI API calls server-side only
- [x] Environment variables for secrets
- [x] Sandbox isolation (Vercel/E2B)
- [x] NextAuth session security
- [x] GitHub token storage in DB
- [x] Rate limiting utility
- [x] Zod input validation
- [x] Security headers configured
- [ ] CORS restrictions (partial)
- [ ] Prompt injection hardening (planned)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/generation/page.tsx` | Main UI for code generation |
| `app/api/generate-ai-code-stream/route.ts` | AI code generation endpoint |
| `app/api/apply-ai-code-stream/route.ts` | Write code to sandbox |
| `app/api/plan-build/route.ts` | AI build planning |
| `lib/sandbox/factory.ts` | Sandbox provider selection |
| `lib/sandbox/sandbox-manager.ts` | Sandbox pooling & lifecycle |
| `components/kanban/` | Kanban board system |
| `config/app.config.ts` | App configuration |

---

## Quick Start Checklist

1. [ ] **Clone repo** and run `npm install`
2. [ ] **Get Vercel Sandbox access**: `vercel link && vercel env pull`
3. [ ] **Add one AI key**: Start with Groq (free) or OpenAI
4. [ ] **Run locally**: `npm run dev`
5. [ ] **Test**: Visit http://localhost:3000/generation
6. [ ] **Deploy**: `vercel --prod`

---

## Scaling Considerations

- **Sandbox pooling**: Implemented in `sandbox-manager.ts` - reuses sandboxes
- **Keep-alive**: Auto-ping to prevent sandbox expiration
- **Auto-recovery**: Sandbox recreation on 410 expiration errors
- **Package caching**: Per-sandbox package installation cache
- **Model routing**: Use Groq for simple edits, Claude/GPT-4 for complex generation
- **Write-order optimization**: Leaf modules first for Vite HMR stability

---

## Troubleshooting

### Sandbox won't start
- Check `SANDBOX_PROVIDER` is set correctly
- Verify Vercel token/OIDC or E2B API key is valid
- Check Vercel dashboard for sandbox quota

### AI generation fails
- Verify at least one AI provider key is set
- Check API key has sufficient credits
- Review server logs for specific error messages

### Website scraping not working
- Ensure `FIRECRAWL_API_KEY` is set
- Check Firecrawl quota/credits
- Some sites may block scraping

### GitHub integration issues
- Verify OAuth callback URL matches your domain
- Check both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set

### Preview not updating
- TSX/TS entrypoints auto-patched (index.html & main.jsx)
- Missing imports get placeholder modules automatically
- Check browser console for Vite errors

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/create-ai-sandbox-v2` | POST | Create new sandbox |
| `/api/generate-ai-code-stream` | POST | Generate code with AI |
| `/api/apply-ai-code-stream` | POST | Apply code to sandbox |
| `/api/plan-build` | POST | Generate build plan |
| `/api/install-packages` | POST | Install npm packages |
| `/api/scrape-website` | POST | Scrape URL with Firecrawl |
| `/api/github/repos` | GET/POST | List/create repos |
| `/api/github/commit` | POST | Commit files to repo |
| `/api/projects` | GET/POST | Project CRUD |
| `/api/auth/[...nextauth]` | * | Authentication |

---

## Implementation Status

See `MVP_UX_IMPLEMENTATION_PLAN.md` for full feature status and roadmap.

**Current Status:**
- ✅ Core build system complete
- ✅ Kanban workflow complete
- ✅ GitHub export complete
- ✅ Auth system complete
- 🔴 Auto-deploy pipeline (planned)
- 🔴 Background Git sync (planned)
- 🔴 PR review agents (planned)

---

## Support

- GitHub Issues: Report bugs and feature requests
- Discussions: Ask questions and share ideas
