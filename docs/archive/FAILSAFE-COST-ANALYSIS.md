# HeyGen & Submagic Failsafe Cost Analysis

**Generated:** 2025-10-18
**Issue:** Failsafe cron jobs running too frequently and potentially costing too much

---

## 📊 Current Failsafe Configuration

### Schedule (from vercel.json)
```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "*/10 9-23 * * *"  // Every 10 minutes, 9am-11pm
},
{
  "path": "/api/cron/check-stuck-submagic",
  "schedule": "*/10 9-23 * * *"  // Every 10 minutes, 9am-11pm
}
```

### Execution Frequency

**Per Failsafe:**
- Runs every **10 minutes**
- Active hours: **9am to 11pm** (15 hours)
- Runs per hour: **6 times**
- **Runs per day: 90**

**Combined (HeyGen + Submagic):**
- **Total cron executions per day: 180**
- **Total per month: ~5,400 executions**
- **Total per year: ~65,700 executions**

---

## 🔍 What Failsafes Actually Do

### HeyGen Failsafe (`check-stuck-heygen/route.ts`)

**Queries:**
- Checks `carz_workflow_queue`, `ownerfi_workflow_queue`, and `podcast_workflow_queue`
- Finds all workflows with `status = 'heygen_processing'`

**Actions:**
1. **If workflow has `heygenVideoId`**: Check HeyGen API for completion status
   - If `completed`: Advance to Submagic processing (uploads to R2, triggers Submagic)
   - If `failed`: Mark workflow as failed
   - If `still processing`: Do nothing

2. **If workflow has NO `heygenVideoId` AND stuck > 30 minutes**: Mark as failed

**API Calls per Execution:**
- 3 Firestore queries (one per collection)
- N HeyGen API calls (where N = number of stuck workflows)
- For each completed video: R2 upload + Submagic API call

### Submagic Failsafe (`check-stuck-submagic/route.ts`)

**Queries:**
- Checks `carz_workflow_queue`, `ownerfi_workflow_queue`, and `podcast_workflow_queue`
- Finds all workflows with `status = 'submagic_processing'`

**Actions:**
1. **If workflow has `submagicVideoId`**: Check Submagic API for completion status
   - If `completed`: Download video, upload to R2, post to Late/social media
   - If `failed`: Mark workflow as failed
   - If `still processing`: Do nothing

2. **If workflow has NO `submagicVideoId` AND stuck > 30 minutes**: Mark as failed

**API Calls per Execution:**
- 3 Firestore queries (one per collection)
- N Submagic API calls (where N = number of stuck workflows)
- For each completed video: Video download + R2 upload + Late API call

---

## 💰 Cost Analysis

### Vercel Serverless Function Costs

**Cron execution costs:**
- **180 executions/day** × **~1-3 seconds average** = ~9 minutes of compute/day
- Vercel Pro: $0.000018 per GB-second
- Estimated: **~$0.50 - $2.00 per month** (depending on memory)

### Firestore Query Costs

**Each failsafe execution:**
- 3 × `WHERE status = 'heygen_processing'` queries
- 180 executions/day × 3 queries = **540 Firestore reads/day**
- **16,200 reads/month**

**Firestore pricing:**
- Free tier: 50,000 reads/day (FREE)
- Our usage: 540/day = **WELL WITHIN FREE TIER**

### API Call Costs

**HeyGen API:**
- Cost per API status check: **$0** (status checks are free)
- Only charged for video generation (not affected by failsafe frequency)

**Submagic API:**
- Cost per API status check: **$0** (status checks are free)
- Only charged for video processing (not affected by failsafe frequency)

**Total direct API costs from failsafes: $0**

---

## 🎯 The Real Question: How Often Do Failsafes Actually Trigger?

### When Failsafes Should Trigger

**Normal flow:**
1. Workflow starts → `heygen_processing` (waits for HeyGen webhook)
2. **HeyGen webhook arrives** → Status advances to `submagic_processing`
3. **Submagic webhook arrives** → Workflow completes

**Failsafe is only needed when webhooks FAIL to arrive:**
- Network issues
- Webhook endpoint down
- HeyGen/Submagic doesn't send webhook
- Webhook gets lost in transit

### Code Analysis: When Webhooks Work

**HeyGen webhook** (`/api/webhooks/heygen/route.ts`):
- Receives `event_type: 'avatar_video.success'`
- Triggers Submagic processing synchronously (lines 73)
- Updates status to `submagic_processing` (lines 226-236)

**Submagic webhook** (`/api/webhooks/submagic/route.ts`):
- Receives completion notification
- Completes workflow and posts to social media

### Expected Stuck Workflow Rate

**If webhooks work 99% of the time:**
- 1% of workflows need failsafe intervention
- ~3-5 videos/day × 1% = **0.03-0.05 workflows/day need help**
- **1-2 workflows per month actually need failsafe**

**If webhooks work 95% of the time:**
- 5% of workflows need failsafe intervention
- ~3-5 videos/day × 5% = **0.15-0.25 workflows/day need help**
- **5-8 workflows per month actually need failsafe**

### Current Execution Rate vs Need

**Current rate: 90 checks/day per failsafe**
**Expected need: <1 stuck workflow/day**

**Utilization rate: <1%** (99% of checks find nothing to do)

---

## 📉 Optimization Recommendations

### Option 1: Reduce Frequency to Every 30 Minutes
```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "*/30 9-23 * * *"  // Every 30 minutes
},
{
  "path": "/api/cron/check-stuck-submagic",
  "schedule": "*/30 9-23 * * *"
}
```

**Impact:**
- Runs per day: **30** (down from 90) = **67% reduction**
- Total executions: **60/day** (down from 180)
- Stuck workflow detection delay: 30 min max (acceptable)
- **Cost savings: ~$1-1.50/month** (minimal)

