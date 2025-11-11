# 🔥 WORKFLOW STUCK - ROOT CAUSE ANALYSIS & FIXES

## Date: 2025-11-06

## 📊 SYMPTOMS

- **Pending workflows**: Stuck for 3-9 hours, never starting
- **Posting workflows**: Stuck for 45-48 hours after Submagic completion
- **Property workflows**: Stuck for 148+ hours (6 days) in Submagic processing
- **Frequency**: 20+ times requiring manual fixes

---

## 🎯 ROOT CAUSES IDENTIFIED

### 1. **CRON TIMEOUT - CRITICAL**

**Problem:**
- `check-stuck-posting` cron times out after **5 MINUTES**
- Trying to process 10+ workflows synchronously
- Each workflow takes 30+ seconds (R2 upload + Late API posting)
- Total time: 10 workflows × 30 seconds = **5+ minutes**
- Result: **FUNCTION_INVOCATION_TIMEOUT** error

**Evidence:**
```
An error occurred with your deployment
FUNCTION_INVOCATION_TIMEOUT
iad1::v4jf7-1762453607109-fcec05c2c863
```

**Why this is catastrophic:**
- Workflows get partially processed then timeout
- Database updates may not complete
- Status stays "posting" forever
- Next cron run tries same workflows, times out again
- **INFINITE LOOP OF FAILURES**

---

### 2. **NO PENDING WORKFLOW STARTER**

**Problem:**
- Workflows in `pending` status NEVER get started
- No cron checks for `pending` status
- They sit there forever waiting for manual trigger

**Your workflows stuck in pending:**
- "La Niña" - 3 hours
- "Government Shutdown" - 9 hours

**Why:**
- `/api/workflow/complete-viral` must be manually called
- No automated trigger exists
- Articles get fetched, marked as "pending", then forgotten

---

### 3. **SYNCHRONOUS PROCESSING IN CRONS**

**Problem:**
```typescript
// Current bad pattern in check-stuck-posting:
for (const workflow of stuckWorkflows) {
  // Download from Submagic (10-20 seconds)
  const video = await downloadVideo(workflow.submagicUrl);

  // Upload to R2 (10-20 seconds)
  const r2Url = await uploadToR2(video);

  // Post to Late API (5-10 seconds)
  const result = await postToLate(r2Url);

  // Update database (1 second)
  await updateWorkflow(workflow.id, result);
}
// Total: 10 workflows × 30-50 seconds = 5-8 minutes 🔥
```

**Why this fails:**
- Cron timeout is 5 minutes
- Network latency adds unpredictable delays
- One slow workflow blocks all others
- If timeout occurs mid-loop, some workflows update, others don't
- **PARTIAL SUCCESS = CORRUPTED STATE**

---

### 4. **MISSING STATUS: `video_processing`**

**Problem:**
- Submagic webhook sets status to `video_processing`
- Then triggers async R2 upload
- If upload fails, workflow stuck in `video_processing` FOREVER
- No cron checks this status

**Code evidence:** (submagic webhook line 148-149)
```typescript
await updateWorkflowForBrand(brand, workflowId, {
  submagicDownloadUrl: downloadUrl,
  status: 'video_processing',  // ⚠️ STUCK HERE IF UPLOAD FAILS
});
```

**Cron gaps:**
- `check-stuck-submagic`: Only checks `submagic_processing`
- `check-stuck-posting`: Only checks `posting`
- **NO CRON CHECKS `video_processing`**

---

### 5. **RACE CONDITIONS**

**Problem:**
- Multiple crons can process same workflow simultaneously
- No distributed locking
- Can update status while another cron is processing

**Example scenario:**
1. `check-stuck-submagic` finds workflow, starts R2 upload (3:00pm)
2. `check-stuck-posting` finds same workflow (3:01pm)
3. Both try to upload and post simultaneously
4. Database gets conflicting updates
5. Workflow ends up in undefined state

---

### 6. **NO MAXIMUM RETRY LIMIT**

**Problem:**
- Workflows retry forever
- No circuit breaker
- Same failing workflows consume resources every cron run

**Current behavior:**
- Naples property: 148 hours stuck
- Your crons tried to fix it 74+ times (every 2 hours for 6 days)
- Each attempt uses API quota, execution time, logs
- **WASTED RESOURCES ON UNFIXABLE WORKFLOWS**

---

## 🔧 THE REAL FIXES NEEDED

### **FIX 1: Async Job Queue (CRITICAL)**

**Replace synchronous cron processing with queue-based system:**

```typescript
// NEW: check-stuck-posting just FINDS and QUEUES
export async function GET(request: NextRequest) {
  const stuckWorkflows = await findStuckPostingWorkflows();

  for (const workflow of stuckWorkflows) {
    // Queue the job, don't process it
    await queueWorkflowRecovery(workflow.id, workflow.brand);
  }

  return NextResponse.json({
    success: true,
    queued: stuckWorkflows.length
  });
  // ✅ Returns in < 5 seconds
}

// SEPARATE: Background workers process queue
async function workflowRecoveryWorker() {
  while (true) {
    const job = await getNextQueuedJob();
    if (!job) {
      await sleep(5000);
      continue;
    }

    try {
      await processWorkflowRecovery(job);
      await markJobComplete(job.id);
    } catch (err) {
      await markJobFailed(job.id, err);
    }
  }
}
```

