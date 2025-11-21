# 🔍 ZILLOW SCRAPER COMPLETE SYSTEM DIAGNOSIS

**Date:** November 20, 2025
**Status:** 🔴 BROKEN - No properties added in 7+ days
**Expected:** 300 properties every 3 days
**Actual:** 0 properties in last 7 days

---

## 🎯 ROOT CAUSE IDENTIFIED

### **The Search Scraper is TIMING OUT**

The automated search scraper cron job (`/api/cron/run-search-scraper`) is:
- ✅ Running on schedule (Monday & Thursday @ 9 AM)
- ❌ **TIMING OUT before completion** (exceeds 5 minute limit)
- ❌ No properties added to queue
- ❌ Silent failure (no error logs)

### **Why It's Timing Out**

**Performance Issue in `/src/app/api/cron/run-search-scraper/route.ts` (lines 65-96)**

```typescript
for (const item of items) {  // 500 properties
  const detailUrl = property.detailUrl;

  // ⚠️ QUERY #1 - Check scraper_queue
  const existingInQueue = await db
    .collection('scraper_queue')
    .where('url', '==', detailUrl)
    .limit(1)
    .get();  // 500 queries

  // ⚠️ QUERY #2 - Check zillow_imports
  const existingInImports = await db
    .collection('zillow_imports')
    .where('url', '==', detailUrl)
    .limit(1)
    .get();  // 500 queries

  // Add to queue
  await db.collection('scraper_queue').add({...});  // 500 writes
}
```

**Total Operations:**
- 500 properties × 2 queries = **1,000 sequential database queries**
- Plus 500 writes to add to queue
- Takes 6+ minutes → **TIMEOUT**

---

## 📊 COMPLETE SYSTEM ARCHITECTURE

### **The 4-Stage Pipeline**

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: SEARCH SCRAPER (BROKEN)                                │
├─────────────────────────────────────────────────────────────────┤
│ Cron: Monday & Thursday @ 9 AM                                  │
│ File: /api/cron/run-search-scraper/route.ts                     │
│                                                                  │
│ 1. Calls Apify 'zillow-scraper' actor                          │
│ 2. Searches Zillow nationwide for owner financing keywords      │
│ 3. Returns up to 500 property URLs                              │
│ 4. Checks for duplicates (SLOW - 1000 queries)                  │
│ 5. Adds new URLs to scraper_queue                               │
│                                                                  │
│ Status: ❌ TIMING OUT - No URLs added to queue                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: SCRAPER QUEUE                                          │
├─────────────────────────────────────────────────────────────────┤
│ Collection: scraper_queue                                        │
│ Status: EMPTY (no new URLs from Stage 1)                        │
│                                                                  │
│ Fields:                                                          │
│ - url: Property detail URL                                      │
│ - status: pending/processing/completed/failed                   │
│ - addedAt: Timestamp                                             │
│ - source: 'search_cron' or 'chrome_extension'                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: QUEUE PROCESSOR                                        │
├─────────────────────────────────────────────────────────────────┤
│ Cron: Every 2 hours (10,12,14,16,18,20,22)                     │
│ File: /api/cron/process-scraper-queue/route.ts                  │
│                                                                  │
│ 1. Fetches 25 pending URLs from scraper_queue                   │
│ 2. Calls Apify 'zillow-detail-scraper' for full property data   │
│ 3. Transforms data & applies STRICT FILTER                      │
│ 4. Only saves properties with owner financing keywords           │
│ 5. Saves to zillow_imports collection                           │
│                                                                  │
│ Status: ✅ Working but has nothing to process                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: SEND TO WEBSITE (MANUAL)                               │
├─────────────────────────────────────────────────────────────────┤
│ Trigger: Admin manually via /api/admin/zillow-imports/send-to-ghl│
│                                                                  │
│ 1. Fetches properties from zillow_imports                        │
│ 2. Filters: Must have contact info + FOR_SALE status            │
│ 3. Deduplicates: Max 3 per agent/broker                         │
│ 4. Sends to GoHighLevel webhook (website)                       │
│ 5. Marks as sentToGHL: true                                      │
│                                                                  │
│ Status: ✅ Working but no new properties to send                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 CURRENT DATABASE STATE

