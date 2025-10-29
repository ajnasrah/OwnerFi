# 🧪 Testing Instructions

## Quick Start Testing Guide

This guide walks you through testing the brand isolation system step-by-step.

---

## Prerequisites

✅ Code deployed to production (or staging)
✅ All environment variables configured
✅ `HEYGEN_API_KEY` set in `.env.local`
✅ `CRON_SECRET` set in `.env.local`

---

## Step 1: Register Webhooks with HeyGen

This is the **most critical step**. HeyGen requires API registration for webhooks.

```bash
# Navigate to project directory
cd /Users/abdullahabunasrah/Desktop/ownerfi

# Install dependencies if needed
npm install

# Run registration script
node scripts/register-heygen-webhooks.mjs
```

**Expected Output:**
```
🚀 HeyGen Webhook Registration Tool

═══════════════════════════════════════════════════════════
STEP 1: Checking existing webhooks
═══════════════════════════════════════════════════════════

📋 Listing all registered webhooks...

Found X registered webhook(s):
...

═══════════════════════════════════════════════════════════
STEP 2: Registering brand-specific webhooks
═══════════════════════════════════════════════════════════

📝 Registering webhook for carz...
   URL: https://ownerfi.ai/api/webhooks/heygen/carz
   Events: avatar_video.success, avatar_video.fail
✅ Successfully registered webhook for carz
   Endpoint ID: xxx
   Secret: ***xxx

... (OwnerFi and Podcast)

═══════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════

✅ Successfully registered: 3/3
   - carz: endpoint_id_xxx
   - ownerfi: endpoint_id_xxx
   - podcast: endpoint_id_xxx

📝 Saving webhook secrets...
✅ Secrets saved to: heygen-webhook-secrets.json

⚠️  IMPORTANT: Add these secrets to your .env.local file:

HEYGEN_WEBHOOK_SECRET_CARZ=abc123...
HEYGEN_WEBHOOK_SECRET_OWNERFI=def456...
HEYGEN_WEBHOOK_SECRET_PODCAST=ghi789...
```

**Action Required:**
1. Copy the `HEYGEN_WEBHOOK_SECRET_*` lines
2. Add them to your `.env.local` file
3. If deploying to Vercel, add them to Vercel environment variables

---

## Step 2: Verify Webhook Endpoints

Test that webhook endpoints respond correctly:

```bash
# Test Carz HeyGen webhook OPTIONS (required by HeyGen)
curl -X OPTIONS https://ownerfi.ai/api/webhooks/heygen/carz

# Should return: 200 OK

# Test OwnerFi HeyGen webhook
curl -X OPTIONS https://ownerfi.ai/api/webhooks/heygen/ownerfi

# Test Podcast HeyGen webhook
curl -X OPTIONS https://ownerfi.ai/api/webhooks/heygen/podcast

# Test Submagic webhooks (all 3 brands)
curl -X OPTIONS https://ownerfi.ai/api/webhooks/submagic/carz
curl -X OPTIONS https://ownerfi.ai/api/webhooks/submagic/ownerfi
curl -X OPTIONS https://ownerfi.ai/api/webhooks/submagic/podcast
```

**Expected**: All should return `200 OK`

---

## Step 3: Check Webhook Health

Verify all brands are healthy:

```bash
# Check overall health
curl https://ownerfi.ai/api/admin/webhook-health | jq '.'

# Check specific brand
curl https://ownerfi.ai/api/admin/webhook-health?brand=carz | jq '.'
```

**Expected Output:**
```json
{
  "success": true,
  "timestamp": "2025-10-18T...",
  "timeframe": "24h",
  "healthScore": 100,
  "overall": {
    "dlq": {...},
    "errors": {...},
    "idempotency": {...}
  },
  "brands": [...],
  "alerts": []
}
```

**Health Score Guide:**
- **90-100**: Excellent ✅
- **70-89**: Good ✅
- **50-69**: Fair ⚠️
- **Below 50**: Poor ❌

