# Dynamic Amortization Schedule Update

## ✅ Implementation Complete

### Changes Made

Updated the default amortization schedule calculation to be dynamic based on property price.

### New Logic

**Price-Based Amortization Terms:**
- **Under $150k:** 15 years
- **$150k - $300k:** 20 years
- **$300k - $600k:** 25 years
- **$600k+:** 30 years

### Files Modified

1. **`/src/lib/property-calculations.ts`**
   - Added `getDefaultTermYears()` helper function
   - Updated `calculatePropertyFinancials()` to use dynamic term calculation
   - Only applies when `termYears` is not explicitly provided

2. **`/src/app/api/gohighlevel/webhook/save-property/route.ts`**
   - Added inline `getDefaultTermYears()` function
   - Updated monthly payment calculation to use dynamic terms
   - Only recalculates when monthly payment is not provided

### Test Results

All test cases pass:

```
✅ $120k house → 15 year term → $970.73/month
✅ $200k house → 20 year term → $1,395.54/month
✅ $450k house → 25 year term → $2,862.46/month
✅ $750k house → 30 year term → $4,490.79/month
✅ Pre-filled monthly payments are preserved (not recalculated)
```

### Important Notes

1. **Pre-filled Values Preserved:**
   - If `monthlyPayment` is already provided, it will NOT be recalculated
   - If `termYears` is already provided, it will be used instead of the default
   - Only calculates when values are missing

2. **Calculation Only When Needed:**
   - Monthly payment is only calculated when:
     - `monthlyPayment` is not provided AND
     - `interestRate` is provided AND
     - `downPaymentAmount` is calculated/provided

3. **Backward Compatible:**
   - Existing properties with explicit term years will keep their values
   - New properties without term years will use the dynamic calculation
   - Manual overrides still work

### Examples

**Example 1: $180k House**
```
Price: $180,000
Down Payment: 10% ($18,000)
Interest Rate: 7%
Term: 20 years (auto-selected)
Monthly Payment: $1,256 (calculated)
```

**Example 2: $400k House**
```
Price: $400,000
Down Payment: 10% ($40,000)
Interest Rate: 7%
Term: 25 years (auto-selected)
Monthly Payment: $2,544 (calculated)
```

**Example 3: Pre-filled Payment (Not Recalculated)**
```
Price: $200,000
Down Payment: 10%
Monthly Payment: $1,500 (provided by user/GHL)
Result: $1,500 (PRESERVED, not recalculated)
```

### Impact on Monthly Payments

Compared to the old 20-year default:

- **Houses under $150k:** Monthly payment INCREASES (shorter term)
  - Example: $120k → was $1,395, now $970 ❌ (wait, this is lower... let me recalculate)

Actually the monthly payment for a $108k loan at 7% over:
- 15 years: $970.73
- 20 years: $837.64
- So shorter terms = HIGHER monthly payments ✅

- **Houses $150k-$300k:** NO CHANGE (still 20 years)
- **Houses $300k-$600k:** Monthly payment DECREASES (longer term)
- **Houses $600k+:** Monthly payment DECREASES significantly (much longer term)

### Testing

Run the test script:
```bash
npx tsx scripts/test-amortization.ts
```

### Deployment

No database migrations needed. Changes apply to:
- New property calculations going forward
- Recalculations of existing properties (when triggered)
- Property imports from GHL

---

**Date:** 2025-10-30
**Status:** ✅ Tested and Deployed
