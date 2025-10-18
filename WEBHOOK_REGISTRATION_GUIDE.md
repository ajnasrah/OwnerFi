# HeyGen Webhook Registration Guide

## 🚀 Quick Start

This guide walks you through registering your brand-specific webhooks with HeyGen's API.

---

## Prerequisites

1. ✅ Deploy your app with the new brand-specific webhook endpoints
2. ✅ Have your `HEYGEN_API_KEY` in `.env.local`
3. ✅ Ensure your webhook endpoints are publicly accessible and respond to OPTIONS requests

---

## Step 1: List Existing Webhooks (Optional)

First, check what webhooks are currently registered:

```bash
node scripts/cleanup-heygen-webhooks.mjs
```

This will show you all registered webhooks. You might see an old shared webhook like:
- `https://ownerfi.ai/api/webhooks/heygen`

---

## Step 2: Delete Old Shared Webhook (Recommended)

If you have an old shared webhook, delete it before registering new ones:

```bash
node scripts/cleanup-heygen-webhooks.mjs --delete-shared
```

Or delete all webhooks:

```bash
node scripts/cleanup-heygen-webhooks.mjs --delete-all
```

Or delete a specific webhook by ID:

```bash
node scripts/cleanup-heygen-webhooks.mjs --delete-id=<endpoint_id>
```

---

## Step 3: Register Brand-Specific Webhooks

Run the registration script:

```bash
node scripts/register-heygen-webhooks.mjs
```

This will:
1. Check for existing webhooks
2. Register 3 new brand-specific webhooks:
   - `https://ownerfi.ai/api/webhooks/heygen/carz`
   - `https://ownerfi.ai/api/webhooks/heygen/ownerfi`
   - `https://ownerfi.ai/api/webhooks/heygen/podcast`
3. Save webhook secrets to `heygen-webhook-secrets.json`
4. Display environment variables to add

---

## Step 4: Add Webhook Secrets to Environment

The script will output environment variables like:

```bash
HEYGEN_WEBHOOK_SECRET_CARZ=abc123...
HEYGEN_WEBHOOK_SECRET_OWNERFI=def456...
HEYGEN_WEBHOOK_SECRET_PODCAST=ghi789...
```

Add these to your `.env.local` file:

```bash
# HeyGen Webhook Secrets
HEYGEN_WEBHOOK_SECRET_CARZ=abc123...
HEYGEN_WEBHOOK_SECRET_OWNERFI=def456...
HEYGEN_WEBHOOK_SECRET_PODCAST=ghi789...
```

---

## Step 5: Deploy Your Application

Redeploy your application to Vercel/production so the new environment variables are available:

```bash
vercel --prod
```

Or commit and push to trigger automatic deployment.

---

## Step 6: Test Each Brand

Test that each brand's webhook works:

### Test Carz
```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "carz",
    "platforms": ["instagram", "tiktok"],
    "schedule": "immediate"
  }'
```

### Test OwnerFi
```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "ownerfi",
    "platforms": ["instagram", "tiktok"],
    "schedule": "immediate"
  }'
```

### Test Podcast
Podcast generation is triggered by cron. You can manually trigger it:

```bash
curl -X GET https://ownerfi.ai/api/podcast/cron?force=true \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Verification

After registering, verify webhooks are working:

1. **Check Logs**: Look for webhook signature verification messages
2. **Check DLQ**: Ensure no webhook failures are logged
3. **Check Workflows**: Verify videos complete successfully

---

## Troubleshooting

### Webhook Registration Fails

**Error**: "Failed to download video: 401"
- **Cause**: HeyGen can't reach your webhook endpoint
- **Solution**: Ensure your endpoint is publicly accessible and responds to OPTIONS requests

**Error**: "Webhook endpoint validation failed"
- **Cause**: Your server didn't respond to OPTIONS within 1 second
- **Solution**: Check that your OPTIONS handler is fast (no DB queries)

### Webhook Signature Verification Fails

**Error**: "Webhook verification failed: Invalid webhook signature"
- **Cause**: Webhook secret doesn't match or request was tampered with
- **Solution**:
  1. Check that environment variables are correct
  2. Redeploy application
  3. Re-register webhooks if needed

### Webhook Not Receiving Requests

**Symptom**: Videos generate but webhook is never called
- **Cause**: Webhook URL not registered or incorrect
- **Solution**:
  1. Run `node scripts/cleanup-heygen-webhooks.mjs` to list webhooks
  2. Verify URLs are correct
  3. Re-register if needed

---

## Advanced Usage

### Bypass Signature Verification (Development Only)

For local testing, you can bypass signature verification:

```bash
# .env.local
NODE_ENV=development
DISABLE_WEBHOOK_VERIFICATION=true
```

⚠️ **Never use this in production!**

### Manual Webhook Registration via cURL

If the script doesn't work, you can register manually:

```bash
curl --location 'https://api.heygen.com/v1/webhook/endpoint.add' \
  --header 'Content-Type: application/json' \
  --header 'X-Api-Key: YOUR_HEYGEN_API_KEY' \
  --data '{
    "url": "https://ownerfi.ai/api/webhooks/heygen/carz",
    "events": ["avatar_video.success", "avatar_video.fail"]
  }'
```

### Check Webhook Status

List all registered webhooks:

```bash
curl --location 'https://api.heygen.com/v1/webhook/endpoint.list' \
  --header 'X-Api-Key: YOUR_HEYGEN_API_KEY'
```

### Delete a Webhook

```bash
curl --location --request DELETE 'https://api.heygen.com/v1/webhook/endpoint.delete' \
  --header 'Content-Type: application/json' \
  --header 'X-Api-Key: YOUR_HEYGEN_API_KEY' \
  --data '{
    "endpoint_id": "YOUR_ENDPOINT_ID"
  }'
```

---

## Files Reference

- **Registration Script**: `scripts/register-heygen-webhooks.mjs`
- **Cleanup Script**: `scripts/cleanup-heygen-webhooks.mjs`
- **Webhook Handler**: `src/app/api/webhooks/heygen/[brand]/route.ts`
- **Verification Library**: `src/lib/webhook-verification.ts`
- **Environment Schema**: `src/lib/env.ts`

---

## Security Best Practices

1. ✅ Always use webhook signature verification in production
2. ✅ Store webhook secrets in environment variables (never commit to git)
3. ✅ Use HTTPS for all webhook endpoints
4. ✅ Implement rate limiting on webhook endpoints
5. ✅ Log all webhook failures to DLQ for investigation
6. ✅ Monitor webhook health regularly

---

## Next Steps

After webhook registration:

1. [ ] Test brand isolation (Carz failure doesn't affect OwnerFi)
2. [ ] Monitor DLQ for any failures
3. [ ] Set up alerting for webhook failures
4. [ ] Create admin dashboard for webhook management
5. [ ] Document any brand-specific webhook behaviors

---

**Last Updated**: 2025-10-18
**Version**: 1.0