---

## Step 4: Run Automated Test Suite

Run the comprehensive brand isolation tests:

```bash
node scripts/test-brand-isolation.mjs
```

**What This Tests:**
1. ✅ Webhook endpoint availability (6 endpoints)
2. ✅ Brand configuration validation (3 brands)
3. ✅ Workflow triggers (3 brands)
4. ✅ DLQ isolation (3 brands)
5. ✅ Error logging isolation (3 brands)
6. ✅ **Failure isolation** (critical test)

**Expected Output:**
```
════════════════════════════════════════════════════════════
🧪 BRAND ISOLATION TEST SUITE
════════════════════════════════════════════════════════════
Base URL: https://ownerfi.ai
Started: 2025-10-18T...
════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════
TEST 1: Webhook Endpoints
════════════════════════════════════════════════════════════

✅ PASS: carz heygen webhook OPTIONS
   URL: https://ownerfi.ai/api/webhooks/heygen/carz

... (more tests)

════════════════════════════════════════════════════════════
TEST 6: Failure Isolation (Critical Test)
════════════════════════════════════════════════════════════

   Simulating Carz webhook failure...
   Failure injected (DLQ should capture this)
   Waiting 5 seconds for processing...

✅ PASS: OwnerFi unaffected by Carz failure
   Health: 100 → 100

✅ PASS: Podcast unaffected by Carz failure
   Health: 100 → 100

════════════════════════════════════════════════════════════
TEST SUMMARY
════════════════════════════════════════════════════════════
Total Tests: XX
✅ Passed: XX
❌ Failed: 0
Success Rate: 100.0%
════════════════════════════════════════════════════════════

📝 Results saved to: test-results-<timestamp>.json

🎉 All tests passed! Brand isolation is working correctly.
```

---

## Step 5: Manual Workflow Testing

### Test Carz Workflow

```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "carz",
    "platforms": ["instagram"],
    "schedule": "immediate"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "workflow_id": "wf_carz_...",
  "brand": "carz",
  "article": {...},
  "content": {...},
  "video": {...}
}
```

### Test OwnerFi Workflow

```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "ownerfi",
    "platforms": ["instagram", "tiktok"],
    "schedule": "immediate"
  }'
```

### Test Podcast Workflow

```bash
curl -X GET "https://ownerfi.ai/api/podcast/cron?force=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Replace `YOUR_CRON_SECRET` with actual value from `.env.local`**

---

## Step 6: Monitor Workflow Progress

### Check Workflow Status

```bash
# Get workflow by ID
curl https://ownerfi.ai/api/workflow/status/wf_carz_...

# Get workflow logs
curl https://ownerfi.ai/api/workflow/logs?brand=carz&limit=10
```

### Monitor DLQ

```bash
# List all DLQ entries
curl https://ownerfi.ai/api/admin/webhook-dlq

# Filter by brand
curl https://ownerfi.ai/api/admin/webhook-dlq?brand=carz

# Get DLQ stats
curl https://ownerfi.ai/api/admin/webhook-dlq?stats=true

