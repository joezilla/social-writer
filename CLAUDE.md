# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint

# Database (Postgres)
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate                    # Regenerate client after schema changes

# Scripts
npm run ingest -- --file <path> --source "blog"     # Ingest voice corpus from file
npm run ingest -- --dir <path> --source "newsletter" # Ingest voice corpus from directory
npm run scrape -- --login                            # LinkedIn scrape (first run, visible browser)
npm run scrape                                       # LinkedIn scrape (headless, saved session)
npm run scraper                                      # LinkedIn scrape on cron schedule
npm run seed-admin <email> <password>                # Create first admin user
```

## Architecture

Next.js 14 App Router + TypeScript + Tailwind CSS + PostgreSQL (Prisma) + Claude AI. Deployed on Vercel.

### Multi-Tenant Model

The app is multi-tenant. Every user has isolated data:
- **User** model with email/password auth (NextAuth.js v5, JWT sessions)
- Tenant-scoped models: Post, VoiceCorpusEntry, FollowerSnapshot, ScheduledPost, ResearchBrief, LinkedInToken — all have a `userId` FK
- PostVersion and PostAnalytics inherit access control through their Post relation
- **All API routes** call `requireAuth()` from `lib/auth-context.ts` and filter by `userId`
- Admin routes under `/api/admin/*` require `requireAdmin()`

### Auth Flow

- `auth.ts` (root) — NextAuth config with Credentials provider, JWT callbacks
- `middleware.ts` — Protects all routes, redirects unauth to `/login`, blocks non-admin from `/admin/*`
- `lib/auth-context.ts` — `requireAuth()` and `requireAdmin()` helpers for API routes
- Invite flow: admin creates invite → user visits `/invite?token=...` → sets password → logs in

### Settings: Global vs Per-User

- **AppSetting** (global, admin-only): API keys (ANTHROPIC, OPENAI, EXA), LinkedIn OAuth app config
- **UserSetting** (per-user): LINKEDIN_PROFILE_HANDLE, SCRAPER_CRON
- `lib/settings.ts` provides `getEffectiveSetting(userId, key)` cascade: UserSetting → AppSetting → env var

### Core Data Flow

Posts move through a Kanban pipeline: `IDEA → RESEARCHING → DRAFTING → REVIEW → SCHEDULED → PUBLISHED`. Each stage has AI-powered actions:

1. **Draft generation**: topic → `lib/voice-rag.ts` retrieves similar corpus entries via vector search (per-user) → Claude generates in the user's voice
2. **Research**: Claude generates search queries → `lib/exa.ts` runs semantic web search → Claude synthesizes a research brief
3. **Voice scoring**: Claude scores draft adherence to voice profile (0-100)
4. **Fact checking**: Claude verifies claims against research sources
5. **Publishing**: encrypted LinkedIn OAuth token retrieved (per-user) → LinkedIn Posts API

### Key Lib Modules

All lib singletons use `globalThis` caching to prevent duplicate instances in dev:

- **`lib/claude.ts`** — `generateText()` and `generateJSON<T>()` wrappers around Anthropic SDK. Model: `claude-sonnet-4-20250514`.
- **`lib/embeddings.ts`** — OpenAI embeddings via direct fetch (no SDK). Model: `text-embedding-3-small`, 1536 dims. Includes `cosineSimilarity()`.
- **`lib/vector-store.ts`** — Pure-JS in-memory vector search over `VoiceCorpusEntry` table per-user. 5-min globalThis cache. Embeddings stored as JSON-serialized `Bytes`.
- **`lib/encryption.ts`** — AES-256-GCM for LinkedIn token storage. Key derived from `LOCAL_ENCRYPTION_SECRET`.
- **`lib/linkedin.ts`** — OAuth 2.0 (OpenID Connect) + `/rest/posts` API with `LinkedIn-Version: 202402` header. All functions take `userId`.
- **`lib/exa.ts`** — Exa search with multi-query batch + URL deduplication.
- **`lib/auth-context.ts`** — `requireAuth()` returns `{userId, role, email}`, `requireAdmin()` enforces admin role.

### API Route Patterns

All routes live under `app/api/`. Post sub-actions use the pattern `/api/posts/[id]/<action>` (e.g., `generate-draft`, `voice-score`, `research`, `fact-check`, `publish`). Standard REST verbs for CRUD. Error responses always return `{error: string}` with appropriate status codes.

Every tenant-scoped route calls `requireAuth()` and filters by `userId`. Admin routes under `/api/admin/` call `requireAdmin()`.

The PATCH `/api/posts/[id]` route auto-creates a `PostVersion` when the body field changes.

### Component Structure

- **`components/pipeline/`** — KanbanBoard (uses `@hello-pangea/dnd`, loaded via `dynamic()` to avoid SSR issues), KanbanCard, NewIdeaModal
- **`components/editor/`** — PostEditor (auto-saves every 30s via dirty flag + interval), VoiceScorePanel, ResearchBriefPanel, FactCheckPanel
- **`components/analytics/`** — FollowerChart (pure SVG), PostImpactCard, MonthlyDigest
- **`components/settings/`** — LinkedInConnect (OAuth flow UI)
- **`components/user-nav.tsx`** — User email + sign out button

### Design System

HSL CSS variables defined in `app/globals.css`, consumed via `hsl(var(--token))` in `tailwind.config.ts`. Key tokens: `--background`, `--foreground`, `--card`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`. Interactive elements use `.focus-ring` utility class.

## Environment Variables

### Vercel (Production)

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Vercel Postgres (pooled) — auto-set when linking |
| `DIRECT_URL` | Vercel Postgres (direct) — auto-set when linking |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Anthropic dashboard |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `EXA_API_KEY` | Exa dashboard |
| `LINKEDIN_CLIENT_ID` | LinkedIn developer portal |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn developer portal |
| `LINKEDIN_REDIRECT_URI` | `https://<vercel-domain>/api/linkedin/callback` |
| `LOCAL_ENCRYPTION_SECRET` | Existing encryption key |
| `CRON_SECRET` | Auto-set by Vercel |

### Local Development

Required in `.env.local`: `DATABASE_URL` (postgres connection string), `DIRECT_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `EXA_API_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LOCAL_ENCRYPTION_SECRET`.

## Deployment

Vercel-native deployment. `vercel.json` configures build command and cron jobs.

### LinkedIn Scraper

The scraper (playwright-based) runs locally or on a VPS, not on Vercel. Point its `DATABASE_URL` at the Vercel Postgres instance. Scraper deps are in `devDependencies` to keep them out of the Vercel build.

## Path Alias

`@/*` maps to the project root (configured in `tsconfig.json`).
