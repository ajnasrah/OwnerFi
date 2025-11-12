# Duplicate Properties to GHL Webhook - Root Cause Analysis

## Problem Summary
Multiple duplicate properties are being sent to the GoHighLevel (GHL) webhook from the Zillow scraper process.

## Root Causes Identified

### 1. **No Deduplication in Zillow Scraper** ⚠️ CRITICAL

**Location**: `/src/app/api/cron/process-zillow-scraper/route.ts` (line 74-82)

**Problem**:
```typescript
// Save to Firebase
const firestoreBatch = db.batch();
items.forEach((item: any) => {
  const propertyData = transformProperty(item);
  const docRef = db.collection('zillow_imports').doc(); // ❌ Creates NEW doc every time
  firestoreBatch.set(docRef, propertyData);
});
```

**Issue**:
- Every Apify scrape result creates a **NEW** document in `zillow_imports` collection
- No check if property already exists by ZPID (Zillow Property ID)
- Same property scraped multiple times = multiple documents

**Impact**: If you scrape 100 URLs and run the job 3 times, you'll have 300 documents in `zillow_imports` (even if they're the same 100 properties).

---

### 2. **Send-to-GHL Sends All Properties Without Tracking** ⚠️ CRITICAL

**Location**: `/src/app/api/admin/zillow-imports/send-to-ghl/route.ts` (line 43-48)

**Problem**:
```typescript
// Fetch properties from zillow_imports collection
const snapshot = await db
  .collection('zillow_imports')
  .orderBy('importedAt', 'desc')
  .limit(limit) // ❌ Just gets latest N properties
  .get();
```

**Issue**:
- No tracking of which properties have already been sent to GHL
- No `sentToGHL` flag or timestamp
- Every time admin clicks "Send to GHL", it sends the latest 50 properties (default limit)
- If same property was scraped 5 times, it might be in those 50 results multiple times

**Impact**: Admin accidentally sending same properties to GHL repeatedly.

---

### 3. **No ZPID-based Deduplication** ⚠️ HIGH

**Problem**: The `zpid` (Zillow Property ID) field is stored but never used for deduplication:

```typescript
zpid: apifyData.zpid || 0,  // ✅ Stored
// ❌ But NEVER used to check "does this zpid already exist?"
```

**Impact**: Same Zillow property can exist 10+ times in `zillow_imports` collection.

---

### 4. **GHL Webhook Save Route Uses opportunityId, Not ZPID**

**Location**: `/src/app/api/gohighlevel/webhook/save-property/route.ts` (line 475-493)

**Current Logic**:
```typescript
// Use opportunity ID as the property ID to maintain consistency
const propertyId = payload.opportunityId;

// Check if property already exists
let isUpdate = false;
try {
  const existingDoc = await getDoc(doc(db, 'properties', propertyId));
  if (existingDoc.exists()) {
    isUpdate = true;
    logInfo(`Property with opportunity ID ${propertyId} already exists, updating`);
  }
}
```

**Issue**:
- This DOES prevent duplicates in the `properties` collection (✅ good)
- BUT it relies on GHL sending the same `opportunityId` each time
- If GHL webhook is called with different `opportunityId` for same property, it creates duplicate in `properties`

**Not the main issue**, but a potential secondary problem.

---

## Why This Causes Duplicates

### Scenario 1: Repeated Scraping
1. Admin adds 100 Zillow URLs to scraper queue
2. Cron job runs: Creates 100 docs in `zillow_imports`
3. Admin accidentally re-adds same 100 URLs
4. Cron job runs: Creates **another** 100 docs (now 200 total)
5. Admin clicks "Send to GHL" → Sends 50 most recent (likely includes many duplicates)
6. GHL receives duplicate properties

### Scenario 2: No Sent Tracking
1. Admin scrapes 50 properties → saved to `zillow_imports`
2. Admin clicks "Send to GHL" → Sends 50 properties
3. Next week, admin clicks "Send to GHL" again → **Sends same 50 properties**
4. GHL receives duplicates

### Scenario 3: Batching Issues
1. Zillow scraper runs with 200 URLs
2. Processes in batches of 50 (line 52)
3. If same URL is in multiple batches (due to array splitting), property gets saved multiple times
4. Send-to-GHL picks up all duplicates

---

## Solutions

### Solution 1: Add ZPID-based Deduplication in Scraper ✅ PRIORITY 1

**File**: `/src/app/api/cron/process-zillow-scraper/route.ts`

**Change**:
```typescript
// Instead of creating new doc:
const docRef = db.collection('zillow_imports').doc();

// Use ZPID as document ID:
const zpid = String(item.zpid);
const docRef = db.collection('zillow_imports').doc(zpid);
firestoreBatch.set(docRef, propertyData, { merge: true }); // Merge instead of overwrite
```

**Benefits**:
- Same ZPID = same document (no duplicates)
- Re-scraping updates existing property instead of creating new one
- `zillow_imports` collection size stays manageable

---

### Solution 2: Add "Sent to GHL" Tracking ✅ PRIORITY 2

**File**: `/src/app/api/admin/zillow-imports/send-to-ghl/route.ts`