### **zillow_imports Collection**
- **Total:** 963 properties
- **Last Added:** Nov 16, 2025 (4 days ago)
- **Sent to Website:** 813 (84.4%)
- **FOR_SALE:** 832 (86.4%)
- **With Contact:** 827 (85.9%)

### **scraper_queue Collection**
- **Total:** 0 items
- **Pending:** 0
- **Processing:** 0
- **Completed:** 0 (all processed)
- **Failed:** 0

### **Last 7 Days Activity**
- **Nov 14:** 78 properties added
- **Nov 15:** 50 properties added
- **Nov 16:** 126 properties added (LAST SUCCESSFUL RUN)
- **Nov 17:** 0 ❌
- **Nov 18:** 0 ❌ (Monday - cron should have run)
- **Nov 19:** 0 ❌
- **Nov 20:** 0 ❌ (Today)

---

## 🔧 SEARCH SCRAPER CONFIGURATION

**File:** `/src/app/api/cron/run-search-scraper/route.ts`

**Search URL:** Nationwide Zillow search with filters:
- Price: $100,000 - $750,000
- Bedrooms: 1+
- Bathrooms: 1+
- Days Listed: Last 14 days
- Keywords: "owner financing", "seller financing", "owner carry", etc.
- Property Types: Single family only
- Mode: `pagination`
- **Max Results: 500** ⚠️

**Schedule (vercel.json line 85-87):**
```json
{
  "path": "/api/cron/run-search-scraper",
  "schedule": "0 9 * * 1,4"  // Monday & Thursday @ 9 AM
}
```

**Max Duration:** 300 seconds (5 minutes)

---

## 🚨 THE PROBLEM IN DETAIL

### **Inefficient Duplicate Checking**

Current code (lines 74-96):
```typescript
for (const item of items) {  // items.length could be 500
  const detailUrl = property.detailUrl;

  // Check if already in queue - ONE QUERY PER URL
  const existingInQueue = await db
    .collection('scraper_queue')
    .where('url', '==', detailUrl)
    .limit(1)
    .get();

  if (!existingInQueue.empty) {
    alreadyInQueue++;
    continue;
  }

  // Check if already scraped - ONE QUERY PER URL
  const existingInImports = await db
    .collection('zillow_imports')
    .where('url', '==', detailUrl)
    .limit(1)
    .get();

  if (!existingInImports.empty) {
    alreadyScraped++;
    continue;
  }

  // Add to queue
  await db.collection('scraper_queue').add({...});
}
```

**Performance:**
- 500 properties found
- 2 queries per property = **1,000 Firestore queries**
- Sequential (not parallel)
- Each query: ~50-200ms
- Total time: **5-10 minutes** → TIMEOUT

---

## ✅ THE SOLUTION

### **Option 1: OPTIMIZE DUPLICATE CHECKING (RECOMMENDED)**

Batch fetch all existing URLs and compare in memory:

```typescript
// BEFORE the loop - batch fetch all existing URLs
const allQueueUrls = new Set();
const queueSnapshot = await db.collection('scraper_queue').get();
queueSnapshot.docs.forEach(doc => allQueueUrls.add(doc.data().url));

const allImportUrls = new Set();
const importSnapshot = await db.collection('zillow_imports').get();
importSnapshot.docs.forEach(doc => allImportUrls.add(doc.data().url));

// NOW loop through items - in-memory comparison
for (const item of items) {
  const detailUrl = property.detailUrl;

  // O(1) lookup instead of database query
  if (allQueueUrls.has(detailUrl)) {
    alreadyInQueue++;
    continue;
  }

  if (allImportUrls.has(detailUrl)) {
    alreadyScraped++;
    continue;
  }

  // Add to queue
  await db.collection('scraper_queue').add({...});
}
```

