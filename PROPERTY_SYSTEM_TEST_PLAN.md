# OwnerFi Properties System - End-to-End Test Plan

## System Status

**Cron Schedule:** 5 times daily at 9:40am, 12:40pm, 3:40pm, 6:40pm, 9:40pm EST
**Cron Endpoint:** `/api/property/video-cron`
**Queue Endpoint:** `/api/property/populate-queue`

### Current Blocker
⚠️ **Firestore Index Building** - The `property_rotation_queue` composite index is currently building:
- Collection: `property_rotation_queue`
- Fields: `status` (ASC) → `position` (ASC) → `__name__` (ASC)
- Monitor status: https://console.firebase.google.com/project/ownerfi-95aa0/firestore/indexes

---

## Test Flow (Once Index is Ready)

### 1. **Populate the Queue**
```bash
curl -X GET http://localhost:3000/api/property/populate-queue
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Queue populated with X properties",
  "stats": {
    "total": X,
    "queued": X,
    "processing": 0
  }
}
```

**What This Does:**
- Queries `properties` collection for active properties
- Creates entries in `property_rotation_queue`
- Orders by `downPaymentAmount` (ASC) for fair rotation
- Sets initial position numbers

---

### 2. **Trigger the Cron (Manual Test)**
```bash
# Local testing (requires auth bypass or session)
curl -X POST http://localhost:3000/api/property/video-cron
```

**Expected Flow:**
1. Fetches next property from `property_rotation_queue` where `status='queued'` ORDER BY `position` LIMIT 1
2. Marks it as `status='processing'`
3. Calls `/api/property/generate-video` with propertyId
4. Generate video workflow starts:
   - Creates workflow in `property_workflow_queue`
   - Generates 15-second video variant
   - Posts to social media platforms
5. Marks property as `status='completed'` in queue
6. When all properties completed → resets cycle (all back to 'queued')

**Expected Response:**
```json
{
  "success": true,
  "variant": "15sec",
  "generated": 1,
  "property": {
    "propertyId": "abc123",
    "address": "123 Main St, City, State",
    "success": true,
    "workflowId": "workflow_xyz",
    "timesShown": 2,
    "cycleComplete": true
  },
  "queueStats": {
    "total": 50,
    "queued": 35,
    "processing": 0
  },
  "cycleProgress": {
    "completed": 15,
    "remaining": 35,
    "total": 50
  }
}
```

---

### 3. **Verify Video Workflow**
```bash
# Check workflow queue for the generated workflow
# This requires Firestore query or admin panel access
```

**Collections to Check:**
- `property_workflow_queue` - Should have new workflow entry
- `property_rotation_queue` - Property should be marked `completed`
- `properties/{propertyId}` - Check `videoCount` incremented

**Expected Workflow Document:**
```javascript
{
  workflowId: "workflow_xyz",
  propertyId: "abc123",
  status: "heygen_rendering" | "submagic_processing" | "posting" | "completed",
  brand: "ownerfi",
  platforms: ["instagram", "facebook", "tiktok", "youtube", "linkedin"],
  variant: "15sec",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  videoUrl: "gs://...", // After HeyGen completes
  captionedVideoUrl: "https://...", // After Submagic completes
  postResults: { ... } // After posting completes
}
```

---

### 4. **Monitor Background Jobs**

#### Check HeyGen Status
```bash
# Cron runs every 15 minutes
curl -X GET http://localhost:3000/api/cron/check-stuck-heygen
```

#### Check Submagic Status
```bash
# Cron runs every 15 minutes
curl -X GET http://localhost:3000/api/cron/check-stuck-submagic
```

#### Check Posting Status
```bash
# Cron runs every 2 hours
curl -X GET http://localhost:3000/api/cron/check-stuck-posting
```

#### Check Video Processing Status
```bash
# Cron runs every 2 hours
curl -X GET http://localhost:3000/api/cron/check-stuck-video-processing
```

---

### 5. **Verify Social Media Posts**

After workflow completes (typically 10-30 minutes), verify posts on:
- ✅ Instagram (@ownerfi)
- ✅ Facebook (OwnerFi page)
- ✅ TikTok (@ownerfi)
- ✅ YouTube Shorts (OwnerFi channel)
- ✅ LinkedIn (OwnerFi company page)

**Post Content Should Include:**
- 15-second property video with captions
- Property address and key details
- Down payment amount highlighted
- CTA to visit OwnerFi

---

## Complete A-Z Test Checklist

### Phase 1: Setup
- [ ] Firestore index `property_rotation_queue` fully built
- [ ] At least 10 properties in `properties` collection with `isActive=true`
- [ ] Properties have required fields: address, city, state, price, downPaymentAmount, beds, baths
- [ ] Dev environment variables configured (HeyGen, Submagic, social media APIs)