# Get recent failures
curl https://ownerfi.ai/api/admin/webhook-dlq?recent=true
```

---

## Step 7: Test Failure Isolation (Critical)

This is the **most important test** - verifying that failures don't cascade across brands.

### Scenario: Carz Fails, OwnerFi Should Continue

1. **Get baseline health scores:**
   ```bash
   curl https://ownerfi.ai/api/admin/webhook-health | jq '.brands[] | {brand: .brand, healthScore: .healthScore}'
   ```

2. **Trigger a Carz workflow:**
   ```bash
   curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
     -H "Content-Type: application/json" \
     -d '{"brand": "carz", "platforms": ["instagram"], "schedule": "immediate"}'
   ```

3. **Immediately trigger an OwnerFi workflow:**
   ```bash
   curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
     -H "Content-Type: application/json" \
     -d '{"brand": "ownerfi", "platforms": ["instagram"], "schedule": "immediate"}'
   ```

4. **If Carz webhook fails, check OwnerFi still works:**
   ```bash
   # Check health scores after 5 minutes
   curl https://ownerfi.ai/api/admin/webhook-health | jq '.brands[] | {brand: .brand, healthScore: .healthScore}'
   ```

5. **Expected Result:**
   - If Carz fails → Carz health score drops
   - OwnerFi health score remains unchanged ✅
   - Podcast health score remains unchanged ✅

---

## Step 8: Test Webhook Retry

### Retry a Failed Workflow

```bash
curl -X POST https://ownerfi.ai/api/admin/retry-workflow \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf_carz_...",
    "brand": "carz",
    "stage": "posting"
  }'
```

**Retry Stages:**
- `heygen` - Restart from video generation
- `submagic` - Restart from caption processing
- `posting` - Restart from social media posting

---

## Troubleshooting

### Webhook Registration Failed

**Error**: `Failed to register webhook: 401`
- **Cause**: Invalid HeyGen API key
- **Fix**: Check `HEYGEN_API_KEY` in `.env.local`

**Error**: `Webhook endpoint validation failed`
- **Cause**: HeyGen can't reach your webhook endpoint
- **Fix**: Ensure `NEXT_PUBLIC_BASE_URL` is set correctly and server is publicly accessible

### Webhook Signature Verification Failed

**Error**: `Webhook verification failed: Invalid webhook signature`
- **Cause**: Webhook secret doesn't match
- **Fix**:
  1. Re-run webhook registration
  2. Copy new secrets to `.env.local`
  3. Redeploy application

### Test Suite Failures

**Some tests fail initially**
- This is normal if you haven't registered webhooks yet
- Run webhook registration first
- Re-run tests

---

## Success Criteria

### ✅ All Systems Go

You should see:
- [x] All 6 webhook endpoints respond to OPTIONS
- [x] Webhook health score: 90-100 for all brands
- [x] Test suite: 100% pass rate
- [x] Workflows trigger successfully for all brands
- [x] DLQ entries: 0 unresolved failures
- [x] Brand isolation: Carz failure doesn't affect OwnerFi

### ⚠️ Needs Attention

If you see:
- [ ] Health score below 70
- [ ] Test failures
- [ ] Unresolved DLQ entries
- [ ] Cross-brand failures

**Next Step**: Check DLQ and error logs for details

---

## Monitoring in Production

### Daily Checks

```bash
# Morning health check
curl https://ownerfi.ai/api/admin/webhook-health | jq '.healthScore, .alerts'

# Check for unresolved failures
curl https://ownerfi.ai/api/admin/webhook-dlq?resolved=false | jq '.count'

# Review recent errors
curl https://ownerfi.ai/api/admin/webhook-health | jq '.recentErrors'
```

### Weekly Maintenance

```bash
# Cleanup old DLQ entries
curl -X DELETE https://ownerfi.ai/api/admin/webhook-dlq?cleanup=true

# Review idempotency stats
curl https://ownerfi.ai/api/admin/webhook-health | jq '.overall.idempotency'
```

---

## Quick Commands Reference

```bash
# Registration
node scripts/register-heygen-webhooks.mjs

# Cleanup
node scripts/cleanup-heygen-webhooks.mjs --delete-shared

# Testing
node scripts/test-brand-isolation.mjs

# Health Check
curl https://ownerfi.ai/api/admin/webhook-health

# DLQ Check
curl https://ownerfi.ai/api/admin/webhook-dlq?recent=true

# Retry Workflow
curl -X POST https://ownerfi.ai/api/admin/retry-workflow \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "...", "brand": "carz", "stage": "posting"}'
```

---

**Happy Testing! 🧪**

If all tests pass, your brand isolation system is working perfectly! 🎉
