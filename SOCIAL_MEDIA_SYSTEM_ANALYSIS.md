# Social Media System - Comprehensive Analysis
**Date:** November 15, 2025
**Status:** CRITICAL ANALYSIS COMPLETE

---

## 🎯 Executive Summary

The social media system processes video workflows across **9 brands** using **2 consolidated cron jobs** that replaced **7 separate crons** (67-75% reduction in cron invocations). While the consolidation improves efficiency, it introduces **potential race conditions, data consistency risks, and cascading failure scenarios** that need monitoring.

### Key Metrics
- **Brands:** 9 (carz, ownerfi, vassdistro, benefit, abdullah, personal, podcast, property, property-spanish)
- **Workflow Collections:** 7 different Firestore collections
- **Daily Cron Invocations:** ~39 (down from ~151 before consolidation)
- **Workflow States:** 7 (pending → heygen_processing → submagic_processing → posting → completed/failed)
- **Max Cron Duration:** 300s (5 minutes) for check-stuck-workflows

---

## 📊 System Architecture

### **Consolidated Cron Jobs**

#### 1. **generate-videos** (5x daily at 9am, 12pm, 3pm, 6pm, 9pm CST)
**Purpose:** Generate new videos for all brands
**Collections:** Processes all 7 workflow collections
**Duration:** ~60s max
**Lock:** "generate-videos" (5min TTL)

**Flow:**
```
1. Generate podcast episode (if due) → HeyGen
2. For each article brand (carz, ownerfi, vassdistro, benefit, abdullah, personal):
   - Get unprocessed articles from RSS
   - Trigger complete-viral workflow
   - Creates workflow in {brand}_workflow_queue
```

**Potential Issues:**
- ✅ Sequential processing prevents overwhelming APIs
- ⚠️ If one brand fails, others continue (good isolation)
- ⚠️ No transaction support - partial failures possible

---

#### 2. **check-stuck-workflows** (every 30 min during active hours)
**Purpose:** Check and advance stuck workflows across all brands
**Collections:** ALL 7 collections checked in parallel
**Duration:** Up to 300s (5 minutes)
**Lock:** "check-stuck-workflows" (5min TTL)

**Flow:**
```
1. Check pending workflows (all brands) → start up to 3
2. Check heygen_processing (all brands) → advance to Submagic
3. Check submagic_processing (all brands) → post to Late
4. Check posting/video_processing (all brands) → retry
```

**CRITICAL ISSUES IDENTIFIED:**
- ⚠️ **Lock Expiration Risk:** Max duration = lock TTL (both 5min). If cron runs longer, lock expires and another instance can start
- ⚠️ **Cascading Failures:** Processes ALL brands in sequence. If early brands are slow, later brands timeout
- ⚠️ **No Priority System:** All brands treated equally. Important workflows can't jump queue
- ⚠️ **Recovery Logic Complexity:** Also checks video_processing_failed workflows with heygenVideoUrl for recovery (lines 361-442)

---

### **Workflow Collections by Brand**

| Brand | Collection | Notes |
|-------|-----------|-------|
| carz | `carz_workflow_queue` | Article-based |
| ownerfi | `ownerfi_workflow_queue` | Article-based |
| vassdistro | `vassdistro_workflow_queue` | Article-based |
| benefit | `benefit_workflow_queue` | Article-based |
| abdullah | `abdullah_workflow_queue` | Queue-based (separate processor) |
| personal | `personal_workflow_queue` | Article-based |
| podcast | `podcast_workflow_queue` | Episode-based |
| property | `propertyShowcaseWorkflows` | **UNIFIED** with property-spanish |
| property-spanish | `propertyShowcaseWorkflows` | **UNIFIED** with property |

**Key Insight:** Property system recently migrated to unified collection (see PROPERTY_SYSTEM_FIXES_COMPLETE.md). This was due to **100% webhook failure** from collection mismatch.

---

### **Workflow State Machine**

```
pending
  ↓
heygen_processing (HeyGen API call made, videoId saved)
  ↓
submagic_processing (Submagic API call made, projectId saved)
  ↓
posting (Video uploaded to R2, Late API call made)
  ↓
completed (Late post confirmed)

Failed States:
- failed (generic failure)
- video_processing_failed (HeyGen video exists but Submagic failed)
- export_failed (Submagic captions done but export failed)
```

