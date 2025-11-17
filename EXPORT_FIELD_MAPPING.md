# Excel Export Field Mapping - Verification

## Database → Excel Column Mapping

### ✅ Core Identification
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `id` (document ID) | Property ID | ✅ Correct |
| `zpid` | ZPID | ✅ Zillow Property ID |
| `status` | Status | ✅ Shows "pending" if null |

### ✅ Address & Location
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `fullAddress` | Full Address | ✅ e.g., "123 Main St, Austin, TX 78701" |
| `streetAddress` | Street Address | ✅ e.g., "123 Main St" |
| `city` | City | ✅ |
| `state` | State | ✅ |
| `zipCode` | ZIP Code | ✅ |

### ✅ Property Details
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `homeType` | Home Type | ✅ e.g., "Single Family" |
| `homeStatus` | Home Status | ✅ e.g., "FOR_SALE" |
| `bedrooms` | Bedrooms | ✅ |
| `bathrooms` | Bathrooms | ✅ |
| `squareFoot` | Square Feet | ✅ (note: schema uses squareFoot, not squareFeet) |
| `lotSquareFoot` | Lot Square Feet | ✅ |
| `yearBuilt` | Year Built | ✅ |

### ✅ Financial Information (Zillow Data)
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `price` | Price | ✅ List price from Zillow |
| `estimate` | Estimate (Zestimate) | ✅ Zillow's valuation |
| `rentEstimate` | Rent Estimate | ✅ Zillow's rent estimate |
| `hoa` | HOA | ✅ Monthly HOA fee |
| `annualTaxAmount` | Annual Tax Amount | ✅ Property taxes |

### ⚠️ Owner Financing Terms (Initially NULL → TBD)
| Database Field | Excel Column | Default | When Filled |
|---------------|--------------|---------|-------------|
| `downPaymentAmount` | Down Payment Amount | `null` → "TBD" | Actual $ amount |
| `downPaymentPercent` | Down Payment Percent | `null` → "TBD" | % (e.g., 10%) |
| `monthlyPayment` | Monthly Payment | `null` → "TBD" | Actual $ amount |
| `interestRate` | Interest Rate | `null` → "TBD" | % (e.g., 7.5%) |
| `loanTermYears` | Loan Term Years | `null` → "TBD" | Years (e.g., 20) |
| `balloonPaymentYears` | Balloon Payment Years | `null` → "TBD" | Years or null |

**IMPORTANT**: These fields are set to `null` when scraped from Zillow. They are filled in later by:
1. Admin manually editing via admin panel
2. GHL webhook updating after seller provides terms
3. Property owner calling to provide terms

### ✅ Agent/Broker Contact
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `agentName` | Agent Name | ✅ From Zillow |
| `agentPhoneNumber` | Agent Phone | ✅ From Zillow |
| `brokerName` | Broker Name | ✅ From Zillow |
| `brokerPhoneNumber` | Broker Phone | ✅ From Zillow |

### ✅ Owner Finance Detection
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `ownerFinanceVerified` | Owner Finance Verified | ✅ Always "Yes" (filtered query) |
| `primaryKeyword` | Primary Keyword | ✅ Main keyword found (e.g., "owner financing") |
| `matchedKeywords` | All Matched Keywords | ✅ All keywords found, comma-separated |

### ✅ Description
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `description` | Description | ✅ Truncated to 500 chars for Excel |

### ✅ Media
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `url` | Zillow URL | ✅ Link to property on Zillow |
| `firstPropertyImage` | First Property Image | ✅ Primary image URL |
| `propertyImages` | All Property Images | ✅ All images, pipe-separated |

### ✅ GHL Integration
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `sentToGHL` | Sent to GHL | ✅ "Yes" or "No" |
| `ghlSentAt` | GHL Sent At | ✅ ISO timestamp |
| `ghlSendStatus` | GHL Send Status | ✅ "success" or "failed" |

### ✅ Timestamps
| Database Field | Excel Column | Notes |
|---------------|--------------|-------|
| `foundAt` | Found At | ✅ When scraped from Zillow |
| `verifiedAt` | Verified At | ✅ When owner finance was verified |
| `soldAt` | Sold At | ✅ When marked as sold |
| `importedAt` | Imported At | ✅ When imported to system |

---

## 🎯 Data Flow for Owner Finance Terms

### Stage 1: Initial Scrape (from Zillow)
```javascript
{
  zpid: 123456,
  fullAddress: "123 Main St, Austin, TX 78701",
  price: 350000,
  estimate: 375000,
  bedrooms: 3,
  bathrooms: 2,
  description: "Owner financing available!",

  // Owner finance terms - ALL NULL initially
  downPaymentAmount: null,      // ← Will show "TBD" in Excel
  downPaymentPercent: null,     // ← Will show "TBD" in Excel
  monthlyPayment: null,         // ← Will show "TBD" in Excel
  interestRate: null,           // ← Will show "TBD" in Excel
  loanTermYears: null,          // ← Will show "TBD" in Excel
  balloonPaymentYears: null,    // ← Will show "TBD" in Excel
}
```

