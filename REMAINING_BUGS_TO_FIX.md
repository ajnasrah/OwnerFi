# Remaining 25 Bugs To Fix

## Status: 4/29 CRITICAL bugs fixed, 25 remaining

---

## CRITICAL Bugs (2 remaining)

### Bug #4: Webhook status race condition
**Severity:** CRITICAL
**File:** `src/app/api/webhooks/submagic/[brand]/route.ts`
**Lines:** ~80-120
**Issue:**
- Webhook updates workflow to 'completed'
- But then triggers `/api/process-video` endpoint
- If both run concurrently, race condition occurs
- Status could flip between 'completed' and 'posting'

**Fix:**
```typescript
// Update status to 'processing_final' BEFORE calling process-video
await updateWorkflowForBrand(brand, workflowId, {
  status: 'processing_final',
  submagicDownloadUrl: downloadUrl
});

// Then trigger processing
await fetch(`${baseUrl}/api/process-video`, ...);
```

**Impact:** Prevents duplicate API calls and inconsistent states

---

### Bug #5: Firebase SDK mismatch in webhook idempotency
**Severity:** CRITICAL
**File:** `src/lib/webhook-idempotency.ts`
**Issue:**
- Uses Firebase Client SDK in server-side webhook handlers
- Client SDK doesn't work reliably in serverless functions
- Idempotency checks fail silently
- Webhooks process duplicates

**Fix:**
```typescript
// Replace client SDK with Admin SDK
import { db } from './firebase-admin-init'; // Admin SDK
// Remove: import { db } from './firebase'; // Client SDK
```

**Impact:** Prevents duplicate webhook processing

---

## HIGH Priority Bugs (5 remaining)

### Bug #6: Module-level env var loading
**Severity:** HIGH
**File:** `src/lib/env-config.ts`, `src/lib/heygen-client.ts`, etc.
**Issue:**
- Environment variables loaded at module level
- In serverless, env vars can change between deployments
- Old values cached in memory
- API calls fail with stale keys

**Fix:**
```typescript
// Bad (module level)
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

// Good (function level)
function getHeyGenKey() {
  return process.env.HEYGEN_API_KEY;
}
```

**Impact:** Prevents stale API key issues

---

### Bug #7: No article content validation
**Severity:** HIGH
**File:** `src/app/api/workflow/complete-viral/route.ts:60-74`
**Issue:**
- Allows articles with < 200 chars (just logs warning)
- These generate poor videos
- Workflow completes but video quality terrible
- Wastes HeyGen credits

**Fix:**
```typescript
if (contentLength < 200) {
  console.error(`❌ Article too short: ${contentLength} chars`);
  // Mark article as processed so it's not retried
  await markArticleAsProcessed(article.id);
  return NextResponse.json({
    success: false,
    error: 'Article content too short for video generation'
  }, { status: 400 });
}
```

**Impact:** Prevents wasted API credits on bad content

---

### Bug #8: Firestore transaction timeout under concurrency
**Severity:** HIGH
**File:** `src/lib/feed-store-firestore.ts`
**Lines:** Transaction-based locks (getAndLockArticle, etc.)
**Issue:**
- Uses Firestore transactions for article locking
- Under high concurrency (5+ crons), transactions timeout
- Articles processed multiple times
- Duplicate videos created

**Fix:**
```typescript
// Add retry logic with exponential backoff
async function getAndLockArticleWithRetry(brand, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getAndLockArticle(brand);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

**Impact:** Prevents duplicate video generation

---

### Bug #9: Abdullah workflows not in failsafes
**Severity:** HIGH
**File:** `src/app/api/cron/check-stuck-heygen/route.ts`
**Lines:** Brand filtering logic
**Issue:**
- Failsafe crons only check 'carz', 'ownerfi', 'vassdistro'
- Abdullah brand workflows not monitored
- Stuck workflows never recovered
- Lost videos

**Fix:**
```typescript
const brands: Brand[] = ['carz', 'ownerfi', 'vassdistro', 'abdullah'];
// Add abdullah to all failsafe crons
```

**Impact:** Ensures all brands monitored

---

## MEDIUM Priority Bugs (10 remaining)

### Bug #10: Caption generation blocks entire workflow
**File:** `src/app/api/workflow/complete-viral/route.ts:98`
**Fix:** Wrap in try-catch, use fallback caption if fails

### Bug #11: Webhook signature verification can be bypassed
**File:** `src/lib/webhook-verification.ts`
**Fix:** Enforce verification in production (currently optional)

### Bug #12: Weak cron lock instance ID
**File:** Multiple cron files
**Fix:** Use cryptographically secure random for lock IDs

### Bug #13: Profile IDs not validated before Firestore queries
**File:** `src/lib/feed-store-firestore.ts`
**Fix:** Add validation to prevent injection

### Bugs #14-19: (6 more medium priority)
- Hardcoded retry counts
- Missing index hints
- Inconsistent error messages
- No request deduplication
- Missing rate limit headers
- Unbounded array growth

---

## LOW Priority Bugs (4 remaining)

### Bug #20: Missing configuration logging on startup
**Fix:** Log all env vars (masked) on server start

### Bug #21: Duplicated HTML entity decoding
**Fix:** Extract to shared utility function

### Bug #22: No success logging for background operations
**Fix:** Add success logs for fire-and-forget calls

### Bug #23: Unused variables and imports
**Fix:** Run ESLint and clean up

---

## Recommended Fix Order

1. **CRITICAL #4 & #5** - Webhook race conditions (highest impact)
2. **HIGH #7** - Article validation (prevents wasted credits)
3. **HIGH #9** - Abdullah failsafes (missing monitoring)
4. **HIGH #6** - Env var loading (deployment safety)
5. **HIGH #8** - Transaction timeouts (data integrity)
6. **MEDIUM #10-15** - Batch fix error handling
7. **LOW #20-23** - Polish and cleanup

## Testing Plan

After each fix:
1. Deploy to staging
2. Trigger test workflow for affected brand
3. Monitor logs for 10 minutes
4. Verify completion in dashboard
5. Check Firestore data integrity

## Estimated Time
- CRITICAL: 2-3 hours
- HIGH: 3-4 hours
- MEDIUM: 4-5 hours
- LOW: 1-2 hours
**Total: 10-14 hours of focused work**

---

**Current Status:**
- ✅ 4 bugs fixed and deployed
- 🔄 25 bugs remaining
- 📊 System audit complete
- 🎯 Ready for systematic fixes
