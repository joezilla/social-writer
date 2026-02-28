# PRD: LinkedIn Content Intelligence Platform
**Version:** 1.0  
**Author:** Joe  
**Date:** February 2026  
**Build Target:** Claude Code (local-first, single user)

---

## Overview

A local-first, AI-powered desktop application that manages the full LinkedIn content lifecycle: trend discovery → research → writing (in the owner's voice) → fact-checking → publishing → impact tracking. Built for one highly demanding user. No cloud hosting, no auth system, no multi-tenancy.

---

## Goals

1. Enable publishing 2–3 substantive LinkedIn posts/week with no increase in time investment
2. Produce AI-assisted drafts that require fewer than 20% of sentences to be significantly rewritten
3. Complete research-to-draft cycle in under 45 minutes for a 600-word article
4. Track follower delta per published post to correlate content topics with audience growth

---

## Non-Goals

- Multi-user or team collaboration features
- Cloud deployment or hosted SaaS
- Mobile interface
- Support for platforms other than LinkedIn (for v1)
- Full LinkedIn API analytics integration (use scraping instead — see Technical Approach)

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Local dev server, `npm run dev` |
| Database | SQLite via Prisma ORM | Single `.db` file, zero ops |
| Vector store | `better-sqlite3` + `sqlite-vec` extension | RAG for voice corpus, no external service |
| AI | Anthropic Claude API | Writing, research synthesis, fact-check |
| Research | Exa API | Semantic web search for article research |
| LinkedIn publish | LinkedIn API v2 (OAuth 2.0) | Official, supported, text posts + articles |
| LinkedIn analytics | Playwright (headless Chromium) | Daily cron scrape of own profile data |
| Styling | Tailwind CSS | Utility-first, no component library needed |
| Runtime | Node.js 20+ | |

**Local environment setup:** All services run on localhost. The app is started with a single `npm run dev`. A `.env.local` file holds all API keys. Playwright runs on a separate cron process (`npm run scrape`).

---

## Data Models

```prisma
// schema.prisma

model Post {
  id              String    @id @default(cuid())
  title           String
  body            String    // full draft content
  status          Status    @default(IDEA)
  linkedinPostId  String?   // set after publish
  publishedAt     DateTime?
  topicTags       String    // comma-separated
  researchBriefId String?
  voiceScore      Float?    // 0–100, higher = closer to owner voice
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  researchBrief   ResearchBrief? @relation(fields: [researchBriefId], references: [id])
  analytics       PostAnalytics[]
  versions        PostVersion[]
}

enum Status {
  IDEA
  RESEARCHING
  DRAFTING
  REVIEW
  SCHEDULED
  PUBLISHED
}

model ResearchBrief {
  id          String   @id @default(cuid())
  topic       String
  summary     String
  keyClaims   String   // JSON array of { claim, source, url }
  sources     String   // JSON array of { title, url, excerpt }
  createdAt   DateTime @default(now())
  posts       Post[]
}

model PostVersion {
  id        String   @id @default(cuid())
  postId    String
  body      String
  note      String?
  createdAt DateTime @default(now())
  post      Post     @relation(fields: [postId], references: [id])
}

model PostAnalytics {
  id             String   @id @default(cuid())
  postId         String
  snapshotAt     DateTime @default(now())
  followerCount  Int
  impressions    Int?
  reactions      Int?
  comments       Int?
  shares         Int?
  post           Post     @relation(fields: [postId], references: [id])
}

model FollowerSnapshot {
  id            String   @id @default(cuid())
  capturedAt    DateTime @default(now())
  followerCount Int
  source        String   @default("playwright")
}

model VoiceCorpusEntry {
  id          String   @id @default(cuid())
  source      String   // "linkedin", "medium", "substack"
  title       String?
  content     String
  publishedAt DateTime?
  embedding   Bytes?   // stored vector
  createdAt   DateTime @default(now())
}

model ScheduledPost {
  id          String   @id @default(cuid())
  postId      String   @unique
  scheduledAt DateTime
  status      String   @default("pending") // pending, sent, failed
}
```

---

## Application Structure

```
/app
  /page.tsx                  # Dashboard / pipeline view (Kanban)
  /ideas/page.tsx            # Idea board
  /posts/[id]/page.tsx       # Post editor (full writing environment)
  /posts/[id]/research/page  # Research brief view
  /analytics/page.tsx        # Impact tracker
  /settings/page.tsx         # API keys, LinkedIn auth, scraper schedule

/components
  /pipeline/KanbanBoard.tsx
  /editor/DraftEditor.tsx
  /editor/VoiceScorePanel.tsx
  /editor/FactCheckPanel.tsx
  /research/ResearchBrief.tsx
  /analytics/FollowerChart.tsx
  /analytics/PostImpactCard.tsx

/lib
  /db.ts                     # Prisma client singleton
  /claude.ts                 # Claude API wrapper
  /exa.ts                    # Exa search wrapper
  /linkedin-publish.ts       # LinkedIn OAuth + post creation
  /voice-rag.ts              # RAG query against voice corpus
  /embeddings.ts             # Generate + store embeddings

/scripts
  /scrape-linkedin.ts        # Playwright scraper (run via cron)
  /ingest-corpus.ts          # One-time: load existing writing into vector store

/prisma
  /schema.prisma
```

---

## Module Specifications

### Module 1: Pipeline Dashboard (Home)

**Route:** `/`

**Purpose:** Kanban board showing all posts across status columns. Entry point for all actions.

**Columns:** IDEA → RESEARCHING → DRAFTING → REVIEW → SCHEDULED → PUBLISHED

**Each card shows:**
- Post title
- Topic tags
- Last updated timestamp
- Voice score (if draft exists)
- Quick actions: Open, Delete, Duplicate

**Actions from dashboard:**
- "New Idea" button → creates IDEA status post with just a title, drops it in IDEA column
- Drag cards between columns (optimistic update, persists to DB)
- Click card → opens Post Editor

**Data:** `GET /api/posts` — returns all posts ordered by updatedAt desc, grouped by status

---

### Module 2: Post Editor

**Route:** `/posts/[id]`

**Purpose:** The primary writing environment. Everything happens here.

**Layout:** Two-column. Left = editor. Right = collapsible panels (Research Brief, Voice Score, Fact Check).

#### 2a. Draft Editor

- Rich text editor (use `@uiw/react-md-editor` or plain `<textarea>` with markdown preview toggle — keep it simple)
- Auto-save every 30 seconds (creates a PostVersion entry)
- Word count, estimated read time shown in footer
- Status selector dropdown (updates Post.status)
- "Generate Draft" button → calls Claude with voice RAG (see AI Prompts section)
- "Improve Selection" → select text, right-click → sends selection to Claude with instruction

#### 2b. Voice Score Panel

Displayed as a 0–100 score with a simple color indicator (red < 50, yellow 50–75, green > 75).

Calculated by: sending the current draft to Claude with the voice profile prompt and asking it to score adherence on a 0–100 scale, returning JSON `{ score: number, flaggedPhrases: string[] }`.

Flagged phrases are highlighted in the editor in yellow.

Recalculates on demand (button click), not on every keystroke.

#### 2c. Fact Check Panel

- "Run Fact Check" button
- Sends current draft body to Claude with the research brief attached
- Claude returns JSON: `{ claims: [{ text: string, verdict: "supported" | "unsupported" | "disputed", source?: string, suggestion?: string }] }`
- Renders each claim as a color-coded badge: green (supported), red (unsupported), yellow (disputed)
- Unsupported/disputed claims link to suggested source or note absence of source

#### 2d. Research Brief Panel

- Shows the linked ResearchBrief (if exists) as collapsible sections: Summary, Key Claims, Sources
- "Generate Research Brief" button (if no brief linked yet) → triggers research flow (see Module 3)
- "Open Full Brief" → navigates to `/posts/[id]/research`

#### 2e. Publish / Schedule Controls

- "Publish Now" → calls LinkedIn API, sets status to PUBLISHED, records publishedAt
- "Schedule" → date/time picker, creates ScheduledPost record
- Before publish: requires status = REVIEW (enforced in UI, warning if bypassed)

---

### Module 3: Research Brief Generator

**Route:** `/posts/[id]/research` (also accessible as panel in editor)

**Trigger:** User clicks "Generate Research Brief" from editor panel

**Flow:**
1. User confirms or edits the topic/angle (pre-filled from post title)
2. System calls Exa API with 3–5 targeted queries derived from topic (Claude generates the queries)
3. Exa returns top results (title, URL, excerpt, published date)
4. Claude synthesizes results into structured brief:
   - 2–3 sentence executive summary
   - 5–8 key claims with source attribution
   - Counterarguments or conflicting data points
   - Recommended angle given the owner's typical positioning
5. Brief saved as ResearchBrief record, linked to Post
6. UI renders brief in read-only view with expandable source citations

**Exa query generation prompt:** See AI Prompts section.

---

### Module 4: Voice Corpus Ingestor

**Route:** Settings → Voice Corpus tab (also runnable as CLI script)

**One-time setup flow:**
1. User pastes LinkedIn post URLs (bulk), Medium profile URL, Substack URL
2. Script fetches content (Playwright for LinkedIn, HTTP for Medium/Substack)
3. Each piece of content is chunked (500 token chunks, 50 token overlap)
4. Each chunk is embedded via Claude's embedding API (or `text-embedding-3-small` via OpenAI if cost is a concern)
5. Stored in VoiceCorpusEntry with embedding in `Bytes` field (sqlite-vec format)

**Ongoing:** After each post is published, it's automatically added to the corpus.

**Corpus stats shown in settings:** Entry count, sources breakdown, last updated.

---

### Module 5: Impact Tracker

**Route:** `/analytics`

**Data source:** Combination of daily Playwright scrapes (FollowerSnapshot) and LinkedIn API engagement data (PostAnalytics).

**Views:**

*Follower Growth Chart:*
- Line chart, x-axis = date, y-axis = follower count
- Published posts shown as vertical markers on the timeline
- Hover on marker = post title + engagement summary

*Per-Post Impact Cards:*
- Each published post shown as a card
- Metrics: follower delta (7-day, 30-day after publish), impressions, reactions, comments, shares
- "Follower delta" = FollowerSnapshot at publish date vs. 7/30 days later
- Topic tags shown — over time, reveals which topics drive growth

*Monthly Digest (generated on demand):*
- Button: "Generate Monthly Digest"
- Claude analyzes last 30 days of PostAnalytics + FollowerSnapshot data
- Returns markdown digest: top performing posts, topic trends, recommended focus areas for next month
- Rendered inline, copyable

**Playwright Scraper (`/scripts/scrape-linkedin.ts`):**

Runs daily (cron expression configurable in settings, default: 8am). Uses a saved authenticated Playwright session (cookie file stored locally). Navigates to own LinkedIn profile, scrapes follower count from the profile card. Stores as FollowerSnapshot. If session expired, sends a desktop notification (node-notifier) prompting re-auth.

Also scrapes each post in PUBLISHED status that is less than 45 days old for reactions/comments/shares counts.

---

### Module 6: Settings

**Route:** `/settings`

**Sections:**

*API Keys (stored in `.env.local`, displayed masked):*
- Anthropic API Key
- Exa API Key
- LinkedIn Client ID / Client Secret

*LinkedIn Authentication:*
- OAuth 2.0 flow (button: "Connect LinkedIn Account")
- Shows connected status + account name
- Token stored in SQLite (encrypted with a local secret)

*Playwright Session:*
- Button: "Authenticate Scraper Session" — opens a visible Playwright browser window for manual login, then saves cookies
- Shows last session timestamp
- Scraper schedule (cron expression input)

*Voice Corpus:*
- Corpus stats
- "Add Content" (URL input)
- "Re-index Corpus" (rebuild all embeddings)

---

## AI Prompts

These are the core prompts. Claude Code should implement these exactly. They can be refined after initial testing.

### Voice RAG Context Builder

```typescript
// lib/voice-rag.ts
async function buildVoiceContext(topic: string): Promise<string> {
  // Query vector store for top 5 most relevant corpus entries
  const similar = await querySimilarContent(topic, 5);
  return similar.map(e => e.content).join('\n\n---\n\n');
}
```

### Draft Generation Prompt

```typescript
const systemPrompt = `You are a writing assistant for a specific author. 
Your sole job is to write in their exact voice — not a generic AI voice, not a polished corporate voice, theirs.

VOICE PROFILE (derived from their actual writing):
- Analytical and direct. States positions clearly without hedging excessively.
- Uses concrete examples and analogies from technology and business history.
- Sentences vary in length. Short declarative sentences for emphasis. Longer sentences for building arguments.
- Occasionally provocative — willing to challenge conventional wisdom in enterprise tech and marketing.
- Never uses corporate buzzwords without immediately interrogating them.
- First person. Personal perspective. Not "organizations should" — "I've seen this fail."
- Opening lines are hooks, not preambles. Never starts with "In today's rapidly changing landscape."
- Closing lines invite reflection or debate, not a summary recap.

SAMPLE WRITING FOR VOICE CALIBRATION:
${voiceContext}

Write a LinkedIn article draft on the following topic. Match the author's voice exactly.
Return only the article content — no preamble, no explanation, no "Here is your draft."`;

const userPrompt = `Topic: ${topic}
Angle: ${angle}
Research brief summary: ${brief.summary}
Key points to incorporate: ${brief.keyClaims.map(c => c.claim).join(', ')}
Target length: ${targetLength} words`;
```

### Voice Score Prompt

```typescript
const prompt = `You are evaluating whether this article draft matches a specific author's voice.

VOICE CHARACTERISTICS TO EVALUATE AGAINST:
- Direct, analytical, concrete
- Varies sentence length for rhythm
- Avoids corporate buzzwords
- First-person perspective
- Strong hooks, no preambles
- Challenges conventional thinking

DRAFT TO EVALUATE:
${draftBody}

Return JSON only, no other text:
{
  "score": <number 0-100>,
  "flaggedPhrases": [<phrases that don't match the voice>],
  "reasoning": "<one sentence explanation>"
}`;
```

### Fact Check Prompt

```typescript
const prompt = `You are a fact-checker. Check each factual claim in the article against the provided research sources.

RESEARCH SOURCES:
${JSON.stringify(brief.sources)}

ARTICLE TO FACT-CHECK:
${draftBody}

For each distinct factual claim in the article, return a JSON object.
Return a JSON array only, no other text:
[
  {
    "text": "<the claim as it appears in the article>",
    "verdict": "supported" | "unsupported" | "disputed",
    "source": "<source title if found>",
    "sourceUrl": "<url if found>",
    "suggestion": "<correction or note if unsupported/disputed>"
  }
]`;
```

### Research Query Generation Prompt

```typescript
const prompt = `Generate 4 precise search queries to research this LinkedIn article topic.
The author writes for a senior enterprise technology and marketing audience.
Queries should surface: recent data, expert opinions, contrarian views, and real-world examples.

Topic: ${topic}

Return JSON array of strings only:
["query 1", "query 2", "query 3", "query 4"]`;
```

### Research Brief Synthesis Prompt

```typescript
const prompt = `You are a research assistant synthesizing web search results into a structured brief 
for a senior technology executive writing a LinkedIn article.

TOPIC: ${topic}

SEARCH RESULTS:
${JSON.stringify(searchResults)}

Return JSON only:
{
  "summary": "<2-3 sentence executive summary of the landscape>",
  "keyClaims": [
    { "claim": "<key finding>", "source": "<source name>", "url": "<url>" }
  ],
  "counterarguments": ["<counterpoint 1>", "<counterpoint 2>"],
  "recommendedAngle": "<suggested unique angle given the research>"
}`;
```

### Monthly Digest Prompt

```typescript
const prompt = `Analyze this LinkedIn content performance data and write a brief monthly digest.

PUBLISHED POSTS (last 30 days):
${JSON.stringify(recentPosts)}

FOLLOWER GROWTH DATA:
${JSON.stringify(followerSnapshots)}

Write a concise digest (300 words max) covering:
1. Top performing content and why it likely worked
2. Topics/formats that underperformed
3. Follower growth trend and correlation with content
4. 3 specific recommendations for next month's content strategy

Write in the second person ("Your top performer was..."). Be direct and specific.`;
```

---

## API Routes

```
POST   /api/posts                    # Create new post
GET    /api/posts                    # List all posts
GET    /api/posts/[id]               # Get single post
PATCH  /api/posts/[id]               # Update post (status, body, etc.)
DELETE /api/posts/[id]               # Delete post

POST   /api/posts/[id]/generate-draft        # Trigger AI draft generation
POST   /api/posts/[id]/voice-score           # Calculate voice score
POST   /api/posts/[id]/fact-check            # Run fact check
POST   /api/posts/[id]/research              # Generate research brief
POST   /api/posts/[id]/publish               # Publish to LinkedIn now
POST   /api/posts/[id]/schedule              # Schedule for later

GET    /api/analytics/overview               # Dashboard stats
GET    /api/analytics/posts/[id]/impact      # Follower delta for specific post
GET    /api/analytics/monthly-digest         # Generate monthly digest

POST   /api/corpus/ingest                    # Add URL to voice corpus
GET    /api/corpus/stats                     # Corpus statistics

POST   /api/linkedin/auth                    # Initiate OAuth flow
GET    /api/linkedin/callback                # OAuth callback handler
```

---

## LinkedIn API Integration

**Scopes required:** `w_member_social`, `r_liteprofile`

**Post creation endpoint:** `POST https://api.linkedin.com/v2/ugcPosts`

```typescript
// lib/linkedin-publish.ts
interface LinkedInPost {
  author: string;           // "urn:li:person:{personId}"
  lifecycleState: "PUBLISHED";
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: string };
      shareMediaCategory: "NONE";
    }
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  };
}
```

Token storage: Access token and refresh token stored in SQLite `Config` table, value encrypted with AES-256 using a key derived from a local `.env.local` secret.

---

## Playwright Scraper

**File:** `/scripts/scrape-linkedin.ts`

**Session management:** On first run, opens a visible browser window. User logs in manually. Cookies saved to `./data/linkedin-session.json`. Subsequent runs load cookies headlessly.

**Scrape targets:**
- Profile page (`linkedin.com/in/{handle}`) → follower count (CSS selector: `.pv-top-card--list .text-body-small`)
- Each recent post URL → reactions count, comments count

**Error handling:** If navigation fails or selector not found, log error to `./data/scraper.log` and send desktop notification via `node-notifier`. Do not crash — return partial data.

**Schedule:** Managed by `node-cron` running in a separate long-lived process started with `npm run scraper`.

---

## Environment Variables (.env.local)

```bash
# Anthropic
ANTHROPIC_API_KEY=

# Exa
EXA_API_KEY=

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/callback

# App
LOCAL_ENCRYPTION_SECRET=   # Random 32-char string for token encryption
LINKEDIN_PROFILE_HANDLE=   # Your LinkedIn handle (e.g. joesmithcto)
DATABASE_URL=file:./data/app.db
```

---

## Build Order for Claude Code

Implement in this exact sequence. Do not skip ahead. Each phase should be testable before moving to the next.

**Phase 1: Data + Publishing Loop (Week 1)**
1. Initialize Next.js project with Tailwind and Prisma
2. Set up SQLite database with schema above
3. Build LinkedIn OAuth flow (settings page → connect → callback → store token)
4. Build the Post Editor page with basic textarea and status selector
5. Implement `POST /api/posts/[id]/publish` using LinkedIn API
6. Build minimal Kanban dashboard
7. Verify: can create a post, write in it, publish to LinkedIn

**Phase 2: AI Writing (Week 2)**
8. Implement voice corpus ingestion script (`/scripts/ingest-corpus.ts`)
9. Set up sqlite-vec for vector storage
10. Build voice RAG query function
11. Implement draft generation API route with voice context
12. Wire "Generate Draft" button in editor
13. Implement Voice Score panel
14. Verify: generated drafts feel like the author's voice

**Phase 3: Research + Fact Check (Week 3)**
15. Integrate Exa API
16. Implement research query generation
17. Implement research brief synthesis
18. Build Research Brief panel in editor
19. Implement Fact Check panel
20. Verify: full idea → research → draft → fact-check flow works end-to-end

**Phase 4: Analytics (Week 4)**
21. Build Playwright scraper script
22. Implement FollowerSnapshot storage
23. Build PostAnalytics storage (from LinkedIn API after publish)
24. Build Impact Tracker page with follower growth chart
25. Implement Monthly Digest generation
26. Verify: follower chart shows historical data, post markers visible

---

## Acceptance Criteria

| Feature | Acceptance Criteria |
|---|---|
| Post publishing | Text post appears on LinkedIn within 5 seconds of clicking "Publish Now" |
| Draft generation | Draft generated in < 30 seconds, minimum 400 words |
| Voice score | Score displayed within 10 seconds of clicking "Score Draft" |
| Fact check | All factual claims flagged within 20 seconds |
| Research brief | Brief generated within 45 seconds for any topic |
| Follower tracking | Daily snapshot captured automatically, visible in chart next day |
| Post impact | Follower delta calculated correctly for 7-day and 30-day windows |
| Scheduling | Scheduled post publishes within 60 seconds of scheduled time |

---

## Known Constraints and Trade-offs

**LinkedIn scraping:** LinkedIn actively works against scraping. The Playwright session will expire periodically (typically 30–90 days). A re-auth notification is sufficient — this is acceptable for daily batch scraping at low frequency.

**Embedding model:** If Claude API doesn't expose an embedding endpoint at implementation time, use OpenAI `text-embedding-3-small` (cheap, fast) for the vector corpus. The writing and reasoning still goes through Claude.

**Scheduling:** The scheduler is a long-running Node process (`npm run scheduler`). For a local app this is fine — it must be running for scheduled posts to fire. Consider adding a startup notification if a scheduled post fires while the scheduler is not running.

**Rate limits:** Exa API has generous free tier limits. Claude API calls for draft generation should include a 2-second debounce on the "Generate" button to prevent double-submits. No other rate limit concerns at single-user scale.

---

## Future Enhancements (Out of Scope for v1)

- Trend intelligence feed (auto-surfacing article ideas from RSS/news)
- Support for LinkedIn document posts (carousels)
- Cross-posting to Substack/Medium
- A/B testing hook variants
- Email digest delivery
- Multi-platform voice corpus (include email writing style)

