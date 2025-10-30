# CRITICAL FIX: Property Workflows Stuck for 74+ Hours

## Problem Summary
- **Property videos stuck in "posting" status for 74+ hours**
- **No new property videos being generated**
- **Root cause: Missing Firestore indexes prevent failsafe cron from detecting stuck workflows**

## What Was Found
```
Property Rotation Queue: 301 total properties
- Queued: 279
- Processing: 0
- Completed: 22
- Failed: 0
```

**The failsafe cron `/api/cron/check-stuck-posting` CANNOT QUERY for stuck workflows because indexes don't exist!**

---

## IMMEDIATE FIX (Required)

### Step 1: Create Missing Firestore Indexes

**Click these links to create the required indexes:**

1. **property_videos: status + updatedAt DESC**
   https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=ClVwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wcm9wZXJ0eV92aWRlb3MvaW5kZXhlcy9fEAEaCgoGc3RhdHVzEAEaDQoJdXBkYXRlZEF0EAIaDAoIX19uYW1lX18QAg

2. **property_videos: status + updatedAt ASC**
   Click "Create Index" in Firebase Console:
   - Collection: `property_videos`
   - Fields:
     - `status` (Ascending)
     - `updatedAt` (Ascending)

3. **property_videos: status + completedAt DESC**
   Click "Create Index" in Firebase Console:
   - Collection: `property_videos`
   - Fields:
     - `status` (Ascending)
     - `completedAt` (Descending)

### Step 2: Wait for Index Building
- **Time required:** 5-10 minutes
- Monitor in Firebase Console → Firestore → Indexes
- Wait until all show **"Enabled"** status

### Step 3: Manually Trigger Stuck Workflow Recovery

Once indexes are enabled, run:

```bash
# Trigger the failsafe cron to detect and retry stuck workflows
curl -X GET "https://owner-c1v1gudvx-abdullah-abunarsahs-projects.vercel.app/api/cron/check-stuck-posting" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or via admin dashboard:
https://owner-c1v1gudvx-abdullah-abunarsahs-projects.vercel.app/admin/social-dashboard

### Step 4: Verify System is Working

Check that property workflows are unstuck:

```bash
npx tsx scripts/check-property-stuck.ts
```

Should show:
- ✅ No workflows stuck in posting >10 minutes
- ✅ No workflows stuck in video_processing >10 minutes
- ✅ Recent completed workflows

---

## What These Indexes Do

The `/api/cron/check-stuck-posting` cron (runs every 10 minutes) queries for:

```typescript
// Stuck in posting for >10 minutes
db.collection('property_videos')
  .where('status', '==', 'posting')
  .where('updatedAt', '<', tenMinutesAgo)  // <-- NEEDS INDEX!
  .get()

// Stuck in video_processing for >10 minutes
db.collection('property_videos')
  .where('status', '==', 'video_processing')
  .where('updatedAt', '<', tenMinutesAgo)  // <-- NEEDS INDEX!
  .get()
```

**Without these indexes, the queries fail silently and workflows stay stuck forever!**

---

## Why This Happened

1. The `property_videos` collection was added later
2. Indexes were created for other collections (carz_workflow_queue, ownerfi_workflow_queue, etc.)
3. But `property_videos` indexes were missed
4. The failsafe cron has been silently failing for weeks/months
5. Workflows get stuck and never recover

---

## Code Changes Made

1. **Added missing indexes to `firestore.indexes.json`:**
   - property_videos: status + updatedAt DESC
   - property_videos: status + updatedAt ASC
   - property_videos: status + completedAt DESC

2. **Created diagnostic script: `scripts/check-property-stuck.ts`**
   - Checks property_rotation_queue stats
   - Finds stuck workflows in all statuses
   - Shows retry counts and errors

3. **Committed changes to development branch**

---

## Long-term Prevention

### Monitor These Metrics Daily:
1. **Stuck Workflows:** Should always be 0
2. **Failsafe Cron Success Rate:** Should be 100%
3. **Property Videos Generated:** Should be 5/day (1 per cron run × 5 runs)

### Set Up Alerts:
- Alert if any workflow stuck >30 minutes
- Alert if no property videos generated in 24 hours
- Alert if failsafe cron fails

### Test After Any Schema Changes:
```bash
# Always test queries work locally before deploying
npx tsx scripts/check-property-stuck.ts
```

---

## Current System Status

**❌ BROKEN (until indexes deployed):**
- Failsafe cron cannot detect stuck workflows
- Property videos will continue getting stuck
- Manual intervention required for each stuck workflow

**✅ WILL BE FIXED (after indexes deployed):**
- Failsafe cron can query stuck workflows
- Auto-retry kicks in after 10 minutes
- System self-heals automatically

---

## Files Changed

- `firestore.indexes.json` - Added 3 new property_videos indexes
- `scripts/check-property-stuck.ts` - Diagnostic tool (NEW)
- `CRITICAL_FIX_INSTRUCTIONS.md` - This file (NEW)

---

## Verification Checklist

After deploying indexes:

- [ ] All 3 indexes show "Enabled" in Firebase Console
- [ ] Run diagnostic script - no stuck workflows >10 min
- [ ] Trigger failsafe cron - completes without errors
- [ ] Wait 1 hour - verify stuck workflows auto-recover
- [ ] Check next property video cron run - generates successfully
- [ ] Monitor for 24 hours - no new stuck workflows

---

## Support

If issues persist after deploying indexes:

1. Check Vercel logs for failsafe cron errors
2. Check Firebase Console for index build status
3. Run diagnostic script to see current state
4. Manually retry stuck workflows via admin dashboard

**Created:** 2025-10-30
**Priority:** P0 - CRITICAL
**Impact:** Entire property social media system is blocked
