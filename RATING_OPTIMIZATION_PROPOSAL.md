# Article Rating System - Optimization Proposal

## Current Problems
1. Rating is manual (requires admin to click button)
2. All articles accumulate unrated until button is clicked
3. No automated cleanup of low-quality articles
4. Video generation might pick unrated articles

## Proposed Solution: Automated Rating on Fetch

### Architecture

```
RSS Fetch (Every 2 hours)
    ↓
Save to Firestore (unrated)
    ↓
Trigger Rating Job (async)
    ↓
Rate + Cleanup (keep top 10)
    ↓
Ready for Video Generation
```

### Implementation (Choose One)

---

## ✅ OPTION 1: Simple Serverless (Recommended)
**Best for:** Current setup, no infrastructure changes

### Changes Required:

#### 1. Update RSS Fetcher to Auto-Rate
**File:** `src/lib/rss-fetcher.ts`

```typescript
export async function processFeedSource(feedSource: FeedSource): Promise<{
  success: boolean;
  newArticles: number;
  error?: string;
}> {
  // ... existing fetch logic ...

  // After saving articles, trigger async rating
  if (newArticles > 0) {
    // Don't await - fire and forget
    fetch(`${baseUrl}/api/articles/rate-brand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: feedSource.category })
    }).catch(err => console.error('Rating trigger failed:', err));
  }

  return { success: true, newArticles };
}
```

#### 2. Create New Rating Endpoint
**File:** `src/app/api/articles/rate-brand/route.ts`

```typescript
// Auto-rate articles for a brand (background job)
export async function POST(request: NextRequest) {
  const { brand } = await request.json();

  // Run in background
  setImmediate(async () => {
    await rateAndCleanupBrand(brand);
  });

  return NextResponse.json({ success: true });
}

async function rateAndCleanupBrand(brand: 'carz' | 'ownerfi') {
  // Get unrated articles only
  const articles = await getUnratedArticles(brand, 50);

  if (articles.length === 0) return;

  // Rate in batches of 10
  const scores = await evaluateArticlesBatch(articles, 10);

  // Update scores
  await updateArticleScores(articles, scores);

  // Cleanup: Keep top 10, delete rest
  await keepTopNArticles(brand, 10);
}
```

**Pros:**
- No infrastructure changes
- Works with current Firestore setup
- Easy to implement (2-3 hours)

**Cons:**
- Still depends on serverless function timeout
- No guaranteed processing (fire-and-forget can fail)

---

## ⚡ OPTION 2: Redis Queue (Better)
**Best for:** Guaranteed processing, scalability

### Required Infrastructure:
- Upstash Redis (free tier works, you already have it configured)

### Changes Required:

#### 1. Add Articles to Redis Queue After Fetch
```typescript
// After saving article to Firestore
await redis.lpush(`rating_queue:${brand}`, article.id);
```

#### 2. Create Rating Worker Endpoint
**File:** `src/app/api/workers/rate-articles/route.ts`

```typescript
export async function POST() {
  const redis = getRedisClient();

  for (const brand of ['carz', 'ownerfi']) {
    // Pop up to 10 article IDs from queue
    const articleIds = await redis.lpop(`rating_queue:${brand}`, 10);

    if (!articleIds.length) continue;

    // Get articles from Firestore
    const articles = await getArticlesByIds(articleIds, brand);

    // Rate them
    const scores = await evaluateArticlesBatch(articles, 10);

    // Update Firestore
    await updateArticleScores(articles, scores);

    // Cleanup
    await keepTopNArticles(brand, 10);
  }

  return NextResponse.json({ success: true });
}
```

#### 3. Schedule Worker (Vercel Cron)
**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/workers/rate-articles",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Pros:**
- Guaranteed processing (queue persists)
- Can process large batches
- Retry failed ratings
- Rate limit protection

**Cons:**
- Requires Redis (but you already have it)
- Slightly more complex

---

## 🚀 OPTION 3: Dedicated Background Job Service (Best)
**Best for:** Production-scale, reliability

### Required Infrastructure:
- **Inngest** (free tier: 50k events/month) OR
- **Quirrel** (serverless background jobs)

### Implementation:

```typescript
import { inngest } from './inngest/client';

