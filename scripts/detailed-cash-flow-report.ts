#!/usr/bin/env npx tsx
/**
 * DETAILED Owner Finance Cash Flow Report
 * 
 * Shows FULL expense breakdown including taxes, insurance, HOA for every property
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

dotenv.config({ path: '.env.local' });

interface DetailedPropertyReport {
  // Property Info
  zpid: string;
  fullAddress: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  rentEstimate: number;
  
  // Raw Financial Data from Database
  annualTaxAmount: number;
  annualHomeownersInsurance: number;
  monthlyHoaFee: number;
  
  // Investment Assumptions
  downPayment: number;
  loanAmount: number;
  
  // Monthly Expense Breakdown
  monthlyMortgage: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyHOA: number;
  totalMonthlyExpenses: number;
  
  // Cash Flow Analysis
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  
  // Flags
  hasRealTaxData: boolean;
  hasRealInsuranceData: boolean;
  hasHOAData: boolean;
}

function calculateMortgagePayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) return principal / numPayments;
  
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function analyzePropertyDetailed(property: any): DetailedPropertyReport | null {
  if (!property.price || !property.rentEstimate || property.price <= 0 || property.rentEstimate <= 0) {
    return null;
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
  
  // Tax calculation
  const hasRealTaxData = !!(property.annualTaxAmount && property.annualTaxAmount > 0);
  const monthlyTax = hasRealTaxData ? property.annualTaxAmount / 12 : 0;
  
  // Insurance calculation  
  const hasRealInsuranceData = !!(property.annualHomeownersInsurance && property.annualHomeownersInsurance > 0);
  const monthlyInsurance = hasRealInsuranceData ? 
    property.annualHomeownersInsurance / 12 : 
    defaultInsurance;
  
  // HOA calculation
  const hasHOAData = !!(property.monthlyHoaFee || property.hoa);
  const monthlyHOA = property.monthlyHoaFee || property.hoa || 0;
  
  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
  const monthlyCashFlow = property.rentEstimate - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  
  return {
    // Property Info
    zpid: property.zpid || 'Unknown',
    fullAddress: property.fullAddress || property.streetAddress || property.address || 'Unknown Address',
    city: property.city || 'Unknown',
    state: property.state || 'Unknown',
    zipCode: property.zipCode || 'Unknown',
    price: property.price,
    rentEstimate: property.rentEstimate,
    
    // Raw Financial Data
    annualTaxAmount: property.annualTaxAmount || 0,
    annualHomeownersInsurance: property.annualHomeownersInsurance || 0,
    monthlyHoaFee: property.monthlyHoaFee || property.hoa || 0,
    
    // Investment Calculations
    downPayment: Math.round(downPayment),
    loanAmount: Math.round(loanAmount),
    
    // Monthly Expenses
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyHOA: Math.round(monthlyHOA),
    totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
    
    // Cash Flow
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
    
    // Data Quality Flags
    hasRealTaxData,
    hasRealInsuranceData,
    hasHOAData
  };
}

async function generateDetailedCashFlowReport() {
  console.log('=== DETAILED OWNER FINANCE CASH FLOW REPORT ===\n');
  console.log('Investment Assumptions:');
  console.log('• 10% down payment');
  console.log('• 5% interest rate, 30 year loan');
  console.log('• $150/month default insurance (when real data unavailable)');
  console.log('• Using REAL tax, insurance, HOA data from Zillow when available\n');
  
  const { db } = getFirebaseAdmin();
  
  // Query owner finance properties
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .get();
  
  console.log(`Found ${snapshot.size} owner finance properties\n`);
  
  const reports: DetailedPropertyReport[] = [];
  let totalAnalyzed = 0;
  let dataQuality = {
    withRealTaxes: 0,
    withRealInsurance: 0,
    withHOA: 0,
    positiveCashFlow: 0,
    over200CashFlow: 0
  };
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    totalAnalyzed++;
    
    // Filter for analyzable properties
    if (!property.rentEstimate || property.rentEstimate <= 0) continue;
    if (!property.price || property.price <= 0) continue;
    if (property.propertyType && !property.propertyType.toLowerCase().includes('single family')) continue;
    if (property.yearBuilt && property.yearBuilt < 1970) continue;
    if ((property.bedrooms && property.bedrooms < 2) || (property.bathrooms && property.bathrooms < 1)) continue;
    
    const report = analyzePropertyDetailed(property);
    if (report) {
      reports.push(report);
      
      // Track data quality
      if (report.hasRealTaxData) dataQuality.withRealTaxes++;
      if (report.hasRealInsuranceData) dataQuality.withRealInsurance++;
      if (report.hasHOAData) dataQuality.withHOAData++;
      if (report.monthlyCashFlow > 0) dataQuality.positiveCashFlow++;
      if (report.monthlyCashFlow > 200) dataQuality.over200CashFlow++;
    }
  }
  
  console.log('=== DATA QUALITY SUMMARY ===');
  console.log(`Properties analyzed: ${reports.length}`);
  console.log(`Properties with REAL tax data: ${dataQuality.withRealTaxes} (${Math.round(dataQuality.withRealTaxes/reports.length*100)}%)`);
  console.log(`Properties with REAL insurance data: ${dataQuality.withRealInsurance} (${Math.round(dataQuality.withRealInsurance/reports.length*100)}%)`);
  console.log(`Properties with HOA data: ${dataQuality.withHOAData} (${Math.round(dataQuality.withHOAData/reports.length*100)}%)`);
  console.log(`Properties with positive cash flow: ${dataQuality.positiveCashFlow} (${Math.round(dataQuality.positiveCashFlow/reports.length*100)}%)`);
  console.log(`Properties with $200+ cash flow: ${dataQuality.over200CashFlow} (${Math.round(dataQuality.over200CashFlow/reports.length*100)}%)`);
  console.log('');
  
  // Sort by cash flow
  const sortedReports = reports.sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow);
  
  // Show top 10 with FULL expense breakdown
  console.log('=== TOP 10 CASH FLOW PROPERTIES (FULL EXPENSE BREAKDOWN) ===\n');
  
  sortedReports.slice(0, 10).forEach((report, i) => {
    console.log(`${i + 1}. ${report.fullAddress}`);
    console.log(`   ${report.city}, ${report.state} ${report.zipCode}`);
    console.log(`   ZPID: ${report.zpid}`);
    console.log('');
    console.log(`   INVESTMENT DETAILS:`);
    console.log(`   • Purchase Price: $${report.price.toLocaleString()}`);
    console.log(`   • Down Payment (10%): $${report.downPayment.toLocaleString()}`);
    console.log(`   • Loan Amount: $${report.loanAmount.toLocaleString()}`);
    console.log('');
    console.log(`   MONTHLY INCOME & EXPENSES:`);
    console.log(`   • Rental Income: $${report.rentEstimate.toLocaleString()}`);
    console.log(`   • Mortgage Payment: $${report.monthlyMortgage.toLocaleString()}`);
    console.log(`   • Property Taxes: $${report.monthlyTax.toLocaleString()} ${report.hasRealTaxData ? '(REAL data)' : '(NO TAX DATA)'}`);
    console.log(`   • Insurance: $${report.monthlyInsurance.toLocaleString()} ${report.hasRealInsuranceData ? '(REAL data)' : '(DEFAULT $150)'}`);
    console.log(`   • HOA Fees: $${report.monthlyHOA.toLocaleString()} ${report.hasHOAData ? '(REAL data)' : '(No HOA)'}`);
    console.log(`   • TOTAL EXPENSES: $${report.totalMonthlyExpenses.toLocaleString()}`);
    console.log('');
    console.log(`   CASH FLOW ANALYSIS:`);
    console.log(`   • Monthly Cash Flow: $${report.monthlyCashFlow.toLocaleString()}`);
    console.log(`   • Annual Cash Flow: $${report.annualCashFlow.toLocaleString()}`);
    console.log(`   • Cash-on-Cash Return: ${report.cashOnCashReturn}%`);
    console.log('');
    console.log(`   RAW DATABASE VALUES:`);
    console.log(`   • Annual Tax Amount: $${report.annualTaxAmount.toLocaleString()}`);
    console.log(`   • Annual Insurance: $${report.annualHomeownersInsurance.toLocaleString()}`);
    console.log(`   • Monthly HOA: $${report.monthlyHoaFee.toLocaleString()}`);
    console.log('');
    console.log('   ' + '='.repeat(70));
    console.log('');
  });
  
  // Show properties with missing expense data
  console.log('=== PROPERTIES WITH MISSING EXPENSE DATA ===\n');
  
  const missingTaxData = sortedReports.filter(r => !r.hasRealTaxData && r.monthlyCashFlow > 200).slice(0, 5);
  const missingInsuranceData = sortedReports.filter(r => !r.hasRealInsuranceData && r.monthlyCashFlow > 200).slice(0, 5);
  
  console.log(`Properties with HIGH cash flow but NO TAX DATA (${missingTaxData.length} shown):`);
  missingTaxData.forEach(r => {
    console.log(`  • ${r.fullAddress} - $${r.monthlyCashFlow}/mo (WARNING: No real tax data!)`);
  });
  
  console.log(`\nProperties with HIGH cash flow but NO INSURANCE DATA (${missingInsuranceData.length} shown):`);
  missingInsuranceData.forEach(r => {
    console.log(`  • ${r.fullAddress} - $${r.monthlyCashFlow}/mo (WARNING: Using $150 default insurance!)`);
  });
  
  // Save detailed report
  const fs = await import('fs/promises');
  const outputFile = `detailed_owner_finance_report_${new Date().toISOString().split('T')[0]}.json`;
  
  const fullReport = {
    metadata: {
      analysisDate: new Date().toISOString(),
      totalPropertiesAnalyzed: reports.length,
      dataQuality,
      assumptions: {
        downPaymentPercent: 10,
        interestRate: 5.0,
        loanTermYears: 30,
        defaultInsurance: 150
      }
    },
    properties: sortedReports
  };
  
  await fs.writeFile(outputFile, JSON.stringify(fullReport, null, 2));
  console.log(`\n✅ Detailed report saved to ${outputFile}`);
  
  // Save CSV with ALL expense details
  const csvFile = `detailed_expenses_breakdown_${new Date().toISOString().split('T')[0]}.csv`;
  const csvHeaders = 'ZPID,Address,City,State,Price,Rent,Down Payment,Loan Amount,Monthly Mortgage,Monthly Tax,Monthly Insurance,Monthly HOA,Total Expenses,Monthly Cash Flow,Annual Cash Flow,ROI,Has Real Tax Data,Has Real Insurance Data,Has HOA Data,Annual Tax Amount,Annual Insurance Amount';
  const csvRows = sortedReports.slice(0, 50).map(r => 
    `${r.zpid},"${r.fullAddress}","${r.city}",${r.state},${r.price},${r.rentEstimate},${r.downPayment},${r.loanAmount},${r.monthlyMortgage},${r.monthlyTax},${r.monthlyInsurance},${r.monthlyHOA},${r.totalMonthlyExpenses},${r.monthlyCashFlow},${r.annualCashFlow},${r.cashOnCashReturn},${r.hasRealTaxData},${r.hasRealInsuranceData},${r.hasHOAData},${r.annualTaxAmount},${r.annualHomeownersInsurance}`
  );
  
  await fs.writeFile(csvFile, csvHeaders + '\n' + csvRows.join('\n'));
  console.log(`✅ Detailed CSV saved to ${csvFile}`);
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`✅ TAXES: ${dataQuality.withRealTaxes}/${reports.length} properties have real tax data`);
  console.log(`✅ INSURANCE: ${dataQuality.withRealInsurance}/${reports.length} properties have real insurance data`);  
  console.log(`✅ HOA: ${dataQuality.withHOAData}/${reports.length} properties have HOA data`);
  console.log(`💰 CASH FLOW: ${dataQuality.positiveCashFlow} properties are profitable`);
}

generateDetailedCashFlowReport().catch(error => {
  console.error('💀 Fatal error:', error);
  process.exit(1);
});