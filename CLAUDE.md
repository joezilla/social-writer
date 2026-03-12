# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build (Next.js standalone output)
npm run start        # Start production server
npm run lint         # ESLint

# Database
DATABASE_URL="file:./data/app.db" npx prisma migrate dev --name <name>   # Create migration
npx prisma generate                                                       # Regenerate client after schema changes

# Scripts
npm run ingest -- --file <path> --source "blog"     # Ingest voice corpus from file
npm run ingest -- --dir <path> --source "newsletter" # Ingest voice corpus from directory
npm run scrape -- --login                            # LinkedIn scrape (first run, visible browser)
npm run scrape                                       # LinkedIn scrape (headless, saved session)
npm run scraper                                      # LinkedIn scrape on cron schedule

# Docker
docker compose up -d --build    # Build and run
```

## Architecture

Next.js 14 App Router + TypeScript + Tailwind CSS + SQLite (Prisma) + Claude AI.

### Core Data Flow

Posts move through a Kanban pipeline: `IDEA → RESEARCHING → DRAFTING → REVIEW → SCHEDULED → PUBLISHED`. Each stage has AI-powered actions:

1. **Draft generation**: topic → `lib/voice-rag.ts` retrieves similar corpus entries via vector search → Claude generates in the user's voice
2. **Research**: Claude generates search queries → `lib/exa.ts` runs semantic web search → Claude synthesizes a research brief
3. **Voice scoring**: Claude scores draft adherence to voice profile (0-100)
4. **Fact checking**: Claude verifies claims against research sources
5. **Publishing**: encrypted LinkedIn OAuth token retrieved → LinkedIn Posts API

### Key Lib Modules

All lib singletons use `globalThis` caching to prevent duplicate instances in dev:

- **`lib/claude.ts`** — `generateText()` and `generateJSON<T>()` wrappers around Anthropic SDK. Model: `claude-sonnet-4-20250514`.
- **`lib/embeddings.ts`** — OpenAI embeddings via direct fetch (no SDK). Model: `text-embedding-3-small`, 1536 dims. Includes `cosineSimilarity()`.
- **`lib/vector-store.ts`** — Pure-JS in-memory vector search over `VoiceCorpusEntry` table. Embeddings stored as JSON-serialized `Bytes`.
- **`lib/encryption.ts`** — AES-256-GCM for LinkedIn token storage. Key derived from `LOCAL_ENCRYPTION_SECRET`.
- **`lib/linkedin.ts`** — OAuth 2.0 (OpenID Connect) + `/rest/posts` API with `LinkedIn-Version: 202402` header.
- **`lib/exa.ts`** — Exa search with multi-query batch + URL deduplication.

### API Route Patterns

All routes live under `app/api/`. Post sub-actions use the pattern `/api/posts/[id]/<action>` (e.g., `generate-draft`, `voice-score`, `research`, `fact-check`, `publish`). Standard REST verbs for CRUD. Error responses always return `{error: string}` with appropriate status codes.

The PATCH `/api/posts/[id]` route auto-creates a `PostVersion` when the body field changes.

### Component Structure

- **`components/pipeline/`** — KanbanBoard (uses `@hello-pangea/dnd`, loaded via `dynamic()` to avoid SSR issues), KanbanCard, NewIdeaModal
- **`components/editor/`** — PostEditor (auto-saves every 30s via dirty flag + interval), VoiceScorePanel, ResearchBriefPanel, FactCheckPanel
- **`components/analytics/`** — FollowerChart (pure SVG), PostImpactCard, MonthlyDigest
- **`components/settings/`** — LinkedInConnect (OAuth flow UI)

### Design System

HSL CSS variables defined in `app/globals.css`, consumed via `hsl(var(--token))` in `tailwind.config.ts`. Key tokens: `--background`, `--foreground`, `--card`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`. Interactive elements use `.focus-ring` utility class.

## Environment Variables

Required in `.env.local`: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `EXA_API_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LOCAL_ENCRYPTION_SECRET`, `LINKEDIN_PROFILE_HANDLE`.

## Path Alias

`@/*` maps to the project root (configured in `tsconfig.json`).
