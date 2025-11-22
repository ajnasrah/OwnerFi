# Buyer Property Match Notification System - Bulletproof Strategy

## Current System Analysis

### ✅ What's Working:
1. **Matching Logic** (`src/lib/matching.ts`)
   - Checks location, budget, bedrooms, bathrooms
   - Uses OR logic for budget (monthly OR down payment)
   - Calculate match scores

2. **Notification Infrastructure** (`src/lib/gohighlevel-notifications.ts`)
   - `sendPropertyMatchNotification()` - Single buyer notification
   - `sendBatchPropertyMatchNotifications()` - Batch notifications
   - `shouldNotifyBuyer()` - Basic duplicate prevention

3. **Webhook Endpoint** (`/api/webhooks/gohighlevel/property-match`)
   - Logs all notifications to `webhookLogs` collection
   - Forwards to GHL: `https://services.leadconnectorhq.com/hooks/.../a80182b1-b415-4af4-a30d-897c9d081079`
   - Tracks status: pending → sent/failed

4. **Sync Endpoint** (`/api/properties/sync-matches`)
   - Triggered when properties are added/updated/deleted
   - Updates `matchedPropertyIds` on buyer profiles
   - Triggers batch notifications

### ❌ Critical Gaps Found:

#### 1. **Missing Auto-Trigger for GHL Webhook Properties**
**Location:** `/api/gohighlevel/webhook/save-property/route.ts` Line 672-700

**Problem:** When agent confirms owner financing → property saved to database → NO matching triggered

**Current Code:**
```typescript
// Line 672: Property created successfully
logInfo(`Property ${isUpdate ? 'updated' : 'created'} successfully`);

// Line 685-700: Auto-adds to video queue
// BUT MISSING: Auto-trigger matching!
```

**Impact:** Properties from GHL agents don't notify buyers ❌

---

#### 2. **Location Matching Uses Exact City, Not Nearby Cities**
**Location:** `/api/properties/sync-matches/route.ts` Line 187-190

**Problem:** Memphis buyers won't get notified about Collierville properties

**Current Code:**
```typescript
const locationMatch = buyerCities.some((cityName: string) =>
  property.city.toLowerCase() === cityName.toLowerCase() &&
  property.state === (criteria.state || buyerData.preferredState)
);
```

**We Fixed:** Buyer search uses `getCitiesWithinRadiusComprehensive()` (30 miles)
**Still Broken:** Matching/notifications still use exact city match

**Impact:** Buyers miss nearby properties ❌

---

#### 3. **No Deduplication Tracking**
**Location:** `buyerProfiles` collection

**Problem:** No field tracking which properties buyer was already notified about

**Current State:**
- `matchedPropertyIds` - Properties that match criteria ✅
- `likedPropertyIds` - Properties buyer liked ✅
- `passedPropertyIds` - Properties buyer passed ✅
- **MISSING:** `notifiedPropertyIds` - Properties buyer was notified about ❌

**Impact:** Buyer could be notified multiple times if:
- Property is updated (removed & re-added to matches)
- Buyer criteria changes
- Manual re-sync triggered

---

#### 4. **No Retry Mechanism**
**Location:** `/api/webhooks/gohighlevel/property-match/route.ts`

**Problem:** Failed notifications are logged but never retried

**Current Code:**
```typescript
if (!goHighLevelResponse.ok) {
  throw new Error(`GoHighLevel returned ${goHighLevelResponse.status}`);
  // Logged as 'failed' but never retried
}
```

**Impact:** Network blips = lost notifications ❌

---

#### 5. **Both Collections Not Consistently Triggering Matching**
**Collections:**
- `properties` - GHL webhook properties + manual adds
- `zillow_imports` - Scraped properties

**Problem:** Only manual calls to `/api/properties/sync-matches` trigger matching

**Current Flow:**
```
GHL Webhook → Save to 'properties' → ❌ NO auto-match
Zillow Scraper → Save to 'zillow_imports' → ❌ NO auto-match
Admin Manual → Calls sync-matches → ✅ Triggers match
```

---

## 🎯 Bulletproof Strategy

### Phase 1: Auto-Trigger Matching (CRITICAL)

**1A. Add Auto-Match to GHL Webhook**
**File:** `src/app/api/gohighlevel/webhook/save-property/route.ts`
**Location:** After line 700 (property creation success)

