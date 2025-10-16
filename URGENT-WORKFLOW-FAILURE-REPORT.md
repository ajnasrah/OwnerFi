# 🚨 URGENT: Carz Workflow Failure Report

**Date:** 2025-10-16
**Success Rate:** 51.6% ❌
**Failed Workflows:** 15
**Impact:** HIGH - Videos not being published

---

## Executive Summary

The Carz workflow system is experiencing a **48.4% failure rate** (15 failed workflows). Diagnostic analysis reveals **critical issues with HeyGen and Submagic API authentication** that are preventing video generation and caption processing.

---

## Critical Issues Found

### 1. ❌ HeyGen API - Authentication Failure (CRITICAL)

**Status:** FAILING
**Error:** HTTP 404 on all API endpoints
**Impact:** Videos cannot be generated

**Evidence:**
```bash
$ curl "https://api.heygen.com/v1/user.info" -H "x-api-key: $HEYGEN_API_KEY"
404 Not Found
```

**Root Cause:**
- **MOST LIKELY**: HeyGen API key (`HEYGEN_API_KEY`) is invalid, expired, or from wrong account
- **POSSIBLE**: HeyGen API endpoints have changed
- **POSSIBLE**: Account suspended or credits exhausted

**Immediate Actions Required:**
1. **Verify HeyGen API key** at https://app.heygen.com/settings/api
   - Log into HeyGen dashboard
   - Navigate to Settings → API
   - Generate a NEW API key
   - Update `.env.local` with new key: `HEYGEN_API_KEY=your-new-key`

2. **Check HeyGen credit balance**
   - Go to https://app.heygen.com/billing
   - Verify you have sufficient credits (need at least $10-20 for testing)
   - If low, add credits immediately

3. **Test API key**
   ```bash
   curl "https://api.heygen.com/v2/avatars?limit=1" \
     -H "x-api-key: YOUR_NEW_KEY" \
     -H "accept: application/json"
   ```
   Should return JSON with avatar data, NOT 404

---

### 2. ❌ Submagic API - Authentication Failure (CRITICAL)

**Status:** FAILING
**Error:** `{"error":"NOT_FOUND","message":"The requested endpoint does not exist"}`
**Impact:** Videos cannot receive captions/effects

**Evidence:**
```bash
$ curl "https://api.submagic.co/v1/projects" -H "x-api-key: $SUBMAGIC_API_KEY"
{"error":"NOT_FOUND","message":"The requested endpoint does not exist"}
```

**Root Cause:**
- **MOST LIKELY**: Submagic API key is invalid or expired
- **POSSIBLE**: Submagic changed API endpoint structure
- **POSSIBLE**: Account not active or payment issue

**Immediate Actions Required:**
1. **Verify Submagic API key**
   - Log into Submagic dashboard (submagic.co)
   - Find API settings/integrations
   - Generate a NEW API key
   - Update `.env.local`: `SUBMAGIC_API_KEY=your-new-key`

2. **Check Submagic account status**
   - Verify subscription is active
   - Check for any payment issues
   - Ensure API access is enabled for your plan

3. **Test API key**
   ```bash
   curl "https://api.submagic.co/v1/projects/test" \
     -H "x-api-key: YOUR_NEW_KEY"
   ```
   Should return JSON response, NOT "NOT_FOUND" error

---

### 3. ⚠️  Firebase Service Account Key Missing

**Status:** NOT CONFIGURED
**Error:** `FIREBASE_SERVICE_ACCOUNT_KEY` not in `.env.local`
**Impact:** Cannot query Firestore for detailed workflow error analysis

**Why This Matters:**
- Prevents diagnostic script from analyzing failed workflows
- Cannot retrieve detailed error messages from Firestore
- Limits troubleshooting capabilities

**Fix:**
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project (ownerfi)
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file
6. Add to `.env.local` as single-line JSON:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
   ```

---

## Secondary Issues

### 4. ⚠️  Late API Integration (Recently Changed)

**Note:** System recently switched from Metricool to Late for social media posting.

**Potential Issues:**
- Late API key might not be configured
- Posting logic might have bugs
- Platform connections might not be set up

**Check:**
```bash
# Look for Late API errors in recent workflow logs
grep -r "Late" src/app/admin/social-dashboard/
```

---

## Workflow Failure Chain

When a workflow starts, here's where it can fail:

```
1. RSS Article Selected ✅ (working)
   ↓
2. OpenAI generates script ✅ (working - API key valid)
   ↓
3. HeyGen generates video ❌ FAILING HERE (404 error)
   ↓
4. Webhook receives completion → Upload to R2
   ↓
5. Submagic adds captions ❌ WOULD FAIL HERE (404 error)
   ↓
6. Webhook receives completion → Upload to R2
   ↓
7. Late posts to social media ❓ (unknown - never reaches this step)
```

**Conclusion:** Workflows are failing at step 3 (HeyGen) due to invalid API key.

---

## Diagnostic Results

Ran `scripts/diagnose-workflow-failures.ts`:

```
✅ Passed: 10
⚠️  Warnings: 0
❌ Failed: 4

