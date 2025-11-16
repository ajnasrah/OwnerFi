# Delete-Property Webhook Removal Guide

**Date:** November 15, 2025
**Status:** ✅ Webhook Disabled Locally

## What Was Done

### 1. Webhook Endpoint Disabled ✅
- **File:** `src/app/api/gohighlevel/webhook/delete-property/route.ts`
- **Action:** Replaced with blocking endpoint that returns 410 Gone
- **Effect:** Any requests to this endpoint will be rejected and logged

### What the Blocked Endpoint Does:
- Returns HTTP 410 (Gone) - permanently disabled
- Logs all access attempts with IP and user agent
- Provides clear error message
- Blocks ALL HTTP methods (GET, POST, PUT, DELETE, PATCH)

## Next Steps Required

### 2. Deploy to Production
```bash
# Commit the changes
git add src/app/api/gohighlevel/webhook/delete-property/route.ts
git commit -m "security: Permanently disable delete-property webhook endpoint"

# Push to main branch
git push origin main

# Deploy to production (if not auto-deployed)
vercel --prod
```

### 3. Remove GoHighLevel Webhook Configuration

**CRITICAL:** You must remove this webhook from GoHighLevel to prevent error logs

#### Steps in GoHighLevel:

1. **Login to GoHighLevel**
   - Go to: https://app.gohighlevel.com

2. **Navigate to Workflows**
   - Click: Settings → Workflows
   - Or: Automations → Workflows

3. **Find and Delete the "delete property" Workflow**
   - Workflow ID: `122860ae-6857-4b55-a41a-0529241a5be4`
   - Workflow Name: "delete property"
   - **DELETE THIS WORKFLOW**

4. **Remove Webhook Configuration (if separate)**
   - Go to: Settings → Integrations → Webhooks
   - Look for webhook pointing to: `https://ownerfi.ai/api/gohighlevel/webhook/delete-property`
   - **DELETE IT**

5. **Check Other Workflows**
   - Review all workflows in your GoHighLevel account
   - Make sure no other workflows are calling the delete-property endpoint

### 4. Clean Up Environment Variables (Optional)

Since the webhook is permanently disabled, you can remove the bypass setting:

```bash
# Remove from local .env.local
# Delete or comment out these lines:
# GHL_BYPASS_SIGNATURE=true

# Remove from production
vercel env rm GHL_BYPASS_SIGNATURE production

# Or set to false (recommended)
vercel env add GHL_BYPASS_SIGNATURE production
# Enter: false
```

### 5. Verify Webhook is Blocked

After deploying, test that the webhook is blocked:

```bash
# Test the webhook (should return 410)
curl -X POST https://ownerfi.ai/api/gohighlevel/webhook/delete-property \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  -v

# Expected response:
# HTTP/1.1 410 Gone
# {
#   "error": "This endpoint has been permanently disabled",
#   "message": "Property deletions must be performed through the admin panel",
#   ...
# }
```

### 6. Monitor for Blocked Attempts

Check logs for any attempts to access the disabled endpoint:

```bash
# Check production logs
vercel logs --prod | grep "webhook_blocked"

# Or check Firebase logs
# Look for action: "webhook_blocked"
```

## Alternative: Complete Removal (More Aggressive)

If you want to completely remove the endpoint instead of blocking it:

```bash
# Delete the entire directory
rm -rf src/app/api/gohighlevel/webhook/delete-property

# Commit and deploy
git add -A
git commit -m "security: Remove delete-property webhook endpoint completely"
git push origin main
```

**Note:** This will cause 404 errors if GoHighLevel still tries to call it.
The blocking approach (current implementation) is better because:
- It returns a clear error message
- Logs all access attempts
- Can be easily monitored

## Security Recommendations

### For Property Deletions Going Forward:

1. **Admin Panel Only**
   - Only allow property deletions through the authenticated admin panel
   - Require admin authentication
   - Add confirmation dialog

2. **Soft Deletes**
   - Consider implementing soft deletes (mark as deleted, keep data)
   - Add ability to restore deleted properties
   - Automatically purge after 30 days

3. **Audit Trail**
   - Log who deleted what and when
   - Keep deletion history
   - Alert on bulk deletions (>10 at once)

4. **Rate Limiting**
   - Limit deletion requests per user/session
   - Prevent automated mass deletions

## Monitoring

After deployment, monitor for:
- Any attempts to access the blocked endpoint
- GoHighLevel workflow errors
- Changes in property count

## Rollback Plan (Emergency Only)

If you need to temporarily re-enable the webhook:

1. Restore the original file from git history:
   ```bash
   git checkout HEAD~1 -- src/app/api/gohighlevel/webhook/delete-property/route.ts
   ```

2. Deploy:
   ```bash
   git commit -m "temp: Re-enable delete webhook for emergency"
   git push origin main
   ```

3. **IMPORTANT:** Set proper webhook secret and disable bypass:
   ```bash
   vercel env add GHL_WEBHOOK_SECRET production
   # Enter a strong secret

   vercel env add GHL_BYPASS_SIGNATURE production
   # Enter: false
   ```

## Status Checklist

- [x] Webhook endpoint disabled locally
- [ ] Changes committed to git
- [ ] Deployed to production
- [ ] GoHighLevel workflow deleted
- [ ] GoHighLevel webhook configuration removed
- [ ] Tested that endpoint returns 410
- [ ] Removed bypass environment variable
- [ ] Monitored for blocked attempts

---

**Last Updated:** November 15, 2025
**Updated By:** Security Team