### Phase 2: Queue Population
- [ ] Run `/api/property/populate-queue`
- [ ] Verify queue created in Firestore `property_rotation_queue`
- [ ] Verify properties ordered by `downPaymentAmount` ASC
- [ ] Verify all properties have `status='queued'` and sequential `position` numbers

### Phase 3: Video Generation
- [ ] Trigger `/api/property/video-cron` (manually or wait for scheduled time)
- [ ] Verify workflow created in `property_workflow_queue`
- [ ] Verify property marked `status='processing'` then `completed` in queue
- [ ] Check logs for HeyGen API call
- [ ] Verify video file saved to Google Cloud Storage

### Phase 4: Video Processing
- [ ] HeyGen webhook received and processed
- [ ] Workflow status updated to `submagic_processing`
- [ ] Submagic adds captions to video
- [ ] Submagic webhook received and processed
- [ ] Workflow status updated to `posting`

### Phase 5: Social Media Posting
- [ ] Workflow posts to all 5 platforms
- [ ] Each platform returns success response
- [ ] Post URLs saved in workflow document
- [ ] Workflow status updated to `completed`
- [ ] Property `videoCount` incremented in properties collection

### Phase 6: Cycle Management
- [ ] Trigger cron 10+ times to complete full cycle
- [ ] Verify all properties get marked `completed`
- [ ] Verify queue automatically resets when cycle completes
- [ ] Verify new cycle starts from first property again
- [ ] Verify `currentCycleCount` incremented

### Phase 7: Error Handling
- [ ] Test with invalid property (missing fields)
- [ ] Test with HeyGen API failure
- [ ] Test with Submagic API failure
- [ ] Test with social media posting failure
- [ ] Verify stuck job crons catch and handle failures

### Phase 8: Performance
- [ ] Cron completes in < 60 seconds (maxDuration)
- [ ] Queue query uses proper index (no full collection scan)
- [ ] Property selection is fair (ordered by downPayment)
- [ ] No race conditions when multiple crons run

---

## Key Files Reference

### Cron & Queue
- `/src/app/api/property/video-cron/route.ts` - Main cron trigger (runs 5x daily)
- `/src/app/api/property/populate-queue/route.ts` - Populates rotation queue

### Video Generation
- `/src/app/api/property/generate-video/route.ts` - Generates property video
- `/src/lib/property-video-generator.ts` - Video generation logic
- `/src/lib/feed-store-firestore.ts` - Queue management functions

### Monitoring Crons
- `/src/app/api/cron/check-stuck-heygen/route.ts` - Every 15 min
- `/src/app/api/cron/check-stuck-submagic/route.ts` - Every 15 min
- `/src/app/api/cron/check-stuck-posting/route.ts` - Every 2 hrs
- `/src/app/api/cron/check-stuck-video-processing/route.ts` - Every 2 hrs

### Configuration
- `/vercel.json` - Cron schedules (line 41-42)
- `/firestore.indexes.json` - Database indexes (line 286-302)

---

## Expected Timeline for Full Test

| Time | Event |
|------|-------|
| T+0min | Trigger cron, video generation starts |
| T+2min | HeyGen starts rendering video |
| T+5-10min | HeyGen completes, webhook fires |
| T+10-12min | Submagic starts processing |
| T+15-20min | Submagic completes, webhook fires |
| T+20-25min | Posts to all 5 platforms |
| T+25-30min | Workflow marked completed |

**Total time per property: ~30 minutes**

---

## Production Monitoring

Once deployed, monitor via:
1. **Vercel Logs** - View cron execution logs
2. **Firestore Console** - Check queue and workflow collections
3. **Social Media Platforms** - Verify posts appear
4. **Error Tracking** (Sentry/etc) - Monitor for failures

---

## Troubleshooting

### Queue Empty Error
**Error:** `"Queue empty - populate via /api/property/populate-queue"`
**Fix:** Run populate endpoint to fill queue

### Index Error
**Error:** `"The query requires an index..."`
**Fix:** Wait for index to finish building in Firebase Console

### No Properties Available
**Error:** `"No properties available after reset"`
**Fix:** Add properties to `properties` collection with `isActive=true`

### Stuck in Processing
**Error:** Property stuck in `status='processing'`
**Fix:** Check stuck job crons, manually update status to 'queued' if needed

### Video Not Posting
**Error:** Workflow stuck in `posting` status
**Fix:** Check social media API credentials, review posting cron logs

---

## Next Steps

1. ✅ **Wait for Firestore index to complete building** (current blocker)
2. **Populate the queue** via `/api/property/populate-queue`
3. **Trigger cron manually** or wait for next scheduled run
4. **Monitor workflow progress** in Firestore console
5. **Verify social posts** appear on all platforms
6. **Test full cycle** by running cron 10+ times
7. **Confirm auto-reset** when cycle completes

---

*Last Updated: 2025-10-25*
