# Secure Delete Property Webhook V2 - Setup Guide

**New Endpoint:** `https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2`

## Security Features ✅

This new webhook has **enhanced security** compared to the old one:

1. **✅ REQUIRED Signature Verification** - No bypass option
2. **✅ Rate Limiting** - Max 20 requests per minute per IP
3. **✅ Batch Size Limits** - Max 50 properties per request
4. **✅ Query Delete Limits** - Max 100 properties per query
5. **✅ IP Tracking & Logging** - All requests logged with IP
6. **✅ Comprehensive Audit Trail** - Detailed logs of all deletions
7. **✅ Blocks "Delete All"** - Cannot delete all properties at once
8. **✅ Processing Time Tracking** - Performance monitoring

## Setup Instructions

### Step 1: Set Webhook Secret in Production

Your webhook secret is already configured in production:
```
5c1d80050969e52a6addccf556c19f66ae68fe902e124eab553fd1ff4c99f00a
```

**IMPORTANT:** This secret is already set in Vercel production environment.

**✅ No action needed** - The secret is already configured!

### Step 2: Local Environment (Already Set)

**✅ Already configured** in `.env.local`:
```
GHL_WEBHOOK_SECRET="5c1d80050969e52a6addccf556c19f66ae68fe902e124eab553fd1ff4c99f00a"
```

No action needed!

### Step 3: Deploy to Production

```bash
# Commit the new webhook
git add src/app/api/gohighlevel/webhook/delete-property-v2/
git add SECURE_DELETE_WEBHOOK_SETUP.md
git commit -m "feat: Add secure delete-property-v2 webhook with authentication"
git push origin main
```

### Step 4: Configure in GoHighLevel

1. **Login to GoHighLevel**
   - Go to: https://app.gohighlevel.com

2. **Create New Webhook Workflow**
   - Navigate to: **Automations** → **Workflows**
   - Click: **Create Workflow**
   - Name: "Delete Property V2 (Secure)"

3. **Add Webhook Action**
   - Add Action: **Webhooks** → **POST**
   - URL: `https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2`
   - Method: **POST**

4. **Configure Webhook Authentication**
   - Enable: **Custom Headers**
   - Add Header:
     - Key: `x-ghl-signature`
     - Value: Use HMAC SHA-256 signature

   **GoHighLevel Signature Setup:**
   - In webhook settings, enable "Sign Requests"
   - Algorithm: **HMAC SHA-256**
   - Secret: `5c1d80050969e52a6addccf556c19f66ae68fe902e124eab553fd1ff4c99f00a`
   - Header Name: `x-ghl-signature`

5. **Configure Request Body**

   **Single Property Deletion:**
   ```json
   {
     "propertyId": "{{opportunity.id}}",
     "contactId": "{{contact.id}}",
     "locationId": "{{location.id}}"
   }
   ```

   **Batch Deletion (max 50):**
   ```json
   {
     "propertyIds": ["id1", "id2", "id3"],
     "contactId": "{{contact.id}}"
   }
   ```

   **Delete by Query:**
   ```json
   {
     "deleteBy": {
       "field": "status",
       "value": "expired"
     },
     "locationId": "{{location.id}}"
   }
   ```
   Allowed fields: `address`, `city`, `state`, `zipCode`, `status`

6. **Test the Webhook**
   - Click "Test" in GoHighLevel
   - Verify you get a success response
   - Check the logs for confirmation

## Usage Limits

| Operation | Limit | Reason |
|-----------|-------|--------|
| Rate Limit | 20 req/min | Prevent abuse |
| Batch Size | 50 properties | Prevent timeouts |
| Query Delete | 100 properties | Safety limit |
| Delete All | ❌ Blocked | Use admin panel |

## API Examples

### Single Property
```bash
curl -X POST https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2 \
  -H "Content-Type: application/json" \
  -H "x-ghl-signature: YOUR_HMAC_SIGNATURE" \
  -d '{
    "propertyId": "abc123",
    "contactId": "contact123"
  }'
```

