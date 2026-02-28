# Social Writer

A local-first LinkedIn Content Intelligence Platform. Create, refine, and publish LinkedIn posts with AI-powered voice calibration, research synthesis, fact checking, and analytics.

## Architecture

```
Next.js 14 (App Router) + TypeScript + Tailwind CSS
SQLite via Prisma ORM
Claude (Anthropic) for AI writing, scoring, research synthesis, fact checking
OpenAI text-embedding-3-small for vector embeddings
Exa API for semantic web search
LinkedIn OAuth 2.0 + Posts API for publishing
Playwright for LinkedIn profile scraping
```

### Data Flow

```
Voice Corpus (ingested writing samples)
  └─ embed via OpenAI ─→ VoiceCorpusEntry (Bytes field, JSON-serialized vectors)

Post Creation (Kanban board)
  ├─ Generate Draft ─→ Voice RAG retrieval ─→ Claude generates in your voice
  ├─ Voice Score ─→ Claude evaluates adherence to your style (0-100)
  ├─ Research Brief ─→ Claude generates queries ─→ Exa search ─→ Claude synthesizes
  ├─ Fact Check ─→ Claude verifies claims against research sources
  └─ Publish ─→ LinkedIn Posts API (OAuth 2.0)

Analytics
  ├─ Playwright scrapes follower count + post engagement daily
  ├─ FollowerSnapshot + PostAnalytics time-series in SQLite
  └─ Monthly Digest ─→ Claude generates performance analysis
```

## Setup

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Database
DATABASE_URL="file:./data/app.db"

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Research
EXA_API_KEY=...

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/callback

# Encryption (any string, used to derive AES-256 key for token storage)
LOCAL_ENCRYPTION_SECRET=your-32-char-secret-here

# Scraper
LINKEDIN_PROFILE_HANDLE=your-linkedin-username
```

### Database

```bash
DATABASE_URL="file:./data/app.db" npx prisma migrate dev --name init
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `next lint` | Run ESLint |
| `ingest` | `tsx scripts/ingest-corpus.ts` | Ingest voice training data |
| `scrape` | `tsx scripts/scrape-linkedin.ts` | One-shot LinkedIn scrape |
| `scraper` | `tsx scripts/scrape-linkedin.ts --cron` | LinkedIn scraper on schedule |

## Project Structure

```
social-writer/
├── app/
│   ├── layout.tsx                          Root layout (nav, fonts)
│   ├── page.tsx                            Home: Kanban pipeline board
│   ├── globals.css                         Design system (HSL CSS variables)
│   ├── settings/page.tsx                   Settings: LinkedIn connection
│   ├── analytics/page.tsx                  Analytics: follower chart, post impact
│   ├── posts/[id]/
│   │   ├── page.tsx                        Post editor page
│   │   └── research/page.tsx               Full research brief view
│   └── api/
│       ├── posts/
│       │   ├── route.ts                    POST create, GET list
│       │   └── [id]/
│       │       ├── route.ts                GET, PATCH, DELETE single post
│       │       ├── publish/route.ts        POST publish to LinkedIn
│       │       ├── generate-draft/route.ts POST AI draft generation
│       │       ├── voice-score/route.ts    POST voice adherence scoring
│       │       ├── research/route.ts       POST/GET research brief
│       │       └── fact-check/route.ts     POST fact-check claims
│       ├── linkedin/
│       │   ├── auth/route.ts               POST initiate OAuth
│       │   ├── callback/route.ts           GET OAuth callback
│       │   └── status/route.ts             GET connection status
│       ├── corpus/
│       │   ├── ingest/route.ts             POST ingest voice samples
│       │   └── stats/route.ts              GET corpus statistics
│       └── analytics/
│           ├── overview/route.ts           GET dashboard stats
│           ├── posts/[id]/impact/route.ts  GET per-post impact metrics
│           └── monthly-digest/route.ts     GET AI monthly performance digest
├── components/
│   ├── pipeline/
│   │   ├── KanbanBoard.tsx                 Drag-and-drop pipeline board
│   │   ├── KanbanCard.tsx                  Post card in Kanban column
│   │   └── NewIdeaModal.tsx                Modal to create new post ideas
│   ├── editor/
│   │   ├── PostEditor.tsx                  Main editor: title, body, markdown preview, auto-save
│   │   ├── VoiceScorePanel.tsx             Voice adherence score display
│   │   ├── ResearchBriefPanel.tsx          Collapsible research brief sidebar
│   │   └── FactCheckPanel.tsx              Fact-check results with verdict badges
│   ├── settings/
│   │   └── LinkedInConnect.tsx             LinkedIn OAuth connect/disconnect
│   └── analytics/
│       ├── FollowerChart.tsx               SVG line chart with post markers
│       ├── PostImpactCard.tsx              Per-post engagement metrics card
│       └── MonthlyDigest.tsx               AI-generated monthly digest
├── lib/
│   ├── db.ts                               Prisma client singleton
│   ├── encryption.ts                       AES-256-GCM encrypt/decrypt
│   ├── linkedin.ts                         OAuth + Posts API integration
│   ├── claude.ts                           Anthropic client + generateText/generateJSON
│   ├── embeddings.ts                       OpenAI embeddings + cosine similarity
│   ├── vector-store.ts                     Corpus insert, similarity search, stats
│   ├── voice-rag.ts                        Build voice context from corpus
│   └── exa.ts                              Exa semantic web search
├── scripts/
│   ├── ingest-corpus.ts                    CLI: batch ingest voice training data
│   └── scrape-linkedin.ts                  Playwright LinkedIn scraper + cron
├── prisma/
│   └── schema.prisma                       Database schema (8 models)
├── data/                                   SQLite database + scraper session (gitignored)
└── .env.local                              API keys and secrets (gitignored)
```

