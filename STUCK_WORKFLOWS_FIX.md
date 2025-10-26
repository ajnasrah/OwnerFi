# 🔧 How to Fix Stuck Video Workflows

## Problem
Workflows stuck in "HeyGen Processing" status for 30+ minutes.

## Solution

### Option 1: API Endpoint (Easiest)

1. **Call the check-stuck endpoint:**
   ```bash
   curl https://ownerfi.ai/api/workflow/check-stuck
   ```

   Or visit in browser:
   ```
   https://ownerfi.ai/api/workflow/check-stuck
   ```

2. **What it does:**
   - Finds workflows stuck in `heygen_processing` status
   - Checks HeyGen API for actual video status
   - Updates workflows to:
     - `heygen_completed` if video is done
     - `failed` if video failed or timed out (60+ min)
     - Leaves as `heygen_processing` if still actively processing (<60 min)

3. **Response:**
   ```json
   {
     "success": true,
     "message": "Stuck workflow check complete",
     "checked": 2,
     "completed": 1,
     "failed": 1,
     "stillProcessing": 0,
     "errors": []
   }
   ```

---

### Option 2: Manual Script

```bash
npx tsx scripts/complete-stuck-workflows.ts
```

This does the same thing but runs locally.

---

## Why Workflows Get Stuck

1. **HeyGen webhook didn't fire**
   - Sometimes HeyGen's webhook fails to call back
   - Solution: The check-stuck endpoint polls HeyGen directly

2. **Network timeout**
   - Webhook request may have timed out
   - Solution: Script retries the status check

3. **Video actually failed**
   - HeyGen video generation failed
   - Solution: Script marks workflow as failed

---

## Prevention

The system should automatically check for stuck workflows via cron job.

**Add to your cron schedule:**
```typescript
// Check every 15 minutes for stuck workflows
*/15 * * * * curl https://ownerfi.ai/api/workflow/check-stuck
```

Or add to your existing cron job route.

---

## Avatar Position

✅ **Already fixed!** The avatar overlay is positioned at bottom-right:

```typescript
offset: {
  x: 0.65, // 65% from left (right side)
  y: 0.75  // 75% from top (bottom area)
}
```

Location: `/src/lib/property-video-generator.ts:304-307`

---

## Quick Reference

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `/api/workflow/check-stuck` | Check and fix stuck workflows | When workflows stuck 30+ min |
| `/api/workflow/complete-viral` | Trigger new video generation | Create new property video |

---

## Troubleshooting

### "No stuck workflows found" but I see them in UI

**Possible causes:**
1. Firestore query filter mismatch
2. Status field has different value than expected
3. Workflows in different collection

**Solution:**
Check Firestore directly:
```
Collection: property_video_workflows
Filter: status == "heygen_processing"
OrderBy: createdAt desc
```

### Workflows still stuck after running endpoint

**Check:**
1. HeyGen API key is valid (`HEYGEN_API_KEY`)
2. Video IDs in workflows are correct
3. Check HeyGen dashboard manually

---

## Created Files

1. `/src/app/api/workflow/check-stuck/route.ts` - API endpoint
2. `/scripts/complete-stuck-workflows.ts` - Manual script
3. `STUCK_WORKFLOWS_FIX.md` - This file

---

**Last Updated**: October 25, 2025
**Status**: ✅ Ready to use
