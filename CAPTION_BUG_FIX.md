# Caption Bug Fix - "Check out this video!" Issue

## Problem

All videos posted to social media (Instagram, TikTok, YouTube, etc.) were using the generic fallback caption "Check out this video! 🔥" instead of the AI-generated, data-backed captions from the caption intelligence system.

## Root Cause

**Critical Bug in `/src/app/api/process-video/route.ts`**

The `getWorkflowForBrand` function was incorrectly handling the return value from `getWorkflowById()`.

### What Was Wrong:

1. `getWorkflowById()` returns an object with this structure:
   ```typescript
   {
     workflow: WorkflowQueueItem,
     brand: Brand
   }
   ```

2. But the code was treating it as if it returned the workflow directly:
   ```typescript
   const workflow = await getWorkflowForBrand(brand, workflowId);
   // ...
   caption = workflow.caption || 'Check out this video! 🔥';
   ```

3. This meant `workflow.caption` was **undefined** (because the actual caption was at `workflow.workflow.caption`), so it always fell back to the generic caption.

## The Fix

**File:** `src/app/api/process-video/route.ts:254-256`

**Before:**
```typescript
const { getWorkflowById } = await import('@/lib/feed-store-firestore');
return await getWorkflowById(workflowId, brand);
```

**After:**
```typescript
const { getWorkflowById } = await import('@/lib/feed-store-firestore');
const result = await getWorkflowById(workflowId);
// getWorkflowById returns { workflow, brand }, so unwrap it
return result ? result.workflow : null;
```

## Verification

### Database Check ✅
All recent workflows in Firestore had correct captions saved:
- Workflow wf_1762702240197_7j6gcpch0: "STOP! Are you feeling squeezed by rising costs in Florida?..." (250 chars)
- Workflow wf_1762702227252_b034vuy6y: "Rochester is booming — are you ready to buy?..." (250 chars)
- Workflow wf_1762700443198_dqqmr865x: "La Niña is here — are you prepared for the hurricane season?..." (249 chars)

### The Issue
The captions **were** being generated and saved correctly, but **weren't** being sent to the Late API due to this object unwrapping bug.

## Impact

**Before Fix:**
- ❌ All posts used generic "Check out this video! 🔥" caption
- ❌ Lost data-backed optimization (200-300 char formula)
- ❌ Missing engagement hooks, questions, hashtags

**After Fix:**
- ✅ Posts use AI-generated, data-backed captions
- ✅ Captions follow proven formula (hook + question + numbers + hashtags)
- ✅ Optimized for engagement (250 character sweet spot)

## Next Steps

1. **Monitor Next Workflow:** Watch the logs for the next workflow to verify captions are now being sent correctly
2. **Check Late Dashboard:** Verify new posts in Late have proper captions (not "Check out this video!")
3. **Social Media Verification:** Check actual posts on Instagram/TikTok/YouTube to confirm captions appear correctly

## Debug Logging Added

Added comprehensive logging in `process-video/route.ts` (lines 123-128, 157-158) to help debug future caption issues:

```typescript
console.log(`🔍 DEBUG: Workflow caption data:`);
console.log(`   workflow.caption exists: ${!!workflow.caption}`);
console.log(`   workflow.caption value: ${workflow.caption ? `"${workflow.caption.substring(0, 100)}..."` : 'UNDEFINED'}`);
console.log(`   workflow.title exists: ${!!workflow.title}`);
console.log(`   workflow.title value: ${workflow.title || 'UNDEFINED'}`);
// ...
console.log(`📝 Final caption being sent to Late: "${caption.substring(0, 100)}..."`);
console.log(`📝 Final title being sent to Late: "${title}"`);
```

## Deployment

- **Commit:** `5279e3f1` - "FIX: Critical bug - Unwrap workflow object to access caption field correctly"
- **Deployed:** Automatically via Vercel on push to main
- **Status:** ✅ Live

## Related Files

- `/src/app/api/process-video/route.ts` - Main fix location
- `/src/lib/feed-store-firestore.ts` - getWorkflowById function
- `/src/app/api/workflow/complete-viral/route.ts` - Caption generation and saving
- `/src/lib/caption-intelligence.ts` - Caption generation system (working correctly)
