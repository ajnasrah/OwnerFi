#!/usr/bin/env npx tsx
/**
 * ACTUALLY REALISTIC 15%+ ROI Properties
 * 
 * Filter for realistic rent-to-price ratios and proper data validation
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import * as fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

function calculateCashFlow(price: number, rent: number, annualTax: number, hoaFee: number = 0) {
  const downPayment = price * 0.10;
  const loanAmount = price * 0.90;
  
  const monthlyRate = 0.05 / 12;
  const numPayments = 30 * 12;
  const monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const monthlyTax = annualTax / 12;
  const monthlyInsurance = price < 200000 ? 150 : price < 500000 ? 200 : 300;
  
  const totalExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + hoaFee;
  const monthlyCashFlow = rent - totalExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const roi = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  
  return {
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    roi: Math.round(roi * 100) / 100,
    downPayment: Math.round(downPayment)
  };
}

function hasRealTaxData(property: any): { has: boolean; amount: number } {
  if (property.annualTaxAmount && property.annualTaxAmount > 0) {
    return { has: true, amount: property.annualTaxAmount };
  }
  
  if (property.propertyTaxRate && property.propertyTaxRate > 0 && property.price) {
    return { has: true, amount: property.price * (property.propertyTaxRate / 100) };
  }
  
  return { has: false, amount: 0 };
}

async function findActuallyRealisticDeals() {
  console.log('=== ACTUALLY REALISTIC 15%+ ROI DEALS ===\n');
  console.log('🎯 STRICT REALITY FILTERS:');
  console.log('• Price: $75,000 - $400,000 (real livable houses)');
  console.log('• Rent: $800+ but not crazy high');
  console.log('• Rent/Price ratio: 0.5% - 1.5% monthly (6% - 18% annually)');
  console.log('• ROI: 15% - 40% maximum');
  console.log('• At least 2br/1ba');
  console.log('• Built after 1950');
  console.log('• Real tax data\n');
  
  const { db } = getFirebaseAdmin();
  
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();
  
  console.log(`Checking ${snapshot.size} properties with strict filters...`);
  
  const deals: any[] = [];
  let processed = 0;
  let filtered = {
    noMLS: 0,
    inactive: 0,
    priceTooLow: 0,
    priceTooHigh: 0,
    rentTooLow: 0,
    rentRatioTooHigh: 0,
    noTaxData: 0,
    tooSmall: 0,
    tooOld: 0,
    roiTooLow: 0,
    roiTooHigh: 0,
    negativeCashFlow: 0,
    passed: 0
  };
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    processed++;
    
    // Basic filters
    if (!property.mlsId) {
      filtered.noMLS++;
      continue;
    }
    
    if (property.isActive === false || property.offMarketReason) {
      filtered.inactive++;
      continue;
    }
    
    if (!property.rentEstimate || !property.price) continue;
    
    // REALISTIC PRICE RANGE ($75k - $400k)
    if (property.price < 75000) {
      filtered.priceTooLow++;
      continue;
    }
    
    if (property.price > 400000) {
      filtered.priceTooHigh++;
      continue;
    }
    
    // REALISTIC RENT ($800+)
    if (property.rentEstimate < 800) {
      filtered.rentTooLow++;
      continue;
    }
    
    // REALISTIC RENT-TO-PRICE RATIO (0.5% - 1.5% monthly)
    const monthlyRentRatio = (property.rentEstimate / property.price) * 100;
    if (monthlyRentRatio < 0.5 || monthlyRentRatio > 1.5) {
      filtered.rentRatioTooHigh++;
      continue;
    }
    
    // Must have real tax data
    const taxCheck = hasRealTaxData(property);
    if (!taxCheck.has) {
      filtered.noTaxData++;
      continue;
    }
    
    // Must be at least 2br/1ba
    if ((property.bedrooms && property.bedrooms < 2) || (property.bathrooms && property.bathrooms < 1)) {
      filtered.tooSmall++;
      continue;
    }
    
    // Built after 1950
    if (property.yearBuilt && property.yearBuilt < 1950) {
      filtered.tooOld++;
      continue;
    }
    
    // Calculate cash flow
    const hoaFee = property.monthlyHoaFee || property.hoa || 0;
    const cashFlow = calculateCashFlow(property.price, property.rentEstimate, taxCheck.amount, hoaFee);
    
    // REALISTIC ROI RANGE (15% - 40%)
    if (cashFlow.roi < 15) {
      filtered.roiTooLow++;
      continue;
    }
    
    if (cashFlow.roi > 40) {
      filtered.roiTooHigh++;
      continue;
    }
    
    // MUST CASH FLOW POSITIVE
    if (cashFlow.monthlyCashFlow <= 0) {
      filtered.negativeCashFlow++;
      continue;
    }
    
    filtered.passed++;
    
    deals.push({
      zpid: property.zpid,
      address: property.fullAddress || property.streetAddress || property.address,
      city: property.city || 'Unknown',
      state: property.state || 'Unknown',
      price: property.price,
      rent: property.rentEstimate,
      rentRatio: monthlyRentRatio,
      ...cashFlow,
      mlsId: property.mlsId,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      yearBuilt: property.yearBuilt || 0,
      propertyType: property.propertyType || 'Unknown'
    });
    
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed}/${snapshot.size}, found ${deals.length} realistic deals...`);
    }
  }
  
  console.log('\n=== FILTERING RESULTS ===');
  console.log(`Total processed: ${processed}`);
  console.log(`No MLS: ${filtered.noMLS}`);
  console.log(`Inactive: ${filtered.inactive}`);
  console.log(`Price too low (<$75k): ${filtered.priceTooLow}`);
  console.log(`Price too high (>$400k): ${filtered.priceTooHigh}`);
  console.log(`Rent too low (<$800): ${filtered.rentTooLow}`);
  console.log(`Rent ratio too high (>1.5% monthly): ${filtered.rentRatioTooHigh}`);
  console.log(`No tax data: ${filtered.noTaxData}`);
  console.log(`Too small (<2br/1ba): ${filtered.tooSmall}`);
  console.log(`Too old (<1950): ${filtered.tooOld}`);
  console.log(`ROI too low (<15%): ${filtered.roiTooLow}`);
  console.log(`ROI too high (>40%): ${filtered.roiTooHigh}`);
  console.log(`Negative cash flow: ${filtered.negativeCashFlow}`);
  console.log(`✅ PASSED ALL FILTERS: ${filtered.passed}`);
  
  if (deals.length === 0) {
    console.log('\n❌ No properties met the strict realistic criteria');
    console.log('🤔 The rent estimates in the database might be garbage');
    return;
  }
  
  // Sort by ROI descending
  deals.sort((a, b) => b.roi - a.roi);
  
  console.log(`\n✅ FOUND ${deals.length} ACTUALLY REALISTIC DEALS\n`);
  
  // Show all of them if under 20, otherwise top 20
  const showCount = Math.min(deals.length, 20);
  console.log(`🏆 TOP ${showCount} ACTUALLY REALISTIC DEALS:`);
  
  deals.slice(0, showCount).forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.address}, ${deal.city}, ${deal.state}`);
    console.log(`   Price: $${deal.price.toLocaleString()} | Rent: $${deal.rent} (${deal.rentRatio.toFixed(1)}% monthly)`);
    console.log(`   ROI: ${deal.roi}% | Cash Flow: $${deal.monthlyCashFlow}/mo | ${deal.bedrooms}br/${deal.bathrooms}ba | ${deal.yearBuilt}`);
    console.log(`   Mortgage: $${deal.monthlyMortgage} | Tax: $${deal.monthlyTax} | Insurance: $${deal.monthlyInsurance}`);
    console.log('');
  });
  
  if (deals.length > 0) {
    // Create CSV
    const timestamp = new Date().toISOString().split('T')[0];
    const csvFile = `ACTUALLY_REALISTIC_DEALS_${timestamp}.csv`;
    
    const headers = 'ZPID,Address,City,State,Price,Monthly Rent,Rent Ratio %,ROI %,Monthly Cash Flow,Down Payment,Monthly Mortgage,Monthly Tax,Monthly Insurance,MLS ID,Bedrooms,Bathrooms,Year Built,Property Type';
    
    const rows = deals.map(d => 
      `${d.zpid},"${d.address}","${d.city}",${d.state},${d.price},${d.rent},${d.rentRatio.toFixed(2)},${d.roi},${d.monthlyCashFlow},${d.downPayment},${d.monthlyMortgage},${d.monthlyTax},${d.monthlyInsurance},${d.mlsId},${d.bedrooms},${d.bathrooms},${d.yearBuilt},"${d.propertyType}"`
    );
    
    await fs.writeFile(csvFile, headers + '\n' + rows.join('\n'));
    
    console.log(`\n🎯 REALISTIC DEALS: ${csvFile}`);
    console.log(`📊 ${deals.length} properties that actually make sense`);
    console.log(`🥇 Best ROI: ${deals[0].roi}% - ${deals[0].address}`);
    console.log(`💰 Average ROI: ${Math.round(deals.reduce((sum, d) => sum + d.roi, 0) / deals.length)}%`);
  }
  
  console.log('\n✅ These are ACTUALLY realistic numbers.');
}

findActuallyRealisticDeals().catch(console.error);