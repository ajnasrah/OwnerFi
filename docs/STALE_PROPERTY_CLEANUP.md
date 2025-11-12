# Stale Property Cleanup - Automatic Deletion System

## Overview

Automatically deletes properties that haven't been updated in 60+ days to keep the database fresh and relevant.

## Implementation

### Cron Job Schedule

- **Path**: `/api/cron/cleanup-stale-properties`
- **Schedule**: Every Sunday at 2:00 AM UTC (`0 2 * * 0`)
- **Max Duration**: 5 minutes (300 seconds)

### Deletion Criteria

A property is considered "stale" and will be deleted if:

1. **Last Update > 60 Days**: The `updatedAt` field (or `createdAt` if no `updatedAt`) is older than 60 days
2. **No Timestamp**: Properties without any timestamp are considered stale

### What Gets Deleted

The cron job will delete:
- Properties from GoHighLevel that haven't been updated in 60+ days
- Properties from any source (manual upload, scraper, etc.) with no updates for 60+ days
- Properties with missing timestamps

### What Stays Active

Properties are kept if:
- Updated within the last 60 days via:
  - GoHighLevel webhook (property saved/updated)
  - Manual admin update
  - Any API update that sets `updatedAt`

## Files

### Cron Job
- **File**: `src/app/api/cron/cleanup-stale-properties/route.ts`
- **Configuration**: `vercel.json` (lines 88-90, 166-168)

### Test Script
- **File**: `scripts/test-stale-property-cleanup.ts`
- **Usage**: `npx tsx scripts/test-stale-property-cleanup.ts`
- **Purpose**: Dry-run to preview which properties would be deleted

## Testing

### Dry Run Test

Before the cron goes live, you can test what would be deleted:

```bash
npx tsx scripts/test-stale-property-cleanup.ts
```

This will show:
- Total properties
- How many are active (< 60 days)
- How many are stale (> 60 days)
- List of properties that would be deleted
- Breakdown by source

### Manual Trigger

You can manually trigger the cleanup (requires CRON_SECRET):

```bash
curl -X GET "https://ownerfi.ai/api/cron/cleanup-stale-properties" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Logging & Monitoring

The cron job logs:
- Number of properties checked
- Number of properties deleted
- Number of errors
- Breakdown by source
- Sample of deleted properties

Errors are sent to the error monitoring system if:
- Any properties fail to delete
- The cron job crashes

## Current Status (As of Nov 12, 2025)

**Test Run Results**:
- Total Properties: 572
- Active (< 60 days): 572 (100%)
- Stale (> 60 days): 0 (0%)

All current properties have been updated recently, so nothing will be deleted on the first run.

## Impact Analysis

### Why This Helps

1. **Database Freshness**: Removes old, outdated property listings
2. **Accurate Inventory**: Only shows properties that are still relevant
3. **Cost Savings**: Reduces storage and query costs
4. **Better UX**: Buyers don't see stale listings

### What To Watch

1. **GoHighLevel Sync**: Properties should be updated regularly via webhooks
2. **Exported Properties**: Properties marked "exported to website" in GHL should auto-update
3. **Manual Properties**: Admin-uploaded properties may go stale if not updated

## Deployment

The cron is configured in `vercel.json` and will automatically deploy with the next deployment.

To deploy immediately:

```bash
git add .
git commit -m "Add stale property cleanup cron job"
git push
```

The cron will start running on its schedule after deployment.

## Configuration Options

To change the 60-day threshold, edit:

**File**: `src/app/api/cron/cleanup-stale-properties/route.ts`
**Line**: 48

```typescript
// Current: 60 days
sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

// Change to 90 days:
sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 90);
```

## Related Documentation

- GoHighLevel webhook: `src/app/api/gohighlevel/webhook/save-property/route.ts`
- Property schema: `src/lib/property-schema.ts`
- Weekly maintenance cron: `src/app/api/cron/weekly-maintenance/route.ts`
