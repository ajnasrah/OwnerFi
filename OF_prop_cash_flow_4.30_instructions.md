# Owner Finance Property + Cash Flow Analysis Instructions
**Date: April 30, 2026**

## Executive Summary
This document outlines the systematic approach for analyzing owner finance properties in our database to identify realistic investment opportunities with positive cash flow and strong ROI potential.

## What We're Looking For

### Primary Investment Criteria
- **Property Type**: Single family homes ONLY (no condos, lots, or other types)
- **Minimum Size**: 2 bedrooms, 1 bathroom minimum
- **Age Requirement**: Built 1970 or newer
- **Price Range**: $75,000 - $400,000 (realistic investment range)
- **Location**: Active MLS listings only
- **Owner Finance**: Must be marked as owner finance available (`isOwnerFinance: true`)

### Financial Requirements
- **Rent Ratio**: 0.5% - 1.5% monthly (6% - 18% annually) - realistic market rates
- **ROI Minimum**: 15%+ cash-on-cash return on down payment
- **Cash Flow**: Positive monthly cash flow after all expenses
- **Tax Data**: Real property tax data required (no estimates)

### Investment Assumptions
- **Down Payment**: 10% of purchase price
- **Interest Rate**: 5% fixed, 30-year loan
- **Insurance**: Value-based estimate ($150-$500/month based on price)
- **Property Management**: Not included in calculations

## Data Quality Issues Discovered

### Major Problems Found
1. **Rent Estimates**: Many properties have unrealistic rent estimates (>2% monthly)
2. **Property Status**: 48% of "FOR_SALE" properties were actually off-market
3. **Tax Data**: Missing real tax amounts for many properties
4. **Address Fields**: Inconsistent mapping between different address fields
5. **Property Types**: Mixed data including vacant lots, manufactured homes

### Data Sources We Use
- **Real Tax Data**: `annualTaxAmount` or `propertyTaxRate` fields
- **Active Properties**: `homeStatus: 'FOR_SALE'` + `isActive: true` + `mlsId` exists
- **Property Details**: Price, rent estimate, bedrooms, bathrooms, year built

## Analysis Process

### Step 1: Database Filtering
```typescript
// Basic filters applied to properties collection
- isOwnerFinance: true
- homeStatus: 'FOR_SALE' 
- isActive: true (not false or null)
- mlsId: exists
- No offMarketReason
```

### Step 2: Property Validation
```typescript
// Realistic property criteria
- Price: $75,000 - $400,000
- Bedrooms: >= 2
- Bathrooms: >= 1  
- Year Built: >= 1970
- Property Type: includes 'single'
- Rent Estimate: exists and > 0
```

### Step 3: Financial Validation
```typescript
// Rent ratio check (critical filter)
const monthlyRentRatio = (rentEstimate / price) * 100;
// Must be between 0.5% - 1.5% monthly
if (monthlyRentRatio < 0.5 || monthlyRentRatio > 1.5) continue;
```

### Step 4: Cash Flow Calculation
```typescript
const downPayment = price * 0.10;
const loanAmount = price * 0.90;
const monthlyMortgage = calculateMortgagePayment(loanAmount, 0.05, 30);
const monthlyTax = annualTaxAmount / 12;
const monthlyInsurance = estimateInsurance(price);
const totalExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + hoa;
const monthlyCashFlow = rentEstimate - totalExpenses;
const roi = (monthlyCashFlow * 12 / downPayment) * 100;
```

### Step 5: ROI Filtering
```typescript
// Final filters
- ROI >= 15%
- Monthly Cash Flow > 0
```

## Scripts Created

### 1. Initial Analysis Scripts
- `owner-finance-cash-flow-analysis.ts` - First attempt with data issues
- `active-owner-finance-cash-flow.ts` - Filtered for active properties only
- `check-property-status.ts` - Diagnosed status and MLS data issues

### 2. Tax Data Scripts
- `comprehensive-tax-lookup-analysis.ts` - Found 162 properties with real tax data
- `find-properties-with-financial-data.ts` - Analyzed data completeness
- `county-assessor-lookup.ts` - Manual tax lookup instructions

### 3. Final Analysis Script Portfolio

#### A. `realistic-single-family-deals.ts` - **PRIMARY SCRIPT**
- **Criteria**: 0.5%-1.5% monthly rent ratio (most conservative/realistic)
- **Focus**: Quality single family homes, 2br/1ba+, 1970+
- **Results**: 104 properties meeting all realistic criteria
- **Use Case**: Conservative investors seeking proven cash flow properties
- **Command**: `npx tsx scripts/realistic-single-family-deals.ts`

#### B. `filtered-above-one-percent.ts` - **AGGRESSIVE FILTERING**
- **Criteria**: 1.0%-2.0% monthly rent ratio (above 1% rule)
- **Focus**: Same quality filters as realistic script but higher returns
- **Use Case**: Investors seeking properties that beat the 1% rule
- **Command**: `npx tsx scripts/filtered-above-one-percent.ts`

#### C. `above-one-percent-deals.ts` - **MODERATE FILTERING**
- **Criteria**: 1.1%-2.0% monthly rent ratio (slightly above 1% rule)
- **Focus**: Less strict on property type/age but higher rent requirements
- **Use Case**: Flexible investors prioritizing high rent ratios
- **Command**: `npx tsx scripts/above-one-percent-deals.ts`

#### D. `one-percent-rule-deals.ts` - **CLASSIC 1% RULE**
- **Criteria**: 0.9%-1.1% monthly rent ratio (classic 1% rule)
- **Focus**: Properties that precisely meet the traditional 1% rule
- **Use Case**: Traditional investors following the exact 1% rule
- **Command**: `npx tsx scripts/one-percent-rule-deals.ts`