**CRITICAL FIX History:**
Recent commits show multiple fixes where `status` was set to `heygen_processing` BEFORE `heygenVideoId` was saved. This caused workflows to be stuck without recovery path.

**Current Fix (implemented):**
```typescript
// CRITICAL FIX: Update workflow with HeyGen video ID AND status atomically
await updateWorkflowStatus(workflowId, brand, {
  heygenVideoId: videoResult.video_id,
  status: 'heygen_processing'  // ✅ Set status HERE after getting video ID
});
```

**Risk:** Multiple places still update workflows (crons, webhooks, queue processors). No database transactions = potential for partial updates.

---

## 🚨 Identified Issues & Risks

### **1. Race Conditions**

#### 1.1 Cron Lock Expiration
**Location:** `src/lib/cron-lock.ts:10`
**Issue:** Lock TTL = 5 minutes, but `check-stuck-workflows` can run up to 5 minutes (maxDuration: 300s)

```typescript
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const maxDuration = 300; // 5 minutes (check-stuck-workflows)
```

**Scenario:**
1. Cron A acquires lock at 12:00:00
2. Cron A starts processing (slow due to many stuck workflows)
3. Lock expires at 12:05:00
4. Cron A still running at 12:05:01
5. Cron B can now acquire lock and start processing
6. **Result:** Both instances processing same workflows simultaneously

**Fix Needed:**
- Increase lock TTL to 10 minutes OR
- Reduce maxDuration to 4 minutes OR
- Implement lock refresh mechanism

---

#### 1.2 Duplicate Workflow Creation
**Location:** `src/app/api/cron/generate-videos/route.ts:268`

```typescript
// Trigger workflow
const mockRequest = new Request('https://ownerfi.ai/api/workflow/complete-viral', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand,
    platforms: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'],
    schedule: 'immediate'
  })
});
```

**Issue:** No check if workflow already exists for this article. If cron runs twice (lock failure), duplicate workflows created.

**Mitigation (partial):** `getAndLockArticle()` in `complete-viral/route.ts:52` attempts to lock article, but this is NOT a database transaction - race window exists.

---

#### 1.3 Webhook vs Cron Status Updates
**Location:** Multiple files

**Issue:** Webhooks (admin SDK) and crons (client SDK) can update same workflow simultaneously.

**Example:**
1. Cron: "Check HeyGen status → completed → trigger Submagic"
2. Webhook (same time): "HeyGen completed → trigger Submagic"
3. **Result:** Submagic API called twice = double cost

**Mitigation (implemented):** Webhook idempotency checks (`src/app/api/webhooks/heygen/[brand]/route.ts:79-102`)

```typescript
const idempotencyCheck = await isWebhookProcessed('heygen', videoId, brand, body);
if (idempotencyCheck.processed) {
  console.log(`⚠️  Webhook already processed, returning cached response`);
  return NextResponse.json(idempotencyCheck.previousResponse);
}
```

**Remaining Risk:** Cron still doesn't check idempotency. Can still call Submagic if webhook failed.

---

### **2. Data Consistency Issues**

#### 2.1 No Database Transactions
**Issue:** Firestore updates are NOT atomic across multiple operations.

**Example from `check-stuck-workflows/route.ts:319-325`:**
```typescript
await updateDoc(doc(db, collectionName, workflowId), {
  status: 'submagic_processing',
  submagicVideoId: projectId,
  heygenVideoUrl: publicHeygenUrl,
  updatedAt: Date.now()
});
```

**Risk:** If process crashes after `status` update but before `submagicVideoId` update, workflow is stuck in `submagic_processing` without a project ID.

**Mitigation:** Recent fixes ensure videoId/projectId saved BEFORE status change, but still not transactional.

---

#### 2.2 Mixed Data Sources
**Issue:** Different collections for different brands can lead to inconsistent queries.

**Example:** Property system had webhook failures because:
- Queue used `propertyShowcaseWorkflows`
- Video generation wrote to `property_videos`
- Webhooks looked in `propertyShowcaseWorkflows`
- **Result:** 0% webhook success rate until fixed

