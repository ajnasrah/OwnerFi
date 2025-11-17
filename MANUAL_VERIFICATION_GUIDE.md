# 🔍 Manual Property Verification Guide

**Quick way to verify 20 properties with complete data**

---

## Method 1: Browser Console Verification (Fastest)

### Step 1: Open Admin Properties Page
```
1. Go to: http://localhost:3000/admin (or your production URL)
2. Navigate to "Properties" tab
3. Open browser console (F12 → Console tab)
```

### Step 2: Run This Script in Console
```javascript
// Fetch 20 properties with complete terms
async function verify20Properties() {
  try {
    const response = await fetch('/api/admin/properties');
    const data = await response.json();
    const properties = data.properties || [];

    // Filter for complete properties
    const complete = properties.filter(p =>
      p.monthlyPayment > 0 &&
      p.downPaymentAmount > 0 &&
      p.interestRate > 0 &&
      p.loanTermYears > 0 &&
      p.price > 0
    ).slice(0, 20);

    console.log(`Found ${complete.length} properties with complete terms\n`);
    console.log('═'.repeat(80));

    complete.forEach((p, i) => {
      console.log(`\n${i+1}. ${p.fullAddress || p.address}`);
      console.log(`   Price: $${p.price?.toLocaleString()}`);
      console.log(`   Monthly: $${p.monthlyPayment?.toLocaleString()}/mo`);
      console.log(`   Down: $${p.downPaymentAmount?.toLocaleString()} (${Math.round((p.downPaymentAmount/p.price)*100)}%)`);
      console.log(`   Rate: ${p.interestRate}%`);
      console.log(`   Term: ${p.loanTermYears} years`);
      console.log(`   Balloon: ${p.balloonPaymentYears || 'None'} years`);
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`\n✅ Found ${complete.length} properties to verify`);

    // Export to CSV
    const csv = [
      'Address,Price,Monthly Payment,Down Payment,Interest Rate,Loan Term,Balloon'
    ];
    complete.forEach(p => {
      csv.push([
        `"${p.fullAddress || p.address}"`,
        p.price,
        p.monthlyPayment,
        p.downPaymentAmount,
        p.interestRate,
        p.loanTermYears,
        p.balloonPaymentYears || 0
      ].join(','));
    });

    console.log('\n📄 CSV Data (copy this):');
    console.log(csv.join('\n'));

    return complete;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run it
const results = await verify20Properties();
```

### Step 3: Copy Results
The script will output:
1. List of properties with all data
2. CSV data you can paste into Excel
3. Full details for verification

---

## Method 2: Excel Export + Manual Check

### Step 1: Export Properties
```
1. Admin → Properties tab
2. Click "Export to Excel"
3. Open the downloaded file
```

### Step 2: Filter for Complete Properties
```
1. In Excel, apply filter to columns
2. Filter out "TBD" values:
   - Monthly Payment ≠ "TBD"
   - Down Payment Amount ≠ "TBD"
   - Interest Rate ≠ "TBD"
   - Loan Term Years ≠ "TBD"
3. You'll see only properties with complete data
```

### Step 3: Pick 20 Properties
```
1. Select first 20 rows with complete data
2. Copy Property IDs or addresses
3. Use these for verification
```

---

## Method 3: Database Direct Query

### Open Firebase Console
```
1. Go to: https://console.firebase.google.com
2. Select project: ownerfi-95aa0
3. Navigate to Firestore Database
4. Collection: zillow_imports
```

### Query for Complete Properties
```
Filter 1: ownerFinanceVerified == true
Filter 2: monthlyPayment > 0
Filter 3: downPaymentAmount > 0

Sort by: foundAt (desc)
Limit: 20
```

### Document Structure to Verify
```javascript
{
  // Basic Info
  zpid: 12345,
  fullAddress: "123 Main St, Austin, TX 78701",
  streetAddress: "123 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",

  // Property Details
  bedrooms: 3,
  bathrooms: 2,
  squareFoot: 1500,
  homeType: "Single Family",

  // Pricing
  price: 350000,
  estimate: 375000,

  // COMPLETE Owner Finance Terms (all filled)
  monthlyPayment: 2485,           // ✅ NOT NULL
  downPaymentAmount: 35000,       // ✅ NOT NULL
  downPaymentPercent: 10,         // ✅ NOT NULL
  interestRate: 7.5,              // ✅ NOT NULL
  loanTermYears: 20,              // ✅ NOT NULL
  balloonPaymentYears: 5,         // ✅ Optional

  // Keywords
  ownerFinanceVerified: true,
  primaryKeyword: "owner financing",
  matchedKeywords: ["owner financing", "owner carry"],

  // Timestamps
  foundAt: Timestamp,
  verifiedAt: Timestamp
}
```

---

## Method 4: Buyer Dashboard Test

### Step 1: Log in as Test Buyer
```
1. Go to your app
2. Log in with a buyer account
3. Navigate to dashboard
```

### Step 2: Manually Check Properties
```
For each property you see:
1. Note the address
2. Check if monthly payment shows dollar amount or "Contact Seller"
3. Expand details (tap "Tap for details")
4. Verify all fields:
   ✅ Monthly Payment: Shows $ amount
   ✅ Down Payment: Shows $ amount (not "Contact Seller")
   ✅ Interest Rate: Shows % (not "Contact seller")
   ✅ Loan Term: Shows years (not "Contact seller")
   ✅ Balloon: Shows years or hidden
```