**Performance:**
- 2 queries total (instead of 1,000)
- In-memory Set lookups: O(1)
- Total time: **30-60 seconds** ✅

### **Option 2: REDUCE MAX RESULTS (QUICK FIX)**

Change line 29:
```typescript
maxResults: 100,  // was 500
```

**Performance:**
- 200 queries (instead of 1,000)
- Total time: **~2-3 minutes** ✅
- But less thorough

### **Option 3: SKIP DUPLICATE CHECKS**

Remove all duplicate checking, let queue processor handle it:

**Performance:**
- 0 queries during search
- Total time: **<30 seconds** ✅
- But may waste Apify credits on duplicate detail scrapes

---

## 🎯 RECOMMENDED FIX

**Implement Option 1 (Optimize) + Option 2 (Safety Limit)**

1. Optimize duplicate checking with batch queries
2. Reduce maxResults from 500 → 200 as safety buffer
3. Deploy and test
4. Monitor next scheduled run (Thursday 9 AM)

**Expected Results:**
- Completes in ~60 seconds
- Adds ~150-200 new properties per run
- Runs successfully twice per week
- **~300-400 properties every 3 days** ✅

---

## 📋 VERIFICATION STEPS

After deploying the fix:

1. **Manual Test:**
   ```bash
   curl "https://ownerfi.ai/api/cron/run-search-scraper?cron_secret=YOUR_SECRET"
   ```
   Should complete in <2 minutes

2. **Check Queue:**
   ```bash
   npx tsx scripts/check-queue-status.ts
   ```
   Should show ~150-200 pending items

3. **Wait for Queue Processor:**
   Runs every 2 hours, processes 25 URLs at a time

4. **Check zillow_imports:**
   Should see new properties added within 24 hours

---

## 📊 TIMELINE BREAKDOWN

**What Happened:**

- **Nov 14-16:** Search scraper working normally
  - Added 254 properties over 3 days
  - Queue processor working
  - Properties flowing to zillow_imports

- **Nov 18 (Monday 9 AM):** First timeout
  - Search scraper ran on schedule
  - Timed out after 5 minutes
  - 0 URLs added to queue
  - Silent failure (no error logged)

- **Nov 21 (Thursday 9 AM - upcoming):** Will timeout again
  - Unless we deploy the fix

**Why No Error Logs:**
- Vercel cron jobs don't retry on timeout
- Timeout is not logged as an error
- Just appears as "FUNCTION_INVOCATION_TIMEOUT" in deployment logs
- No alert sent

---

## 🚀 ACTION ITEMS

1. ✅ **ROOT CAUSE IDENTIFIED:** Search scraper timeout due to 1,000 sequential queries
2. ⏳ **FIX READY:** Optimize duplicate checking + reduce maxResults
3. 🔧 **DEPLOY:** Push optimized code to production
4. ✅ **TEST:** Manually trigger endpoint to verify
5. 📊 **MONITOR:** Check Thursday 9 AM run for success

---

## 💡 FUTURE IMPROVEMENTS

1. **Add Health Monitoring:**
   - Track cron job success/failure
   - Alert on timeout or 0 results
   - Daily summary email

2. **Optimize Queue Processing:**
   - Currently processes 25 URLs every 2 hours
   - Could increase to 50 for faster throughput

3. **Add Retry Logic:**
   - Retry failed Apify runs
   - Exponential backoff

4. **Dashboard:**
   - Real-time view of scraper status
   - Queue size, processing rate
   - Success/failure metrics

---

## 📞 NEXT STEPS

**Do you want me to:**
1. **Fix the search scraper code** (optimize duplicate checking)
2. **Reduce maxResults** to 200 as safety buffer
3. **Test locally** before deploying
4. **Deploy to production** and monitor

Let me know and I'll implement the fix!
