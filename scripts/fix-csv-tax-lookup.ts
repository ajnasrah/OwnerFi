#!/usr/bin/env npx tsx
/**
 * Fixed CSV Tax Lookup with Proper Parsing
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
  zip: string;
  price: number;
  rentEstimate: number;
  currentTaxAmount: number;
  propertyType: string;
}

async function parseCSVCorrectly(csvPath: string): Promise<CSVProperty[]> {
  const content = await fs.readFile(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const properties: CSVProperty[] = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    // Proper CSV parsing to handle quoted values
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add the last value
    
    if (values.length >= 22) {
      const zpid = values[0];
      const address = values[1].replace(/"/g, '');
      const city = values[2].replace(/"/g, '');
      const state = values[3];
      const zip = values[4];
      const price = parseInt(values[5]) || 0;
      const rentEstimate = parseInt(values[6]) || 0;
      const currentTaxAmount = parseInt(values[17]) || 0;
      const propertyType = values[22].replace(/"/g, '');
      
      properties.push({
        zpid,
        address,
        city,
        state,
        zip,
        price,
        rentEstimate,
        currentTaxAmount,
        propertyType
      });
    }
  }
  
  return properties;
}

async function lookupTaxes(property: any): Promise<{ success: boolean; amount: number; source: string }> {
  // Look for real tax data in order of preference
  const checks = [
    { field: 'annualTaxAmount', name: 'annualTaxAmount' },
    { field: 'taxAnnualAmount', name: 'taxAnnualAmount' },
  ];
  
  for (const check of checks) {
    const value = property[check.field];
    if (value && value > 0) {
      return { success: true, amount: value, source: check.name };
    }
  }
  
  // Check propertyTaxRate
  if (property.propertyTaxRate && property.propertyTaxRate > 0 && property.price) {
    const calculatedTax = property.price * (property.propertyTaxRate / 100);
    return { success: true, amount: calculatedTax, source: 'propertyTaxRate' };
  }
  
  // Check tax history
  if (property.taxHistory && Array.isArray(property.taxHistory)) {
    for (const tax of property.taxHistory) {
      if (tax.taxPaid && tax.taxPaid > 0) {
        return { success: true, amount: tax.taxPaid, source: 'taxHistory' };
      }
    }
  }
  
  return { success: false, amount: 0, source: 'none' };
}

function calculateCashFlow(price: number, rent: number, annualTax: number, hoaFee: number = 0) {
  const downPayment = price * 0.10;
  const loanAmount = price * 0.90;
  
  // Calculate monthly mortgage payment (5%, 30 years)
  const monthlyRate = 0.05 / 12;
  const numPayments = 30 * 12;
  const monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const monthlyTax = annualTax / 12;
  const monthlyInsurance = price < 200000 ? 150 : price < 400000 ? 200 : 300;
  const monthlyHOA = hoaFee;
  
  const totalExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
  const monthlyCashFlow = rent - totalExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const roi = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  
  return {
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyHOA: Math.round(monthlyHOA),
    totalExpenses: Math.round(totalExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    roi: Math.round(roi * 100) / 100,
    downPayment: Math.round(downPayment)
  };
}

async function fixCSVTaxLookup() {
  console.log('=== FIXED CSV TAX LOOKUP ===\n');
  
  const csvPath = '/Users/abdullahabunasrah/Desktop/ownerfi/owner_finance_top_performers_2026-04-30.csv';
  const csvProperties = await parseCSVCorrectly(csvPath);
  
  console.log(`Parsed ${csvProperties.length} properties from CSV`);
  console.log(`Properties currently with $0 taxes: ${csvProperties.filter(p => p.currentTaxAmount === 0).length}\n`);
  
  const { db } = getFirebaseAdmin();
  const results: any[] = [];
  
  for (const csvProp of csvProperties) {
    console.log(`\nChecking ZPID ${csvProp.zpid}: ${csvProp.address}`);
    console.log(`  Current: $${csvProp.currentTaxAmount} annual tax`);
    
    const doc = await db.collection('properties').doc(`zpid_${csvProp.zpid}`).get();
    
    if (!doc.exists) {
      console.log(`  ❌ Not found in database`);
      results.push({ ...csvProp, found: false, error: 'Not found' });
      continue;
    }
    
    const property = doc.data();
    const taxLookup = await lookupTaxes(property);
    
    if (taxLookup.success) {
      console.log(`  ✅ Real tax: $${taxLookup.amount.toFixed(2)} (${taxLookup.source})`);
      
      const hoaFee = property.monthlyHoaFee || property.hoa || 0;
      const cashFlow = calculateCashFlow(csvProp.price, csvProp.rentEstimate, taxLookup.amount, hoaFee);
      
      console.log(`  💰 Updated cash flow: $${cashFlow.monthlyCashFlow}/month | ROI: ${cashFlow.roi}%`);
      console.log(`  📊 Tax: $${cashFlow.monthlyTax}/mo | Insurance: $${cashFlow.monthlyInsurance}/mo | HOA: $${cashFlow.monthlyHOA}/mo`);
      
      results.push({
        ...csvProp,
        found: true,
        realAnnualTax: Math.round(taxLookup.amount),
        taxSource: taxLookup.source,
        ...cashFlow
      });
    } else {
      console.log(`  ❌ No real tax data found`);
      results.push({ ...csvProp, found: false, error: 'No tax data' });
    }
  }
  
  // Summary
  const foundCount = results.filter(r => r.found).length;
  const notFoundCount = results.length - foundCount;
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total properties: ${results.length}`);
  console.log(`Found real tax data: ${foundCount}`);
  console.log(`Still missing: ${notFoundCount}`);
  
  // Top performers with real tax data
  const withRealTax = results.filter(r => r.found && r.monthlyCashFlow > 0);
  withRealTax.sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow);
  
  console.log('\n=== TOP PERFORMERS WITH REAL TAX DATA ===');
  withRealTax.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
    console.log(`   ZPID: ${prop.zpid} | Price: $${prop.price.toLocaleString()}`);
    console.log(`   Rent: $${prop.rentEstimate} | Cash Flow: $${prop.monthlyCashFlow}/mo | ROI: ${prop.roi}%`);
    console.log(`   Real Tax: $${prop.monthlyTax}/mo (${prop.taxSource}) vs CSV: $${Math.round(prop.currentTaxAmount/12)}/mo`);
    console.log('');
  });
  
  // Export corrected CSV
  const timestamp = new Date().toISOString().split('T')[0];
  const outputFile = `corrected_csv_with_real_taxes_${timestamp}.csv`;
  
  const headers = 'ZPID,Address,City,State,ZIP,Price,Rent,Property Type,Found Tax Data,Real Annual Tax,Tax Source,CSV Tax,Monthly Mortgage,Monthly Tax,Monthly Insurance,Monthly HOA,Total Expenses,Monthly Cash Flow,Annual Cash Flow,ROI %,Down Payment';
  
  const rows = results.map(p => {
    if (p.found) {
      return `${p.zpid},"${p.address}","${p.city}",${p.state},${p.zip},${p.price},${p.rentEstimate},"${p.propertyType}",YES,${p.realAnnualTax},${p.taxSource},${p.currentTaxAmount},${p.monthlyMortgage},${p.monthlyTax},${p.monthlyInsurance},${p.monthlyHOA},${p.totalExpenses},${p.monthlyCashFlow},${p.annualCashFlow},${p.roi},${p.downPayment}`;
    } else {
      return `${p.zpid},"${p.address}","${p.city}",${p.state},${p.zip},${p.price},${p.rentEstimate},"${p.propertyType}",NO,0,"none",${p.currentTaxAmount},0,0,0,0,0,0,0,0,0`;
    }
  });
  
  await fs.writeFile(outputFile, headers + '\n' + rows.join('\n'));
  
  console.log(`✅ Corrected CSV saved to: ${outputFile}`);
  console.log(`🎯 ${foundCount} properties now have verified real tax data`);
}

fixCSVTaxLookup().catch(console.error);