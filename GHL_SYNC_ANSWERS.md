# GHL → Firestore Sync: Complete Analysis

## Your Questions Answered

### 1. ✅ **Webhook exists?**

**YES!** There is a webhook from GHL → Firestore:

**Endpoint:** `/api/gohighlevel/webhook/save-property`
**File:** `src/app/api/gohighlevel/webhook/save-property/route.ts`

**How it works:**
1. GHL sends webhook when opportunity is updated
2. Webhook receives opportunity data (address, price, etc.)
3. Uses `opportunityId` as the Firestore property ID
4. Saves/updates property in `properties` collection
5. Auto-adds active properties with images to video queue

**Current setup:** Manual trigger from GHL workflows

### 2. ✅ **Confirmed: Uses Opportunity ID AND Street Address**

**Primary Identifier:**
- `opportunityId` from GHL → Firestore `id` field
- **Confirmed:** 600/601 properties in Firestore use opportunityId as their ID

**Address Normalization:**
- Street addresses are formatted and normalized
- City names are capitalized properly
- State codes standardized to 2-letter uppercase
- BUT addresses are NOT used as the primary key

**Example:**
```javascript
// GHL Opportunity
opportunityId: "04K60AmUEUDjOfrkE9br"
address: "14310 briartrail"

// Firestore Property
id: "04K60AmUEUDjOfrkE9br"  // ← Uses opportunityId
opportunityId: "04K60AmUEUDjOfrkE9br"
address: "14310 Briartrail"  // ← Normalized
```

### 3. ❌ **No automatic sync - Manual workflow only**

**Current sync method:**
- Manual: Someone must trigger the webhook from GHL
- Properties go through stages: New → available → exported to website
- The webhook is ONLY called when GHL workflow moves property to "exported to website"

**11 "available" properties:**
```
1. 3312 Jonathan Circle Circle, Augusta, GA
2. 10205 Kellogg St, El Paso, TX
3. 1156 NW 91st St, Oklahoma City, OK
4. 512 Monroe Dr NW, Decatur, AL
5. 507 Pecan Valley, San Antonio, TX
... and 6 more
```

**Answer: NO, they should NOT be exported automatically**
- "available" = internal GHL stage (not ready for website)
- "exported to website" = ready for website (triggers webhook)
- Only the 188 "exported to website" properties should be in Firestore

### 4. ✅ **Monitoring System: How?**

I've created a comprehensive monitoring endpoint:

**Endpoint:** `/api/admin/monitor-ghl-sync`

**What it does:**
1. Fetches all opportunities from GHL API
2. Fetches all properties from Firestore
3. Compares them and identifies gaps
4. Reports critical issues:
   - Properties marked "exported to website" but missing from Firestore
   - Properties marked "available" but missing
   - Orphaned properties (in Firestore but not in GHL)

**To use it:**
```bash
curl https://your-domain.com/api/admin/monitor-ghl-sync
```

**Response includes:**
- Total counts (GHL vs Firestore)
- Breakdown by stage
- List of critical missing properties
- Recommendations for fixing issues

## The Real Issue: Why 188 Properties Are Missing

### Current Workflow:
```
1. Property added to GHL (stage: "New")
2. Property reviewed/updated (stage: "available")
3. Workflow triggers webhook (stage: "exported to website")
4. Webhook saves to Firestore
5. Property appears on website
```

### What's Broken:
**188 properties are stuck at step 3!**

They're marked "exported to website" in GHL but the webhook never fired (or failed silently).

### Possible Causes:
1. **Webhook not configured** in GHL workflow for "exported to website" stage
2. **Webhook failed** (network error, validation error, timeout)
3. **Manual stage change** without triggering webhook
4. **Data validation failures** (missing required fields)
5. **Webhook endpoint was down** when stage changed
6. **GHL workflow misconfigured** or not applied to all opportunities

## Solutions

### Immediate Fix (Manual):
1. Use the monitoring endpoint to identify missing properties
2. Manually trigger the webhook for each missing property
3. Or use bulk import script

### Short-term Fix (Automated):
Create a cron job that:
1. Runs daily
2. Calls monitoring endpoint
3. Auto-triggers webhooks for "exported to website" properties not in Firestore
4. Sends alert if count > 10

### Long-term Fix (Prevent):
1. **Auto-sync on stage change:** Configure GHL to trigger webhook when stage changes to "available" or "exported to website"
2. **Webhook retry logic:** Add automatic retries for failed webhooks
3. **Validation logging:** Log all webhook calls and failures
4. **Daily monitoring:** Automated checks with Slack/email alerts

## File Locations

**Webhook Handler:**
- `src/app/api/gohighlevel/webhook/save-property/route.ts`

**Monitoring Endpoint:**
- `src/app/api/admin/monitor-ghl-sync/route.ts` (NEW)

**Sync Library:**
- `src/lib/gohighlevel-api.ts`

**Missing Properties Export:**
- `/Users/abdullahabunasrah/Downloads/missing-properties-from-firestore.csv`

## Next Steps

1. **Test the monitoring endpoint** to verify current sync status
2. **Review GHL workflow** to ensure webhook is triggered correctly
3. **Bulk import the 188 "exported to website" properties**
4. **Export the 11 "available" properties**
5. **Set up automated monitoring** (cron + alerts)
6. **Add webhook logging** to track successes/failures

## Quick Stats

- **GHL Opportunities:** 2,127
- **Firestore Properties:** 601
- **Using opportunityId as ID:** 600/601 (99.8%)
- **Missing from Firestore:** 1,685
  - Exported to website: 188 🚨
  - Available: 11 ⚠️
  - New: 915 (normal)
  - Not available: 483 (normal)