**Status:** Fixed as of Nov 15, 2025 (see PROPERTY_SYSTEM_FIXES_COMPLETE.md)

---

#### 2.3 Status Transition Inconsistencies
**Issue:** Multiple paths to same status = different field sets.

**Example:**
- Path 1: `complete-viral` → `heygen_processing` (has articleId, caption)
- Path 2: `check-stuck-workflows` → `heygen_processing` (missing caption if recovered)

**Result:** Some workflows have incomplete data, causing failures downstream.

---

### **3. Cascading Failure Scenarios**

#### 3.1 One Brand Slows All Brands
**Location:** `check-stuck-workflows/route.ts:49-76`

**Flow:**
```
1. Check pending (ALL brands sequentially)
2. Check heygen (ALL brands sequentially)
3. Check submagic (ALL brands sequentially)
4. Check posting (ALL brands sequentially)
```

**Issue:** If Brand A has 50 stuck workflows and Brand B has 1, Brand B must wait for Brand A to finish.

**Scenario:**
1. Carz has 100 workflows stuck in heygen_processing (API slow)
2. Cron checks all 100 Carz workflows (takes 3 minutes)
3. Only 2 minutes left for other 8 brands
4. Timeout before reaching Abdullah workflows
5. **Result:** Abdullah workflows never get processed

**Actual Code Evidence:**
```typescript
for (const brand of brands) {  // Sequential loop
  try {
    const collectionName = `${brand}_workflow_queue`;
    console.log(`📂 Checking ${collectionName}...`);

    const q = query(
      collection(db, collectionName),
      where('status', '==', 'heygen_processing'),
      firestoreLimit(10)  // Up to 10 per brand
    );

    // ... process all 10 workflows ...
  }
}
```

**Math:**
- 9 brands × 10 workflows/brand = 90 workflows max
- If each takes 2 seconds = 180 seconds minimum
- Lock TTL = 300 seconds
- **Remaining buffer:** 120 seconds (tight!)

---

#### 3.2 External API Failures Propagate
**Issue:** No circuit breaker aggregation across brands.

**Current Implementation:**
- Individual circuit breakers exist (`src/lib/api-utils.ts`)
- But they're per-API, not per-brand
- If HeyGen API is down, ALL brands fail HeyGen processing

**No Brand-Level Isolation:**
If Submagic API fails for Carz, the circuit breaker opens. But the cron still tries Submagic for all other brands, wasting time on calls that will fail.

---

### **4. Performance & Scalability**

#### 4.1 Query Performance
**Issue:** Checking all brands sequentially can be slow.

**Current:**
```typescript
for (const brand of brands) {
  const snapshot = await getDocs(q);  // Serial Firestore query
  // Process...
}
```

**Better:**
```typescript
// Parallel queries
const queries = brands.map(brand => getDocs(query(...)));
const results = await Promise.all(queries);
```

**Savings:** ~2-3 seconds per cron run (queries run in parallel vs sequential)

---

#### 4.2 Webhook Validation Overhead
**Location:** `webhooks/heygen/[brand]/route.ts:350-362`

**Issue:** Webhook validates HeyGen video URL by making HEAD request.

```typescript
try {
  console.log(`🔍 Validating HeyGen video URL...`);
  const headResponse = await fetch(heygenVideoUrl, { method: 'HEAD' });
  // ...
}
```

**Risk:** HeyGen API slow = webhook timeout = workflow marked failed even though video is ready.

**Mitigation:** Error is caught and logged, doesn't fail workflow. But adds latency.

---

### **5. Monitoring & Observability Gaps**

#### 5.1 No Alerting on Lock Contention
**Issue:** If multiple cron instances run simultaneously (lock failure), no alerts.

**Current Behavior:**
```typescript
if (!instanceId) {
  console.log(`⏭️  Skipping "${cronName}" - another instance is running`);
  return null;
}
```

**Risk:** Silent failures. Could indicate infrastructure issues but no alerts sent.

---

#### 5.2 No Cross-Brand Metrics
**Issue:** Each brand reports separately. No aggregated health view.

**Example:**
- Carz: 95% success rate
- OwnerFi: 92% success rate
- **Overall:** ??? (not tracked)

**Result:** System-wide degradation hard to detect.

---

## ✅ Good Practices Identified