### Option 2: Reduce Frequency to Every Hour
```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "0 9-23 * * *"  // Every hour on the hour
},
{
  "path": "/api/cron/check-stuck-submagic",
  "schedule": "0 9-23 * * *"
}
```

**Impact:**
- Runs per day: **15** (down from 90) = **83% reduction**
- Total executions: **30/day** (down from 180)
- Stuck workflow detection delay: 60 min max (still acceptable)
- **Cost savings: ~$1.50-1.80/month**

### Option 3: Reduce Frequency to Every 2 Hours (RECOMMENDED)
```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "0 9-23/2 * * *"  // Every 2 hours (9am, 11am, 1pm, 3pm, 5pm, 7pm, 9pm, 11pm)
},
{
  "path": "/api/cron/check-stuck-submagic",
  "schedule": "0 9-23/2 * * *"
}
```

**Impact:**
- Runs per day: **8** (down from 90) = **91% reduction**
- Total executions: **16/day** (down from 180)
- Stuck workflow detection delay: 2 hours max (acceptable - videos take time anyway)
- **Cost savings: ~$1.80-2.00/month**

### Option 4: Smart Scheduling (Best)
```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "*/15 14-23 * * *"  // Every 15 min during peak hours (2pm-11pm)
},
{
  "path": "/api/cron/check-stuck-submagic",
  "schedule": "*/15 14-23 * * *"
}
```

**Impact:**
- Focuses checks during peak video generation times
- Runs per day: **40** (down from 90) = **56% reduction**
- Still responsive during peak hours
- Minimal cost during off-peak hours

---

## 🔍 Recommended Monitoring

Before reducing frequency, add monitoring to understand actual usage:

### 1. Add Metrics to Failsafe Responses

**Modify failsafe crons to track:**
```typescript
return NextResponse.json({
  success: true,
  timestamp: new Date().toISOString(),
  totalWorkflows: heygenProjects.length,
  stuckWorkflows: results.filter(r => r.stuckMinutes > 10).length,
  advancedWorkflows: results.filter(r => r.action === 'advanced_to_submagic').length,
  failedWorkflows: results.filter(r => r.action === 'marked_failed').length,
  results
});
```

### 2. Log to Analytics/Monitoring

Send metrics to Vercel Analytics, Datadog, or log them:
```typescript
console.log(JSON.stringify({
  event: 'failsafe_check',
  type: 'heygen',
  found: heygenProjects.length,
  advanced: advancedCount,
  timestamp: Date.now()
}));
```

### 3. Set Up Alerts

Alert if failsafe finds >5 stuck workflows (indicates webhook issues):
```typescript
if (heygenProjects.length > 5) {
  await alertWebhookIssue('heygen', heygenProjects.length);
}
```

---

## 📊 Actual Cost Impact

### Current State
- **Direct compute cost: ~$1-2/month** (minimal)
- **Firestore reads: FREE** (within free tier)
- **API calls: $0** (status checks are free)
- **Total cost: ~$1-2/month**

### Real Issue
The "cost" isn't dollars - it's:
1. **Unnecessary compute cycles** (99% of checks find nothing)
2. **Firestore query quota usage** (even if free)
3. **Log noise** (180 executions/day = lots of logs)
4. **Complexity overhead** (harder to debug when logs are full of empty checks)

---

## ✅ Action Items

### Immediate (This Week)
1. **Add logging to failsafes** to track actual utilization:
   - How many stuck workflows found per execution
   - How many workflows actually advanced
   - Average stuck time when found

2. **Monitor for 7 days** to understand patterns:
   - When do workflows actually get stuck?
   - What's the average stuck time?
   - Are webhooks working reliably?

### After Monitoring (Week 2)
3. **Adjust frequency based on data**:
   - If <1 stuck workflow/week: Reduce to every 2-4 hours
   - If 5-10 stuck/week: Reduce to every 30-60 minutes
   - If >10 stuck/week: Keep every 10 min BUT investigate webhook reliability

4. **Implement smart scheduling**:
   - Run more frequently during peak hours (2pm-11pm)
   - Run less frequently during off-hours (9am-2pm)

### Long-term (Month 2)
5. **Improve webhook reliability** to reduce failsafe need:
   - Add webhook signature verification
   - Implement webhook retry logic
   - Monitor webhook success rates
   - Alert on webhook failures immediately

6. **Add circuit breaker**:
   - If webhooks fail repeatedly, increase failsafe frequency temporarily
   - If webhooks work reliably, reduce failsafe frequency automatically

---

## 🎯 Final Recommendation

**START WITH THIS:**

```json
{
  "path": "/api/cron/check-stuck-heygen",
  "schedule": "*/30 9-23 * * *"  // Every 30 minutes
},
{
  "path": "/api/cron/check-stuck-submagic",
  "schedule": "*/30 9-23 * * *"  // Every 30 minutes
}
```

**Why:**
- Still responsive (max 30 min delay)
- 67% reduction in executions
- Low risk if something breaks
- Easy to adjust after monitoring

**Then monitor for 1 week and adjust further based on data.**

---

## 📈 Expected Outcome

**Before:**
- 180 cron executions/day
- 99% of executions find nothing to do
- ~540 Firestore reads/day

**After (30 min interval):**
- 60 cron executions/day (**67% reduction**)
- Still catch stuck workflows within 30 minutes
- ~180 Firestore reads/day (**67% reduction**)
- Cleaner logs
- Same reliability

**Success metric:**
- Zero increase in permanently stuck workflows
- Cleaner logs with less noise
- Reduced resource usage

---

**Report by:** Claude Code
**Date:** 2025-10-18
