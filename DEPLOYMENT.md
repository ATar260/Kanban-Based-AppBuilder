# Open Lovable - Production Deployment Guide

## Architecture Overview

**Open Lovable** is a Lovable/Bolt-style AI app builder built with:
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **AI Providers**: OpenAI, Anthropic, Google Gemini, Groq (via Vercel AI SDK)
- **Sandboxes**: Vercel Sandbox or E2B (cloud code execution environments)
- **Web Scraping**: Firecrawl (for cloning websites)
- **Version Control**: GitHub OAuth integration (optional)

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
| └─ OpenAI | GPT-4 | https://platform.openai.com |
| └─ Anthropic | Claude | https://console.anthropic.com |
| └─ Groq | Fast inference (Kimi K2) | https://console.groq.com |

### Tier 2: Feature Enhancements (Optional)

| Service | Purpose | Get Key |
|---------|---------|---------|
| Firecrawl | Website scraping/cloning | https://firecrawl.dev |
| GitHub OAuth | Save to GitHub repos | https://github.com/settings/developers |
| Morph | Fast code edits | https://morphllm.com |

---

## Deployment Options

### Option 1: Vercel (Recommended)

```bash
# 1. Fork/clone the repo
git clone https://github.com/your-org/open-lovable
cd open-lovable

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
git clone https://github.com/your-org/open-lovable
cd open-lovable
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
docker build -t open-lovable .
docker run -p 3000:3000 --env-file .env open-lovable
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
GITHUB_CLIENT_ID=xxx           # GitHub integration
GITHUB_CLIENT_SECRET=xxx
NEXT_PUBLIC_GITHUB_CLIENT_ID=xxx
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

- [ ] Never expose API keys in frontend code
- [ ] All keys should be server-side only (no `NEXT_PUBLIC_` prefix except GitHub Client ID)
- [ ] Enable CORS restrictions in production
- [ ] Rate limit API endpoints
- [ ] Sandbox code runs in isolated environments (Vercel/E2B handle this)
- [ ] GitHub OAuth uses state parameter validation (implemented)

---

## Key Files to Understand

| File | Purpose |
|------|---------|
| `app/generation/page.tsx` | Main UI for code generation |
| `app/api/generate-ai-code-stream/route.ts` | AI code generation endpoint |
| `app/api/apply-ai-code-stream/route.ts` | Write code to sandbox |
| `lib/sandbox/factory.ts` | Sandbox provider selection |
| `lib/sandbox/providers/vercel-provider.ts` | Vercel Sandbox implementation |
| `lib/sandbox/providers/e2b-provider.ts` | E2B Sandbox implementation |
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

- **Sandbox pooling**: Already implemented in `sandbox-manager.ts` - reuses sandboxes
- **Pre-warming**: Sandboxes can be pre-warmed for faster UX (automatic)
- **Model routing**: Use Groq for simple edits, Claude/GPT-4 for complex generation
- **Caching**: Package installation cache per sandbox session (automatic)

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
- Ensure `NEXT_PUBLIC_GITHUB_CLIENT_ID` matches `GITHUB_CLIENT_ID`

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/create-ai-sandbox` | POST | Create new sandbox |
| `/api/generate-ai-code-stream` | POST | Generate code with AI |
| `/api/apply-ai-code-stream` | POST | Apply code to sandbox |
| `/api/install-packages` | POST | Install npm packages |
| `/api/scrape-website` | POST | Scrape URL with Firecrawl |
| `/api/github/auth` | GET | GitHub OAuth callback |
| `/api/github/repos` | GET/POST | List/create repos |
| `/api/github/commit` | POST | Commit files to repo |

---

## Support

- GitHub Issues: Report bugs and feature requests
- Discussions: Ask questions and share ideas
