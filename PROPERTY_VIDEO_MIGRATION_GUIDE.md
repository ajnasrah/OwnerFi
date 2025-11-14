# Property Video System Migration Guide

## Overview

This guide will help you migrate from the broken 3-collection system to the new simplified single-collection system.

**Time required:** ~15 minutes
**Downtime:** ~5 minutes (while migrating)

---

## What Changed

### OLD SYSTEM (BROKEN)
```
3 Collections:
├── property_rotation_queue (388 entries) - Queue management
├── property_videos (817 entries, 776 stuck!) - Workflow tracking
└── propertyShowcaseWorkflows (0 entries) - Empty

Problem: Collections out of sync, workflows stuck forever
```

### NEW SYSTEM (FIXED)
```
1 Collection:
└── propertyShowcaseWorkflows
    ├── Queue management (queueStatus, queuePosition)
    ├── Workflow tracking (status, HeyGen, Submagic)
    └── Rotation logic (totalVideosGenerated, currentCycleCount)

Solution: Single source of truth, simple and reliable
```

---

## Migration Steps

### Step 1: Backup Current Data (Optional)

If you want to preserve history before cleanup:

```bash
# Export current collections (optional)
firebase firestore:export gs://ownerfi-95aa0.appspot.com/backups/pre-migration-$(date +%Y%m%d)
```

### Step 2: Clean Up Old Collections

**⚠️ WARNING:** This deletes ALL old workflow data (irreversible!)

```bash
# Delete all from the 3 old collections
npx tsx scripts/cleanup-old-property-system.ts --confirm
```

**What it does:**
- Deletes ~388 entries from `property_rotation_queue`
- Deletes ~817 entries from `property_videos`
- Deletes any entries from `propertyShowcaseWorkflows`
- Does NOT touch the `properties` collection

### Step 3: Populate New Queue

```bash
# Add all active properties to new queue
npx tsx scripts/populate-new-property-queue.ts
```

**What it does:**
- Queries all active properties with images
- Creates entries in `propertyShowcaseWorkflows` with:
  - `queueStatus: 'queued'`
  - `status: 'pending'`
  - `variant: '15sec'` (default)
  - `language: 'en'` (default)
- Assigns queue positions (1, 2, 3, ...)

**Expected output:**
```
✅ Added: 388 properties
📋 Final queue size: 388 properties
🎬 Next video will be: [first property address]
```

### Step 4: Update Routes

The new system uses different routes. Update your cron configuration:

**OLD:** `/api/property/video-cron`
**NEW:** `/api/property/video-cron-new`

In `vercel.json`, update the cron schedule:

```json
{
  "crons": [{
    "path": "/api/property/video-cron-new",
    "schedule": "0 11,14,17,20,23 * * *"
  }]
}
```

Or manually trigger to test:

```bash
curl -X POST https://your-domain.vercel.app/api/property/video-cron-new \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Step 5: Verify Migration

Check that everything is working:

```bash
# 1. Check queue stats
npx tsx scripts/check-new-property-queue.ts

# 2. Trigger a test video generation
curl -X POST http://localhost:3000/api/property/video-cron-new \
  -H "Authorization: Bearer $CRON_SECRET"

