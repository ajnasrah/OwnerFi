# Property Webhook Diagnosis Report
**Date:** November 13, 2025
**Issue:** Only 6 out of 50 expected properties were created

---

## 📊 Current Status

### Properties Created Today
- **Total created:** 6 properties
- **Expected:** ~50 properties
- **Missing:** ~44 properties

### Buyer Notifications
- **Matches found:** 1 match (Abir Besbes ↔ San Antonio property)
- **Notifications sent:** Unknown (no persistent logging)
- **Property added to buyer's matches:** ✅ Yes

---

## 🔍 Root Cause Analysis

### Why Only 6 Properties Were Created

The webhook at `/api/gohighlevel/webhook/save-property` has strict validation requirements. Properties are **rejected** if they're missing:

#### Required Fields (all must be present):
1. ✅ **opportunityId** - Unique ID from GHL
2. ✅ **propertyAddress** - Street address (cannot be empty)
3. ✅ **propertyCity** - City name (cannot be empty)
4. ✅ **state** - State code (2-letter or full name)
5. ✅ **price** - Must be > 0

See validation code: `src/app/api/gohighlevel/webhook/save-property/route.ts:431-472`

### Common Reasons for Rejection

Based on the webhook code analysis:

1. **Missing Custom Fields in GHL**
   - The webhook expects data in **headers** OR **body**
   - GHL sends custom fields with specific names
   - Field name mismatches cause validation failures

2. **Price Issues**
   - Price = 0 or empty → REJECTED
   - Price field not mapped in GHL → REJECTED

3. **Location Data Issues**
   - Missing city → REJECTED
   - Missing state → REJECTED
   - Empty address → REJECTED

4. **Webhook Not Triggered**
   - Pipeline stage doesn't trigger webhook
   - Webhook URL not configured in GHL
   - Webhook disabled for certain stages

---

## 🔬 Data Mapping Analysis

The webhook checks multiple field name variations:

### Address
```typescript
propertyAddress = headers.get('propertyaddress') ||
                  headers.get('propertyAddress') ||
                  body.propertyAddress ||
                  body.address
```

### City
```typescript
propertyCity = headers.get('propertycity') ||
               headers.get('propertyCity') ||
               body.propertyCity ||
               body.city
```

### State
```typescript
state = headers.get('state') || body.state
```

### Price
```typescript
price = headers.get('price') || body.price
```

**Source:** `src/app/api/gohighlevel/webhook/save-property/route.ts:382-407`

---

## ✅ Successfully Created Properties (Today)

| Property | City | State | Price | Status |
|----------|------|-------|-------|--------|
| 6069 Dakota Rose Cir | Brownsville | TX | $237,000 | ✅ Active |
| 1439 Caballero | San Antonio | TX | $115,000 | ✅ Active |
| 708 Los Naranjos | San Juan | PR | $165,000 | ✅ Active |
| 226 Cherokee Rd | Glenwood | GA | $215,000 | ✅ Active |
| 150 Lynn Dr | Lumberton | TX | $295,500 | ✅ Active |
| 416 W Us Hwy 30 | Bliss | ID | $415,000 | ✅ Active |

All 6 properties had complete data for all required fields.

---

## 🎯 Buyer Matching Analysis

### Match Found
- **Property:** 1439 Caballero, San Antonio, TX
- **Buyer:** Abir Besbes (206-395-4410)
- **Match Criteria:**
  - ✅ Location: San Antonio, TX
  - ✅ Monthly payment: $544 ≤ $2,000
  - ✅ Requirements: 3 bed, 1 bath (no minimums set)

### Why Other Properties Didn't Match

| Property | City | Reason |
|----------|------|--------|
| 6069 Dakota Rose Cir | Brownsville, TX | No buyers in Brownsville |
| 708 Los Naranjos | San Juan, PR | No buyers in Puerto Rico |
| 226 Cherokee Rd | Glenwood, GA | No buyers in Glenwood |
| 150 Lynn Dr | Lumberton, TX | No buyers in Lumberton |
| 416 W Us Hwy 30 | Bliss, ID | No buyers in Idaho |

---

## 🚨 Critical Issues Found

### 1. No Persistent Notification Logging
- **Problem:** Webhook uses `console.log()` for notification status
- **Impact:** Cannot verify if SMS was sent to Abir Besbes
- **Location:** `src/app/api/gohighlevel/webhook/save-property/route.ts:837-890`