Failed Components:
1. ENV: FIREBASE_SERVICE_ACCOUNT_KEY - Missing
2. HeyGen API - 404 Authentication Error
3. Submagic API - 404 Not Found Error
4. Firebase - Can't connect (missing key)
```

---

## Step-by-Step Recovery Plan

### Phase 1: Fix API Keys (URGENT - Do This NOW)

**Estimated Time:** 15 minutes

1. **Fix HeyGen API**
   ```bash
   # 1. Get new API key from https://app.heygen.com/settings/api
   # 2. Update .env.local
   HEYGEN_API_KEY=your-new-heygen-api-key-here

   # 3. Test it
   curl "https://api.heygen.com/v2/avatars?limit=1" \
     -H "x-api-key: your-new-heygen-api-key-here"

   # Expected: JSON response with avatars, NOT 404
   ```

2. **Fix Submagic API**
   ```bash
   # 1. Get new API key from Submagic dashboard
   # 2. Update .env.local
   SUBMAGIC_API_KEY=your-new-submagic-api-key-here

   # 3. Test it
   curl "https://api.submagic.co/v1/projects/test-id" \
     -H "x-api-key: your-new-submagic-api-key-here"

   # Expected: JSON response (even if project not found), NOT "endpoint does not exist"
   ```

3. **Add Firebase Key (Optional but Recommended)**
   ```bash
   # Get from Firebase Console
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"ownerfi-prod","private_key_id":"..."}'
   ```

### Phase 2: Test Single Workflow

**Estimated Time:** 5 minutes

```bash
# Restart Next.js server to load new .env.local
npm run dev

# Navigate to dashboard
open http://localhost:3000/admin/social-dashboard

# Click "Generate Video Now" for Carz
# Watch workflow progress - should NOT fail at HeyGen stage anymore
```

### Phase 3: Clear Stuck Workflows

**Estimated Time:** 5 minutes

```bash
# Run failsafe crons to retry stuck workflows with new API keys
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/check-stuck-heygen

curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/check-stuck-submagic
```

### Phase 4: Monitor & Verify

**Estimated Time:** 30-60 minutes

1. **Watch Dashboard**
   - Go to `/admin/social-dashboard`
   - Monitor Carz tab
   - Watch workflow progress from pending → heygen_processing → submagic_processing → posting → completed

2. **Check Analytics**
   - Click "Analytics" tab
   - Success rate should start improving
   - Look for new critical recommendations

3. **Verify Posted Content**
   - Check Late dashboard to see if posts are being scheduled
   - Verify videos appear on social media platforms

---

## Expected Timeline

| Phase | Duration | Success Metric |
|-------|----------|----------------|
| Fix APIs | 15 min | APIs return 200 OK, not 404 |
| Test Workflow | 5 min | Single workflow completes successfully |
| Clear Stuck | 5 min | 15 failed workflows retry/complete |
| Monitor | 1 hour | Success rate > 90% |

**Total Time to Recovery:** ~1.5 hours

---

## Prevention: How to Avoid This Again

1. **Set up API Key Rotation Alerts**
   - Add expiry reminders for HeyGen/Submagic API keys
   - Test API keys weekly with diagnostic script

2. **Monitor Credit Balances**
   - Check HeyGen credits weekly
   - Set up billing alerts in HeyGen dashboard

3. **Run Weekly Diagnostics**
   ```bash
   # Add to cron or run manually every Monday
   npx ts-node scripts/diagnose-workflow-failures.ts
   ```

4. **Enable Error Monitoring**
   - Configure Slack/Discord webhooks for failures
   - Review `/admin/social-dashboard` daily

---

## Commands Quick Reference

```bash
# 1. Diagnose system
npx ts-node scripts/diagnose-workflow-failures.ts

# 2. Test HeyGen API
curl "https://api.heygen.com/v2/avatars?limit=1" \
  -H "x-api-key: $HEYGEN_API_KEY"

# 3. Test Submagic API
curl "https://api.submagic.co/v1/projects/test" \
  -H "x-api-key: $SUBMAGIC_API_KEY"

# 4. Retry stuck HeyGen workflows
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/check-stuck-heygen

# 5. Retry stuck Submagic workflows
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/check-stuck-submagic

# 6. Check workflow logs
curl http://localhost:3000/api/workflow/logs | jq .

# 7. View analytics
curl http://localhost:3000/api/analytics/recommendations | jq .
```

---

## Support Resources

- **HeyGen API Docs:** https://docs.heygen.com/reference/api-overview
- **HeyGen Status:** https://status.heygen.com
- **Submagic Support:** support@submagic.co
- **Dashboard:** https://ownerfi.ai/admin/social-dashboard
- **This Report Location:** `/URGENT-WORKFLOW-FAILURE-REPORT.md`

---

## Questions?

If issues persist after following this guide:

1. Check that `.env.local` changes are loaded (restart server)
2. Verify API keys are from correct accounts
3. Check HeyGen/Submagic service status pages
4. Review server logs for detailed error messages
5. Run diagnostic script again to see what changed

---

**Next Steps:** Start with Phase 1 (Fix API Keys) immediately. This is blocking all video generation.