## Results Summary

### Final Analysis Results (April 30, 2026)
- **Total Properties Checked**: 3,536 owner finance listings
- **Realistic Deals Found**: 104 properties
- **Average ROI**: 40%
- **Average Price**: $196,832
- **Average Rent Ratio**: 1.0% monthly (12% annually)

### Top Markets Identified
- **Arkansas**: Ward, Cherokee Village, Heber Springs
- **Mississippi**: Gulfport (multiple properties)
- **Louisiana**: Dequincy, New Orleans, Shreveport
- **Texas**: Various cities with good deals
- **Oklahoma**: Claremore, Spencer

## Key Learnings

### What Works
1. **Strict Filtering**: Only analyze truly active MLS properties
2. **Realistic Ratios**: 0.5%-1.5% monthly rent ratios are achievable
3. **Real Data Only**: Don't rely on estimates for taxes or rent
4. **Property Quality**: Focus on 2br+ single family, 1970+ built

### What Doesn't Work
1. **High Rent Ratios**: Properties claiming >2% monthly are fantasy
2. **Off-Market Properties**: Many "FOR_SALE" properties aren't actually available
3. **Missing Tax Data**: Can't properly analyze without real tax amounts
4. **Unrealistic Properties**: Vacant lots, manufactured homes, condemned properties

## File Outputs

### CSV Files Generated
- `REALISTIC_SINGLE_FAMILY_2026-04-30.csv` - **PRIMARY OUTPUT**
- `comprehensive_tax_lookup_2026-04-30.json` - 162 properties with real tax data
- `REAL_county_assessor_lookup_guide_2026-04-30.md` - Manual tax lookup instructions

### CSV Structure
```
ZPID,Address,City,State,Price,Monthly Rent,Rent Ratio %,ROI %,Monthly Cash Flow,Bedrooms,Bathrooms,Year Built,MLS ID,Down Payment,Monthly Mortgage,Monthly Tax,Monthly Insurance
```

## Usage Instructions

### Choosing the Right Script

**For Most Users**: Start with `realistic-single-family-deals.ts` - it uses proven, conservative criteria that actually work in the real world.

**Script Selection Guide**:
1. **Conservative/New Investors**: Use `realistic-single-family-deals.ts`
2. **Traditional Investors**: Use `one-percent-rule-deals.ts` 
3. **Aggressive Returns**: Use `above-one-percent-deals.ts`
4. **Maximum Filtering**: Use `filtered-above-one-percent.ts`

### Running the Analysis
```bash
# Primary recommended script
npx tsx scripts/realistic-single-family-deals.ts

# Alternative scripts
npx tsx scripts/one-percent-rule-deals.ts
npx tsx scripts/above-one-percent-deals.ts  
npx tsx scripts/filtered-above-one-percent.ts
```

### Script Comparison Table

| Script | Rent Ratio | Property Filters | Expected Results | Best For |
|--------|------------|------------------|------------------|----------|
| `realistic-single-family-deals.ts` | 0.5%-1.5% | Strict (2br/1ba+, single family, 1970+) | 50-150 properties | Conservative investors |
| `one-percent-rule-deals.ts` | 0.9%-1.1% | Moderate | 10-50 properties | Traditional 1% rule followers |
| `above-one-percent-deals.ts` | 1.1%-2.0% | Basic | 20-80 properties | Flexible investors |
| `filtered-above-one-percent.ts` | 1.0%-2.0% | Strict | 15-60 properties | Aggressive + quality focused |

### Common Filtering Variables

All scripts share these core variables that can be modified:
```typescript
// Price range
if (property.price < 75000 || property.price > 400000) continue;

// Rent ratio bounds (varies by script)
const monthlyRentRatio = (property.rentEstimate / property.price) * 100;
if (monthlyRentRatio < 0.5 || monthlyRentRatio > 1.5) continue; // realistic script

// Property quality (strict scripts only)
if (!property.propertyType.toLowerCase().includes('single')) continue;
if (property.yearBuilt < 1970) continue;
if (property.bedrooms < 2 || property.bathrooms < 1) continue;

// Financial requirements
if (cashFlow.roi < 15) continue;
if (cashFlow.monthlyCashFlow <= 0) continue;
```

### Expected Runtime
- Full analysis: 2-3 minutes
- Properties processed: ~3,500
- Output varies by script:
  - Realistic: 50-150 deals
  - 1% Rule: 10-50 deals  
  - Above 1%: 20-80 deals
  - Filtered Above 1%: 15-60 deals

## Quality Assurance

### Red Flags to Watch
- Rent ratios >1.5% monthly (18% annually)
- ROI claims >100% (usually bad data)
- Properties with $0 taxes
- Properties built before 1970
- Vacant lots or manufactured homes
- Off-market properties

### Validation Checks
- Always verify MLS ID exists
- Check property status is truly "FOR_SALE"
- Confirm rent estimates are reasonable for the area
- Validate tax amounts are realistic for the price range

## Future Improvements

### Data Quality
1. Implement real-time MLS status validation
2. Add external rent validation (RentSpree, etc.)
3. Integrate county assessor APIs for tax data
4. Add property condition scoring

### Analysis Enhancement
1. Add market area analysis (comparable rents)
2. Include repair/renovation estimates
3. Add vacancy rate considerations
4. Include property management costs

---
**Last Updated**: April 30, 2026  
**Analysis Type**: Owner Finance Cash Flow Analysis  
**Primary Output**: `REALISTIC_SINGLE_FAMILY_2026-04-30.csv` (104 properties)  
**Success Rate**: 104 realistic deals from 3,536 total properties (2.9%)