### 1. Idempotency Checks
**Location:** `webhooks/heygen/[brand]/route.ts:93`

Webhooks check if already processed to prevent duplicate API calls:
```typescript
const idempotencyCheck = await isWebhookProcessed('heygen', videoId, brand, body);
if (idempotencyCheck.processed) {
  return NextResponse.json(idempotencyCheck.previousResponse);
}
```

### 2. Critical Fix for Status Before VideoId
**Recent Fix:** Status now set AFTER videoId received, preventing stuck workflows.

### 3. Recovery Logic
**Location:** `check-stuck-workflows/route.ts:361-442`

Cron automatically recovers `video_processing_failed` workflows that have `heygenVideoUrl`.

### 4. Brand Isolation in Webhooks
Each brand has separate webhook endpoint preventing cross-contamination.

### 5. Cron Locking
Prevents duplicate cron runs (with TTL caveat noted above).

---

## 📋 Recommendations

### **Priority 1: Critical (Fix Immediately)**

#### 1.1 Fix Lock TTL vs Max Duration Mismatch
```typescript
// src/lib/cron-lock.ts
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes (was 5)

// OR

// src/app/api/cron/check-stuck-workflows/route.ts
export const maxDuration = 240; // 4 minutes (was 300)
```

#### 1.2 Add Lock Refresh Mechanism
```typescript
export async function refreshCronLock(cronName: string, instanceId: string): Promise<boolean> {
  // Extend lock expiration if we still own it
  const lockRef = doc(db, LOCK_COLLECTION, cronName);
  const lockDoc = await getDoc(lockRef);

  if (lockDoc.exists() && lockDoc.data().instanceId === instanceId) {
    await updateDoc(lockRef, { expiresAt: Date.now() + LOCK_TTL_MS });
    return true;
  }
  return false;
}
```

---

### **Priority 2: High (Fix This Week)**

#### 2.1 Parallelize check-stuck-workflows Queries
```typescript
// Instead of:
for (const brand of brands) {
  const snapshot = await getDocs(q);
  // Process...
}

// Use:
const brandQueries = brands.map(async (brand) => {
  const snapshot = await getDocs(q);
  return { brand, snapshot };
});
const results = await Promise.all(brandQueries);
// Process results in parallel
```

**Benefit:** 2-3x faster execution, reduces timeout risk

---

#### 2.2 Add Circuit Breaker Per Brand
```typescript
const brandCircuitBreakers = {
  carz: new CircuitBreaker(...),
  ownerfi: new CircuitBreaker(...),
  // ...
};

// If one brand's circuit opens, others unaffected
```

---

#### 2.3 Add Workflow Processing Timeout
```typescript
// Limit time spent per brand to prevent one brand blocking others
const BRAND_PROCESSING_TIMEOUT = 30_000; // 30 seconds per brand

for (const brand of brands) {
  try {
    await Promise.race([
      processBrand(brand),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Brand timeout')), BRAND_PROCESSING_TIMEOUT)
      )
    ]);
  } catch (err) {
    console.error(`Brand ${brand} timed out, continuing to next brand`);
    continue;
  }
}
```

---

### **Priority 3: Medium (Fix This Month)**

#### 3.1 Add Cross-Brand Metrics
```typescript
interface SystemHealthMetrics {
  totalPending: number;
  totalProcessing: number;
  totalFailed: number;
  brandBreakdown: Record<string, { pending: number; processing: number; failed: number }>;
  oldestWorkflow: { brand: string; age: number };
  avgProcessingTime: number;
}

async function getSystemHealth(): Promise<SystemHealthMetrics> {
  // Aggregate across all brands
}
```

#### 3.2 Add Alerting for Lock Contention
```typescript
if (!instanceId) {
  console.log(`⏭️  Skipping "${cronName}" - another instance is running`);

  // NEW: Send alert if this happens frequently
  await sendAlert({
    severity: 'warning',
    message: `Cron ${cronName} lock contention detected`,
    context: { timestamp: Date.now() }
  });

  return null;
}
```

