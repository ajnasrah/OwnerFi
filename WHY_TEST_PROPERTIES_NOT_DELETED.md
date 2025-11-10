# Why the 2 Test Properties Weren't Deleted

## The 2 Test Properties

1. **123 Test Investment St, Dallas, TX** (ID: `EBMIeDvOjCaw5QK9sc2l`)
2. **789 Rental Investment Blvd, Houston, TX** (ID: `test_rental_estimate_1762555331637`)

## Why They Weren't Auto-Deleted by GHL Webhook

The delete webhook at `/api/gohighlevel/webhook/delete-property` exists and works correctly. However, these test properties were **never in GHL** to begin with, so GHL couldn't send a delete webhook for them.

### Evidence:
- Both properties show `Current GHL Stage: NOT IN GHL`
- Both properties show `In GHL: ❌ NO`
- The IDs don't match the GHL ID format (especially `test_rental_estimate_1762555331637` which has "test" in the ID itself)

## How They Got Into Firestore

These properties were likely created through one of these methods:

### 1. Direct Database Insert (Most Likely)
Created directly in Firestore for testing purposes, bypassing GHL entirely:
- Manual testing of property display
- Testing rental estimate calculations
- Testing property card rendering
- Development/staging environment testing

### 2. Manual API Call
Someone may have called the save-property webhook directly with test data:
```bash
curl -X POST https://ownerfi.ai/api/gohighlevel/webhook/save-property \
  -H "Content-Type: application/json" \
  -d '{"opportunityId": "test_rental_estimate_1762555331637", ...}'
```

### 3. Import Script
Could have been created by an old import or migration script during development.

## Why GHL Delete Webhook Couldn't Remove Them

The GHL delete webhook only triggers when:

1. **A property/opportunity is deleted in GHL**
2. **A property/opportunity moves to a "deleted" stage in GHL**
3. **GHL sends a webhook request to `/api/gohighlevel/webhook/delete-property`**

Since these test properties were never in GHL:
- GHL has no record of them
- GHL doesn't know they exist in your Firestore
- GHL will never send a delete webhook for them

## The Delete Webhook Works Correctly

The webhook code at `src/app/api/gohighlevel/webhook/delete-property/route.ts` is fully functional:

```typescript
// Lines 139-183: Handles single property deletion
if (propertyId) {
  const propertyRef = doc(db, 'properties', propertyId);
  const propertyDoc = await getDoc(propertyRef);

  if (propertyDoc.exists()) {
    await deleteDoc(propertyRef);
    // Also removes from rotation queue
  }
}
```

The webhook:
- ✅ Accepts propertyId/opportunityId from headers or body
- ✅ Deletes from `properties` collection
- ✅ Removes from `property_rotation_queue` collection
- ✅ Supports batch deletion
- ✅ Has proper error handling
- ✅ Has signature verification

## Previous Fixes to Delete Webhook

Git history shows the delete webhook has been fixed before:
- `b234354e` - "Fix delete webhook to read property ID from headers"
- `6ae5434a` - "Fix delete webhook to accept opportunityId from GoHighLevel"
- `03624eb1` - "AUTO-CLEANUP: Remove properties from rotation queue when deleted/deactivated"

## Why This is Expected Behavior

This is **not a bug**. The system is working as designed:

1. **GHL → Firestore Sync**: Only properties in GHL "exported to website" stage should be in Firestore
2. **Delete Webhook**: Only triggered by GHL when properties are deleted FROM GHL
3. **Test Properties**: Created outside of GHL, so GHL can't manage their lifecycle

## How to Handle Test Properties

### Option 1: Manual Deletion (Recommended)
Create a script to delete these specific test properties:

```typescript
await deleteDoc(doc(db, 'properties', 'EBMIeDvOjCaw5QK9sc2l'));
await deleteDoc(doc(db, 'properties', 'test_rental_estimate_1762555331637'));
```

### Option 2: Call Delete Webhook Manually
Trigger the delete webhook directly:

```bash
# Property 1
curl -X POST http://localhost:3000/api/gohighlevel/webhook/delete-property \
  -H "Content-Type: application/json" \
  -H "opportunityid: EBMIeDvOjCaw5QK9sc2l" \
  -d '{"opportunityId": "EBMIeDvOjCaw5QK9sc2l"}'

# Property 2
curl -X POST http://localhost:3000/api/gohighlevel/webhook/delete-property \
  -H "Content-Type: application/json" \
  -H "opportunityid: test_rental_estimate_1762555331637" \
  -d '{"opportunityId": "test_rental_estimate_1762555331637"}'
```

Note: If `GHL_BYPASS_SIGNATURE=true` is set in `.env.local`, this will work without webhook signature.

### Option 3: Leave Them
They're harmless and only add 2 extra records to your database (0.3% overhead).

## Preventing Future Test Data in Production

To prevent test properties from accumulating:

1. **Use separate Firestore database for dev/test**
2. **Add validation to save-property webhook** to reject IDs containing "test"
3. **Implement cleanup cron job** to remove properties not in GHL
4. **Add alerts** when properties exist in Firestore but not in GHL

## Summary

The 2 test properties weren't deleted because:
- ❌ They were never in GHL
- ❌ GHL can't send delete webhooks for properties it doesn't know about
- ✅ The delete webhook works correctly
- ✅ This is expected behavior

**Recommendation:** Manually delete these 2 test properties to clean up the database.
