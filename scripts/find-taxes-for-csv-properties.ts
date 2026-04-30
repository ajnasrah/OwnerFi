#!/usr/bin/env npx tsx
/**
 * Find Real Tax Data for Specific CSV Properties
 * 
 * Takes the properties from your existing CSV and finds ACTUAL tax data for each one
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import * as fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

interface CSVProperty {
  zpid: string;
  address: string;
  city: string;
  state: string;
  price: number;
  rentEstimate: number;
  currentTaxAmount: number; // What's currently in the CSV
}

interface TaxLookupResult {
  success: boolean;
  annualTaxAmount: number;
  source: string;
  error?: string;
}

async function lookupPropertyTaxes(property: any): Promise<TaxLookupResult> {
  // Priority 1: Check annualTaxAmount
  if (property.annualTaxAmount && property.annualTaxAmount > 0) {
    return {
      success: true,
      annualTaxAmount: property.annualTaxAmount,
      source: 'annualTaxAmount'
    };
  }

  // Priority 2: Check taxAnnualAmount 
  if (property.taxAnnualAmount && property.taxAnnualAmount > 0) {
    return {
      success: true,
      annualTaxAmount: property.taxAnnualAmount,
      source: 'taxAnnualAmount'
    };
  }

  // Priority 3: Check propertyTaxRate
  if (property.propertyTaxRate && property.propertyTaxRate > 0 && property.price) {
    const calculatedTax = property.price * (property.propertyTaxRate / 100);
    return {
      success: true,
      annualTaxAmount: calculatedTax,
      source: 'propertyTaxRate'
    };
  }

  // Priority 4: Tax history
  if (property.taxHistory && Array.isArray(property.taxHistory) && property.taxHistory.length > 0) {
    const latestTax = property.taxHistory.find((t: any) => t.taxPaid && t.taxPaid > 0);
    if (latestTax) {
      return {
        success: true,
        annualTaxAmount: latestTax.taxPaid,
        source: 'taxHistory'
      };
    }
  }

  // Priority 5: Assessment-based calculation
  if (property.taxAssessment && property.taxAssessment > 0 && property.priceForHDP) {
    const assessmentRatio = property.taxAssessment / property.priceForHDP;
    if (assessmentRatio > 0.005 && assessmentRatio < 0.05) { // Reasonable range
      return {
        success: true,
        annualTaxAmount: property.price * assessmentRatio,
        source: 'assessmentRatio'
      };
    }
  }

  // Priority 6: Look in mortgage details
  if (property.mortgageData && property.mortgageData.propertyTax) {
    return {
      success: true,
      annualTaxAmount: property.mortgageData.propertyTax * 12, // Monthly to annual
      source: 'mortgageData'
    };
  }

  // Priority 7: Look in Zestimate data
  if (property.zestimate && property.zestimate.taxHistory && Array.isArray(property.zestimate.taxHistory)) {
    const latestTax = property.zestimate.taxHistory[0];
    if (latestTax && latestTax.amount) {
      return {
        success: true,
        annualTaxAmount: latestTax.amount,
        source: 'zestimate.taxHistory'
      };
    }
  }

  return {
    success: false,
    annualTaxAmount: 0,
    source: 'none',
    error: 'No real tax data found in any field'
  };
}

async function findTaxesForCSVProperties() {
  console.log('=== FINDING REAL TAX DATA FOR YOUR CSV PROPERTIES ===\n');
  
  // Parse your existing CSV
  const csvContent = await fs.readFile('/Users/abdullahabunasrah/Desktop/ownerfi/owner_finance_top_performers_2026-04-30.csv', 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  
  const csvProperties: CSVProperty[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    if (values.length < 3) continue;
    
    const zpid = values[0];
    const address = values[1].replace(/"/g, '');
    const city = values[2].replace(/"/g, '');
    const state = values[3];
    const price = parseInt(values[5]) || 0;
    const rentEstimate = parseInt(values[6]) || 0;
    const currentTaxAmount = parseInt(values[17]) || 0;
    
    csvProperties.push({
      zpid,
      address,
      city, 
      state,
      price,
      rentEstimate,
      currentTaxAmount
    });
  }
  
  console.log(`Found ${csvProperties.length} properties in your CSV file`);
  console.log(`Properties currently missing tax data: ${csvProperties.filter(p => p.currentTaxAmount === 0).length}\n`);

  const { db } = getFirebaseAdmin();
  
  const results: any[] = [];
  let foundTaxData = 0;
  let stillMissingTaxData = 0;

  for (const csvProp of csvProperties) {
    console.log(`\nProcessing ZPID ${csvProp.zpid}: ${csvProp.address}`);
    console.log(`  Current tax amount in CSV: $${csvProp.currentTaxAmount}`);
    
    // Get property from Firestore
    const doc = await db.collection('properties').doc(`zpid_${csvProp.zpid}`).get();
    
    if (!doc.exists) {
      console.log(`  ❌ Property not found in database`);
      results.push({
        ...csvProp,
        foundTaxData: false,
        error: 'Property not found in database'
      });
      stillMissingTaxData++;
      continue;
    }
    
    const property = doc.data();
    const taxLookup = await lookupPropertyTaxes(property);
    
    if (taxLookup.success) {
      console.log(`  ✅ Found real tax data: $${taxLookup.annualTaxAmount.toFixed(2)} (${taxLookup.source})`);
      console.log(`  📊 Monthly tax: $${(taxLookup.annualTaxAmount / 12).toFixed(2)}`);
      
      // Recalculate cash flow with real tax data
      const downPayment = csvProp.price * 0.10;
      const loanAmount = csvProp.price * 0.90;
      const monthlyMortgage = calculateMortgagePayment(loanAmount, 0.05, 30);
      const monthlyTax = taxLookup.annualTaxAmount / 12;
      const monthlyInsurance = estimateInsurance(csvProp.price);
      const monthlyHOA = property.monthlyHoaFee || property.hoa || 0;
      
      const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
      const monthlyCashFlow = csvProp.rentEstimate - totalMonthlyExpenses;
      const annualCashFlow = monthlyCashFlow * 12;
      const cashOnCashReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
      
      console.log(`  💰 Updated cash flow: $${monthlyCashFlow.toFixed(2)}/month (was estimate before)`);
      
      results.push({
        ...csvProp,
        foundTaxData: true,
        realAnnualTaxAmount: Math.round(taxLookup.annualTaxAmount),
        realMonthlyTax: Math.round(monthlyTax),
        taxSource: taxLookup.source,
        updatedMonthlyCashFlow: Math.round(monthlyCashFlow),
        updatedAnnualCashFlow: Math.round(annualCashFlow),
        updatedROI: Math.round(cashOnCashReturn * 100) / 100,
        monthlyMortgage: Math.round(monthlyMortgage),
        monthlyInsurance: Math.round(monthlyInsurance),
        monthlyHOA: Math.round(monthlyHOA),
        totalMonthlyExpenses: Math.round(totalMonthlyExpenses)
      });
      
      foundTaxData++;
    } else {
      console.log(`  ❌ Still no real tax data found: ${taxLookup.error}`);
      results.push({
        ...csvProp,
        foundTaxData: false,
        error: taxLookup.error
      });
      stillMissingTaxData++;
    }
    
    // Small delay to be nice to the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total properties in CSV: ${csvProperties.length}`);
  console.log(`Found real tax data for: ${foundTaxData} properties`);
  console.log(`Still missing tax data: ${stillMissingTaxData} properties`);
  
  // Tax source breakdown for found data
  const taxSources = results.filter(r => r.foundTaxData).reduce((acc, r) => {
    acc[r.taxSource] = (acc[r.taxSource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n=== TAX DATA SOURCES ===');
  Object.entries(taxSources).forEach(([source, count]) => {
    console.log(`${source}: ${count} properties`);
  });
  
  // Show properties with the biggest cash flow changes
  const withUpdatedFlow = results.filter(r => r.foundTaxData && r.updatedMonthlyCashFlow);
  withUpdatedFlow.sort((a, b) => b.updatedMonthlyCashFlow - a.updatedMonthlyCashFlow);
  
  console.log('\n=== TOP PERFORMERS WITH REAL TAX DATA ===');
  withUpdatedFlow.slice(0, 10).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
    console.log(`   ZPID: ${prop.zpid} | Price: $${prop.price.toLocaleString()}`);
    console.log(`   Rent: $${prop.rentEstimate} | Updated Cash Flow: $${prop.updatedMonthlyCashFlow}/mo | ROI: ${prop.updatedROI}%`);
    console.log(`   Real Tax: $${prop.realMonthlyTax}/mo (${prop.taxSource}) vs CSV: $${Math.round(prop.currentTaxAmount/12)}/mo`);
    console.log('');
  });
  
  // Export updated CSV with real tax data
  const timestamp = new Date().toISOString().split('T')[0];
  const updatedCSVFile = `csv_properties_with_real_taxes_${timestamp}.csv`;
  
  const csvHeaders = 'ZPID,Address,City,State,Price,Rent Estimate,Found Real Tax Data,Real Annual Tax,Real Monthly Tax,Tax Source,CSV Tax Amount,Updated Monthly Cash Flow,Updated Annual Cash Flow,Updated ROI %,Monthly Mortgage,Monthly Insurance,Monthly HOA,Total Monthly Expenses,Error';
  
  const csvRows = results.map(p => {
    if (p.foundTaxData) {
      return `${p.zpid},"${p.address}","${p.city}",${p.state},${p.price},${p.rentEstimate},YES,${p.realAnnualTaxAmount},${p.realMonthlyTax},${p.taxSource},${p.currentTaxAmount},${p.updatedMonthlyCashFlow},${p.updatedAnnualCashFlow},${p.updatedROI},${p.monthlyMortgage},${p.monthlyInsurance},${p.monthlyHOA},${p.totalMonthlyExpenses},""`;
    } else {
      return `${p.zpid},"${p.address}","${p.city}",${p.state},${p.price},${p.rentEstimate},NO,0,0,"none",${p.currentTaxAmount},0,0,0,0,0,0,0,"${p.error}"`;
    }
  });
  
  await fs.writeFile(updatedCSVFile, csvHeaders + '\n' + csvRows.join('\n'));
  
  console.log(`\n✅ Updated CSV saved to: ${updatedCSVFile}`);
  console.log(`🎯 ${foundTaxData} properties now have REAL tax data instead of estimates`);
  console.log(`❌ ${stillMissingTaxData} properties still need tax data lookup from external sources`);
}

function calculateMortgagePayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) return principal / numPayments;
  
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function estimateInsurance(price: number): number {
  if (price < 100000) return 100;
  if (price < 200000) return 150;
  if (price < 300000) return 200;
  if (price < 400000) return 250;
  if (price < 500000) return 300;
  if (price < 750000) return 400;
  return 500;
}

findTaxesForCSVProperties().catch(error => {
  console.error('💀 Fatal error:', error);
  process.exit(1);
});