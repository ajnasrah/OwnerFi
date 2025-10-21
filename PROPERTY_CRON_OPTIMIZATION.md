# Property Processing Cron Optimization

## Current Problem

Two crons run frequently even when there's nothing to process:
- **process-zillow-scraper:** Every 2 minutes (18 hrs/month)
- **process-scraper-queue:** Every 15 minutes (4 hrs/month)

Combined: **22 hours/month** (75% of Vercel Pro compute limit)

## Solution: Conditional Execution

### Option 1: Immediate Trigger + Failsafe Cron (RECOMMENDED)

**How it works:**
1. When user uploads URLs → immediately trigger processing
2. Keep cron running but only as a failsafe backup
3. Cron checks for pending items, exits early if none found

**Benefits:**
✅ Instant processing (no waiting for cron)
✅ Backup system if immediate trigger fails
✅ Reduces wasted cron invocations

**Implementation:**

#### Step 1: Add status flag to Firebase
```typescript
// New collection: scraper_status
{
  hasPendingJobs: boolean,
  hasPendingQueue: boolean,
  lastUpdated: timestamp
}
```

#### Step 2: Update upload endpoints to trigger immediately
```typescript
// After creating job in scraper_jobs:
await fetch('/api/cron/process-zillow-scraper', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
});
```

#### Step 3: Update crons to check status flag first
```typescript
// At start of process-zillow-scraper:
const status = await db.collection('scraper_status').doc('global').get();
if (!status.data()?.hasPendingJobs) {
  return NextResponse.json({ message: 'No pending jobs' });
}
```

---

### Option 2: Reduce Cron Frequency (SIMPLEST)

**How it works:**
Just run the crons less frequently since they already exit early when no work exists.

**Changes:**
- process-zillow-scraper: Every 2 min → **Every 10 minutes**
- process-scraper-queue: Every 15 min → **Every 30 minutes**

**Benefits:**
✅ Zero code changes (only vercel.json)
✅ Reduces compute by 80%+ when queue is empty
❌ Slower processing (10-30 min delay)

**Compute savings:**
- process-zillow-scraper: 18 hrs → ~3.6 hrs/month (saves 14.4 hrs)
- process-scraper-queue: 4 hrs → ~2 hrs/month (saves 2 hrs)
- **Total savings: 16.4 hours/month** (41% reduction)

---

### Option 3: On-Demand Only (MOST EFFICIENT)

**How it works:**
Remove crons entirely, only trigger when items are added.

**Benefits:**
✅ Zero wasted compute
✅ Instant processing
❌ No failsafe if trigger fails
❌ More complex error handling needed

---

## Recommended Implementation

### Use Option 1 (Immediate + Failsafe)

This gives best of both worlds:

**1. Update upload endpoint to trigger immediately:**

```typescript
// src/app/api/admin/scraper/upload/route.ts (line 96)
await db.collection('scraper_jobs').doc(jobId).set({
  status: 'pending',
  total: newProperties.length,
  imported: 0,
  progress: 0,
  createdAt: new Date(),
  urls: newProperties.map(p => p.url),
});

// NEW: Trigger processing immediately
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
fetch(`${BASE_URL}/api/cron/process-zillow-scraper`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    'User-Agent': 'vercel-cron/1.0'
  }
}).catch(err => console.error('Failed to trigger scraper:', err));
```

**2. Reduce cron frequency as failsafe:**

```json
// vercel.json
{
  "path": "/api/cron/process-zillow-scraper",
  "schedule": "*/10 * * * *"  // Every 10 min (was every 2 min)
},
{
  "path": "/api/cron/process-scraper-queue",
  "schedule": "*/30 * * * *"  // Every 30 min (was every 15 min)
}
```

**3. Crons already have early exit logic:**
They check for pending items and return immediately if none found.

---

## Expected Results

### Before:
- Cron invocations: 32,400/month (21,600 + 2,880 + others)
- Compute when idle: ~22 hours wasted
- Processing delay: 0-2 minutes

### After (Option 1):
- Cron invocations: ~6,480/month (4,320 + 1,440 + others)
- Compute when idle: ~4.4 hours (80% reduction)
- Processing delay: 0 seconds (immediate) + 10-30 min failsafe
- **Compute savings: ~17.6 hours/month**

---

## Cost Impact

**Current:**
- process-zillow-scraper: 18 hrs/month
- process-scraper-queue: 4 hrs/month
- Total: 22 hrs/month (75% of limit)

**After optimization:**
- process-zillow-scraper: ~3.6 hrs/month
- process-scraper-queue: ~2 hrs/month
- Total: ~5.6 hrs/month (19% of limit)
- **Available buffer: 34.4 hours (86%)**

---

## Implementation Steps

1. Update upload endpoint to trigger immediately
2. Update vercel.json to reduce cron frequency
3. Git commit and push to deploy
4. Test by uploading a small batch
5. Monitor logs to confirm immediate processing

---

## Alternative: Keep Current Setup

If uploads are frequent (multiple times per day), the current setup might be optimal:
- Fast processing (2 min max delay)
- Simple architecture
- Within compute limits

Only optimize if:
- ✓ Uploads are infrequent (few times per week)
- ✓ Queue is usually empty
- ✓ You want to free up compute for other services