## Database Schema

8 models in SQLite via Prisma:

| Model | Purpose |
|-------|---------|
| **Post** | Content pieces. Fields: title, body, status, topicTags, voiceScore, linkedinPostId, publishedAt. Relations: versions, analytics, researchBrief. |
| **PostVersion** | Version history. Created automatically when post body changes via PATCH. Cascade-deletes with post. |
| **ResearchBrief** | Research synthesis. Fields: topic, summary, keyClaims (JSON), sources (JSON). Linked to posts (1:N). |
| **PostAnalytics** | Engagement snapshots per post. Fields: impressions, reactions, comments, shares, followerCount. |
| **FollowerSnapshot** | Daily follower count time-series. Source defaults to "playwright". |
| **VoiceCorpusEntry** | Training data for voice matching. Fields: source, content, embedding (Bytes, JSON-serialized float vector). |
| **LinkedInToken** | Encrypted OAuth token. Fields: accessToken (ciphertext), tokenIv, tokenTag, personUrn, displayName, expiresAt. |
| **ScheduledPost** | Placeholder for future scheduled publishing. |

### Post Status Flow

```
IDEA → RESEARCHING → DRAFTING → REVIEW → SCHEDULED → PUBLISHED
```

Statuses are changed by dragging cards on the Kanban board or via the editor status dropdown. Publishing to LinkedIn automatically sets status to PUBLISHED.

## Library Modules

### `lib/claude.ts`

Anthropic Claude client singleton. Model: `claude-sonnet-4-20250514`.

- `generateText(systemPrompt, userPrompt, maxTokens?)` — Returns plain text response
- `generateJSON<T>(systemPrompt, userPrompt, maxTokens?)` — Returns parsed JSON (strips code fences)

### `lib/embeddings.ts`

OpenAI embeddings via direct fetch (no SDK). Model: `text-embedding-3-small`, 1536 dimensions.

- `embed(texts[])` — Batch embed, returns `number[][]`
- `embedSingle(text)` — Single text embedding
- `cosineSimilarity(a, b)` — Cosine distance between two vectors

### `lib/vector-store.ts`

Pure-JS vector search (no native extensions). Loads all embeddings into memory for similarity computation.

- `insertCorpusEntries(entries[])` — Embed and store in batches of 100
- `querySimilarContent(query, topK=5)` — Semantic search, returns entries with similarity scores
- `getCorpusStats()` — Total entries, embedding count, source breakdown

### `lib/voice-rag.ts`

- `buildVoiceContext(topic)` — Returns top-5 similar corpus entries joined as context string

### `lib/encryption.ts`

AES-256-GCM using Node.js `crypto`. Key derived from `LOCAL_ENCRYPTION_SECRET` env var.

- `encrypt(plaintext)` — Returns `{ciphertext, iv, tag}` (all hex strings)
- `decrypt(ciphertext, iv, tag)` — Returns plaintext

### `lib/linkedin.ts`

LinkedIn OAuth 2.0 (OpenID Connect) and Posts API.

- Scopes: `openid`, `profile`, `w_member_social`
- Uses `/v2/userinfo` endpoint for person URN (replaces deprecated `/v2/me`)
- Uses `/rest/posts` endpoint with `LinkedIn-Version: 202402` header (replaces deprecated `/v2/ugcPosts`)
- `getAuthorizationUrl(state)` — Builds OAuth URL
- `exchangeCodeForToken(code)` — Exchanges code, fetches userinfo, encrypts and stores token
- `getStoredToken()` — Retrieves and decrypts stored token
- `disconnectLinkedIn()` — Deletes stored token
- `publishPost(accessToken, personUrn, text)` — Publishes to LinkedIn feed

### `lib/exa.ts`

Exa semantic web search for research.

- `searchExa(query, numResults=5)` — Single query, returns `ExaResult[]`
- `searchMultipleQueries(queries[], numResultsPerQuery=3)` — Batch search with URL deduplication

