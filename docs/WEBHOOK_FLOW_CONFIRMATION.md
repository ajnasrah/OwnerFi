# ✅ Webhook Flow Confirmation

## Complete Property → Buyer SMS Notification Flow

This document confirms the complete flow from when a new property is added to when buyers receive SMS notifications.

---

## 📋 Executive Summary

✅ **CONFIRMED:** When a new property is added that matches a buyer's search criteria, the system automatically:

1. Detects the match
2. Triggers webhook to GoHighLevel
3. Sends SMS to the buyer with property details

**Buyer Information Sent to GoHighLevel:**
- ✅ Buyer Name (First & Last)
- ✅ Phone Number
- ✅ Email Address
- ✅ Primary City
- ✅ Primary State
- ✅ Max Monthly Payment Budget
- ✅ Max Down Payment Budget

**Property Information Sent:**
- ✅ Property Address
- ✅ City, State
- ✅ Monthly Payment
- ✅ Down Payment
- ✅ List Price
- ✅ Bedrooms/Bathrooms

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: New Property Added                                 │
├─────────────────────────────────────────────────────────────┤
│  Admin creates property via:                                │
│  • /api/admin/properties/create                             │
│  • CSV import                                               │
│  • External integration                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Property Saved to Firestore                        │
├─────────────────────────────────────────────────────────────┤
│  Collection: properties                                     │
│  Document: {                                                │
│    id: "prop_123",                                          │
│    address: "123 Main St",                                  │
│    city: "Houston",                                         │
│    state: "TX",                                             │
│    monthlyPayment: 1500,                                    │
│    downPaymentAmount: 10000,                                │
│    bedrooms: 3,                                             │
│    bathrooms: 2,                                            │
│    isActive: true                                           │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Trigger Property Matching                          │
├─────────────────────────────────────────────────────────────┤
│  POST /api/properties/sync-matches                          │
│  {                                                          │
│    action: "add",                                           │
│    propertyId: "prop_123",                                  │
│    propertyData: {...}                                      │
│  }                                                          │
│                                                             │
│  Location: src/app/api/properties/sync-matches/route.ts    │
│  Function: addPropertyToMatchingBuyers()                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Find Matching Buyers                               │
├─────────────────────────────────────────────────────────────┤
│  Query buyerProfiles WHERE:                                 │
│  • searchCriteria.state == property.state (TX)              │
│  • maxMonthlyPayment >= property.monthlyPayment             │
│  • maxDownPayment >= property.downPaymentAmount             │
│  • preferredCity == property.city (Houston)                 │
│  • isActive == true                                         │
│  • smsNotifications != false                                │
│                                                             │
│  Filters OUT buyers who:                                    │
│  • Already liked this property                              │
│  • Already passed on this property                          │
│  • Don't have SMS enabled                                   │
│  • Don't have phone number                                  │
│                                                             │
│  Result: matchedBuyers = [buyer1, buyer2, buyer3...]        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Update Buyer Profiles                              │
├─────────────────────────────────────────────────────────────┤
│  For each matched buyer:                                    │
│  UPDATE buyerProfiles/{buyerId}                             │
│  SET matchedPropertyIds = arrayUnion("prop_123")            │
│  SET lastMatchUpdate = serverTimestamp()                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Trigger GoHighLevel Notifications (BACKGROUND)     │
├─────────────────────────────────────────────────────────────┤
│  Location: src/app/api/properties/sync-matches/route.ts:166│
│                                                             │
│  sendBatchPropertyMatchNotifications(                       │
│    property,                                                │
│    matchedBuyers,                                           │
│    'new_property_added'                                     │
│  )                                                          │
│                                                             │
│  This runs in background (fire-and-forget)                  │
│  Won't block property creation response                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Send Individual Notifications                      │
├─────────────────────────────────────────────────────────────┤
│  Location: src/lib/gohighlevel-notifications.ts            │
│  Function: sendPropertyMatchNotification()                  │
│                                                             │
│  For each buyer:                                            │
│    1. Validate buyer has phone & SMS enabled                │
│    2. Build payload with ALL buyer info                     │
│    3. POST to internal webhook endpoint                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 8: Internal Webhook Receives Request                  │
├─────────────────────────────────────────────────────────────┤
│  POST /api/webhooks/gohighlevel/property-match             │
│  Location: src/app/api/webhooks/gohighlevel/property-      │
│            match/route.ts                                   │
│                                                             │
│  Payload: {                                                 │
│    // Buyer Info                                            │
│    buyerId: "buyer_abc",                                    │
│    buyerName: "John Doe",                                   │
│    buyerFirstName: "John",                                  │
│    buyerLastName: "Doe",                                    │
│    buyerPhone: "+15551234567",                              │
│    buyerEmail: "john@example.com",                          │
│    buyerCity: "Houston",                                    │
│    buyerState: "TX",                                        │
│    buyerMaxMonthlyPayment: 2000,                            │
│    buyerMaxDownPayment: 50000,                              │
│                                                             │
│    // Property Info                                         │
│    propertyId: "prop_123",                                  │
│    propertyAddress: "123 Main St",                          │
│    propertyCity: "Houston",                                 │
│    propertyState: "TX",                                     │
│    monthlyPayment: 1500,                                    │
│    downPaymentAmount: 10000,                                │
│    listPrice: 250000,                                       │
│    bedrooms: 3,                                             │
│    bathrooms: 2,                                            │
│                                                             │
│    // Metadata                                              │
│    dashboardUrl: "https://ownerfi.com/dashboard",           │
│    trigger: "new_property_added",                           │
│    timestamp: "2025-11-12T10:30:00.000Z"                    │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 9: Log Notification Attempt                           │
├─────────────────────────────────────────────────────────────┤
│  CREATE document in webhookLogs collection:                 │
│  {                                                          │
│    type: "property_match_notification",                     │
│    status: "pending",                                       │
│    buyerId: "buyer_abc",                                    │
│    propertyId: "prop_123",                                  │
│    buyerPhone: "+15551234567",                              │
│    payload: {...full payload...},                           │
│    createdAt: serverTimestamp()                             │
│  }                                                          │
│                                                             │
│  Log ID: log_xyz789                                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 10: Forward to GoHighLevel                            │
├─────────────────────────────────────────────────────────────┤
│  POST to: $GOHIGHLEVEL_WEBHOOK_URL                         │
│  URL: https://services.leadconnectorhq.com/hooks/          │
│       U2B5lSlWrVBgVxHNq5AH/webhook-trigger/                │
│       a80182b1-b415-4af4-a30d-897c9d081079                  │
│                                                             │
│  Headers:                                                   │
│    Content-Type: application/json                           │
│                                                             │
│  Body: {                                                    │
│    phone: "+15551234567",                                   │
│    message: "🏠 New Property Match!\n\n...",                │
│    buyerName: "John Doe",                                   │
│    buyerFirstName: "John",                                  │
│    buyerLastName: "Doe",                                    │
│    buyerEmail: "john@example.com",                          │
│    buyerPhone: "+15551234567",                              │
│    buyerCity: "Houston",                                    │
│    buyerState: "TX",                                        │
│    buyerMaxMonthlyPayment: 2000,                            │
│    buyerMaxDownPayment: 50000,                              │
│    ...property data...                                      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 11: GoHighLevel Receives Webhook                      │
├─────────────────────────────────────────────────────────────┤
│  • Webhook trigger fires in GoHighLevel workflow            │
│  • Workflow has access to all data via {{webhook.field}}    │
│  • Example: {{webhook.buyerFirstName}} = "John"             │
│  • Example: {{webhook.buyerEmail}} = "john@example.com"     │
│  • Example: {{webhook.buyerCity}} = "Houston"               │
│  • Example: {{webhook.buyerMaxMonthlyPayment}} = 2000       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 12: GoHighLevel Sends SMS                             │
├─────────────────────────────────────────────────────────────┤
│  Action: Send SMS                                           │
│  To: {{webhook.phone}} = "+15551234567"                     │
│  Message: {{webhook.message}} =                             │
│    "🏠 New Property Match!                                  │
│                                                             │
│     Hi John! We found a home for you in Houston, TX:        │
│                                                             │
│     📍 123 Main St                                          │
│     🛏️ 3 bed, 2 bath                                       │
│     💰 $250,000 list price                                  │
│     💵 $1,500/mo, $10,000 down                              │
│                                                             │
│     View it now: https://ownerfi.com/dashboard              │
│                                                             │
│     Reply STOP to unsubscribe"                              │
│                                                             │
│  Status: Sent ✅                                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 13: Update Webhook Log                                │
├─────────────────────────────────────────────────────────────┤
│  UPDATE webhookLogs/log_xyz789:                             │
│  {                                                          │
│    status: "sent",                                          │
│    sentAt: "2025-11-12T10:30:02.000Z",                      │
│    goHighLevelResponse: {...},                              │
│    processingTimeMs: 245,                                   │
│    updatedAt: serverTimestamp()                             │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 14: Buyer Receives SMS 📱                             │
├─────────────────────────────────────────────────────────────┤
│  Buyer's phone receives text message                        │
│  They click the link to view property                       │
│  They can like/pass on the property                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Trigger Points

The webhook is triggered in **1 primary location**:

### 1. New Property Added (`new_property_added`)
**File:** `src/app/api/properties/sync-matches/route.ts`
**Function:** `addPropertyToMatchingBuyers()` (lines 158-173)

```typescript
// After matching buyers to property
if (matchedBuyers.length > 0) {
  const { sendBatchPropertyMatchNotifications } =
    await import('@/lib/gohighlevel-notifications');

  sendBatchPropertyMatchNotifications(
    property,
    matchedBuyers,
    'new_property_added'
  );
}
```

**When it fires:**
- Admin creates property via `/api/admin/properties/create`
- Property is added via CSV import
- Property is synced from external source

---

## 📊 Data Sent to GoHighLevel

### Complete Payload Structure

```json
{
  // SMS Configuration
  "phone": "+15551234567",
  "message": "🏠 New Property Match!\n\nHi John!...",

  // Buyer Personal Information
  "buyerId": "buyer_abc123",
  "buyerName": "John Doe",
  "buyerFirstName": "John",
  "buyerLastName": "Doe",
  "buyerEmail": "john.doe@example.com",
  "buyerPhone": "+15551234567",

  // Buyer Location & Preferences
  "buyerCity": "Houston",
  "buyerState": "TX",
  "buyerMaxMonthlyPayment": 2000,
  "buyerMaxDownPayment": 50000,

  // Property Details
  "propertyId": "prop_xyz789",
  "propertyAddress": "123 Main St",
  "propertyCity": "Houston",
  "propertyState": "TX",
  "monthlyPayment": 1500,
  "downPaymentAmount": 10000,
  "listPrice": 250000,
  "bedrooms": 3,
  "bathrooms": 2,

  // Additional Metadata
  "dashboardUrl": "https://ownerfi.com/dashboard",
  "trigger": "new_property_added",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

### Available in GoHighLevel Workflow

All fields accessible via `{{webhook.fieldName}}`:

**Buyer Fields:**
- `{{webhook.buyerFirstName}}` - "John"
- `{{webhook.buyerLastName}}` - "Doe"
- `{{webhook.buyerName}}` - "John Doe"
- `{{webhook.buyerEmail}}` - "john.doe@example.com"
- `{{webhook.buyerPhone}}` - "+15551234567"
- `{{webhook.buyerCity}}` - "Houston"
- `{{webhook.buyerState}}` - "TX"
- `{{webhook.buyerMaxMonthlyPayment}}` - 2000
- `{{webhook.buyerMaxDownPayment}}` - 50000

**Property Fields:**
- `{{webhook.propertyAddress}}` - "123 Main St"
- `{{webhook.propertyCity}}` - "Houston"
- `{{webhook.propertyState}}` - "TX"
- `{{webhook.monthlyPayment}}` - 1500
- `{{webhook.downPaymentAmount}}` - 10000
- `{{webhook.listPrice}}` - 250000
- `{{webhook.bedrooms}}` - 3
- `{{webhook.bathrooms}}` - 2

---

## 🔍 Matching Logic

A buyer receives notification if **ALL** conditions are met:

✅ **Location Match**
```
property.state === buyer.preferredState
AND
property.city === buyer.preferredCity
```

✅ **Budget Match**
```
property.monthlyPayment <= buyer.maxMonthlyPayment
AND
property.downPaymentAmount <= buyer.maxDownPayment
```

✅ **SMS Enabled**
```
buyer.smsNotifications !== false
AND
buyer.phone !== null
```

✅ **Active Profile**
```
buyer.isActive === true
```

✅ **Not Already Interacted**
```
property.id NOT IN buyer.likedPropertyIds
AND
property.id NOT IN buyer.passedPropertyIds
```

**Location:** `src/lib/gohighlevel-notifications.ts:shouldNotifyBuyer()`

---

## 📈 Performance & Scale

### Current Implementation

- **Batch Size:** 200 buyers per property (line 128 in sync-matches)
- **Background Processing:** Yes (fire-and-forget)
- **Non-Blocking:** Property creation doesn't wait for notifications
- **Parallel Notifications:** All buyers notified simultaneously

### Example Timeline

```
T+0ms     Property created and saved to Firestore
T+50ms    Property sync-matches endpoint called
T+200ms   Matching buyers found (5 buyers)
T+250ms   Buyer profiles updated with matchedPropertyIds
T+260ms   Batch notification triggered (background)
T+300ms   sync-matches returns success (doesn't wait for SMS)

--- BACKGROUND (non-blocking) ---
T+500ms   5 webhook requests sent to internal endpoint
T+600ms   5 logs created in webhookLogs collection
T+800ms   5 requests forwarded to GoHighLevel
T+1000ms  GoHighLevel sends 5 SMS messages
T+2000ms  All 5 buyers receive SMS on their phones
```

---

## 🧪 Testing

### Test via Admin Dashboard

1. Go to `/admin/ghl-logs`
2. Select buyer with SMS enabled
3. Select any property
4. Click "Send Test SMS"
5. Check logs table for result

### Test with Real Property

1. Create buyer profile with:
   - City: "Houston"
   - State: "TX"
   - Max Monthly: $2000
   - Max Down: $50000
   - SMS Enabled: true
   - Phone: your test number

2. Create property with:
   - City: "Houston"
   - State: "TX"
   - Monthly Payment: $1500
   - Down Payment: $10000

3. Property is automatically added to buyer's matches
4. SMS notification sent within 1-2 seconds
5. Check `/admin/ghl-logs` to see the log entry

---

## ✅ Checklist

Before going live, ensure:

- [x] `GOHIGHLEVEL_WEBHOOK_URL` environment variable set
- [x] GoHighLevel workflow created and activated
- [x] SMS action configured in workflow
- [x] Test SMS sent successfully
- [x] Webhook logs visible in `/admin/ghl-logs`
- [x] Buyer has `smsNotifications: true`
- [x] Buyer has valid phone number
- [x] Property matching logic tested

---

## 📝 Summary

**✅ CONFIRMED: The webhook integration is complete and functional.**

When a new property is added:
1. System finds matching buyers based on budget, location, and preferences
2. Updates buyer profiles with `matchedPropertyIds`
3. Triggers GoHighLevel webhook for each matched buyer
4. Sends complete buyer information (name, email, phone, city, budget)
5. GoHighLevel sends SMS to buyer's phone
6. All attempts logged in `webhookLogs` collection
7. Viewable in admin dashboard at `/admin/ghl-logs`

**All buyer data you requested is included:**
- ✅ Buyer name (first & last)
- ✅ Phone number
- ✅ Email
- ✅ Primary city
- ✅ Primary state
- ✅ Max monthly payment budget
- ✅ Max down payment budget

**Ready to deploy!** 🚀
