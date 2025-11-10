# Workflow Fixes Applied - Social Media Pipeline

## Date: 2025-01-08

## Critical Issues Fixed

### 1. ✅ Field Name Inconsistency in Submagic Webhook Handler
**Problem:** Different brands used different field names to store Submagic project IDs:
- `benefit`, `abdullah`, `carz`, `ownerfi`, `vassdistro` used `submagicVideoId`
- `podcast` and `property` used `submagicProjectId`

When Submagic webhook arrived, it would search using only one field name and fail to find workflows using the other field name, returning 404.

**Solution:** Modified `getWorkflowBySubmagicId()` in `/src/app/api/webhooks/submagic/[brand]/route.ts` (lines 221-269):
- Unified all brands to use same collection lookup logic
- Try `submagicProjectId` first (standardized field)
- Fall back to `submagicVideoId` for legacy workflows
- This provides backward compatibility while standardizing going forward

**Impact:** Webhooks will now successfully find workflows regardless of which field name was used.

---

### 2. ✅ Proper Error Handling in HeyGen Webhook Async Calls
**Problem:** HeyGen webhook triggered Submagic processing asynchronously (fire-and-forget) and returned success immediately. If Submagic API call failed or timed out after webhook returned, workflows stayed stuck in `heygen_processing` forever.

**Solution:** Modified HeyGen webhook in `/src/app/api/webhooks/heygen/[brand]/route.ts` (lines 121-160):
- Added 25-second timeout protection using `Promise.race()`
- Wait for Submagic trigger to complete OR timeout
- Catch immediate failures and mark workflow as `failed` status
- Return error response (500) if Submagic trigger fails
- Prevents webhooks from returning success when Submagic call actually failed

**Impact:** Workflows will no longer get stuck in `heygen_processing` when Submagic API fails.

---

### 3. ✅ Retry Logic for Failed Submagic Exports
**Problem:** When Submagic export API call timed out or returned 500, workflows were immediately marked as `failed` instead of being retried.

**Solution:** Added retry logic in `/src/app/api/webhooks/submagic/[brand]/route.ts` (lines 96-162):
- Retry export trigger up to 3 times with exponential backoff (2s, 4s, 8s)
- Log each attempt and failure reason
- Only mark as `export_failed` after all retries exhausted
- Track retry count in workflow (`exportRetries` field)
- Preserve Submagic project data for manual retry later

**Impact:** Transient API failures will be automatically retried, significantly reducing failed workflows.

---

### 4. ✅ Strip Undefined Values Before Firestore Writes
**Problem:** Error logs showed Firebase rejecting writes with undefined field values:
```
Function WriteBatch.set() called with invalid data.
Unsupported field value: undefined (found in field balloonYears)
```

**Solution:** Modified GHL webhook in `/src/app/api/gohighlevel/webhook/save-property/route.ts` (lines 654-657):
- Added filter to remove all undefined values from propertyData before writing
- Uses `Object.fromEntries()` and `filter()` to clean data
- Firestore only receives defined values (including `null` which is valid)

**Impact:** Eliminates Firestore write errors caused by undefined values.

---

### 5. ✅ Consistent Field Names Going Forward
**Current State:** HeyGen webhook already sets BOTH field names for new workflows:
```typescript
submagicVideoId: projectId,
submagicProjectId: projectId, // For podcast compatibility
```

This means:
- New workflows created after the HeyGen webhook fix have both fields
- Submagic webhook can find them using either field name
- Legacy workflows with only one field will still be found (fallback logic)
- All brands are now compatible

**Impact:** Field name mismatches will not occur for new workflows.

---

## Testing Recommendations

### 1. Test Field Name Compatibility
- Trigger a new workflow for each brand
- Verify Submagic webhook finds the workflow successfully
- Check logs for which field name was used

### 2. Test HeyGen Error Handling
- Simulate Submagic API failure
- Verify workflow is marked as `failed` (not stuck in `heygen_processing`)
- Verify HeyGen webhook returns 500 error

### 3. Test Submagic Export Retry
- Simulate export API timeout
- Verify retry logic kicks in (check logs for "Attempt 1/3", etc.)
- Verify workflow is marked `export_failed` only after 3 attempts

### 4. Test Firestore Undefined Values
- Send GHL webhook with missing optional fields
- Verify property is created without Firestore errors
- Check logs for no "Unsupported field value: undefined" errors

---

## Recovery Steps for Existing Stuck Workflows

### For workflows stuck in `heygen_processing`:
```bash
npm run ts-node scripts/recover-stuck-submagic-workflows.ts
```

### For workflows stuck in `submagic_processing`:
```bash
npm run ts-node scripts/fix-stuck-submagic-direct.ts
```

### For workflows with `export_failed` status:
- These can now be retried via the admin panel
- Or manually trigger export via Submagic API

---

## Monitoring

Watch these metrics going forward:
1. Number of workflows stuck in `heygen_processing` (should drop to ~0)
2. Number of workflows stuck in `submagic_processing` (should decrease)
3. Number of `export_failed` workflows (should be rare with retry logic)
4. Firestore write errors in logs (should disappear)

---

## Files Modified

1. `/src/app/api/webhooks/submagic/[brand]/route.ts` - Field name fallback + retry logic
2. `/src/app/api/webhooks/heygen/[brand]/route.ts` - Timeout protection + error handling
3. `/src/app/api/gohighlevel/webhook/save-property/route.ts` - Strip undefined values

---

## Next Steps

1. Monitor production workflows for 24-48 hours
2. Verify stuck workflow count decreases
3. Check error logs for any new issues
4. Consider adding automated retry cron job for `export_failed` workflows
5. Add metrics dashboard to track workflow success rate by brand
