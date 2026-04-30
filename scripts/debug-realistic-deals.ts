#!/usr/bin/env npx tsx
/**
 * DEBUG: What's wrong with the ROI calculations?
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

dotenv.config({ path: '.env.local' });

async function debugRealismCheck() {
  console.log('=== DEBUGGING UNREALISTIC ROI NUMBERS ===\n');
  
  const { db } = getFirebaseAdmin();
  
  // Get one of those "199% ROI" properties and break it down
  const doc = await db.collection('properties').doc('zpid_61969406').get(); // Baltimore property
  
  if (doc.exists) {
    const property = doc.data();
    
    console.log('🏠 PROPERTY BREAKDOWN:');
    console.log(`Address: ${property?.fullAddress}`);
    console.log(`Price: $${property?.price?.toLocaleString()}`);
    console.log(`Rent: $${property?.rentEstimate}`);
    console.log(`MLS: ${property?.mlsId}`);
    console.log(`Property Type: ${property?.propertyType}`);
    console.log(`Bedrooms: ${property?.bedrooms}`);
    console.log(`Bathrooms: ${property?.bathrooms}`);
    console.log(`Year Built: ${property?.yearBuilt}`);
    console.log(`Days on Zillow: ${property?.daysOnZillow}`);
    console.log(`Home Status: ${property?.homeStatus}`);
    console.log(`Is Active: ${property?.isActive}`);
    
    console.log('\n💰 TAX DATA:');
    console.log(`annualTaxAmount: ${property?.annualTaxAmount}`);
    console.log(`taxAnnualAmount: ${property?.taxAnnualAmount}`);
    console.log(`propertyTaxRate: ${property?.propertyTaxRate}`);
    
    console.log('\n🧮 MANUAL CALCULATION:');
    
    const price = property?.price || 0;
    const rent = property?.rentEstimate || 0;
    
    // Down payment
    const downPayment = price * 0.10;
    console.log(`Down Payment (10%): $${downPayment.toLocaleString()}`);
    
    // Loan amount
    const loanAmount = price * 0.90;
    console.log(`Loan Amount (90%): $${loanAmount.toLocaleString()}`);
    
    // Monthly mortgage (5%, 30 years)
    const monthlyRate = 0.05 / 12;
    const numPayments = 30 * 12;
    const monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                            (Math.pow(1 + monthlyRate, numPayments) - 1);
    console.log(`Monthly Mortgage (5%, 30yr): $${Math.round(monthlyMortgage)}`);
    
    // Taxes
    let monthlyTax = 0;
    if (property?.annualTaxAmount) {
      monthlyTax = property.annualTaxAmount / 12;
      console.log(`Monthly Tax (real data): $${Math.round(monthlyTax)}`);
    } else if (property?.propertyTaxRate) {
      const annualTax = price * (property.propertyTaxRate / 100);
      monthlyTax = annualTax / 12;
      console.log(`Monthly Tax (calculated from rate): $${Math.round(monthlyTax)} (${property.propertyTaxRate}% rate)`);
    }
    
    // Insurance
    const monthlyInsurance = price < 200000 ? 150 : 200;
    console.log(`Monthly Insurance (estimate): $${monthlyInsurance}`);
    
    // HOA
    const monthlyHOA = property?.monthlyHoaFee || property?.hoa || 0;
    console.log(`Monthly HOA: $${monthlyHOA}`);
    
    // Total expenses
    const totalExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
    console.log(`\nTotal Monthly Expenses: $${Math.round(totalExpenses)}`);
    
    // Cash flow
    const monthlyCashFlow = rent - totalExpenses;
    console.log(`Monthly Cash Flow: $${rent} - $${Math.round(totalExpenses)} = $${Math.round(monthlyCashFlow)}`);
    
    // Annual cash flow
    const annualCashFlow = monthlyCashFlow * 12;
    console.log(`Annual Cash Flow: $${Math.round(annualCashFlow)}`);
    
    // ROI
    const roi = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
    console.log(`ROI: $${Math.round(annualCashFlow)} / $${Math.round(downPayment)} = ${roi.toFixed(2)}%`);
    
    console.log('\n🚨 REALITY CHECK:');
    
    // Check if rent is realistic
    const rentToPrice = (rent / price) * 100;
    console.log(`Rent/Price ratio: ${rentToPrice.toFixed(2)}% per month (${(rentToPrice * 12).toFixed(2)}% per year)`);
    
    if (rentToPrice > 2) {
      console.log('❌ RENT TOO HIGH - No way this property rents for that much');
    }
    
    if (roi > 50) {
      console.log('❌ ROI TOO HIGH - Something is wrong with the data');
    }
    
    if (price < 70000) {
      console.log('❌ PRICE TOO LOW - Probably vacant land, condemned, or bad data');
    }
    
    if (monthlyTax < 50) {
      console.log('❌ TAXES TOO LOW - Probably missing real tax data');
    }
    
  } else {
    console.log('Property not found');
  }
  
  console.log('\n=== CHECKING SAMPLE OF "HIGH ROI" PROPERTIES ===\n');
  
  // Check a few more properties
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .limit(20)
    .get();
  
  let checkedCount = 0;
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    
    if (!property.price || property.price < 50000 || property.price > 500000) continue;
    if (!property.rentEstimate || property.rentEstimate < 800) continue;
    if (!property.mlsId) continue;
    
    const rentToPrice = (property.rentEstimate / property.price) * 100 * 12; // Annual rent/price ratio
    
    if (rentToPrice > 20) { // More than 20% annually is suspicious
      console.log(`🚨 SUSPICIOUS: ${property.fullAddress}`);
      console.log(`   Price: $${property.price.toLocaleString()} | Rent: $${property.rentEstimate} | Ratio: ${rentToPrice.toFixed(1)}% annually`);
      console.log(`   MLS: ${property.mlsId} | Type: ${property.propertyType} | Built: ${property.yearBuilt}`);
      console.log('');
      
      checkedCount++;
      if (checkedCount >= 5) break;
    }
  }
}

debugRealismCheck().catch(console.error);