# 3. Monitor workflow
# Wait for HeyGen webhook, then Submagic webhook, then post
```

---

## File Changes Summary

### New Files Created

1. **`src/lib/property-workflow.ts`**
   - Core workflow management functions
   - Replaces scattered logic from `feed-store-firestore.ts`

2. **`src/lib/property-video-service-new.ts`**
   - Updated video generation service
   - Uses new `propertyShowcaseWorkflows` collection

3. **`src/app/api/property/video-cron-new/route.ts`**
   - New cron job handler
   - Simplified queue logic

4. **`scripts/cleanup-old-property-system.ts`**
   - Deletes old collections (run once)

5. **`scripts/populate-new-property-queue.ts`**
   - Populates new queue (run once)

### Files to Delete Later

Once migration is successful and you've verified the new system works:

- `src/app/api/property/video-cron/route.ts` (old cron)
- `src/lib/property-video-service.ts` (old service)
- Sections of `src/lib/feed-store-firestore.ts` related to `property_rotation_queue` and `property_videos`

**Don't delete yet!** Wait until you're confident the new system works.

---

## Webhook Configuration

The webhooks already work with the new system! No changes needed.

**Why?** The webhook handler at `/api/webhooks/heygen/[brand]` already checks the `property_videos` collection. We'll repurpose this collection name to be `propertyShowcaseWorkflows` in the webhook handler.

### Update Webhook Handler

In `src/app/api/webhooks/heygen/[brand]/route.ts`, line 267:

**OLD:**
```typescript
const docSnap = await adminDb.collection('property_videos').doc(workflowId).get();
```

**NEW:**
```typescript
const docSnap = await adminDb.collection('propertyShowcaseWorkflows').doc(workflowId).get();
```

And line 292:

**OLD:**
```typescript
const collectionName = (brand === 'property' || brand === 'property-spanish')
  ? 'property_videos'
  : `${brand}_workflow_queue`;
```

**NEW:**
```typescript
const collectionName = (brand === 'property' || brand === 'property-spanish')
  ? 'propertyShowcaseWorkflows'
  : `${brand}_workflow_queue`;
```

---

## Testing Checklist

- [ ] Old collections deleted (1205 total documents removed)
- [ ] New queue populated (~388 properties)
- [ ] First property queued at position 1
- [ ] Cron job route updated in vercel.json
- [ ] Test video generation triggered successfully
- [ ] HeyGen webhook received and processed
- [ ] Submagic webhook received and processed
- [ ] Video posted to social media
- [ ] Workflow status updated to 'completed'
- [ ] Property moved to 'completed_cycle' status
- [ ] Queue position updated for next property

---

## Rollback Plan

If something goes wrong:

1. **Restore from backup** (if you made one):
   ```bash
   firebase firestore:import gs://ownerfi-95aa0.appspot.com/backups/pre-migration-YYYYMMDD
   ```

2. **Revert cron route** in vercel.json:
   ```json
   "path": "/api/property/video-cron"
   ```

3. **Manually fix queue** by running the old populate script:
   ```bash
   npx tsx scripts/populate-property-rotation-queue.ts
   ```

---

## Monitoring

After migration, monitor for:

1. **Queue health:**
   ```bash
   # Check queue stats
   npx tsx -e "
   import { getPropertyQueueStats } from './src/lib/property-workflow';
   getPropertyQueueStats().then(stats => console.log(stats));
   "
   ```

2. **Workflow progress:**
   - Check Firestore Console → `propertyShowcaseWorkflows`
   - Look for workflows moving through statuses:
     - `pending` → `heygen_processing` → `submagic_processing` → `posting` → `completed`

3. **Error logs:**
   ```bash
   vercel logs --follow
   ```

---

## FAQ

**Q: What happens to properties that were mid-workflow?**
A: They'll be lost. The new system starts fresh. This is intentional to clean up the 776 stuck workflows.

**Q: Will I lose video generation history?**
A: Yes, unless you backed up. But the `properties` collection is untouched, so property data is safe.

**Q: Can I run old and new systems in parallel?**
A: No, they use the same webhooks. Choose one system.

**Q: How long until the first video is generated?**
A: Immediately after running the cron job (manually or via schedule).

**Q: What if a property fails validation?**
A: It stays in queue with `status: 'failed'` and can be manually fixed and retried.

---

## Support

If you encounter issues:

1. Check logs: `vercel logs --follow`
2. Check Firestore Console for workflow status
3. Run diagnostics: `npx tsx scripts/diagnose-property-queues.ts`
4. Check the old design doc: `PROPERTY_VIDEO_SYSTEM_REDESIGN.md`

---

**Ready to migrate?** Start with Step 1!