### 2. Missing GHL API Credentials
- **Problem:** `GHL_API_KEY` and `GHL_LOCATION_ID` are empty
- **Impact:** Cannot query GHL to see all opportunities
- **Cannot verify:** Which 44 properties failed or weren't sent

### 3. No Webhook Error Logging
- **Problem:** Validation failures logged but not persisted
- **Impact:** Cannot analyze why properties were rejected
- **Solution needed:** Persistent webhook error log

---

## 📋 Action Items to Fix

### Immediate Actions

1. **Check GoHighLevel Webhook Logs**
   - Go to: GHL → Settings → Webhooks
   - Find webhook for: `/api/gohighlevel/webhook/save-property`
   - Check for failed webhook calls today
   - Review error messages

2. **Verify GHL Custom Fields Mapping**
   - Ensure pipeline has custom fields:
     - `propertyAddress` (or `address`)
     - `propertyCity` (or `city`)
     - `state`
     - `price`
   - Verify fields are populated for all 50 opportunities
   - Check field names match exactly (case-insensitive)

3. **Check GHL Webhook Triggers**
   - Verify webhook is triggered on:
     - Opportunity created
     - Opportunity updated
   - Check if webhook is enabled for all pipeline stages
   - Confirm webhook URL is correct

### Long-term Improvements

1. **Add Persistent Webhook Logging**
   ```typescript
   // Add to webhook handler
   await db.collection('webhookLogs').add({
     timestamp: serverTimestamp(),
     type: 'property_save',
     propertyId: propertyId,
     status: 'success',
     matchedBuyers: matchedBuyers.length,
     notificationsSent: sent,
     notificationsFailed: failed
   });
   ```

2. **Add Validation Error Logging**
   ```typescript
   // When validation fails
   await db.collection('webhookErrors').add({
     timestamp: serverTimestamp(),
     opportunityId: payload.opportunityId,
     errors: validationErrors,
     receivedData: payload
   });
   ```

3. **Set GHL API Credentials**
   - Get API key from GHL
   - Set in Vercel: `GHL_API_KEY` and `GHL_LOCATION_ID`
   - Enables direct querying of opportunities

---

## 🔧 How to Debug the Missing 44 Properties

### Option 1: Check GHL Webhook Logs (Recommended)
1. Log into GoHighLevel
2. Go to Settings → Webhooks
3. Find the webhook for property saving
4. Check "Recent Deliveries" or "Logs"
5. Look for:
   - Failed deliveries (400 errors = validation failed)
   - Success but no property created
   - Properties that were never sent

### Option 2: Manual Test
1. Pick one of the "missing" properties from GHL
2. Manually trigger the webhook
3. Check what error is returned
4. Fix the field mapping issue
5. Re-send all 44 properties

### Option 3: Export and Analyze
1. Export all 50 opportunities from GHL as CSV
2. Check which fields are empty
3. Identify the pattern (missing city? missing price?)
4. Fix in GHL before re-sending

---

## 📞 Next Steps

**Immediate:**
1. Check your GHL webhook dashboard for failed webhook calls
2. Identify which of the 44 properties failed validation
3. Check if fields are missing or incorrectly mapped

**To Prevent This:**
1. Add persistent logging to track all webhook attempts
2. Set up monitoring/alerts for webhook failures
3. Add a validation test endpoint to check data before sending

---

## 📊 Quick Stats

- **Webhook Success Rate:** 6/50 = 12% (likely higher if only 6 were sent)
- **Matching Success Rate:** 1/6 = 16.7% of created properties matched buyers
- **Notification Delivery:** Unknown (no logging)
- **Active Buyers:** 43 total
- **Active Buyers in TX:** 7 buyers
- **Active Buyers in San Antonio:** 1 buyer (Abir Besbes)

---

## 🎯 Expected Behavior

When a property is added via GHL webhook:
1. ✅ Webhook receives data
2. ✅ Validates required fields
3. ✅ Creates/updates property in Firestore
4. ✅ Finds matching buyers (by state + city + budget)
5. ⚠️ Adds property to buyer's `matchedPropertyIds`
6. ❓ Sends SMS notification to GHL webhook URL
7. ❌ No persistent log of notification status

**Working:** Steps 1-5
**Unknown:** Step 6 (no way to verify)
**Missing:** Step 7 (no logging)
