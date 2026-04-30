#!/usr/bin/env npx tsx
/**
 * Owner Finance Cash Flow Analysis
 * 
 * Analyzes existing owner finance properties in our database to identify 
 * cash flow opportunities using standardized investment assumptions:
 * - 10% down payment
 * - 5% interest rate
 * - 30 year amortization
 * - Standard expense estimates
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

dotenv.config({ path: '.env.local' });

interface PropertyAnalysis {
  // Property Info
  zpid: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  propertyType: string;
  
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
  
  // Metadata
  scrapedAt: string;
  url?: string;
}

interface AnalysisResults {
  metadata: {
    analysisDate: string;
    totalPropertiesAnalyzed: number;
    qualifyingProperties: number;
    positiveFlowProperties: number;
    averageCashFlow: number;
    averageROI: number;
    assumptions: {
      downPaymentPercent: number;
      interestRate: number;
      loanTermYears: number;
      defaultInsurance: number;
    }
  };
  topPerformers: PropertyAnalysis[];
  marketAnalysis: {
    byState: Record<string, { count: number; avgCashFlow: number; avgROI: number }>;
    byPriceRange: Record<string, { count: number; avgCashFlow: number; avgROI: number }>;
    byMarket: Record<string, { count: number; avgCashFlow: number; avgROI: number }>;
  };
  allProperties: PropertyAnalysis[];
}

/**
 * Calculate monthly mortgage payment using standard amortization formula
 */
function calculateMortgagePayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) return principal / numPayments;
  
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

/**
 * Analyze a property for cash flow potential
 */
function analyzeProperty(property: any): PropertyAnalysis | null {
  // Validate required data
  if (!property.price || !property.rentEstimate || property.price <= 0 || property.rentEstimate <= 0) {
    return null;
  }
  
  // Debug log for first few properties
  if (property.zpid && (property.zpid === '101317013' || property.zpid === '101344699')) {
    console.log(`DEBUG - Property ${property.zpid}:`);
    console.log(`  annualTaxAmount: ${property.annualTaxAmount}`);
    console.log(`  annualHomeownersInsurance: ${property.annualHomeownersInsurance}`);
    console.log(`  monthlyHoaFee: ${property.monthlyHoaFee}`);
    console.log(`  hoa: ${property.hoa}`);
  }
  
  // Investment assumptions
  const downPaymentPercent = 0.10;
  const interestRate = 0.05;
  const loanTermYears = 30;
  const defaultInsurance = 150;
  
  // Calculate loan details
  const downPayment = property.price * downPaymentPercent;
  const loanAmount = property.price * (1 - downPaymentPercent);
  
  // Calculate monthly payments
  const monthlyMortgage = calculateMortgagePayment(loanAmount, interestRate, loanTermYears);
  const monthlyTax = (property.annualTaxAmount || 0) / 12;
  const monthlyInsurance = property.annualHomeownersInsurance ? property.annualHomeownersInsurance / 12 : defaultInsurance;
  const monthlyHOA = property.monthlyHoaFee || property.hoa || 0;
  
  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
  const monthlyCashFlow = property.rentEstimate - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  
  return {
    // Property Info
    zpid: property.zpid || 'Unknown',
    address: property.fullAddress || property.streetAddress || property.address || 'Unknown Address',
    city: property.city || 'Unknown',
    state: property.state || 'Unknown',
    zipCode: property.zipCode || 'Unknown',
    price: property.price,
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    yearBuilt: property.yearBuilt || 0,
    propertyType: property.propertyType || 'Unknown',
    
    // Financial Data
    rentEstimate: property.rentEstimate,
    taxAnnualAmount: property.annualTaxAmount || 0,
    hoaFee: property.monthlyHoaFee || property.hoa || 0,
    insuranceEstimate: property.annualHomeownersInsurance || (defaultInsurance * 12),
    
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
    
    // Metadata
    scrapedAt: property.scrapedAt || 'Unknown',
    url: property.url
  };
}