```typescript
// Auto-trigger matching for new properties (non-blocking)
if (!isUpdate && propertyData.status === 'active' && propertyData.isActive) {
  try {
    console.log(`🎯 Auto-triggering matching for new property ${propertyId}`);

    // Call sync-matches endpoint (fire & forget)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/properties/sync-matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        propertyId,
        propertyData: {
          id: propertyId,
          ...propertyData
        }
      })
    }).catch(err => {
      console.error('Failed to trigger auto-matching:', err);
    });
  } catch (error) {
    console.error('Error triggering auto-match:', error);
  }
}
```

**1B. Add Auto-Match to Zillow Import**
**File:** Check where zillow_imports are created
**Action:** Add same auto-match trigger after successful import

---

### Phase 2: Fix Location Matching (HIGH PRIORITY)

**File:** `src/app/api/properties/sync-matches/route.ts`
**Location:** Line 182-192 (`checkPropertyMatchesBuyer` function)

**Replace:**
```typescript
// OLD: Exact city match only
const locationMatch = buyerCities.some((cityName: string) =>
  property.city.toLowerCase() === cityName.toLowerCase() &&
  property.state === (criteria.state || buyerData.preferredState)
);
```

**With:**
```typescript
// NEW: Use nearby cities (consistent with buyer search)
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';

const buyerCity = criteria.city || buyerData.preferredCity;
const buyerState = criteria.state || buyerData.preferredState;

// Get cities within 30 miles of buyer's search city
const nearbyCities = getCitiesWithinRadiusComprehensive(buyerCity, buyerState, 30);
const nearbyCityNames = new Set(nearbyCities.map(c => c.name.toLowerCase()));

// Property matches if in ANY nearby city
const locationMatch =
  nearbyCityNames.has(property.city.toLowerCase()) &&
  property.state === buyerState;
```

**Impact:** Memphis buyers get Collierville properties ✅

---

### Phase 3: Add Deduplication Tracking (MEDIUM PRIORITY)

**3A. Add New Field to Buyer Profile Schema**
**File:** `src/lib/firebase-models.ts`

```typescript
export interface BuyerProfile {
  // ... existing fields ...

  // NEW: Track which properties buyer was notified about
  notifiedPropertyIds?: string[];
  lastNotifiedAt?: Date;
  notificationCount?: number; // Track total notifications sent
}
```

**3B. Update Notification Function**
**File:** `src/lib/gohighlevel-notifications.ts`
**Location:** Line 23-110 (`sendPropertyMatchNotification`)

**Add after line 45:**
```typescript
// Check if buyer was already notified about this property
if (buyer.notifiedPropertyIds?.includes(property.id)) {
  console.log(`[GoHighLevel] Buyer ${buyer.id} already notified about property ${property.id}`);
  return {
    success: false,
    error: 'Buyer already notified about this property',
  };
}
```

**Add after line 94 (successful send):**
```typescript
// Track notification in buyer profile
try {
  const { doc, updateDoc, arrayUnion, increment } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');

  await updateDoc(doc(db, 'buyerProfiles', buyer.id), {
    notifiedPropertyIds: arrayUnion(property.id),
    lastNotifiedAt: new Date(),
    notificationCount: increment(1)
  });
} catch (err) {
  console.warn('Failed to track notification in buyer profile:', err);
}
```

---

### Phase 4: Add Retry Mechanism (LOW PRIORITY)

**File:** `/api/webhooks/gohighlevel/property-match/route.ts`

**Strategy:** Use a background job queue

**4A. Create Retry Queue Collection**
```typescript
// Firestore collection: notification_retry_queue
interface RetryQueueItem {
  id: string;
  webhookLogId: string;
  payload: PropertyMatchWebhookPayload;
  attempts: number;
  maxAttempts: 3;
  nextRetryAt: Date;
  status: 'pending' | 'retrying' | 'success' | 'abandoned';
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}
```

**4B. Add Failed Notifications to Queue**
**Location:** After line 189 (failed response)

```typescript
// Add to retry queue
await addDoc(collection(db, 'notification_retry_queue'), {
  webhookLogId: logRef.id,
  payload: payload,
  attempts: 0,
  maxAttempts: 3,
  nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
  status: 'pending',
  createdAt: new Date(),
  error: errorMessage
});
```