**Options:**
- Use Vercel Background Functions (beta)
- Use Redis Queue + separate worker process
- Use Upstash QStash
- Use Inngest or Trigger.dev

---

### **FIX 2: Pending Workflow Starter Cron**

```typescript
// NEW: /api/cron/start-pending-workflows
export async function GET(request: NextRequest) {
  // Find workflows in pending > 5 minutes
  const pendingWorkflows = await findPendingWorkflows();

  for (const workflow of pendingWorkflows) {
    // Trigger workflow start
    await fetch('/api/workflow/complete-viral', {
      method: 'POST',
      body: JSON.stringify({
        brand: workflow.brand,
        articleId: workflow.articleId,
        platforms: defaultPlatforms,
        schedule: 'optimal'
      })
    });
  }

  return NextResponse.json({ started: pendingWorkflows.length });
}
```

**Schedule:** Every 10 minutes

---

### **FIX 3: Add `video_processing` to Recovery**

Update `check-stuck-posting` to also check `video_processing` status:

```typescript
const statuses = ['posting', 'video_processing']; // Add this status

for (const status of statuses) {
  const q = query(
    collection(db, collectionName),
    where('status', '==', status)
  );
  // ... process
}
```

---

### **FIX 4: Distributed Locking**

```typescript
// Before processing any workflow
const lock = await acquireLock(`workflow:${workflowId}`, 300000); // 5 min TTL
if (!lock) {
  console.log('Workflow already being processed');
  return;
}

try {
  await processWorkflow(workflowId);
} finally {
  await releaseLock(`workflow:${workflowId}`);
}
```

**Implementation:**
- Use Redis SET NX EX
- Or Firestore transaction with timestamp check
- Or Upstash Redis (serverless-friendly)

---

### **FIX 5: Max Retries + Dead Letter Queue**

```typescript
interface WorkflowQueueItem {
  // ... existing fields
  retryCount: number;
  maxRetries: number; // Default: 5
  firstFailedAt?: number;
  lastRetryAt?: number;
}

async function processWorkflow(workflow: WorkflowQueueItem) {
  if (workflow.retryCount >= workflow.maxRetries) {
    // Move to dead letter queue
    await moveToDeadLetterQueue(workflow);

    // Alert admin
    await sendAlert({
      type: 'workflow_max_retries',
      workflowId: workflow.id,
      brand: workflow.brand,
      retries: workflow.retryCount
    });

    return;
  }

  // Process...
}
```

---

### **FIX 6: Increase Cron Frequencies**

Current problems:
- Stuck workflows wait 2 hours for recovery
- Users see stuck content for hours

**New schedule:**
```json
{
  "check-stuck-submagic": "*/15 * * * *",  // Every 15 minutes (was 2 hours)
  "check-stuck-posting": "*/15 * * * *",   // Every 15 minutes (was 2 hours)
  "start-pending": "*/10 * * * *"          // Every 10 minutes (NEW)
}
```

---

## 📋 IMPLEMENTATION PRIORITY

### **IMMEDIATE (Today)**
1. ✅ Increase cron timeout in vercel.json (300s)
2. ⏳ Manually recover current stuck workflows
3. Add `video_processing` status check to stuck-posting cron
4. Increase cron frequency to 15 minutes

### **THIS WEEK**
1. Implement async job queue (Upstash QStash recommended)
2. Create pending workflow starter cron
3. Add distributed locking (Redis or Firestore transactions)
4. Add max retries + dead letter queue
5. Add admin alerts for permanently failed workflows

### **THIS MONTH**
1. Comprehensive monitoring dashboard
2. Webhook retry logic with exponential backoff
3. Circuit breakers per external API
4. Automated recovery testing
5. Performance optimization (reduce R2 upload time)

---

## 🚨 TEMPORARY WORKAROUND (Until Fixes Deployed)

**Manual Recovery Script:**
```bash
# Run every 30 minutes until fixed
./scripts/recover-via-api.ts
```

**Monitor these endpoints:**
- `/api/cron/check-stuck-submagic` - Check logs for timeouts
- `/api/cron/check-stuck-posting` - Check logs for timeouts
- Vercel logs - Search for "FUNCTION_INVOCATION_TIMEOUT"

---

## 📊 METRICS TO TRACK

After fixes deployed, monitor:
- Average time from "pending" to "completed"
- Retry count distribution
- Timeout error rate (should be 0%)
- Workflows stuck > 1 hour (should be 0)
- API costs (should decrease with fewer retries)

---

## ✅ SUCCESS CRITERIA

**Fix is successful when:**
1. NO workflows stuck > 1 hour
2. NO timeout errors in logs
3. All pending workflows start within 10 minutes
4. Recovery happens automatically without manual intervention
5. You don't have to fix this for the 21st time

---

**Created by:** Claude
**Status:** ROOT CAUSES IDENTIFIED - FIXES IN PROGRESS
**Next Steps:** Implement async queue + pending starter cron