**Add field to track sent status**:
```typescript
// After successful send:
await db.collection('zillow_imports').doc(property.id).update({
  sentToGHL: true,
  sentToGHLAt: new Date(),
  sentToGHLBy: session.user.id
});

// In query, exclude already sent:
const snapshot = await db
  .collection('zillow_imports')
  .where('sentToGHL', '!=', true) // Only unsent properties
  .orderBy('importedAt', 'desc')
  .limit(limit)
  .get();
```

**Benefits**:
- Only send each property once
- Admin can see which properties have been sent
- Can add "Resend" button to force re-send if needed

---

### Solution 3: Add ZPID Uniqueness Check in Send Route ✅ PRIORITY 3

**File**: `/src/app/api/admin/zillow-imports/send-to-ghl/route.ts`

**Deduplicate by ZPID before sending**:
```typescript
// After fetching properties:
const properties = snapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .filter((property: any) => property.agentPhoneNumber || property.brokerPhoneNumber);

// NEW: Deduplicate by ZPID
const uniqueProperties = Array.from(
  new Map(properties.map(p => [p.zpid, p])).values()
);

console.log(`📊 Found ${properties.length} properties, ${uniqueProperties.length} unique by ZPID\n`);
```

**Benefits**:
- Even if duplicates exist in `zillow_imports`, only send unique properties
- Immediate fix without database changes

---

### Solution 4: Add Batch Deduplication ✅ OPTIONAL

**File**: `/src/app/api/cron/process-zillow-scraper/route.ts`

**Check for duplicates before batching**:
```typescript
const urls: string[] = jobData.urls || [];

// Deduplicate URLs
const uniqueUrls = Array.from(new Set(urls));

console.log(`📋 Job has ${urls.length} URLs, ${uniqueUrls.length} unique`);

for (let i = 0; i < uniqueUrls.length; i += batchSize) {
  const batch = uniqueUrls.slice(i, i + batchSize);
  // ... rest of logic
}
```

**Benefits**:
- Prevents same URL from being scraped multiple times in one job
- Reduces Apify API costs

---

## Recommended Implementation Order

### Phase 1: Immediate Fixes (30 minutes)
1. ✅ **Solution 3** - Add ZPID deduplication in send-to-ghl route
2. ✅ **Solution 4** - Deduplicate URLs before batching

**Impact**: Stops duplicates from being sent immediately, no database changes needed

### Phase 2: Prevent Future Duplicates (1 hour)
3. ✅ **Solution 1** - Use ZPID as document ID in scraper
4. ✅ **Solution 2** - Add sent tracking

**Impact**: Prevents duplicate creation at source, adds tracking

### Phase 3: Cleanup (Optional, 30 minutes)
5. Create script to:
   - Find all duplicate ZPIDs in `zillow_imports`
   - Keep latest version, delete older ones
   - Mark all as `sentToGHL: false` to allow re-sending

---

## Database Impact

### Current State (Estimated):
```
zillow_imports collection: 500-2000 documents
Duplicate rate: 30-60% (based on re-scraping frequency)
Actual unique properties: 200-800
```

### After Fixes:
```
zillow_imports collection: Uses ZPID as ID (only unique properties)
Each property: One document only
Sent tracking: Clear audit trail
```

---

## Testing Plan

### Test 1: ZPID Deduplication
1. Scrape 10 Zillow URLs
2. Re-scrape same 10 URLs
3. Check `zillow_imports` count → Should be 10 (not 20)

### Test 2: Send Tracking
1. Send 20 properties to GHL
2. Click "Send to GHL" again
3. Should find 0 unsent properties (not send same 20 again)

### Test 3: Batch Deduplication
1. Create job with duplicate URLs: `[url1, url2, url1, url3, url2]`
2. Run scraper
3. Should only scrape 3 unique URLs (not 5)

---

## Questions to Confirm

1. **How often are Zillow properties re-scraped?**
   - Daily? Weekly? On-demand only?

2. **Are the same URLs being added to scraper queue multiple times?**
   - By mistake? By design (to update pricing)?

3. **Should updated properties be re-sent to GHL?**
   - Or only send once ever?
   - Or re-send if price/status changes?

4. **What's the GHL webhook behavior with duplicates?**
   - Does it create duplicate opportunities?
   - Or does it update existing based on some field?

---

## Monitoring Recommendations

### Add Logging:
```typescript
// In scraper:
console.log(`Duplicates prevented: ${urls.length - uniqueUrls.length}`);

// In send-to-ghl:
console.log(`Total: ${properties.length}, Unique by ZPID: ${uniqueProperties.length}`);
console.log(`Already sent: ${alreadySentCount}, Sending: ${toSendCount}`);
```

### Add Admin UI:
- Show duplicate count in admin dashboard
- "Deduplicate zillow_imports" button
- "Resend to GHL" button (for specific properties)
- Last sent timestamp for each property

---

## Summary

**Root Cause**: No deduplication logic anywhere in the pipeline

**Primary Issues**:
1. Zillow scraper creates new doc for every scrape (no ZPID check)
2. Send-to-GHL has no sent tracking (sends same properties repeatedly)
3. No uniqueness checks before sending

**Quick Fix**: Add ZPID deduplication in send-to-ghl route (~30 min)

**Permanent Fix**: Use ZPID as document ID + add sent tracking (~1 hour)

**Expected Result**: Zero duplicate properties sent to GHL