### Batch Delete
```bash
curl -X POST https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2 \
  -H "Content-Type: application/json" \
  -H "x-ghl-signature: YOUR_HMAC_SIGNATURE" \
  -d '{
    "propertyIds": ["id1", "id2", "id3"]
  }'
```

### Delete by Status
```bash
curl -X POST https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2 \
  -H "Content-Type: application/json" \
  -H "x-ghl-signature: YOUR_HMAC_SIGNATURE" \
  -d '{
    "deleteBy": {
      "field": "status",
      "value": "expired"
    }
  }'
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "deletedProperties": ["id1", "id2"],
    "deletedCount": 2,
    "processingTime": 1234
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Maximum 20 requests per minute allowed",
  "retryAfter": 60
}
```

### Authentication Error
```json
{
  "error": "Unauthorized - Invalid webhook signature"
}
```

## Security Notes

### What's Logged:
- ✅ All authenticated requests (IP, timestamp)
- ✅ All property deletions (property ID, address, city, state)
- ✅ Failed authentication attempts
- ✅ Rate limit violations
- ✅ Processing times

### What's Blocked:
- ❌ Requests without valid signature
- ❌ Requests exceeding rate limit (20/min)
- ❌ Batch sizes over 50 properties
- ❌ Query deletes over 100 properties
- ❌ "Delete all" operations

## Monitoring

### Check Deletion Logs
```bash
# View recent deletions
vercel logs --prod | grep "property_deleted"

# View blocked attempts
vercel logs --prod | grep "unauthorized_webhook_request"

# View rate limit violations
vercel logs --prod | grep "rate_limit_exceeded"
```

### Query Firebase Logs
```typescript
// Query systemLogs for deletion activity
const logs = await db.collection('systemLogs')
  .where('action', 'in', ['property_deleted', 'batch_deletion_completed'])
  .orderBy('createdAt', 'desc')
  .limit(100)
  .get();
```

## Troubleshooting

### "Unauthorized - Invalid webhook signature"
- **Cause:** Signature doesn't match
- **Fix:** Verify webhook secret is correctly set in both GoHighLevel and Vercel
- **Check:** Make sure you're using HMAC SHA-256

### "Rate limit exceeded"
- **Cause:** More than 20 requests per minute
- **Fix:** Wait 60 seconds and try again
- **Consider:** Batch your deletions instead of individual requests

### "Batch size exceeds limit"
- **Cause:** Trying to delete more than 50 properties at once
- **Fix:** Split into multiple batches of 50 or fewer

### "Query would delete too many properties"
- **Cause:** Query matches more than 100 properties
- **Fix:** Use more specific query criteria or use admin panel

## Migration from Old Webhook

### Old Endpoint (BLOCKED):
- ❌ `https://ownerfi.ai/api/gohighlevel/webhook/delete-property`

### New Endpoint (SECURE):
- ✅ `https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2`

### Changes Needed:
1. Update webhook URL in all GoHighLevel workflows
2. Add signature authentication
3. Ensure batch sizes don't exceed 50
4. Test thoroughly before production use

## Rollback Plan

If you need to disable this webhook:

```bash
# Option 1: Remove from production
rm -rf src/app/api/gohighlevel/webhook/delete-property-v2
git commit -am "Remove delete-property-v2 webhook"
git push origin main

# Option 2: Block it like the old one
# Replace route.ts with blocking code
```

---

## Quick Start Checklist

- [ ] Set `GHL_WEBHOOK_SECRET` in Vercel production
- [ ] Commit and deploy the new webhook
- [ ] Create workflow in GoHighLevel
- [ ] Configure signature authentication
- [ ] Test with a single property
- [ ] Test with batch deletion
- [ ] Monitor logs for any issues
- [ ] Update documentation for your team

**New Webhook URL:** `https://ownerfi.ai/api/gohighlevel/webhook/delete-property-v2`

**Webhook Secret:** `5c1d80050969e52a6addccf556c19f66ae68fe902e124eab553fd1ff4c99f00a`

---

**Created:** November 15, 2025
**Status:** Ready for deployment
