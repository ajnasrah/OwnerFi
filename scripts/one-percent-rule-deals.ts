#!/usr/bin/env npx tsx
/**
 * 1% Rule Deals: Monthly rent = 1% of purchase price
 * 
 * The classic real estate investing rule
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

async function findOnePercentRuleDeals() {
  console.log('=== 1% RULE DEALS ===\n');
  console.log('🎯 CRITERIA: Monthly rent = 1% of purchase price');
  console.log('📊 Range: 0.9% - 1.1% monthly (10.8% - 13.2% annually)');
  console.log('🏠 Price: $75,000 - $400,000');
  console.log('💰 15%+ ROI required\n');
  
  const { db } = getFirebaseAdmin();
  
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();
  
  console.log(`Checking ${snapshot.size} properties for 1% rule...`);
  
  const deals: any[] = [];
  let processed = 0;
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    processed++;
    
    // Basic filters
    if (!property.mlsId) continue;
    if (property.isActive === false || property.offMarketReason) continue;
    if (!property.rentEstimate || !property.price) continue;
    
    // Price range
    if (property.price < 75000 || property.price > 400000) continue;
    
    // 1% RULE: Monthly rent should be ~1% of price
    const monthlyRentRatio = (property.rentEstimate / property.price) * 100;
    
    // Allow 0.9% to 1.1% (close to 1% rule)
    if (monthlyRentRatio < 0.9 || monthlyRentRatio > 1.1) continue;
    
    // Must have real tax data
    const taxCheck = hasRealTaxData(property);
    if (!taxCheck.has) continue;
    
    // Calculate cash flow
    const hoaFee = property.monthlyHoaFee || property.hoa || 0;
    const cashFlow = calculateCashFlow(property.price, property.rentEstimate, taxCheck.amount, hoaFee);
    
    // Must have 15%+ ROI
    if (cashFlow.roi < 15) continue;
    
    // Must cash flow positive
    if (cashFlow.monthlyCashFlow <= 0) continue;
    
    deals.push({
      zpid: property.zpid,
      address: property.fullAddress || property.streetAddress || property.address,
      city: property.city || 'Unknown',
      state: property.state || 'Unknown',
      price: property.price,
      rent: property.rentEstimate,
      onePercentRatio: monthlyRentRatio,
      ...cashFlow,
      mlsId: property.mlsId,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      yearBuilt: property.yearBuilt || 0,
      propertyType: property.propertyType || 'Unknown'
    });
    
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed}/${snapshot.size}, found ${deals.length} 1% rule deals...`);
    }
  }
  
  // Sort by how close to 1% they are
  deals.sort((a, b) => Math.abs(1.0 - a.onePercentRatio) - Math.abs(1.0 - b.onePercentRatio));
  
  console.log(`\n✅ FOUND ${deals.length} PROPERTIES THAT MEET THE 1% RULE\n`);
  
  if (deals.length === 0) {
    console.log('❌ No properties found that meet the 1% rule with 15%+ ROI');
    return;
  }
  
  // Show all of them
  console.log('🏆 ALL 1% RULE PROPERTIES:');
  
  deals.forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.address}, ${deal.city}, ${deal.state}`);
    console.log(`   Price: $${deal.price.toLocaleString()} | Rent: $${deal.rent} (${deal.onePercentRatio.toFixed(2)}% monthly)`);
    console.log(`   ROI: ${deal.roi}% | Cash Flow: $${deal.monthlyCashFlow}/mo | ${deal.bedrooms}br/${deal.bathrooms}ba`);
    console.log(`   MLS: ${deal.mlsId} | Built: ${deal.yearBuilt} | ${deal.propertyType}`);
    console.log('');
  });
  
  // Create CSV
  const timestamp = new Date().toISOString().split('T')[0];
  const csvFile = `ONE_PERCENT_RULE_DEALS_${timestamp}.csv`;
  
  const headers = 'ZPID,Address,City,State,Price,Monthly Rent,1% Ratio,ROI %,Monthly Cash Flow,Down Payment,Monthly Mortgage,Monthly Tax,Monthly Insurance,MLS ID,Bedrooms,Bathrooms,Year Built,Property Type';
  
  const rows = deals.map(d => 
    `${d.zpid},"${d.address}","${d.city}",${d.state},${d.price},${d.rent},${d.onePercentRatio.toFixed(2)},${d.roi},${d.monthlyCashFlow},${d.downPayment},${d.monthlyMortgage},${d.monthlyTax},${d.monthlyInsurance},${d.mlsId},${d.bedrooms},${d.bathrooms},${d.yearBuilt},"${d.propertyType}"`
  );
  
  await fs.writeFile(csvFile, headers + '\n' + rows.join('\n'));
  
  console.log(`\n🎯 1% RULE DEALS: ${csvFile}`);
  console.log(`📊 ${deals.length} properties where monthly rent = ~1% of price`);
  
  if (deals.length > 0) {
    console.log(`🥇 Closest to 1%: ${deals[0].onePercentRatio.toFixed(2)}% - ${deals[0].address}`);
    console.log(`💰 Average ROI: ${Math.round(deals.reduce((sum, d) => sum + d.roi, 0) / deals.length)}%`);
    console.log(`🏠 Average Price: $${Math.round(deals.reduce((sum, d) => sum + d.price, 0) / deals.length).toLocaleString()}`);
  }
  
  console.log('\n✅ These follow the classic 1% rule of real estate investing.');
}

findOnePercentRuleDeals().catch(console.error);