### Stage 2: After Admin/Seller Fills Terms
```javascript
{
  zpid: 123456,
  fullAddress: "123 Main St, Austin, TX 78701",
  price: 350000,
  estimate: 375000,

  // Owner finance terms - NOW FILLED
  downPaymentAmount: 35000,     // ← Will show "$35,000" in Excel
  downPaymentPercent: 10,       // ← Will show "10%" in Excel
  monthlyPayment: 2500,         // ← Will show "$2,500" in Excel
  interestRate: 7.5,            // ← Will show "7.5%" in Excel
  loanTermYears: 20,            // ← Will show "20" in Excel
  balloonPaymentYears: 5,       // ← Will show "5" in Excel
}
```

---

## 🧮 Monthly Payment Calculation

**When to Calculate**:
- Monthly payment is calculated ONLY if all required fields are provided:
  - `price` (list price)
  - `downPaymentAmount` or `downPaymentPercent`
  - `interestRate`
  - `loanTermYears`

**Calculation Formula** (from `property-calculations.ts`):
```javascript
loanAmount = price - downPaymentAmount;
monthlyRate = interestRate / 100 / 12;
numPayments = loanTermYears * 12;

monthlyPayment = loanAmount *
  (monthlyRate * (1 + monthlyRate)^numPayments) /
  ((1 + monthlyRate)^numPayments - 1);
```

**Priority**:
1. If `monthlyPayment` is provided → Use it directly (seller's value)
2. If `interestRate` + `loanTermYears` provided → Calculate monthly payment
3. If only `interestRate` provided → Use default term for calculation
4. If nothing provided → All show "TBD"

**Export Behavior**:
- If `monthlyPayment` exists in DB → Show actual value
- If `monthlyPayment` is null → Show "TBD" (NOT calculated)
- Admin must fill terms, then calculation happens on-demand when viewing

---

## ✅ Verification Checklist

### Database Field Completeness
- [ ] All 44 columns map to correct database fields
- [ ] NULL values properly display as "TBD"
- [ ] Non-null values display actual data
- [ ] Timestamps convert from Firestore format to ISO strings
- [ ] Arrays (images, keywords) properly join with delimiters

### Financial Calculations
- [ ] Monthly payment shows actual DB value (not calculated in export)
- [ ] Down payment amount/percent both exported
- [ ] Interest rate shown as stored (no assumptions)
- [ ] Loan term shown as stored (no defaults)
- [ ] Calculations happen in admin panel, not export

### Data Accuracy
- [ ] Property with complete terms → All columns filled
- [ ] Property with partial terms → Some "TBD", some values
- [ ] Property with no terms → All finance columns show "TBD"
- [ ] Agent contact info matches Zillow data
- [ ] Owner finance keywords match detection results

---

## 🔍 Sample Property Validation

### Property A: Complete Terms (Filled by Admin)
```
Price: $350,000
Down Payment: $35,000 (10%)
Monthly Payment: $2,485
Interest Rate: 7.5%
Loan Term: 20 years
Balloon: 5 years

Excel Export Shows:
- Down Payment Amount: $35,000 ✅
- Down Payment Percent: 10% ✅
- Monthly Payment: $2,485 ✅
- Interest Rate: 7.5% ✅
- Loan Term Years: 20 ✅
- Balloon Payment Years: 5 ✅
```

### Property B: Incomplete Terms (Newly Scraped)
```
Price: $450,000
Down Payment: null
Monthly Payment: null
Interest Rate: null
Loan Term: null
Balloon: null

Excel Export Shows:
- Down Payment Amount: TBD ✅
- Down Payment Percent: TBD ✅
- Monthly Payment: TBD ✅
- Interest Rate: TBD ✅
- Loan Term Years: TBD ✅
- Balloon Payment Years: TBD ✅
```

---

## 📊 Export Summary

**Total Columns**: 44
**Database Collection**: `zillow_imports`
**Filter**: `ownerFinanceVerified == true`
**Sort**: `foundAt` descending (newest first)

**Export Filename**: `owner_finance_properties_YYYY-MM-DD.xlsx`

**Column Width Optimization**: ✅ All columns sized for readability
**Data Validation**: ✅ Handles null, undefined, missing fields
**Timestamp Conversion**: ✅ Firestore timestamps → ISO strings
**Array Handling**: ✅ Joins with proper delimiters