async function runOwnerFinanceCashFlowAnalysis() {
  console.log('=== OWNER FINANCE CASH FLOW ANALYSIS ===\n');
  console.log('Analyzing properties with standardized investment assumptions:');
  console.log('• 10% down payment');
  console.log('• 5% interest rate');  
  console.log('• 30 year loan term');
  console.log('• $150/month insurance (default)');
  console.log('');
  
  const { db } = getFirebaseAdmin();
  
  // Query owner finance properties with required data
  console.log('Querying owner finance properties...');
  
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .get();
  
  console.log(`Found ${snapshot.size} owner finance properties in database`);
  
  // Filter and analyze properties
  const analyses: PropertyAnalysis[] = [];
  let totalAnalyzed = 0;
  let filtered = {
    missingRent: 0,
    missingPrice: 0,
    notSingleFamily: 0,
    tooOld: 0,
    tooSmall: 0,
    analyzed: 0
  };
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    totalAnalyzed++;
    
    // Apply filters
    if (!property.rentEstimate || property.rentEstimate <= 0) {
      filtered.missingRent++;
      continue;
    }
    
    if (!property.price || property.price <= 0) {
      filtered.missingPrice++;
      continue;
    }
    
    // Allow single family AND condos (many owner finance properties are condos)
    if (property.propertyType && 
        !property.propertyType.toLowerCase().includes('single family') &&
        !property.propertyType.toLowerCase().includes('condo')) {
      filtered.notSingleFamily++;
      continue;
    }
    
    if (property.yearBuilt && property.yearBuilt < 1970) {
      filtered.tooOld++;
      continue;
    }
    
    if ((property.bedrooms && property.bedrooms < 2) || (property.bathrooms && property.bathrooms < 1)) {
      filtered.tooSmall++;
      continue;
    }
    
    // Analyze property
    const analysis = analyzeProperty(property);
    if (analysis) {
      analyses.push(analysis);
      filtered.analyzed++;
    }
    
    // Progress update
    if (totalAnalyzed % 100 === 0) {
      console.log(`Processed ${totalAnalyzed} properties, analyzed ${filtered.analyzed}...`);
    }
  }
  
  console.log('\n=== FILTERING RESULTS ===');
  console.log(`Total properties: ${totalAnalyzed}`);
  console.log(`Missing rent estimate: ${filtered.missingRent}`);
  console.log(`Missing price: ${filtered.missingPrice}`);
  console.log(`Not single family: ${filtered.notSingleFamily}`);
  console.log(`Built before 1970: ${filtered.tooOld}`);
  console.log(`Too small (< 2br/1ba): ${filtered.tooSmall}`);
  console.log(`Successfully analyzed: ${filtered.analyzed}`);
  
  if (analyses.length === 0) {
    console.log('\n❌ No properties met analysis criteria');
    return;
  }
  
  // Calculate summary metrics
  const positiveFlowProperties = analyses.filter(p => p.monthlyCashFlow > 0);
  const avgCashFlow = analyses.reduce((sum, p) => sum + p.monthlyCashFlow, 0) / analyses.length;
  const avgROI = analyses.reduce((sum, p) => sum + p.cashOnCashReturn, 0) / analyses.length;
  
  console.log('\n=== CASH FLOW ANALYSIS ===');
  console.log(`Properties with positive cash flow: ${positiveFlowProperties.length} (${Math.round(positiveFlowProperties.length / analyses.length * 100)}%)`);
  console.log(`Average monthly cash flow: $${Math.round(avgCashFlow)}`);
  console.log(`Average cash-on-cash return: ${Math.round(avgROI * 100) / 100}%`);
  
  // Top performers (best cash flow)
  const topPerformers = [...analyses]
    .filter(p => p.monthlyCashFlow > 200) // $200+ monthly cash flow
    .sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow)
    .slice(0, 20);
  
  console.log(`\nTop ${Math.min(20, topPerformers.length)} cash flow properties (>$200/month):`);
  topPerformers.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
    console.log(`   Price: $${prop.price.toLocaleString()} | Rent: $${prop.rentEstimate} | Cash Flow: $${prop.monthlyCashFlow}/mo | ROI: ${prop.cashOnCashReturn}%`);
  });
  
  // Market analysis
  const marketAnalysis = {
    byState: {} as Record<string, { count: number; avgCashFlow: number; avgROI: number }>,
    byPriceRange: {} as Record<string, { count: number; avgCashFlow: number; avgROI: number }>,
    byMarket: {} as Record<string, { count: number; avgCashFlow: number; avgROI: number }>
  };
  
  // Analyze by state
  for (const prop of positiveFlowProperties) {
    const state = prop.state;
    if (!marketAnalysis.byState[state]) {
      marketAnalysis.byState[state] = { count: 0, avgCashFlow: 0, avgROI: 0 };
    }
    marketAnalysis.byState[state].count++;
    marketAnalysis.byState[state].avgCashFlow += prop.monthlyCashFlow;
    marketAnalysis.byState[state].avgROI += prop.cashOnCashReturn;
  }
  
  // Calculate averages
  for (const state in marketAnalysis.byState) {
    const data = marketAnalysis.byState[state];
    data.avgCashFlow = Math.round(data.avgCashFlow / data.count);
    data.avgROI = Math.round((data.avgROI / data.count) * 100) / 100;
  }
  
  // Analyze by price range
  const priceRanges = ['$0-50k', '$50-100k', '$100-150k', '$150-200k', '$200-300k', '$300k+'];
  for (const prop of positiveFlowProperties) {
    let range = '$300k+';
    if (prop.price < 50000) range = '$0-50k';
    else if (prop.price < 100000) range = '$50-100k';
    else if (prop.price < 150000) range = '$100-150k';
    else if (prop.price < 200000) range = '$150-200k';
    else if (prop.price < 300000) range = '$200-300k';
    
    if (!marketAnalysis.byPriceRange[range]) {
      marketAnalysis.byPriceRange[range] = { count: 0, avgCashFlow: 0, avgROI: 0 };
    }
    marketAnalysis.byPriceRange[range].count++;
    marketAnalysis.byPriceRange[range].avgCashFlow += prop.monthlyCashFlow;
    marketAnalysis.byPriceRange[range].avgROI += prop.cashOnCashReturn;
  }
  
  for (const range in marketAnalysis.byPriceRange) {
    const data = marketAnalysis.byPriceRange[range];
    data.avgCashFlow = Math.round(data.avgCashFlow / data.count);
    data.avgROI = Math.round((data.avgROI / data.count) * 100) / 100;
  }
  
  console.log('\n=== MARKET ANALYSIS ===');
  console.log('\nPositive Cash Flow Properties by State:');
  Object.entries(marketAnalysis.byState)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([state, data]) => {
      console.log(`  ${state}: ${data.count} properties, $${data.avgCashFlow}/mo avg, ${data.avgROI}% ROI avg`);
    });
  
  console.log('\nPositive Cash Flow Properties by Price Range:');
  priceRanges.forEach(range => {
    const data = marketAnalysis.byPriceRange[range];
    if (data) {
      console.log(`  ${range}: ${data.count} properties, $${data.avgCashFlow}/mo avg, ${data.avgROI}% ROI avg`);
    }
  });
  
  // Save results
  const results: AnalysisResults = {
    metadata: {
      analysisDate: new Date().toISOString(),
      totalPropertiesAnalyzed: totalAnalyzed,
      qualifyingProperties: analyses.length,
      positiveFlowProperties: positiveFlowProperties.length,
      averageCashFlow: Math.round(avgCashFlow),
      averageROI: Math.round(avgROI * 100) / 100,
      assumptions: {
        downPaymentPercent: 10,
        interestRate: 5.0,
        loanTermYears: 30,
        defaultInsurance: 150
      }
    },
    topPerformers,
    marketAnalysis,
    allProperties: analyses
  };
  
  // Save to JSON file
  const fs = await import('fs/promises');
  const outputFile = `owner_finance_cash_flow_analysis_${new Date().toISOString().split('T')[0]}.json`;
  
  await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Analysis complete! Results saved to ${outputFile}`);
  
  // Save CSV of top performers for easy viewing
  const csvFile = `owner_finance_top_performers_${new Date().toISOString().split('T')[0]}.csv`;
  const csvHeaders = 'ZPID,Address,City,State,ZIP,Price,Rent,Cash Flow,ROI,Down Payment,Monthly Mortgage,Total Expenses,Bedrooms,Bathrooms,Year Built';
  const csvRows = topPerformers.map(p => 
    `${p.zpid},"${p.address}","${p.city}",${p.state},${p.zipCode},${p.price},${p.rentEstimate},${p.monthlyCashFlow},${p.cashOnCashReturn},${p.downPayment},${p.monthlyMortgage},${p.totalMonthlyExpenses},${p.bedrooms},${p.bathrooms},${p.yearBuilt}`
  );
  
  await fs.writeFile(csvFile, csvHeaders + '\n' + csvRows.join('\n'));
  console.log(`✅ Top performers saved to ${csvFile}`);
  
  console.log('\n=== SUMMARY ===');
  console.log(`• Found ${positiveFlowProperties.length} properties with positive cash flow`);
  console.log(`• ${topPerformers.length} properties with $200+ monthly cash flow`);
  console.log(`• Best property: $${Math.max(...topPerformers.map(p => p.monthlyCashFlow))}/month cash flow`);
  console.log(`• Analysis covers ${Object.keys(marketAnalysis.byState).length} states`);
}

// Run the analysis
runOwnerFinanceCashFlowAnalysis().catch(error => {
  console.error('💀 Fatal error:', error);
  process.exit(1);
});