// After saving article
await inngest.send({
  name: 'article.rate',
  data: { articleId, brand }
});

// Inngest worker
inngest.createFunction(
  { name: 'Rate Articles' },
  { event: 'article.rate' },
  async ({ event }) => {
    const article = await getArticle(event.data.articleId);
    const score = await evaluateArticleQuality(article);
    await updateArticle(article.id, score);
    await cleanupLowScoring(event.data.brand);
  }
);
```

**Pros:**
- Purpose-built for background jobs
- Automatic retries
- Built-in monitoring/observability
- Handles rate limits

**Cons:**
- New dependency
- Learning curve

---

## 📊 COMPARISON

| Feature | Option 1: Serverless | Option 2: Redis Queue | Option 3: Job Service |
|---------|---------------------|----------------------|----------------------|
| **Setup Time** | 2-3 hours | 4-6 hours | 1 day |
| **Infrastructure** | None | Redis | Inngest/Quirrel |
| **Reliability** | Medium | High | Highest |
| **Cost** | $0 | $0 (free Redis) | $0 (free tier) |
| **Scalability** | Low | Medium | High |
| **Retry Logic** | Manual | Built-in | Built-in |
| **Monitoring** | Logs only | Basic | Full dashboard |

---

## 🎯 RECOMMENDATION

**Start with Option 1 (Simple Serverless)**

**Why:**
- Fastest to implement (this afternoon)
- No new dependencies
- Solves 80% of the problem
- Can upgrade to Option 2 later if needed

**Implementation Steps:**
1. Add auto-trigger in RSS fetcher (5 lines)
2. Create `/api/articles/rate-brand` endpoint
3. Extract rating logic from `rate-all-async`
4. Test with one brand

**Later, upgrade to Option 2 when:**
- You're processing 100+ articles/day
- You need guaranteed processing
- You want better observability

---

## 🔧 Quick Implementation (Option 1)

### Step 1: Modify RSS Fetcher
Add after line 256 in `src/lib/rss-fetcher.ts`:

```typescript
// Trigger rating for new articles (fire and forget)
if (newArticles > 0) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  fetch(`${baseUrl}/api/articles/rate-brand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand: feedSource.category })
  }).catch(() => {}); // Silent fail - not critical
}
```

### Step 2: Create New Endpoint
**File:** `src/app/api/articles/rate-brand/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { brand } = await request.json();

  // Run in background (don't block response)
  setImmediate(async () => {
    try {
      const { rateAndCleanupArticles } = await import('@/lib/feed-store-firestore');
      await rateAndCleanupArticles(10); // Keep top 10
      console.log(`✅ Auto-rated ${brand} articles`);
    } catch (error) {
      console.error(`❌ Auto-rating failed for ${brand}:`, error);
    }
  });

  return NextResponse.json({
    success: true,
    message: `Rating ${brand} articles in background`
  });
}
```

### Step 3: Test
```bash
# Manually trigger to test
curl -X POST https://ownerfi.ai/api/articles/rate-brand \
  -H "Content-Type: application/json" \
  -d '{"brand":"carz"}'

# Check logs for rating activity
```

---

## 📈 Expected Results

**Before:**
- Cron fetches 20 articles → Waits for admin → Admin rates manually → Keeps top 10

**After:**
- Cron fetches 20 articles → Auto-rates in 30 seconds → Keeps top 10 → Ready for video

**Benefits:**
- ✅ Always have fresh, rated articles
- ✅ No manual button clicking
- ✅ Low-quality articles removed automatically
- ✅ Video generation always picks best content

**Metrics to Track:**
- Articles fetched per run
- Articles rated per run
- Average rating time
- Top 10 articles always available
