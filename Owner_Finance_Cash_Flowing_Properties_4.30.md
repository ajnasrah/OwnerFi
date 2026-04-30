# Owner Finance Cash Flowing Properties Analysis - 4.30

## Project Overview
**Date:** April 30, 2026  
**Objective:** Analyze existing owner finance properties in our database to identify cash flow opportunities using standardized investment metrics.

## What You're Looking For

You want to find **owner finance properties in our database that would cash flow positively** if purchased using consistent investment assumptions. This analysis will help identify which owner finance deals in our system represent genuine cash flow opportunities for investors.

## My Understanding

### Target Properties
- **Source**: Active owner finance properties in our Firebase `properties` collection
- **Property Type**: Single family homes only (exclude apartments, condos, land, etc.)
- **Minimum Specs**: 2+ bedrooms, 1+ bathrooms
- **Age Requirement**: Built 1970 or newer
- **Data Requirements**: Must have:
  - `rentEstimate` (rental income projection)
  - `taxAnnualAmount` or calculable tax estimate
  - Valid `isOwnerFinance` = true
  - Valid listing price

### Financial Analysis Framework

**Loan Assumptions (Standardized for all properties):**
- **Down Payment**: 10% of listing price
- **Loan Amount**: 90% of listing price  
- **Interest Rate**: 5.0% (fixed)
- **Loan Term**: 30 years (360 months)
- **Mortgage Formula**: Standard amortization

**Monthly Expense Estimates:**
- **Property Taxes**: `taxAnnualAmount / 12` (or estimate if missing)
- **Insurance**: $150/month (default) OR actual if available
- **HOA Fees**: Use actual `hoaFee` if available, $0 if missing
- **No management/vacancy assumed** (conservative cash flow analysis)

**Revenue:**
- **Rental Income**: Use `rentEstimate` from property data

**Cash Flow Calculation:**
```
Monthly Cash Flow = Rental Income - (Mortgage Payment + Property Taxes + Insurance + HOA)

Where:
- Mortgage Payment = PMT(5%/12, 360, -LoanAmount)
- LoanAmount = ListingPrice * 0.90
- DownPayment = ListingPrice * 0.10
```

## Analysis Goals

1. **Identify High Cash Flow Properties**: Properties with monthly cash flow > $200
2. **Market Analysis**: Which markets/zip codes have the most cash flowing owner finance deals
3. **Price Point Analysis**: Sweet spot price ranges for cash flow
4. **ROI Analysis**: Cash-on-cash return calculation (annual cash flow / down payment)
5. **Geographic Insights**: Map cash flow opportunities by region

## Deliverables

1. **Comprehensive Analysis Report**: Document with findings, metrics, and insights
2. **Property Database Export**: Filtered list of cash flowing properties with all calculations
3. **Market Summary**: Top markets/zip codes ranked by opportunity count
4. **Investment Recommendations**: Best cash flow properties identified

## Technical Implementation

### Data Pipeline
1. **Query Firebase**: Filter owner finance properties with required data
2. **Calculate Financials**: Apply standardized loan and expense assumptions  
3. **Filter Results**: Properties with positive cash flow
4. **Rank & Analyze**: Sort by cash flow potential and ROI
5. **Export Results**: JSON and CSV formats for further analysis

### Property Filters
```typescript
// Firebase query criteria
isOwnerFinance: true
propertyType: 'Single Family'
bedrooms: >= 2  
bathrooms: >= 1
yearBuilt: >= 1970
rentEstimate: exists and > 0
price: exists and > 0
status: 'active' or recent
```

### Cash Flow Formula
```typescript
const downPayment = listingPrice * 0.10;
const loanAmount = listingPrice * 0.90;
const monthlyRate = 0.05 / 12;
const numPayments = 360;

const monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                       (Math.pow(1 + monthlyRate, numPayments) - 1);

const monthlyTax = taxAnnualAmount / 12;
const monthlyInsurance = insuranceEstimate || 150;
const monthlyHOA = hoaFee || 0;

const totalExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
const monthlyCashFlow = rentEstimate - totalExpenses;
const annualCashFlow = monthlyCashFlow * 12;
const cashOnCashReturn = (annualCashFlow / downPayment) * 100;
```

## Success Metrics

- **Property Count**: Target 100+ qualifying owner finance properties
- **Cash Flow Threshold**: Focus on properties with $200+ monthly cash flow
- **ROI Target**: Highlight properties with 15%+ cash-on-cash returns
- **Geographic Diversity**: Identify opportunities across multiple states/markets
- **Price Range**: Find opportunities across various price points ($50k-$300k)

This analysis will provide actionable insights into which owner finance properties in our database represent the best investment opportunities for cash flow-focused investors.