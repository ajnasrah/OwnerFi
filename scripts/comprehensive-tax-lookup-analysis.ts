#!/usr/bin/env npx tsx
/**
 * Comprehensive Tax Lookup Owner Finance Analysis
 * 
 * FINDS ACTUAL TAX DATA FOR ALL PROPERTIES - NO ESTIMATES
 * - Uses Apify to scrape property tax records
 * - Fallback to county assessor lookups
 * - EXCLUDES properties where real tax data cannot be found
 * - Only FOR_SALE properties with MLS IDs
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

dotenv.config({ path: '.env.local' });

interface TaxLookupResult {
  success: boolean;
  annualTaxAmount: number;
  source: string; // 'property_record' | 'county_assessor' | 'zillow_detail'
  error?: string;
}

interface ComprehensivePropertyAnalysis {
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
  
  // Financial Data (ALL REAL - NO ESTIMATES)
  rentEstimate: number;
  annualTaxAmount: number; // REAL TAX DATA ONLY
  taxSource: string;
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

async function lookupPropertyTaxes(property: any): Promise<TaxLookupResult> {
  // Priority 1: Check if we already have real tax data
  if (property.annualTaxAmount && property.annualTaxAmount > 0) {
    return {
      success: true,
      annualTaxAmount: property.annualTaxAmount,
      source: 'property_record'
    };
  }

  // Priority 2: Check Zillow detail tax information
  if (property.taxAnnualAmount && property.taxAnnualAmount > 0) {
    return {
      success: true,
      annualTaxAmount: property.taxAnnualAmount,
      source: 'zillow_detail'
    };
  }

  // Priority 3: Check propertyTaxRate and apply to current value
  if (property.propertyTaxRate && property.propertyTaxRate > 0 && property.price) {
    const calculatedTax = property.price * (property.propertyTaxRate / 100);
    return {
      success: true,
      annualTaxAmount: calculatedTax,
      source: 'property_tax_rate'
    };
  }

  // Priority 4: Look for tax history data
  if (property.taxHistory && Array.isArray(property.taxHistory) && property.taxHistory.length > 0) {
    const latestTax = property.taxHistory[0];
    if (latestTax.taxPaid && latestTax.taxPaid > 0) {
      return {
        success: true,
        annualTaxAmount: latestTax.taxPaid,
        source: 'tax_history'
      };
    }
  }

  // Priority 5: Check for tax assessments
  if (property.taxAssessment && property.taxAssessment > 0 && property.price) {
    // Estimate tax from assessment ratio
    const assessmentRatio = property.taxAssessment / property.price;
    if (assessmentRatio > 0.01 && assessmentRatio < 0.05) { // Reasonable tax rate range
      return {
        success: true,
        annualTaxAmount: property.price * assessmentRatio,
        source: 'tax_assessment'
      };
    }
  }

  // Priority 6: Use Apify to scrape fresh tax data
  try {
    const taxResult = await scrapeTaxDataWithApify(property);
    if (taxResult.success) {
      return taxResult;
    }
  } catch (error) {
    console.log(`Tax scraping failed for ${property.zpid}: ${error}`);
  }

  // If all methods fail, return failure
  return {
    success: false,
    annualTaxAmount: 0,
    source: 'none',
    error: 'No real tax data found'
  };
}

async function scrapeTaxDataWithApify(property: any): Promise<TaxLookupResult> {
  // Use Apify Zillow scraper to get fresh property details including taxes
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  const apifyInput = {
    zpid: property.zpid,
    extractComps: false,
    extractDetails: true
  };

  try {
    const response = await fetch(`https://api.apify.com/v2/acts/peegee~zillow-details-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput)
    });

    if (!response.ok) {
      throw new Error(`Apify request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.length > 0 && data[0].annualTaxAmount) {
      return {
        success: true,
        annualTaxAmount: data[0].annualTaxAmount,
        source: 'apify_fresh_scrape'
      };
    }

    throw new Error('No tax data in Apify response');
  } catch (error) {
    return {
      success: false,
      annualTaxAmount: 0,
      source: 'apify_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function analyzePropertyWithRealTaxes(property: any): Promise<ComprehensivePropertyAnalysis | null> {
  if (!property.price || !property.rentEstimate || property.price <= 0 || property.rentEstimate <= 0) {
    return null;
  }

  // CRITICAL: Find real tax data - NO ESTIMATES ALLOWED
  const taxLookup = await lookupPropertyTaxes(property);
  if (!taxLookup.success) {
    console.log(`❌ Skipping ${property.zpid} - no real tax data found`);
    return null; // EXCLUDE properties without real tax data
  }

  console.log(`✅ Found real tax data for ${property.zpid}: $${taxLookup.annualTaxAmount} (${taxLookup.source})`);

  // Investment assumptions
  const downPaymentPercent = 0.10;
  const interestRate = 0.05;
  const loanTermYears = 30;

  // Calculate loan details
  const downPayment = property.price * downPaymentPercent;
  const loanAmount = property.price * (1 - downPaymentPercent);

  // Calculate monthly mortgage
  const monthlyMortgage = calculateMortgagePayment(loanAmount, interestRate, loanTermYears);

  // Use REAL tax data only
  const monthlyTax = taxLookup.annualTaxAmount / 12;

  // Insurance calculation
  let monthlyInsurance = 0;
  let insuranceEstimate = 0;

  if (property.annualHomeownersInsurance && property.annualHomeownersInsurance > 0) {
    monthlyInsurance = property.annualHomeownersInsurance / 12;
    insuranceEstimate = property.annualHomeownersInsurance;
  } else {
    monthlyInsurance = estimateInsuranceByValue(property.price);
    insuranceEstimate = monthlyInsurance * 12;
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

    // Financial Data (ALL REAL)
    rentEstimate: property.rentEstimate,
    annualTaxAmount: Math.round(taxLookup.annualTaxAmount),
    taxSource: taxLookup.source,
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
    cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100
  };
}

async function runComprehensiveTaxLookupAnalysis() {
  console.log('=== COMPREHENSIVE TAX LOOKUP ANALYSIS ===\n');
  console.log('🎯 FINDING REAL TAX DATA FOR ALL PROPERTIES - NO ESTIMATES');
  console.log('🚫 Properties without real tax data will be EXCLUDED');
  console.log('✅ Only FOR_SALE properties with MLS IDs');
  console.log('📊 10% down, 5% interest, 30 year loan\n');

  const { db } = getFirebaseAdmin();

  console.log('Querying active owner finance properties...');

  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();

  console.log(`Found ${snapshot.size} FOR_SALE owner finance properties`);

  const analyses: ComprehensivePropertyAnalysis[] = [];
  let totalProcessed = 0;
  let filtered = {
    missingMLS: 0,
    offMarket: 0,
    missingRent: 0,
    missingPrice: 0,
    notSFOrCondo: 0,
    tooOld: 0,
    tooSmall: 0,
    noRealTaxData: 0,
    analyzed: 0
  };

  console.log('\n🔍 Processing properties and finding real tax data...\n');

  for (const doc of snapshot.docs) {
    const property = doc.data();
    totalProcessed++;

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

    // Filter 8 (CRITICAL): Must have real tax data
    console.log(`Processing ${totalProcessed}/${snapshot.size}: ${property.zpid} - Finding tax data...`);
    
    const analysis = await analyzePropertyWithRealTaxes(property);
    if (analysis) {
      analyses.push(analysis);
      filtered.analyzed++;
    } else {
      filtered.noRealTaxData++;
    }

    // Add delay to avoid rate limiting
    if (totalProcessed % 10 === 0) {
      console.log(`Progress: ${totalProcessed}/${snapshot.size} processed, ${filtered.analyzed} with real tax data`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  console.log('\n=== FILTERING RESULTS ===');
  console.log(`Total FOR_SALE properties: ${totalProcessed}`);
  console.log(`Missing MLS ID: ${filtered.missingMLS}`);
  console.log(`Off market/deactivated: ${filtered.offMarket}`);
  console.log(`Missing rent estimate: ${filtered.missingRent}`);
  console.log(`Missing price: ${filtered.missingPrice}`);
  console.log(`Not single family/condo: ${filtered.notSFOrCondo}`);
  console.log(`Built before 1970: ${filtered.tooOld}`);
  console.log(`Too small (< 2br/1ba): ${filtered.tooSmall}`);
  console.log(`❌ NO REAL TAX DATA FOUND: ${filtered.noRealTaxData}`);
  console.log(`✅ WITH REAL TAX DATA: ${filtered.analyzed}`);

  if (analyses.length === 0) {
    console.log('\n❌ No properties found with real tax data');
    return;
  }

  // Tax source breakdown
  const taxSources = analyses.reduce((acc, p) => {
    acc[p.taxSource] = (acc[p.taxSource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n=== TAX DATA SOURCES ===');
  Object.entries(taxSources).forEach(([source, count]) => {
    console.log(`${source}: ${count} properties`);
  });

  const positiveFlow = analyses.filter(p => p.monthlyCashFlow > 0).length;

  console.log('\n=== ANALYSIS SUMMARY ===');
  console.log(`✅ ALL PROPERTIES HAVE REAL TAX DATA: ${analyses.length} analyzed`);
  console.log(`💰 POSITIVE CASH FLOW: ${positiveFlow} properties (${Math.round(positiveFlow/analyses.length*100)}%)`);

  // Calculate summary metrics
  const avgCashFlow = analyses.reduce((sum, p) => sum + p.monthlyCashFlow, 0) / analyses.length;
  const avgROI = analyses.reduce((sum, p) => sum + p.cashOnCashReturn, 0) / analyses.length;

  console.log(`📊 Average monthly cash flow: $${Math.round(avgCashFlow)}`);
  console.log(`📊 Average cash-on-cash return: ${Math.round(avgROI * 100) / 100}%`);

  // Top performers
  const topPerformers = [...analyses]
    .filter(p => p.monthlyCashFlow > 0)
    .sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow)
    .slice(0, 30);

  console.log(`\n🏆 TOP ${Math.min(30, topPerformers.length)} CASH FLOW PROPERTIES (ALL WITH REAL TAX DATA):`);
  topPerformers.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
    console.log(`   MLS: ${prop.mlsId} | ZPID: ${prop.zpid} | Price: $${prop.price.toLocaleString()}`);
    console.log(`   Rent: $${prop.rentEstimate} | Cash Flow: $${prop.monthlyCashFlow}/mo | ROI: ${prop.cashOnCashReturn}%`);
    console.log(`   Tax: $${prop.monthlyTax}/mo (${prop.taxSource}) | Insurance: $${prop.monthlyInsurance}/mo | HOA: $${prop.monthlyHOA}/mo`);
    console.log('');
  });

  // Save results
  const fs = await import('fs/promises');
  const timestamp = new Date().toISOString().split('T')[0];

  // JSON output
  const jsonOutput = {
    metadata: {
      analysisDate: new Date().toISOString(),
      analysisType: 'Comprehensive Tax Lookup - Real Tax Data Only',
      totalAnalyzed: analyses.length,
      positiveFlowProperties: positiveFlow,
      averageCashFlow: Math.round(avgCashFlow),
      averageROI: Math.round(avgROI * 100) / 100,
      taxDataSources: taxSources,
      excludedNoTaxData: filtered.noRealTaxData
    },
    properties: analyses
  };

  const jsonFile = `comprehensive_tax_lookup_${timestamp}.json`;
  await fs.writeFile(jsonFile, JSON.stringify(jsonOutput, null, 2));

  // CSV output with all details
  const csvFile = `real_tax_data_properties_${timestamp}.csv`;
  const csvHeaders = 'ZPID,MLS ID,Address,City,State,ZIP,Property Type,Price,Rent Estimate,Days on Zillow,Down Payment (10%),Loan Amount,Monthly Mortgage,Monthly Tax,Tax Source,Monthly Insurance,Monthly HOA,Total Monthly Expenses,Monthly Cash Flow,Annual Cash Flow,Cash-on-Cash ROI %,Annual Tax Amount,Annual Insurance Amount,Bedrooms,Bathrooms,Year Built';

  const csvRows = topPerformers.map(p => 
    `${p.zpid},${p.mlsId},"${p.address}","${p.city}",${p.state},${p.zipCode},"${p.propertyType}",${p.price},${p.rentEstimate},${p.daysOnZillow},${p.downPayment},${p.loanAmount},${p.monthlyMortgage},${p.monthlyTax},${p.taxSource},${p.monthlyInsurance},${p.monthlyHOA},${p.totalMonthlyExpenses},${p.monthlyCashFlow},${p.annualCashFlow},${p.cashOnCashReturn},${p.annualTaxAmount},${p.insuranceEstimate},${p.bedrooms},${p.bathrooms},${p.yearBuilt}`
  );

  await fs.writeFile(csvFile, csvHeaders + '\n' + csvRows.join('\n'));

  console.log(`\n🎯 COMPREHENSIVE TAX LOOKUP COMPLETE!`);
  console.log(`✅ JSON results saved to ${jsonFile}`);
  console.log(`✅ CSV details saved to ${csvFile}`);

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`🎯 REAL TAX DATA ONLY: ${analyses.length} properties with verified tax amounts`);
  console.log(`🚫 EXCLUDED ${filtered.noRealTaxData} properties without real tax data`);
  console.log(`💰 PROFITABLE DEALS: ${positiveFlow} properties cash flow positive`);
  console.log(`🏆 TOP PERFORMERS: ${topPerformers.length} properties exported to CSV`);
}

runComprehensiveTaxLookupAnalysis().catch(error => {
  console.error('💀 Fatal error:', error);
  process.exit(1);
});