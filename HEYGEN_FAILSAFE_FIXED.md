# ✅ HeyGen Failsafe - Property Videos Added

## What Was Fixed

Property video workflows were NOT included in the HeyGen failsafe system. They are now fully covered.

---

## 🔧 Changes Made

### File: `/src/app/api/cron/check-stuck-heygen/route.ts`

**Added property video workflow checking:**

1. **Lines 131-173**: Check `property_video_workflows` collection for stuck workflows
2. **Lines 195-201**: Mark failed property workflows (no HeyGen ID)
3. **Lines 274-278**: Property-specific Submagic webhook URL
4. **Lines 280-281**: Property title handling
5. **Lines 334-341**: Update property workflow to `submagic_processing`
6. **Lines 369-375**: Mark property workflow as failed on Submagic error

---

## ⏰ Cron Schedule

The failsafe runs **every 15 minutes**:

```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "*/15 * * * *"
}
```

**Vercel.json line 45-46**

---

## 🛡️ What the Failsafe Does

### For ALL Workflows (Carz, OwnerFi, VassDist, Benefit, Podcast, **Property**)

**Every 15 minutes:**

1. **Find stuck workflows** in `heygen_processing` status
2. **Check HeyGen API** for actual video status
3. **Take action based on status:**

| HeyGen Status | Action | Result |
|---------------|--------|--------|
| **completed** | Advance to Submagic | Status → `submagic_processing` |
| **failed** | Mark as failed | Status → `failed` |
| **processing** (>30min) | Mark as failed | Status → `failed` (timeout) |
| No video ID (>30min) | Mark as failed | Status → `failed` |

---

## 📊 Workflow Coverage

| Type | Collection | Status |
|------|------------|--------|
| Carz Videos | `carz_viral_workflow_queue` | ✅ Covered |
| OwnerFi Videos | `ownerfi_viral_workflow_queue` | ✅ Covered |
| VassDist Videos | `vassdistro_viral_workflow_queue` | ✅ Covered |
| Benefit Videos | `benefit_viral_workflow_queue` | ✅ Covered |
| Podcasts | `podcast_workflow_queue` | ✅ Covered |
| **Property Videos** | `property_video_workflows` | ✅ **NOW COVERED** |

---

## 🎯 Property-Specific Logic

### Submagic Webhook
```typescript
isProperty
  ? `${baseUrl}/api/webhooks/submagic-property`
  : ...
```

### Title Handling
```typescript
workflow.propertyAddress || `Property - ${workflowId}`
```

### Status Updates
```typescript
await updateDoc(doc(db, 'property_video_workflows', workflowId), {
  status: 'submagic_processing',
  submagicVideoId: projectId,
  heygenVideoUrl: videoUrl,
  updatedAt: Date.now()
});
```

---

## 🔍 How It Works

### Step 1: Detection (Every 15 minutes)
```
Firestore Query:
  Collection: property_video_workflows
  Where: status == 'heygen_processing'

For each workflow:
  - Get heygenVideoId
  - Calculate stuck time (now - statusChangedAt)
```

### Step 2: HeyGen API Check
```
GET https://api.heygen.com/v1/video_status.get?video_id={videoId}

Response:
  {
    "data": {
      "status": "completed",
      "video_url": "https://..."
    }
  }
```

### Step 3: Action
```
IF status == 'completed':
  1. Download HeyGen video
  2. Upload to R2 storage
  3. Send to Submagic for captions
  4. Update workflow: status = 'submagic_processing'

ELSE IF status == 'failed':
  Update workflow: status = 'failed'

ELSE IF stuck > 30 minutes:
  Update workflow: status = 'failed' (timeout)
```

---

## 🚨 Failure Scenarios Handled

### 1. HeyGen Never Calls Back
**Symptom**: Workflow stuck in `heygen_processing` for 30+ minutes
**Failsafe**: Checks HeyGen API directly, advances if complete

### 2. No Video ID Received
**Symptom**: Workflow has no `heygenVideoId` after 30+ minutes
**Failsafe**: Marks as failed (HeyGen request never succeeded)

### 3. HeyGen Video Failed
**Symptom**: HeyGen API returns `status: 'failed'`
**Failsafe**: Marks workflow as failed

### 4. Submagic Upload Fails
**Symptom**: Exception during Submagic project creation
**Failsafe**: Catches error, marks workflow as failed with error message

---

## 📝 Testing

### Manual Test
```bash
# Check current stuck workflows
curl https://ownerfi.ai/api/cron/check-stuck-heygen \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### Expected Output
```json
{
  "success": true,
  "totalWorkflows": 2,
  "completed": 1,
  "failed": 1,
  "results": [
    {
      "workflowId": "prop_123",
      "brand": "property",
      "isProperty": true,
      "action": "advanced_to_submagic",
      "submagicProjectId": "abc123"
    }
  ]
}
```

---

## 🎯 Summary

**Before**: Property videos could get stuck forever if HeyGen webhook failed
**After**: Failsafe checks every 15 minutes and auto-recovers stuck workflows

### Coverage
- ✅ HeyGen timeout detection
- ✅ Automatic video status checking
- ✅ Auto-advance to Submagic when complete
- ✅ Auto-fail when HeyGen fails
- ✅ Property-specific webhook routing
- ✅ All 6 workflow types covered

### Runs Automatically
- Every 15 minutes via Vercel cron
- No manual intervention needed
- Processes up to 10 workflows per run

---

**Last Updated**: October 25, 2025
**Status**: ✅ Production Ready
**Property Videos**: ✅ Now Protected
