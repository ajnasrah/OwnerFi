# 🛡️ Property Financial Validation System

**Purpose:** Catch outliers and unusual property data BEFORE properties go live, preventing errors like wrong down payments, miscalculated terms, or impossible payment amounts.

---

## 🎯 What It Does

The validation system automatically checks every property uploaded via CSV for:
- ✅ Reasonable price ranges
- ✅ Valid down payment amounts and percentages
- ✅ Realistic interest rates
- ✅ Appropriate term years
- ✅ Monthly payments that make sense
- ✅ Amortization consistency (payment matches loan/rate/term)
- ✅ Affordability ratios
- ✅ Extreme outliers

---

## 🚫 Auto-Rejection Criteria

Properties are **automatically rejected** if they have:

### Price Issues:
- Price under $10,000 (likely missing zeros)
- Price over $10M (unusually high for owner financing)

### Down Payment Issues:
- Negative down payment
- Down payment exceeds list price
- Down payment and percentage don't match

### Interest Rate Issues:
- Rate below 0% or above 50%
- Rate above 20% (may violate usury laws)

### Term Issues:
- Term under 0 years or over 50 years

### Payment Issues:
- Monthly payment is $0 or negative
- Payment doesn't cover monthly interest (negative amortization)
- Payment differs from calculated by over 50%
- Annual payments exceed 15% of price

---

## ⚠️  Warning Criteria (Needs Review)

Properties are **flagged for manual review** if they have:

### Down Payment Warnings:
- Down payment below 5% (very low for owner financing)
- Down payment above 75% (unusually high)

### Interest Rate Warnings:
- Rate below 3% (unusually low for owner financing)
- Rate above 15% (very high)

### Term Warnings:
- Term below 10 years (unusually short)
- Term above 40 years (unusually long)
- Term has decimal places (e.g., 15.5 years - indicates reverse calculation)

### Payment Warnings:
- Payment is unusually high for loan amount
- Payment is unusually low for loan amount
- Payment differs from calculated by 10-50% (may include taxes/insurance)

### Other Warnings:
- Payment may be unaffordable for typical buyer in that price range

---

## 📝 How It Works

### 1. Property Upload
When you upload a CSV, each property goes through:
```
CSV Row → Parse Data → Validate Financials → Decision
```

### 2. Validation Decision Tree
```
Property Data
    ↓
Financial Validation
    ├─→ Has Errors? → AUTO-REJECT → Goes to Failed Properties
    ├─→ Has Warnings? → FLAG FOR REVIEW → Goes to Properties (with review flag)
    └─→ All Good? → APPROVED → Goes to Properties (active)
```

### 3. Stored Data
**Approved Properties:**
- Stored in `properties` collection
- `isActive: true`
- Visible to buyers

**Flagged Properties:**
- Stored in `properties` collection
- `isActive: true`
- `needsReview: true`
- `reviewReasons: []` array with issues
- Visible to buyers but you should review

**Rejected Properties:**
- Not stored in database
- Listed in upload errors CSV
- Reason provided for rejection

---

## 🔍 Example Validations

### Example 1: 6710 Blanco St (Wrong Down Payment)
```
Property: 6710 Blanco St, Edinburg, TX
Price: $599,900
Down Payment: $25 (WRONG - should be $149,975)
Monthly Payment: $4,500
Term: 20 years
Interest: 9%

Validation Result: ❌ AUTO-REJECTED
Issues:
- Down payment percentage: 0.004% (expected: 5-50%)
- Monthly payment doesn't match amortization (off by 8000%)
- Payment doesn't cover monthly interest
```

### Example 2: Property with Decimal Term
```
Property: 123 Main St
Price: $250,000
Down Payment: $25,000 (10%)
Monthly Payment: $1,500
Term: 17.3 years (UNUSUAL)
Interest: 7%

Validation Result: ⚠️  NEEDS REVIEW
Issues:
- Term has decimal places (reverse-calculated from payment)
Suggestion: Round to 17 or 18 years for clarity
```

### Example 3: High Interest Rate
```
Property: 456 Oak Ave
Price: $180,000
Down Payment: $18,000 (10%)
Monthly Payment: $2,000
Term: 20 years
Interest: 18% (HIGH)

Validation Result: ⚠️  NEEDS REVIEW
Issues:
- Interest rate very high (>15%)
Suggestion: Verify rate is correct - may be uncompetitive
```

---

## 📊 Validation Checks in Detail

### 1. **Price Range Check**
```typescript
Expected: $10,000 - $10,000,000
Errors: < $10,000 or > $10,000,000
```

### 2. **Down Payment Validation**
```typescript
Expected: 5% - 75% of list price
Checks:
- Amount matches percentage: |calculated% - stated%| < 1%
- Amount < list price
- Amount >= 0
```