#### 3.3 Implement Priority Queue
```typescript
// High-priority brands (Abdullah, Property) processed first
const brandPriority: Record<string, number> = {
  abdullah: 1,
  property: 1,
  'property-spanish': 1,
  podcast: 2,
  benefit: 2,
  carz: 3,
  ownerfi: 3,
  vassdistro: 3,
  personal: 3,
};

const sortedBrands = brands.sort((a, b) =>
  brandPriority[a] - brandPriority[b]
);
```

---

### **Priority 4: Low (Monitoring & Cleanup)**

#### 4.1 Remove Unused Collections
After 7 days of stable operation, archive deprecated collections:
- `property_videos` (replaced by `propertyShowcaseWorkflows`)
- `property_rotation_queue` (replaced by `propertyShowcaseWorkflows`)

#### 4.2 Add Comprehensive Logging
```typescript
console.log('📊 Cron Summary:', {
  cron: 'check-stuck-workflows',
  duration: duration,
  brandsProcessed: brands.length,
  workflowsChecked: totalChecked,
  workflowsAdvanced: totalAdvanced,
  workflowsFailed: totalFailed,
  lockHeld: instanceId,
  timestamp: new Date().toISOString(),
});
```

---

## 🧪 Testing Recommendations

### Load Testing Scenarios

#### Scenario 1: Lock Expiration
1. Simulate slow Firestore queries (add delay)
2. Verify cron duration exceeds 5 minutes
3. Confirm second instance DOES NOT start
4. **Expected:** Lock TTL increased prevents collision

#### Scenario 2: Brand Cascade
1. Create 100 stuck workflows for Carz
2. Create 1 stuck workflow for Abdullah
3. Run check-stuck-workflows
4. **Expected:** Abdullah workflow processed within timeout

#### Scenario 3: Webhook + Cron Race
1. Trigger HeyGen completion webhook
2. Simultaneously run check-stuck-workflows
3. **Expected:** Only one Submagic API call (idempotency works)

---

## 📊 System Health Dashboard

### Metrics to Monitor

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Cron duration | >240s | Warning |
| Cron duration | >280s | Critical |
| Lock contention rate | >10% | Warning |
| Workflows stuck >1 hour | >5 | Warning |
| Workflows stuck >24 hours | >1 | Critical |
| Workflow success rate | <90% | Warning |
| Workflow success rate | <80% | Critical |
| Cross-brand processing time variance | >2x | Warning |

### Example Query
```typescript
// Get all workflows stuck >1 hour
const oneHourAgo = Date.now() - (60 * 60 * 1000);

const stuckWorkflows = await Promise.all(
  brands.map(async (brand) => {
    const q = query(
      collection(db, `${brand}_workflow_queue`),
      where('status', 'in', ['heygen_processing', 'submagic_processing', 'posting']),
      where('updatedAt', '<', oneHourAgo)
    );
    const snapshot = await getDocs(q);
    return { brand, count: snapshot.size };
  })
);
```

---

## 🎯 Conclusion

The social media system consolidation significantly reduced cron invocations (67-75% reduction), but introduced complexity and potential failure modes:

### **Strengths:**
✅ Efficient resource usage (fewer cron runs)
✅ Good webhook isolation per brand
✅ Idempotency checks prevent duplicate API calls
✅ Recent fixes improved status/videoId consistency
✅ Recovery logic handles some failure scenarios

### **Critical Risks:**
⚠️ Lock TTL = max duration (race condition risk)
⚠️ Sequential brand processing (cascading failures)
⚠️ No database transactions (partial update risk)
⚠️ Timeout risk if many workflows stuck
⚠️ No cross-brand metrics or alerts

### **Recommended Actions:**
1. **Immediate:** Fix lock TTL mismatch (P1.1)
2. **This Week:** Parallelize queries (P2.1), add brand timeouts (P2.3)
3. **This Month:** Add system health metrics (P3.1), priority queue (P3.3)
4. **Ongoing:** Monitor lock contention, workflow age, cron duration

### **Overall Assessment:**
System is **FUNCTIONAL** but **NOT PRODUCTION-HARDENED**. Recent property system fixes show the architecture is fragile and requires careful monitoring. Recommendations above will improve reliability and prevent cascading failures.

**Next Review:** After implementing P1 and P2 recommendations (1 week from now)

---

**Analysis completed:** November 15, 2025
**Analyzed by:** Claude Code
**Files examined:** 25+ workflow files, crons, webhooks, and queue processors
