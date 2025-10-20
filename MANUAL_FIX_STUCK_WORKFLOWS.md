# Manual Fix for Stuck Workflows

## Your Current Issue

You have 4 workflows stuck:
- **2 in "Submagic Processing"** (2h and 20h ago)
- **2 in "Posting"** (41h and 43h ago)

## Root Cause

The workflows stuck in "Posting" means:
1. ✅ HeyGen completed successfully
2. ✅ Submagic completed successfully
3. ✅ Video uploaded to R2
4. ❌ Late API posting failed/timed out (or webhook never confirmed)

The Submagic webhook sets status to "posting" BEFORE calling Late API. If Late API fails or times out, the workflow stays stuck forever.

## Quick Manual Fix (Immediate)

### Option 1: Trigger the New Posting Failsafe Manually

```bash
curl -X POST https://ownerfi.ai/api/cron/check-stuck-posting \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

This will:
- Find all workflows stuck in "posting" > 10 minutes
- Retry Late API posting
- Mark as completed if successful
- Mark as failed if stuck > 60 minutes

### Option 2: Use the Debug Endpoint (if available)

```bash
curl -X POST https://ownerfi.ai/api/debug/complete-stuck-submagic
```

This might help with the 2 workflows stuck in "Submagic Processing".

## Long-Term Fix (Deployed)

### What Was Fixed:

1. **Created New Failsafe** (`/api/cron/check-stuck-posting`)
   - Runs every 15 minutes
   - Checks workflows stuck in "posting" or "publishing"
   - Retries Late API posting
   - Auto-recovers stuck workflows

2. **Updated Vercel Cron Schedule**
   - HeyGen: Every 2 hours (light load)
   - Submagic: Every 2 hours (light load)
   - **Posting: Every 15 minutes** (catches stuck workflows quickly)

## After Deploying to Vercel

The new failsafe will automatically:
1. Check every 15 minutes for stuck workflows
2. Retry posting if stuck > 10 minutes
3. Mark as failed if stuck > 60 minutes
4. Log detailed metrics for monitoring

## Monitoring

After deployment, check logs for:
```
🔍 [FAILSAFE-POSTING] Checking workflows stuck in posting/publishing...
```

You should see:
- How many workflows are stuck
- Retry attempts
- Success/failure status

## Prevent Future Stuckness

The root cause is that status is updated to "posting" BEFORE attempting Late API. Consider refactoring the Submagic webhook to:

```typescript
// BETTER: Only update status AFTER successful posting
await processVideoAndPost(brand, workflowId, workflow, downloadUrl);

// If we reach here, posting succeeded, mark as completed
await updateWorkflowForBrand(brand, workflowId, {
  status: 'completed',
  completedAt: Date.now()
});
```

But with the new failsafe running every 15 minutes, even if this happens, it will auto-recover within 15-30 minutes.

---

## Summary

**Before**: Workflows stuck in "posting" forever, no recovery
**After**: Auto-recovery every 15 minutes, max stuck time = 30 minutes

Deploy to Vercel and your stuck workflows will be automatically fixed! 🎉