### 3. **Interest Rate Validation**
```typescript
Expected: 5% - 12% (typical owner financing)
Warnings: < 3% or > 15%
Errors: < 0% or > 50%
```

### 4. **Term Years Validation**
```typescript
Expected: 10 - 40 years (whole numbers)
Warnings:
- < 10 years or > 40 years
- Decimal places (15.5, 23.4, etc.)
```

### 5. **Monthly Payment Validation**
```typescript
Expected: 0.3% - 2% of loan amount per month
Example:
- $200,000 loan
- Min: $600/month (0.3%)
- Max: $4,000/month (2%)
```

### 6. **Amortization Consistency**
```typescript
Formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]

Checks:
- Calculated payment matches stated payment (within 50%)
- Payment > monthly interest (avoids negative amortization)
- If payment differs by 10-50%: Warning (may include taxes/insurance)
- If payment differs by > 50%: Error (data is wrong)
```

### 7. **Outlier Detection**
```typescript
Checks:
- Annual payments < 15% of price
- Down payment < 90% of price
- Payment-to-price ratio reasonable
```

---

## 🔧 How to Use

### During CSV Upload:
1. Upload your CSV as normal
2. System automatically validates each property
3. Review upload results:
   - **Success:** Properties approved
   - **Needs Review:** Properties flagged (check `reviewReasons`)
   - **Failed:** Properties rejected (download failures CSV)

### Reviewing Flagged Properties:
Properties with `needsReview: true` will have:
```javascript
{
  needsReview: true,
  reviewReasons: [
    {
      field: "termYears",
      issue: "Term has decimal places",
      severity: "warning"
    },
    {
      field: "interestRate",
      issue: "Interest rate very high (>15%)",
      severity: "warning"
    }
  ]
}
```

### Fixing Rejected Properties:
1. Download the failed properties CSV from upload results
2. Review the "Reason" column for each failure
3. Correct the data in your original CSV
4. Re-upload

---

## 📋 Common Failure Reasons

| Reason | What It Means | How to Fix |
|--------|---------------|------------|
| "Down payment exceeds list price" | Down payment amount > property price | Check down payment amount (missing decimal?) |
| "Payment doesn't cover monthly interest" | Monthly payment too low | Verify monthly payment and interest rate |
| "Price unusually low" | Price < $10,000 | Check if zeros are missing ($50000 not $50) |
| "Payment does not match amortization" | Payment doesn't match calculated | Verify all financial numbers are correct |
| "Term years out of valid range" | Term > 50 years or < 1 year | Check term years value |
| "Down payment and percentage do not match" | Math doesn't add up | Recalculate: (amount / price) × 100 |

---

## 🎯 Benefits

### Before Validation System:
❌ Properties with wrong data went live
❌ Buyers saw incorrect information
❌ Had to manually find and fix bad data
❌ 6710 Blanco St example: wrong down payment went unnoticed

### With Validation System:
✅ Bad data caught automatically
✅ Properties rejected before going live
✅ Clear reasons for failures
✅ Review queue for borderline cases
✅ Confidence that published data is accurate

---

## 🔄 Workflow Example

### Upload CSV with 100 properties:

```
📤 Upload Started
    ↓
📊 Validation Running
    ├─→ 85 properties: ✅ Approved (live immediately)
    ├─→ 10 properties: ⚠️  Needs Review (live but flagged)
    └─→ 5 properties: ❌ Rejected (not stored)
    ↓
📥 Results
    ├─→ Download failures CSV
    ├─→ Review flagged properties in admin
    └─→ Fix and re-upload rejected ones
```

---

## 🚀 Future Enhancements

Possible additions:
- Admin UI to review flagged properties
- Bulk edit interface for fixing issues
- Historical tracking of validation failures
- Machine learning to detect patterns
- State-specific validation rules
- Integration with external data sources for verification

---

## 📞 Support

### If You See a False Positive:
(Property wrongly rejected)
1. Check the validation rules in this document
2. Verify your data is actually correct
3. If rules are too strict, adjust thresholds in `src/lib/property-validation.ts`

### If Bad Data Gets Through:
(Property wrongly approved)
1. Note the property details
2. Check which validation rule should have caught it
3. Add or tighten the rule in `src/lib/property-validation.ts`

---

## 📄 Files

- **Validation Logic:** `src/lib/property-validation.ts`
- **Integration:** `src/app/api/admin/upload-properties-v4/route.ts`
- **Documentation:** This file

---

**Status:** ✅ **ACTIVE IN PRODUCTION**

*System implemented: 2025-11-14*
*Prevents data quality issues like 6710 Blanco St down payment error*
