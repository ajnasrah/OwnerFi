#!/usr/bin/env npx tsx
/**
 * Active Owner Finance Cash Flow Analysis
 * 
 * ONLY includes active MLS properties with improved estimates for missing data:
 * - Tax rate estimation by state when missing real tax data
 * - Value-based insurance estimates for expensive properties
 * - Only FOR_SALE properties with MLS IDs
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

dotenv.config({ path: '.env.local' });

// Average property tax rates by state (as percentage of home value)
const STATE_TAX_RATES: Record<string, number> = {
  'AL': 0.41, 'AK': 1.19, 'AZ': 0.66, 'AR': 0.63, 'CA': 0.75,
  'CO': 0.51, 'CT': 2.14, 'DE': 0.57, 'FL': 0.83, 'GA': 0.89,
  'HI': 0.27, 'ID': 0.69, 'IL': 2.27, 'IN': 0.87, 'IA': 1.53,
  'KS': 1.36, 'KY': 0.86, 'LA': 0.55, 'ME': 1.28, 'MD': 1.06,
  'MA': 1.23, 'MI': 1.64, 'MN': 1.12, 'MS': 0.81, 'MO': 0.97,
  'MT': 0.83, 'NE': 1.73, 'NV': 0.53, 'NH': 2.18, 'NJ': 2.49,
  'NM': 0.80, 'NY': 1.69, 'NC': 0.84, 'ND': 0.98, 'OH': 1.52,
  'OK': 0.90, 'OR': 0.87, 'PA': 1.58, 'RI': 1.53, 'SC': 0.57,
  'SD': 1.31, 'TN': 0.67, 'TX': 1.69, 'UT': 0.60, 'VT': 1.90,
  'VA': 0.82, 'WA': 0.88, 'WV': 0.60, 'WI': 1.85, 'WY': 0.62
};

interface ActivePropertyAnalysis {
  // Property Info
  zpid: string;
  mlsId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  propertyType: string;
  daysOnZillow: number;
  
  // Financial Data
  rentEstimate: number;
  taxAnnualAmount: number;
  hoaFee: number;
  insuranceEstimate: number;
  
  // Investment Calculations
  downPayment: number;
  loanAmount: number;
  monthlyMortgage: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyHOA: number;
  totalMonthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  
  // Data Quality Flags
  hasRealTaxData: boolean;
  hasRealInsuranceData: boolean;
  taxEstimationMethod: string; // 'real' | 'state_rate_estimate'
  insuranceEstimationMethod: string; // 'real' | 'value_based_estimate' | 'default'
}

function calculateMortgagePayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) return principal / numPayments;
  
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function estimateInsuranceByValue(price: number): number {
  // Value-based insurance estimation (monthly)
  if (price < 100000) return 100;
  if (price < 200000) return 150;
  if (price < 300000) return 200;
  if (price < 400000) return 250;
  if (price < 500000) return 300;
  if (price < 750000) return 400;
  return 500; // $500+ for expensive properties
}

function analyzeActiveProperty(property: any): ActivePropertyAnalysis | null {
  if (!property.price || !property.rentEstimate || property.price <= 0 || property.rentEstimate <= 0) {
    return null;
  }
  
  // Investment assumptions
  const downPaymentPercent = 0.10;
  const interestRate = 0.05;
  const loanTermYears = 30;
  
  // Calculate loan details
  const downPayment = property.price * downPaymentPercent;
  const loanAmount = property.price * (1 - downPaymentPercent);
  
  // Calculate monthly mortgage
  const monthlyMortgage = calculateMortgagePayment(loanAmount, interestRate, loanTermYears);
  
  // Tax calculation with state estimation fallback
  let monthlyTax = 0;
  let taxEstimationMethod = 'real';
  let hasRealTaxData = false;
  let taxAnnualAmount = 0;
  
  if (property.annualTaxAmount && property.annualTaxAmount > 0) {
    // Use real tax data
    monthlyTax = property.annualTaxAmount / 12;
    taxAnnualAmount = property.annualTaxAmount;
    hasRealTaxData = true;
  } else {
    // Estimate using state average tax rate
    const stateRate = STATE_TAX_RATES[property.state] || 1.0; // Default 1% if state not found
    taxAnnualAmount = property.price * (stateRate / 100);
    monthlyTax = taxAnnualAmount / 12;
    taxEstimationMethod = 'state_rate_estimate';
  }
  
  // Insurance calculation with value-based estimation
  let monthlyInsurance = 0;
  let insuranceEstimationMethod = 'real';
  let hasRealInsuranceData = false;
  let insuranceEstimate = 0;
  
  if (property.annualHomeownersInsurance && property.annualHomeownersInsurance > 0) {
    // Use real insurance data
    monthlyInsurance = property.annualHomeownersInsurance / 12;
    insuranceEstimate = property.annualHomeownersInsurance;
    hasRealInsuranceData = true;
  } else {
    // Use value-based estimation
    monthlyInsurance = estimateInsuranceByValue(property.price);
    insuranceEstimate = monthlyInsurance * 12;
    insuranceEstimationMethod = 'value_based_estimate';
  }
  
  // HOA calculation
  const monthlyHOA = property.monthlyHoaFee || property.hoa || 0;
  
  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
  const monthlyCashFlow = property.rentEstimate - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  
  return {
    // Property Info
    zpid: property.zpid || 'Unknown',
    mlsId: property.mlsId || 'No MLS',
    address: property.fullAddress || property.streetAddress || property.address || 'Unknown Address',
    city: property.city || 'Unknown',
    state: property.state || 'Unknown',
    zipCode: property.zipCode || 'Unknown',
    price: property.price,
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    yearBuilt: property.yearBuilt || 0,
    propertyType: property.propertyType || 'Unknown',
    daysOnZillow: property.daysOnZillow || 0,
    
    // Financial Data
    rentEstimate: property.rentEstimate,
    taxAnnualAmount: Math.round(taxAnnualAmount),
    hoaFee: property.monthlyHoaFee || property.hoa || 0,
    insuranceEstimate: Math.round(insuranceEstimate),
    
    // Investment Calculations
    downPayment: Math.round(downPayment),
    loanAmount: Math.round(loanAmount),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyHOA: Math.round(monthlyHOA),
    totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
    
    // Data Quality Flags
    hasRealTaxData,
    hasRealInsuranceData,
    taxEstimationMethod,
    insuranceEstimationMethod
  };
}

async function runActiveOwnerFinanceAnalysis() {
  console.log('=== ACTIVE OWNER FINANCE CASH FLOW ANALYSIS ===\n');
  console.log('Filters:');
  console.log('• Only FOR_SALE properties with MLS IDs');
  console.log('• No off-market or deactivated properties');
  console.log('• Tax estimation using state rates when real data missing');
  console.log('• Value-based insurance estimation');
  console.log('• 10% down, 5% interest, 30 year loan\n');
  
  const { db } = getFirebaseAdmin();
  
  // Query active owner finance properties only
  console.log('Querying active owner finance properties...');
  
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();
  
  console.log(`Found ${snapshot.size} FOR_SALE owner finance properties`);
  
  // Filter for truly active properties
  const analyses: ActivePropertyAnalysis[] = [];
  let totalAnalyzed = 0;
  let filtered = {
    missingMLS: 0,
    offMarket: 0,
    missingRent: 0,
    missingPrice: 0,
    notSFOrCondo: 0,
    tooOld: 0,
    tooSmall: 0,
    analyzed: 0
  };
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    totalAnalyzed++;
    
    // Filter 1: Must have MLS ID
    if (!property.mlsId) {
      filtered.missingMLS++;
      continue;
    }
    
    // Filter 2: Must be truly active (not off market)
    if (property.isActive === false || property.offMarketReason) {
      filtered.offMarket++;
      continue;
    }
    
    // Filter 3: Must have rent estimate
    if (!property.rentEstimate || property.rentEstimate <= 0) {
      filtered.missingRent++;
      continue;
    }
    
    // Filter 4: Must have price
    if (!property.price || property.price <= 0) {
      filtered.missingPrice++;
      continue;
    }
    
    // Filter 5: Single family OR condo only
    if (property.propertyType && 
        !property.propertyType.toLowerCase().includes('single family') &&
        !property.propertyType.toLowerCase().includes('condo')) {
      filtered.notSFOrCondo++;
      continue;
    }
    
    // Filter 6: Built 1970 or newer
    if (property.yearBuilt && property.yearBuilt < 1970) {
      filtered.tooOld++;
      continue;
    }
    
    // Filter 7: At least 2br/1ba
    if ((property.bedrooms && property.bedrooms < 2) || (property.bathrooms && property.bathrooms < 1)) {
      filtered.tooSmall++;
      continue;
    }
    
    // Analyze property
    const analysis = analyzeActiveProperty(property);
    if (analysis) {
      analyses.push(analysis);
      filtered.analyzed++;
    }
    
    // Progress update
    if (totalAnalyzed % 500 === 0) {
      console.log(`Processed ${totalAnalyzed} properties, analyzed ${filtered.analyzed}...`);
    }
  }
  
  console.log('\n=== FILTERING RESULTS ===');
  console.log(`Total FOR_SALE properties: ${totalAnalyzed}`);
  console.log(`Missing MLS ID: ${filtered.missingMLS}`);
  console.log(`Off market/deactivated: ${filtered.offMarket}`);
  console.log(`Missing rent estimate: ${filtered.missingRent}`);
  console.log(`Missing price: ${filtered.missingPrice}`);
  console.log(`Not single family/condo: ${filtered.notSFOrCondo}`);
  console.log(`Built before 1970: ${filtered.tooOld}`);
  console.log(`Too small (< 2br/1ba): ${filtered.tooSmall}`);
  console.log(`Successfully analyzed: ${filtered.analyzed}`);
  
  if (analyses.length === 0) {
    console.log('\n❌ No active properties met analysis criteria');
    return;
  }
  
  // Data quality summary
  const withRealTax = analyses.filter(p => p.hasRealTaxData).length;
  const withRealInsurance = analyses.filter(p => p.hasRealInsuranceData).length;
  const positiveFlow = analyses.filter(p => p.monthlyCashFlow > 0).length;
  
  console.log('\n=== DATA QUALITY SUMMARY ===');
  console.log(`Properties with real tax data: ${withRealTax} (${Math.round(withRealTax/analyses.length*100)}%)`);
  console.log(`Properties with real insurance data: ${withRealInsurance} (${Math.round(withRealInsurance/analyses.length*100)}%)`);
  console.log(`Properties with positive cash flow: ${positiveFlow} (${Math.round(positiveFlow/analyses.length*100)}%)`);
  
  // Calculate summary metrics
  const avgCashFlow = analyses.reduce((sum, p) => sum + p.monthlyCashFlow, 0) / analyses.length;
  const avgROI = analyses.reduce((sum, p) => sum + p.cashOnCashReturn, 0) / analyses.length;
  
  console.log('\n=== CASH FLOW ANALYSIS ===');
  console.log(`Average monthly cash flow: $${Math.round(avgCashFlow)}`);
  console.log(`Average cash-on-cash return: ${Math.round(avgROI * 100) / 100}%`);
  
  // Top performers
  const topPerformers = [...analyses]
    .filter(p => p.monthlyCashFlow > 200)
    .sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow)
    .slice(0, 20);
  
  console.log(`\nTop ${Math.min(20, topPerformers.length)} active MLS cash flow properties (>$200/month):`);
  topPerformers.forEach((prop, i) => {
    const taxFlag = prop.hasRealTaxData ? 'REAL' : 'EST';
    const insFlag = prop.hasRealInsuranceData ? 'REAL' : 'EST';
    console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
    console.log(`   MLS: ${prop.mlsId} | Days: ${prop.daysOnZillow} | Price: $${prop.price.toLocaleString()}`);
    console.log(`   Rent: $${prop.rentEstimate} | Cash Flow: $${prop.monthlyCashFlow}/mo | ROI: ${prop.cashOnCashReturn}%`);
    console.log(`   Tax: $${prop.monthlyTax}/mo (${taxFlag}) | Insurance: $${prop.monthlyInsurance}/mo (${insFlag}) | HOA: $${prop.monthlyHOA}/mo`);
    console.log('');
  });
  
  // Save results
  const fs = await import('fs/promises');
  const timestamp = new Date().toISOString().split('T')[0];
  
  // JSON output
  const jsonOutput = {
    metadata: {
      analysisDate: new Date().toISOString(),
      analysisType: 'Active MLS Owner Finance Properties Only',
      totalAnalyzed: analyses.length,
      positiveFlowProperties: positiveFlow,
      averageCashFlow: Math.round(avgCashFlow),
      averageROI: Math.round(avgROI * 100) / 100,
      dataQuality: {
        withRealTaxData: withRealTax,
        withRealInsuranceData: withRealInsurance
      }
    },
    properties: analyses
  };
  
  const jsonFile = `active_owner_finance_analysis_${timestamp}.json`;
  await fs.writeFile(jsonFile, JSON.stringify(jsonOutput, null, 2));
  
  // CSV output with all details
  const csvFile = `active_owner_finance_detailed_${timestamp}.csv`;
  const csvHeaders = 'ZPID,MLS ID,Address,City,State,ZIP,Property Type,Price,Rent Estimate,Days on Zillow,Down Payment (10%),Loan Amount,Monthly Mortgage,Monthly Tax,Tax Method,Monthly Insurance,Insurance Method,Monthly HOA,Total Monthly Expenses,Monthly Cash Flow,Annual Cash Flow,Cash-on-Cash ROI %,Annual Tax Amount,Annual Insurance Amount,Bedrooms,Bathrooms,Year Built';
  
  const csvRows = topPerformers.map(p => 
    `${p.zpid},${p.mlsId},"${p.address}","${p.city}",${p.state},${p.zipCode},"${p.propertyType}",${p.price},${p.rentEstimate},${p.daysOnZillow},${p.downPayment},${p.loanAmount},${p.monthlyMortgage},${p.monthlyTax},${p.taxEstimationMethod},${p.monthlyInsurance},${p.insuranceEstimationMethod},${p.monthlyHOA},${p.totalMonthlyExpenses},${p.monthlyCashFlow},${p.annualCashFlow},${p.cashOnCashReturn},${p.taxAnnualAmount},${p.insuranceEstimate},${p.bedrooms},${p.bathrooms},${p.yearBuilt}`
  );
  
  await fs.writeFile(csvFile, csvHeaders + '\n' + csvRows.join('\n'));
  
  console.log(`\n✅ Analysis complete!`);
  console.log(`✅ JSON results saved to ${jsonFile}`);
  console.log(`✅ CSV details saved to ${csvFile}`);
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`✅ ACTIVE MLS PROPERTIES ONLY: ${analyses.length} analyzed`);
  console.log(`✅ REALISTIC TAX ESTIMATES: Using state rates when real data missing`);
  console.log(`✅ VALUE-BASED INSURANCE: Scaled by property price`);
  console.log(`💰 POSITIVE CASH FLOW: ${positiveFlow} properties are profitable`);
  console.log(`🏆 TOP PERFORMERS: ${topPerformers.length} with $200+ monthly cash flow`);
}

runActiveOwnerFinanceAnalysis().catch(error => {
  console.error('💀 Fatal error:', error);
  process.exit(1);
});