### Step 3: Cross-Reference with Database
```
1. For each property, note the address
2. Look it up in admin panel
3. Compare values:
   - Database value
   - Buyer dashboard display
   - Should match exactly
```

---

## Quick Verification Checklist

### For Each of 20 Properties:

#### ✅ Database Check (Admin Panel)
- [ ] Property has zpid
- [ ] Address is complete
- [ ] Price > 0
- [ ] Monthly Payment > 0 (not NULL)
- [ ] Down Payment > 0 (not NULL)
- [ ] Interest Rate > 0 (not NULL)
- [ ] Loan Term > 0 (not NULL)
- [ ] Beds/Baths filled
- [ ] Sq ft filled

#### ✅ Buyer Dashboard Check
- [ ] Property appears in search results
- [ ] Monthly Payment shows "$X/mo" (not "Contact Seller")
- [ ] Down Payment shows "est. $X" (not "Contact Seller")
- [ ] Interest Rate shows "~X%" (not "Contact seller")
- [ ] Loan Term shows "~X years" (not "Contact seller")
- [ ] Balloon shows "X years" or hidden (if 0)
- [ ] All values match database

#### ✅ Excel Export Check
- [ ] Property appears in export
- [ ] All columns have values (not "TBD")
- [ ] Values match database
- [ ] Values match buyer dashboard

---

## Expected Results

### Complete Property Example
```
Database:
  price: 350000
  monthlyPayment: 2485
  downPaymentAmount: 35000
  downPaymentPercent: 10
  interestRate: 7.5
  loanTermYears: 20
  balloonPaymentYears: 5

Excel Export Shows:
  Price: 350000 ✅
  Monthly Payment: 2485 ✅
  Down Payment Amount: 35000 ✅
  Down Payment Percent: 10 ✅
  Interest Rate: 7.5 ✅
  Loan Term Years: 20 ✅
  Balloon Payment Years: 5 ✅

Buyer Dashboard Shows:
  "$2,485/mo" ✅
  "est. $35,000" ✅
  "10% of purchase price" ✅
  "~7.5%" ✅
  "~20 years" ✅
  "5 years" ✅
```

### Incomplete Property Example (DON'T USE FOR TESTING)
```
Database:
  price: 350000
  monthlyPayment: null      // ❌ Not filled yet
  downPaymentAmount: null   // ❌ Not filled yet
  interestRate: null        // ❌ Not filled yet
  loanTermYears: null       // ❌ Not filled yet

Excel Export Shows:
  Price: 350000 ✅
  Monthly Payment: TBD ❌
  Down Payment Amount: TBD ❌
  Interest Rate: TBD ❌
  Loan Term Years: TBD ❌

Buyer Dashboard Shows:
  "Contact Seller" ❌
```

---

## Troubleshooting

### If No Complete Properties Found
```
Problem: All properties show "Contact Seller" / "TBD"
Cause: No properties have owner finance terms filled yet
Solution: Admin needs to fill terms via:
  1. Admin panel → Edit property
  2. GHL webhook (seller provides terms)
  3. Manual database update
```

### If Values Don't Match
```
Problem: Database has value but dashboard shows "Contact Seller"
Possible Causes:
  1. Value is 0 (not NULL) → Check if 0 vs null
  2. Browser cache → Clear cache and refresh
  3. Code not deployed → Check production deployment
  4. Field name mismatch → Check API response in Network tab
```

### If Calculation Seems Wrong
```
Problem: Monthly payment doesn't match expected calculation
This is OK if:
  - Seller provided custom monthly payment
  - Monthly payment includes taxes/insurance
  - Special financing arrangement

To verify calculation:
Loan Amount = Price - Down Payment
Monthly Rate = Interest Rate / 100 / 12
Num Payments = Loan Term * 12

Monthly Payment = Loan Amount * (Monthly Rate * (1 + Monthly Rate)^Num Payments) / ((1 + Monthly Rate)^Num Payments - 1)
```

---

## Quick Start (Run This Now)

**Option A: Browser Console (30 seconds)**
```
1. Open admin → Properties
2. Press F12 → Console
3. Paste the script from Method 1
4. Press Enter
5. See results immediately
```

**Option B: Excel (2 minutes)**
```
1. Admin → Properties → Export to Excel
2. Open file
3. Filter out "TBD" values
4. Pick 20 rows with complete data
5. Verify against buyer dashboard
```

**Option C: Firebase Console (3 minutes)**
```
1. Open Firebase console
2. Go to zillow_imports collection
3. Add filters for complete properties
4. View first 20 documents
5. Copy zpids for testing
```

---

## Final Notes

- **Complete properties** = All finance terms filled (not NULL, not 0)
- **Incomplete properties** = Some/all terms NULL → Show "TBD"/"Contact Seller"
- **This is normal** = Properties move from incomplete to complete as sellers provide terms
- **Buyer dashboard** = Shows exact database values (no calculations in display)
- **Excel export** = Shows exact database values ("TBD" for NULL)

Choose the method that's fastest for you and start verifying! 🚀
