# Social Media Video Generation System

> Complete documentation for the automated social media content pipeline
> **For: New Employee Onboarding**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Pipeline Flow](#pipeline-flow)
3. [Services & Integrations](#services--integrations)
4. [Brand Configuration](#brand-configuration)
5. [Database Structure](#database-structure)
6. [Cron Jobs & Scheduling](#cron-jobs--scheduling)
7. [Webhooks](#webhooks)
8. [Cost Management](#cost-management)
9. [Error Handling & Recovery](#error-handling--recovery)
10. [Quick Reference Guide](#quick-reference-guide)
11. [Troubleshooting](#troubleshooting)

---

## System Overview

The OwnerFi social media system is a fully automated pipeline that transforms RSS articles into engaging social media videos. The system runs 24/7 with minimal human intervention.

### What It Does

1. **Fetches** articles from 82+ RSS feeds across multiple niches
2. **Rates** content quality using AI (OpenAI GPT-4o-mini)
3. **Generates** AI avatar videos (HeyGen)
4. **Adds captions** and effects to videos (Submagic)
5. **Posts** to 6+ social platforms simultaneously (Late/GetLate)

### Active Brands

| Brand | Purpose | Daily Videos | Platforms |
|-------|---------|--------------|-----------|
| **Carz** | Automotive content | 3 | Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads |
| **OwnerFi** | Real estate/Owner finance | 3 | Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads |
| **Gaza** | Humanitarian news | 5 | Instagram, TikTok, YouTube, Facebook, LinkedIn |
| **Abdullah** | Personal brand | 3 | Custom selection |
| **Benefit** | Benefits/Insurance | 3 | Custom selection |
| **Personal** | Personal content | 3 | Custom selection |

---

## Pipeline Flow

### Visual Overview

```
                        DAILY SOCIAL MEDIA PIPELINE
================================================================================

   12:00 PM UTC          1:00 PM UTC         8 AM / 12 PM / 7 PM UTC
       |                     |                        |
       v                     v                        v
+-------------+       +-------------+          +-------------+
|  FETCH RSS  |  -->  | RATE WITH   |  -->     |  GENERATE   |
|   FEEDS     |       |    AI       |          |   VIDEOS    |
+-------------+       +-------------+          +-------------+
       |                     |                        |
       v                     v                        v
  82 RSS feeds          OpenAI GPT-4              Top articles
  across brands         scores 0-100              trigger workflow
       |                     |                        |
       +---------------------+------------------------+
                             |
                             v
================================================================================
                        VIDEO GENERATION FLOW
================================================================================
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
   +-------------+    +-------------+    +-------------+
   |   HEYGEN    |    |  SUBMAGIC   |    |   LATE      |
   |   Avatar    | -> |  Captions   | -> |   Post to   |
   |   Video     |    |  + Effects  |    |   Social    |
   +-------------+    +-------------+    +-------------+
         |                  |                  |
         v                  v                  v
   ~60 seconds         ~2-3 minutes       Scheduled
   AI avatar with      Professional       posting to
   TTS voiceover      captions/zooms      6+ platforms
```

### Phase-by-Phase Breakdown

---

### Phase 1: RSS Feed Fetching

**When:** Daily at 12:00 PM UTC (6:00 AM CST)

**What happens:**
1. System acquires a distributed lock (prevents duplicate runs)
2. Fetches articles from 82 configured RSS feeds
3. Sanitizes HTML content and extracts key data
4. Stores new articles in Firestore
5. Each brand has its own isolated article collection

**Key files:**
- `/src/app/api/cron/fetch-rss/route.ts` - Main cron handler
- `/src/lib/rss-fetcher.ts` - RSS parsing logic
- `/src/config/feed-sources.ts` - Feed configurations

**Output:** Articles stored in `{brand}_articles` collection with `processed: false`

---

### Phase 2: AI Quality Rating

**When:** Daily at 1:00 PM UTC (7:00 AM CST)

**What happens:**
1. Fetches all unprocessed articles (up to 100 per brand)
2. Pre-filters by content length (minimum 100 characters)
3. Checks OpenAI budget (daily + monthly limits)
4. Sends articles to GPT-4o-mini for quality evaluation
5. Each article receives a score from 0-100
6. Keeps top 100 articles, deletes the rest

**Scoring criteria:**
- **Relevance** - How relevant is this to the brand's audience?
- **Engagement potential** - Will people share/comment on this?
- **Timeliness** - Is this news fresh and current?
- **Content quality** - Is it well-written and informative?

**Key files:**
- `/src/app/api/cron/rate-articles/route.ts` - Main cron handler
- `/src/lib/article-quality-filter.ts` - AI evaluation logic

**Output:** Articles with `qualityScore` (0-100) and `aiReasoning` fields

---

### Phase 3: Video Generation Trigger

**When:** 3x daily at 8:00 AM, 12:00 PM, 7:00 PM UTC

**What happens:**
1. For each brand with RSS feeds (carz, ownerfi, abdullah, personal):
   - Finds the best unprocessed article (score >= 30)
   - Creates a workflow document in Firestore
   - Triggers HeyGen video generation
2. For Gaza brand (separate flow):
   - Checks daily limit (5 videos/day)
   - Creates workflow with deduplication check
   - Uses "sad" mood for humanitarian context

**Key files:**
- `/src/app/api/cron/generate-videos/route.ts` - Main cron handler

**Output:** Workflow documents in `{brand}_workflow_queue` with `status: pending`

---

### Phase 4: HeyGen Avatar Video Generation

**When:** Triggered immediately after Phase 3

**What happens:**
1. **Pre-flight checks:**
   - Verifies HeyGen has enough credits
   - Checks internal budget limits
   - Validates circuit breaker is healthy
2. **API call to HeyGen:**
   - Sends article content as script
   - Configures avatar, voice, background
   - Sets vertical format (1080x1920)
   - Includes workflow ID for webhook callback
3. **Webhook received when complete:**
   - HeyGen calls our `/api/webhooks/heygen/{brand}` endpoint
   - We save the video URL immediately (critical backup!)
   - Triggers Submagic processing

**Key files:**
- `/src/lib/heygen-client.ts` - HeyGen API wrapper
- `/src/config/heygen-agents.ts` - Avatar configurations
- `/src/app/api/webhooks/heygen/[brand]/route.ts` - Webhook handler

**Output:** `heygenVideoUrl` saved to workflow document

---

### Phase 5: Submagic Caption Processing

**When:** Triggered by HeyGen webhook

**What happens:**
1. **Create Submagic project:**
   - Sends HeyGen video URL
   - Configures caption style (Hormozi 2 template)
   - Enables magic zooms and B-rolls
   - Sets viral pacing (remove silence)
2. **First webhook (captions complete):**
   - Triggers `/export` to generate final video
   - Includes retry logic (3 attempts with backoff)
3. **Second webhook (export complete):**
   - Receives final video download URL
   - Triggers async video processing

**Key files:**
- `/src/lib/submagic-client.ts` - Submagic API wrapper
- `/src/app/api/webhooks/submagic/[brand]/route.ts` - Webhook handler

**Output:** `submagicDownloadUrl` with captioned video

---

### Phase 6: Upload & Social Media Posting

**When:** Triggered by Submagic export webhook

**What happens:**
1. **Download video from Submagic**
2. **Upload to Cloudflare R2:**
   - Permanent storage for our videos
   - Gets public URL for distribution
3. **Post to GetLate queue:**
   - Sends video + caption to Late API
   - Selects platforms based on brand config
   - Uses queue system for optimal timing
4. **Mark workflow complete:**
   - Stores `latePostId` and `finalVideoUrl`
   - Updates article as `processed: true`

**Key files:**
- `/src/lib/late-api.ts` - GetLate API wrapper
- `/src/lib/video-storage.ts` - R2 upload logic

**Output:** Video live on 6+ social media platforms!

---

## Services & Integrations

### HeyGen (Avatar Videos)

| Item | Details |
|------|---------|
| **Purpose** | Generate AI avatar talking videos |
| **Cost** | $0.50 per video (1 credit) |
| **Monthly allocation** | 660 credits ($330) |
| **API Docs** | https://docs.heygen.com |
| **Dashboard** | https://app.heygen.com |

**Key functions:**
```typescript
// Check remaining credits
const quota = await getHeyGenQuota();

// Generate a video
const result = await generateHeyGenVideo({
  script: "Article content here...",
  avatarId: "avatar_123",
  voiceId: "voice_456",
  callbackId: workflowId
}, brand);

// Poll video status (free call)
const status = await getHeyGenVideoStatus(videoId);
```

---

### Submagic (Captions & Effects)

| Item | Details |
|------|---------|
| **Purpose** | Add captions, zooms, B-rolls |
| **Cost** | $0.25 per video |
| **Monthly allocation** | 600 credits ($150) |
| **Dashboard** | https://app.submagic.co |

**Features we use:**
- **Hormozi 2** - Professional caption template
- **Magic Zooms** - Auto-zoom on emphasized words
- **Magic B-Rolls** - Stock footage overlay (75% coverage)
- **Remove Silence** - Fast pacing for viral feel
- **Remove Bad Takes** - Clean up stutters

---

### Late/GetLate (Social Posting)

| Item | Details |
|------|---------|
| **Purpose** | Post to multiple platforms at once |
| **Cost** | $50/month unlimited |
| **Dashboard** | https://getlate.io |

**Platforms supported:**
- Instagram (Reels)
- TikTok
- YouTube (Shorts)
- Facebook
- LinkedIn
- Threads

**Key functions:**
```typescript
const result = await postToLate({
  videoUrl: "https://...",
  caption: "Your caption here #hashtags",
  platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  brand: 'ownerfi',
  useQueue: true,  // Schedule to next available slot
  timezone: 'America/Chicago'
});
```

---

### OpenAI (Content Rating)

| Item | Details |
|------|---------|
| **Purpose** | Rate article quality for viral potential |
| **Model** | GPT-4o-mini |
| **Cost** | ~$0.15 per 1M input tokens |
| **Budget** | Controlled per brand, daily + monthly |

---

## Brand Configuration

Each brand has isolated configuration. Here's the structure:

```typescript
// From /src/config/brand-configs.ts

{
  id: 'carz',
  displayName: 'Carz Inc',

  // Social platforms
  platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],

  // Webhooks (auto-constructed from base URL)
  webhooks: {
    heygen: '/api/webhooks/heygen/carz',
    submagic: '/api/webhooks/submagic/carz'
  },

  // YouTube settings
  youtubeCategory: 'AUTOS_VEHICLES',

  // Content settings
  hashtags: ['#cars', '#automotive', '#vehicles', '#auto', '#carlovers'],

  // Scheduling
  timezone: 'America/Chicago',
  postingHours: [8, 12, 19],  // CST
  maxPostsPerDay: 3,

  // Firestore collections
  collections: {
    feeds: 'carz_rss_feeds',
    articles: 'carz_articles',
    workflows: 'carz_workflow_queue'
  }
}
```

### Brand-Specific Settings Summary

| Brand | Timezone | Max Posts/Day | YouTube Category | Special Notes |
|-------|----------|---------------|------------------|---------------|
| Carz | America/Chicago | 3 | Autos & Vehicles | Automotive focus |
| OwnerFi | America/Chicago | 3 | Finance | Real estate focus |
| Gaza | UTC | 5 | News & Politics | "Sad" mood, humanitarian |
| Abdullah | America/Chicago | 3 | Education | Personal brand |
| Benefit | America/Chicago | 3 | Finance | Insurance/benefits |
| Personal | America/Chicago | 3 | People & Blogs | General content |

---

## Database Structure

All data is stored in **Google Firestore**. Each brand has isolated collections.

### Collection Overview

```
Firestore Database
├── carz_rss_feeds          # RSS feed configurations
├── carz_articles           # Fetched articles
├── carz_workflow_queue     # Video workflows
├── ownerfi_rss_feeds
├── ownerfi_articles
├── ownerfi_workflow_queue
├── gaza_rss_feeds
├── gaza_articles
├── gaza_workflow_queue
├── ... (same pattern for other brands)
├── cron_locks              # Distributed locking
├── cost_entries            # Cost tracking
├── webhook_idempotency     # Prevent duplicate processing
└── webhook_dlq             # Dead letter queue for failed webhooks
```

---

### RSS Feed Document

**Collection:** `{brand}_rss_feeds`

```javascript
{
  // Identity
  id: "feed_abc123",
  name: "TechCrunch Auto",
  url: "https://techcrunch.com/category/transportation/feed/",

  // Status
  enabled: true,
  lastFetched: Timestamp,
  lastError: null,

  // Config
  fetchInterval: 3600000,  // 1 hour in milliseconds

  // Stats
  articlesProcessed: 247
}
```

---

### Article Document

**Collection:** `{brand}_articles`

```javascript
{
  // Identity
  id: "article_xyz789",
  feedId: "feed_abc123",

  // Content
  title: "Tesla Announces New Model",
  description: "Short summary...",
  content: "Full article content here...",
  link: "https://techcrunch.com/...",
  pubDate: Timestamp,
  author: "John Smith",
  categories: ["electric-vehicles", "tesla"],

  // Processing status
  processed: false,           // True after video posted
  videoGenerated: false,      // True after HeyGen starts

  // AI quality rating
  qualityScore: 78,           // 0-100 from OpenAI
  aiReasoning: "High engagement potential due to...",
  ratedAt: Timestamp,

  // Deduplication
  contentHash: "sha256_hash_here",

  // Timestamps
  createdAt: Timestamp
}
```

---

### Workflow Document

**Collection:** `{brand}_workflow_queue`

```javascript
{
  // Identity
  id: "wf_ownerfi_1704067200_abc123",
  articleId: "article_xyz789",

  // Status (see flow diagram below)
  status: "completed",

  // Article data
  articleTitle: "Tesla Announces New Model",
  caption: "Breaking: Tesla unveils... #tesla #ev",

  // HeyGen data
  heygenVideoId: "hg_video_123",
  heygenVideoUrl: "https://files.heygen.ai/.../output.mp4",

  // Submagic data
  submagicProjectId: "sm_proj_456",
  submagicDownloadUrl: "https://cdn.submagic.co/.../export.mp4",

  // Final output
  finalVideoUrl: "https://r2.ownerfi.ai/carz/videos/wf_123.mp4",
  latePostId: "late_post_789",

  // Metadata
  platformsUsed: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "threads"],
  scheduledFor: "2024-01-15T14:00:00Z",

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  completedAt: Timestamp,

  // Error handling
  error: null,
  retryCount: 0
}
```

---

### Workflow Status Flow

```
                    WORKFLOW STATUS TRANSITIONS
================================================================================

     pending
        |
        | (HeyGen API called)
        v
  heygen_processing ---------> failed (HeyGen error)
        |
        | (HeyGen webhook received)
        v
 submagic_processing --------> failed (Submagic error)
        |
        | (Submagic first webhook)
        v
    exporting
        |
        | (Submagic export webhook)
        v
  video_processing ----------> failed (R2/Late error)
        |
        | (Upload + Late post complete)
        v
    completed ✓
```

---

## Cron Jobs & Scheduling

All cron jobs are configured in `/vercel.json` and run on Vercel's infrastructure.

### Complete Schedule

| Time (UTC) | Time (CST) | Cron Job | Purpose |
|------------|------------|----------|---------|
| Every 30 min | - | `check-stuck-workflows` | Monitor & fix stuck workflows |
| 00:00 | 6:00 PM | `daily-maintenance` | Cleanup old data |
| 08:00 | 2:00 AM | `generate-videos` | 1st video generation window |
| 12:00 | 6:00 AM | `fetch-rss` | Fetch RSS feeds |
| 12:00 | 6:00 AM | `generate-videos` | 2nd video generation window |
| 12:20 | 6:20 AM | `benefit/cron` | Benefit brand videos |
| 13:00 | 7:00 AM | `rate-articles` | AI quality rating |
| 19:00 | 1:00 PM | `generate-videos` | 3rd video generation window |

### Key Cron Files

```
/src/app/api/cron/
├── fetch-rss/route.ts              # RSS fetching (12:00 UTC)
├── rate-articles/route.ts          # AI quality rating (13:00 UTC)
├── generate-videos/route.ts        # Video generation (8, 12, 19 UTC)
├── check-stuck-workflows/route.ts  # Monitoring (every 30 min)
├── daily-maintenance/route.ts      # Cleanup (00:00 UTC)
└── generate-blog/route.ts          # Blog content
```

### Cron Security

All cron endpoints are protected:

```typescript
// Check authorization
const authHeader = request.headers.get('authorization');
const userAgent = request.headers.get('user-agent');

// Must have either:
// 1. Bearer token matching CRON_SECRET
// 2. Vercel cron user agent
const isAuthorized =
  authHeader === `Bearer ${process.env.CRON_SECRET}` ||
  userAgent === 'vercel-cron/1.0';
```

---

## Webhooks

### HeyGen Webhook

**Endpoint:** `POST /api/webhooks/heygen/[brand]`

**When it fires:** After HeyGen finishes generating a video (success or failure)

**Success payload:**
```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "hg_video_123",
    "url": "https://files.heygen.ai/.../output.mp4",
    "callback_id": "wf_ownerfi_1704067200_abc123"
  }
}
```

**What we do:**
1. Validate the brand from URL path
2. Check idempotency (prevent duplicate processing)
3. **Save HeyGen URL immediately** (critical for recovery!)
4. Trigger Submagic with 25-second timeout
5. Update workflow status to `submagic_processing`

**File:** `/src/app/api/webhooks/heygen/[brand]/route.ts`

---

### Submagic Webhook

**Endpoint:** `POST /api/webhooks/submagic/[brand]`

**When it fires:**
1. After captions are applied (no downloadUrl)
2. After export completes (with downloadUrl)

**First webhook (captions done):**
```json
{
  "projectId": "sm_proj_456",
  "status": "completed"
  // No downloadUrl yet
}
```
**Action:** Trigger `/export` endpoint

**Second webhook (export done):**
```json
{
  "projectId": "sm_proj_456",
  "status": "completed",
  "downloadUrl": "https://cdn.submagic.co/.../export.mp4"
}
```
**Action:** Queue async video processing (upload + post)

**File:** `/src/app/api/webhooks/submagic/[brand]/route.ts`

---

## Cost Management

### Service Costs at a Glance

| Service | Per-Unit Cost | Monthly Budget | Monthly Allocation |
|---------|---------------|----------------|-------------------|
| HeyGen | $0.50/video | $330 | 660 videos |
| Submagic | $0.25/video | $150 | 600 videos |
| Late | Unlimited | $50 | Unlimited posts |
| OpenAI | ~$0.001/article | Budget-controlled | Varies |
| R2 Storage | ~$0.015/GB | Pay as you go | N/A |

### Budget Enforcement

The system automatically:
- **Checks budget BEFORE** making any API call
- **Blocks operations** if budget is exceeded
- **Sends alerts** at 80% and 95% thresholds
- **Tracks all costs** in `cost_entries` collection

### Cost Entry Example

```javascript
// In Firestore: cost_entries collection
{
  timestamp: Timestamp,
  brand: "carz",
  service: "heygen",
  operation: "generate_video",
  units: 1,
  costUSD: 0.50,
  workflowId: "wf_carz_1704067200_xyz",
  metadata: {
    video_id: "hg_video_123",
    avatar_type: "studio"
  }
}
```

---

## Error Handling & Recovery

### Automatic Stuck Workflow Detection

The `check-stuck-workflows` cron runs every 30 minutes and automatically:

| Stage | Timeout | Recovery Action |
|-------|---------|-----------------|
| `pending` | 30 min | Re-trigger HeyGen generation |
| `heygen_processing` | 20 min | Query HeyGen for status |
| `submagic_processing` | 25 min | Query Submagic for status |
| `video_processing` | 15 min | Retry upload + posting |
| `posting` | 10 min | Retry Late API call |

**Max retries:** 3 per workflow, then auto-fail

---

### Idempotency Protection

All webhooks use idempotency to prevent:
- Duplicate video generation
- Duplicate social media posts
- Double charges

**How it works:**
```javascript
// In Firestore: webhook_idempotency collection
{
  service: "heygen",
  webhookId: "hg_video_123",  // Unique per webhook call
  brand: "carz",
  processed: true,
  processedAt: Timestamp,
  previousResponse: { ... }  // Cached response
}
```

---

### Dead Letter Queue (DLQ)

Failed webhook processing is logged for debugging:

```javascript
// In Firestore: webhook_dlq collection
{
  service: "submagic",
  brand: "carz",
  url: "/api/webhooks/submagic/carz",
  method: "POST",
  headers: { ... },
  body: { ... },
  error: "Network timeout",
  stack: "Error: ...",
  timestamp: Timestamp
}
```

---

### Manual Recovery Options

**Retry a stuck workflow:**
```bash
curl -X POST https://ownerfi.ai/api/workflow/retry-submagic \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "wf_ownerfi_xxx"}'
```

**Force check all stuck workflows:**
```bash
curl https://ownerfi.ai/api/cron/check-stuck-workflows \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Quick Reference Guide

### Common Daily Tasks

#### 1. Check if videos are posting

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to Firestore > `{brand}_workflow_queue`
3. Filter by `status == "completed"` and recent `completedAt`
4. Or check the Late dashboard for scheduled posts

#### 2. Debug a failed workflow

1. Find the workflow in Firestore
2. Check the `status` field (where did it stop?)
3. Check the `error` field (what went wrong?)
4. Check `retryCount` (has it exceeded 3?)
5. View Vercel logs for detailed error messages

#### 3. Monitor costs

1. Go to Firestore > `cost_entries`
2. Filter by brand and date range
3. Sum the `costUSD` field
4. Compare to monthly budget

#### 4. Add a new RSS feed

1. Go to Firestore > `{brand}_rss_feeds`
2. Click "Add document"
3. Fill in the required fields:
   - `name`: Display name
   - `url`: Full RSS feed URL
   - `enabled`: true
   - `fetchInterval`: 3600000 (1 hour)
4. Feed will be fetched on next cron run

---

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `HEYGEN_API_KEY` | HeyGen authentication | `hg_xxxxx` |
| `SUBMAGIC_API_KEY` | Submagic authentication | `sm_xxxxx` |
| `OPENAI_API_KEY` | OpenAI for article rating | `sk-xxxxx` |
| `LATE_API_KEY` | GetLate authentication | `lt_xxxxx` |
| `LATE_{BRAND}_PROFILE_ID` | Brand-specific Late profile | `profile_123` |
| `CRON_SECRET` | Secure cron execution | Random string |
| `R2_*` | Cloudflare R2 storage | Various |
| `FIREBASE_*` | Firebase/Firestore | Various |

---

### Key File Locations

```
src/
├── app/api/
│   ├── cron/
│   │   ├── fetch-rss/route.ts           # RSS fetching
│   │   ├── rate-articles/route.ts       # AI rating
│   │   ├── generate-videos/route.ts     # Video trigger
│   │   └── check-stuck-workflows/route.ts  # Monitoring
│   └── webhooks/
│       ├── heygen/[brand]/route.ts      # HeyGen webhook
│       └── submagic/[brand]/route.ts    # Submagic webhook
│
├── config/
│   ├── brand-configs.ts                 # Brand settings
│   ├── feed-sources.ts                  # RSS feed config
│   └── heygen-agents.ts                 # Avatar config
│
└── lib/
    ├── heygen-client.ts                 # HeyGen API
    ├── submagic-client.ts               # Submagic API
    ├── late-api.ts                      # GetLate API
    ├── cost-tracker.ts                  # Budget tracking
    ├── rss-fetcher.ts                   # RSS parsing
    ├── article-quality-filter.ts        # AI rating
    └── cron-lock.ts                     # Distributed locking
```

---

## Troubleshooting

### "No videos being generated"

1. Check if RSS feeds have new articles:
   - Firestore > `{brand}_articles`
   - Filter: `processed == false`
2. Check if articles have quality scores:
   - Filter: `qualityScore >= 30`
3. Check OpenAI budget hasn't been exceeded
4. Check Vercel logs for cron execution

### "Workflow stuck in pending"

1. Check HeyGen quota:
   - Go to https://app.heygen.com
   - View remaining credits
2. Check internal budget limits
3. Manual trigger:
   ```bash
   curl https://ownerfi.ai/api/cron/check-stuck-workflows \
     -H "Authorization: Bearer CRON_SECRET"
   ```

### "Workflow stuck in heygen_processing"

1. Video is generating - wait up to 2 minutes
2. If stuck > 5 minutes:
   - Check HeyGen dashboard for the video
   - `check-stuck-workflows` will auto-retry

### "Workflow stuck in submagic_processing"

1. Captions are being generated - wait up to 3 minutes
2. If stuck > 5 minutes:
   - Check Submagic dashboard for the project
   - `check-stuck-workflows` will auto-retry

### "Video has no captions"

1. Check Submagic webhook logs in Vercel
2. Verify `submagicProjectId` exists in workflow
3. Check Submagic dashboard for project status
4. May need manual retry

### "Video not posting to social"

1. Check Late profile ID configuration
2. Verify Late account has platforms connected
3. Check Late dashboard for queue status
4. Check `error` field in workflow

### "Budget exceeded errors"

1. Check `cost_entries` for current spend
2. Wait for next budget period (daily or monthly reset)
3. Or increase budget limits in environment variables

### "Duplicate posts appearing"

1. Check `webhook_idempotency` collection
2. Verify webhook is returning 200 (not triggering retries)
3. Check for multiple concurrent cron executions
4. Review cron lock mechanism

---

## External Dashboards

| Service | URL | Purpose |
|---------|-----|---------|
| **Firebase Console** | https://console.firebase.google.com | Firestore data |
| **Vercel Dashboard** | https://vercel.com/dashboard | Logs, deployments, crons |
| **HeyGen Dashboard** | https://app.heygen.com | Video generation, credits |
| **Submagic Dashboard** | https://app.submagic.co | Caption projects |
| **GetLate Dashboard** | https://getlate.io | Social posting, queues |

---

## Getting Help

- **Internal issues:** Check Vercel logs first
- **HeyGen issues:** support@heygen.com
- **Submagic issues:** support@submagic.co
- **Late issues:** support@getlate.io

---

*Last updated: January 2025*