## API Reference

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/posts` | List all posts (ordered by updatedAt DESC) |
| `POST` | `/api/posts` | Create post. Body: `{title, topicTags?}` |
| `GET` | `/api/posts/[id]` | Get post with latest 5 versions |
| `PATCH` | `/api/posts/[id]` | Update post. Body: `{title?, body?, status?, topicTags?, voiceScore?}`. Creates PostVersion when body changes. |
| `DELETE` | `/api/posts/[id]` | Delete post |
| `POST` | `/api/posts/[id]/publish` | Publish to LinkedIn. Validates token + body. Sets status=PUBLISHED. |
| `POST` | `/api/posts/[id]/generate-draft` | AI draft generation. Body: `{targetLength?, angle?}`. Uses voice RAG + research brief. |
| `POST` | `/api/posts/[id]/voice-score` | Score draft (0-100). Returns `{score, flaggedPhrases, reasoning}`. |
| `POST` | `/api/posts/[id]/research` | Generate research brief. Multi-step: Claude queries → Exa search → Claude synthesis. |
| `GET` | `/api/posts/[id]/research` | Get existing research brief |
| `POST` | `/api/posts/[id]/fact-check` | Fact-check claims. Returns `{claims: [{text, verdict, source?, suggestion?}]}` |

### LinkedIn

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/linkedin/auth` | Initiate OAuth. Returns `{url}`. Stores state in httpOnly cookie. |
| `GET` | `/api/linkedin/callback` | OAuth callback. Exchanges code, stores encrypted token, redirects to /settings. |
| `GET` | `/api/linkedin/status` | Connection status. Returns `{connected, expired?, displayName?, expiresAt?}` |

### Corpus

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/corpus/ingest` | Ingest voice samples. Body: `{content?, url?, source, title?}`. Chunks by 500 words. |
| `GET` | `/api/corpus/stats` | Corpus statistics: total, withEmbeddings, sourceBreakdown, lastUpdated |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/overview` | Dashboard stats: followers, snapshots, published count, chart data |
| `GET` | `/api/analytics/posts/[id]/impact` | Per-post impact: 7d/30d follower deltas, engagement metrics |
| `GET` | `/api/analytics/monthly-digest` | AI-generated 30-day performance digest (markdown) |

## Scripts

### Voice Corpus Ingestion

```bash
# Ingest a single file
npm run ingest -- --file ~/writing/article.md --source "blog"

# Ingest from URL
npm run ingest -- --url https://example.com/my-post --source "linkedin"

# Ingest all files in a directory
npm run ingest -- --dir ~/writing/ --source "newsletter"
```

Chunks text into 500-word segments with 50-word overlap, embeds via OpenAI, stores in SQLite.

### LinkedIn Scraper

```bash
# First run: opens visible browser for manual LinkedIn login
npm run scrape -- --login

# Subsequent runs: headless scrape using saved session
npm run scrape

# Scheduled scraping (default: 8am daily)
npm run scraper
```

Scrapes follower count from your profile and engagement metrics (reactions, comments, shares) for posts published within the last 45 days. Stores data in FollowerSnapshot and PostAnalytics tables. Session cookies are saved to `data/linkedin-session.json`.

## Design System

The UI uses an HSL CSS variable design system defined in `app/globals.css`:

| Token | Purpose |
|-------|---------|
| `--background` | Page background |
| `--foreground` | Primary text |
| `--card` / `--card-foreground` | Card surfaces |
| `--muted` / `--muted-foreground` | Subdued surfaces and secondary text |
| `--border` | Border color |
| `--ring` | Focus ring color |
| `--accent` / `--accent-foreground` | Interactive elements (buttons, links) |
| `--destructive` | Error/delete states |
| `--success` | Success states |
| `--warning` | Warning states |

Tailwind is configured to consume these tokens via `hsl(var(--token))` in `tailwind.config.ts`. All interactive elements use the `.focus-ring` utility class for consistent `focus-visible` states. Numbers use `.tabular-nums` for alignment.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.35 | Web framework (App Router) |
| `react` / `react-dom` | ^18 | UI library |
| `@prisma/client` / `prisma` | ^5.22.0 | ORM (SQLite) |
| `@anthropic-ai/sdk` | ^0.78.0 | Claude API |
| `@hello-pangea/dnd` | ^18.0.1 | Kanban drag-and-drop |
| `react-markdown` | ^10.1.0 | Markdown preview |
| `playwright` | ^1.58.2 | LinkedIn browser scraping |
| `node-cron` | ^4.2.1 | Scheduled scraping |
| `node-notifier` | ^10.0.1 | Desktop notifications for scraper |
| `tailwindcss` | ^3.4.1 | Utility-first CSS |
| `tsx` | ^4.21.0 | TypeScript script runner |
