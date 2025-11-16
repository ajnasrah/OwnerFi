# Website Not Showing Properties - Diagnostic Report

## Problem
User reports: "website isn't showing any properties in admin properties"

## Backend Validation ✅

### Database Check
- ✅ **1,439 properties** in `zillow_imports` collection
- ✅ All have `ownerFinanceVerified = true`
- ✅ All have `status = null`
- ✅ All have owner finance keywords
- ✅ Query returns 150 properties for TX

### API Test
```
Query: zillow_imports where state='TX' AND ownerFinanceVerified=true
Result: ✅ 150 properties returned
Sample: 826 Johnnie Row, Seagoville, TX 75159
  - Price: $260,000
  - Beds: 3, Baths: 2
  - Keyword: "owner financing"
  - Monthly Payment: null ✅
  - Down Payment: null ✅
  - Status: null ✅
```

## Possible Issues

### 1. Buyer Profile Missing
**Check**: Does buyer have a profile with city/state?
```
/api/buyer/profile
```
If no profile → redirects to `/dashboard/setup`

### 2. Frontend Not Making API Call
**Check**: Browser console for errors
- Network tab: Is `/api/buyer/properties?city=...&state=...` being called?
- Console: Any JavaScript errors?

### 3. Empty Response Handling
**Check**: Is frontend handling empty `properties` array?
```javascript
setProperties(propertiesData.properties || []);
```

### 4. Display Logic Issue
**Check**: PropertySwiper2 component
- Is it rendering when `properties.length > 0`?
- Any CSS hiding the properties?

### 5. City Filter Too Restrictive
**Check**: Does buyer's city have properties?
Example: Buyer searches "Austin, TX" but properties are in "Seagoville, TX"
- Dashboard filters by exact city match
- Use nearby cities to expand results

## Quick Fixes

### Fix 1: Check Browser Console
```
1. Open website
2. Press F12
3. Go to Console tab
4. Look for errors in red
5. Go to Network tab
6. Filter: XHR
7. Look for /api/buyer/properties
8. Click it, check Response tab
```

### Fix 2: Test API Directly
```bash
# Replace with actual buyer profile data
curl "http://localhost:3000/api/buyer/properties?city=Houston&state=TX&maxMonthlyPayment=3000&maxDownPayment=20000"
```

### Fix 3: Check Database Directly
```bash
npx tsx -e "
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: cert({...}) });
const db = getFirestore();
const snap = await db.collection('zillow_imports').where('ownerFinanceVerified', '==', true).limit(10).get();
console.log('Properties:', snap.size);
"
```

## Recommended Actions

1. **Check Buyer Profile**
   - Go to `/dashboard/setup`
   - Make sure city and state are set
   - Try searching different cities

2. **Check Browser Console**
   - Open developer tools
   - Look for API errors
   - Check if properties are being fetched

3. **Test with Different Cities**
   - Try: Houston, TX (many properties)
   - Try: Austin, TX
   - Try: Dallas, TX

4. **Check Admin Panel**
   - Is this about admin panel or buyer dashboard?
   - Admin panel might use different query

## Next Steps

Please provide:
1. Screenshot of browser console (F12)
2. What city/state is buyer searching?
3. Is this buyer dashboard or admin panel?
4. Any error messages?