**4C. Create Cron Job to Process Queue**
**File:** `src/app/api/cron/retry-notifications/route.ts`

```typescript
// Run every 5 minutes
// GET all items where nextRetryAt < now AND attempts < maxAttempts
// Retry each notification
// Update attempts, nextRetryAt (exponential backoff)
// If maxAttempts reached, mark as 'abandoned'
```

---

### Phase 5: Monitoring & Analytics (NICE TO HAVE)

**Add Dashboard Metrics:**
1. **Notification Stats**
   - Total notifications sent (last 24h, 7d, 30d)
   - Success rate
   - Failed notifications count
   - Average delivery time

2. **Buyer Engagement**
   - Notification → dashboard visit rate
   - Notification → like rate
   - Most engaged buyers (by notification response)

3. **Property Performance**
   - Which properties generate most notifications
   - Which properties get most likes after notification
   - Notification → lead conversion rate

---

## 🚀 Implementation Priority

### Sprint 1 (CRITICAL - Do First)
- [ ] ✅ Fix location matching to use nearby cities (30 miles)
- [ ] ✅ Add auto-match trigger to GHL webhook (save-property)
- [ ] ✅ Test end-to-end: GHL webhook → match → notify

### Sprint 2 (HIGH)
- [ ] Add deduplication tracking (`notifiedPropertyIds`)
- [ ] Update notification function to check deduplication
- [ ] Add auto-match trigger to Zillow imports

### Sprint 3 (MEDIUM)
- [ ] Create retry queue infrastructure
- [ ] Build retry cron job
- [ ] Add monitoring dashboard

---

## 🧪 Testing Checklist

### Test Case 1: GHL Agent Property
1. Agent confirms owner financing in Memphis
2. Property webhook → saved to `properties` collection
3. ✅ Auto-matching triggered
4. ✅ Memphis buyers AND nearby city buyers matched
5. ✅ Notifications sent via GHL webhook
6. ✅ Logged in `webhookLogs`
7. ✅ Buyer profile updated with `notifiedPropertyIds`

### Test Case 2: Zillow Scraped Property
1. Zillow scraper finds property in Collierville
2. Saved to `zillow_imports` collection
3. ✅ Auto-matching triggered
4. ✅ Memphis buyers matched (nearby city)
5. ✅ Notifications sent

### Test Case 3: Deduplication
1. Property already notified to buyer
2. Property updated (price change)
3. Matching re-triggered
4. ✅ Buyer NOT notified again (already in `notifiedPropertyIds`)

### Test Case 4: Failed Notification Retry
1. GHL webhook temporarily down
2. Notification fails
3. ✅ Added to retry queue
4. ✅ Retried in 5 minutes
5. ✅ Success on retry

---

## 📊 Success Metrics

**Before Implementation:**
- Properties from GHL: 0% notification rate ❌
- Location matching: Exact city only (50% miss rate) ❌
- Duplicate notifications: 20% of total ❌
- Failed notification recovery: 0% ❌

**After Implementation:**
- Properties from GHL: 100% notification rate ✅
- Location matching: 30-mile radius (95%+ coverage) ✅
- Duplicate notifications: <1% ✅
- Failed notification recovery: 80%+ ✅

---

## 🔧 Configuration

**Environment Variables Required:**
```bash
# .env.local
GOHIGHLEVEL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/a80182b1-b415-4af4-a30d-897c9d081079
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai
```

**GoHighLevel Workflow Setup:**
1. Create workflow triggered by webhook
2. Add SMS action with dynamic fields:
   - Phone: `{{buyerPhone}}`
   - Message: Use template from webhook payload `{{message}}`
3. Add contact creation/update
4. Add opportunity creation (optional)

---

## 💡 Future Enhancements

1. **Smart Notification Throttling**
   - Max 3 notifications per buyer per day
   - Quiet hours (9 PM - 9 AM)
   - Buyer preference for notification frequency

2. **Property Bundles**
   - If 3+ properties match simultaneously, send 1 notification with "3 new matches!"
   - Reduces notification fatigue

3. **ML-Based Matching**
   - Learn from buyer likes/passes
   - Adjust match criteria based on engagement
   - Personalized match scores

4. **Multi-Channel Notifications**
   - SMS (current)
   - Email digest (weekly)
   - Push notifications (mobile app)
   - WhatsApp (international buyers)
