#!/usr/bin/env npx tsx
/**
 * Above 1% Rule Deals: Monthly rent > 1% of purchase price
 * 
 * Find properties that beat the 1% rule
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

async function findAboveOnePercentDeals() {
  console.log('=== ABOVE 1% RULE DEALS ===\n');
  console.log('🎯 CRITERIA: Monthly rent > 1.1% of purchase price');
  console.log('📊 Examples: $90k house renting for $1,300+ (1.4%+)');
  console.log('🏠 Price: $75,000 - $400,000');
  console.log('💰 15%+ ROI required\n');
  
  const { db } = getFirebaseAdmin();
  
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();
  
  console.log(`Checking ${snapshot.size} properties for ABOVE 1% rule...`);
  
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
    
    // ABOVE 1% RULE: Monthly rent should be > 1.1% of price
    const monthlyRentRatio = (property.rentEstimate / property.price) * 100;
    
    // Looking for 1.1%+ (better than 1% rule)
    if (monthlyRentRatio <= 1.1) continue;
    
    // Cap at 2% to avoid crazy numbers
    if (monthlyRentRatio > 2.0) continue;
    
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
      rentRatio: monthlyRentRatio,
      ...cashFlow,
      mlsId: property.mlsId,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      yearBuilt: property.yearBuilt || 0,
      propertyType: property.propertyType || 'Unknown'
    });
    
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed}/${snapshot.size}, found ${deals.length} above-1% deals...`);
    }
  }
  
  // Sort by rent ratio descending (highest rent-to-price ratio first)
  deals.sort((a, b) => b.rentRatio - a.rentRatio);
  
  console.log(`\n✅ FOUND ${deals.length} PROPERTIES THAT BEAT THE 1% RULE\n`);
  
  if (deals.length === 0) {
    console.log('❌ No properties found that beat the 1% rule with 15%+ ROI');
    return;
  }
  
  // Show top 30
  const showCount = Math.min(deals.length, 30);
  console.log(`🏆 TOP ${showCount} ABOVE-1% DEALS:`);
  
  deals.slice(0, showCount).forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.address}, ${deal.city}, ${deal.state}`);
    console.log(`   Price: $${deal.price.toLocaleString()} | Rent: $${deal.rent} (${deal.rentRatio.toFixed(1)}% monthly)`);
    console.log(`   ROI: ${deal.roi}% | Cash Flow: $${deal.monthlyCashFlow}/mo | ${deal.bedrooms}br/${deal.bathrooms}ba`);
    console.log(`   Example: $${deal.price.toLocaleString()} house → $${deal.rent}/month rent`);
    console.log('');
  });
  
  // Show rent ratio analysis
  const avgRentRatio = deals.reduce((sum, d) => sum + d.rentRatio, 0) / deals.length;
  const avgPrice = deals.reduce((sum, d) => sum + d.price, 0) / deals.length;
  const avgRent = deals.reduce((sum, d) => sum + d.rent, 0) / deals.length;
  
  console.log('\n📊 ANALYSIS:');
  console.log(`Average rent ratio: ${avgRentRatio.toFixed(1)}% monthly (${(avgRentRatio * 12).toFixed(1)}% annually)`);
  console.log(`Average price: $${Math.round(avgPrice).toLocaleString()}`);
  console.log(`Average rent: $${Math.round(avgRent)}/month`);
  console.log(`Best ratio: ${deals[0].rentRatio.toFixed(1)}% - ${deals[0].address}`);
  
  // Create CSV
  const timestamp = new Date().toISOString().split('T')[0];
  const csvFile = `ABOVE_ONE_PERCENT_DEALS_${timestamp}.csv`;
  
  const headers = 'ZPID,Address,City,State,Price,Monthly Rent,Rent Ratio %,ROI %,Monthly Cash Flow,Down Payment,Monthly Mortgage,Monthly Tax,Monthly Insurance,MLS ID,Bedrooms,Bathrooms,Year Built,Property Type';
  
  const rows = deals.map(d => 
    `${d.zpid},"${d.address}","${d.city}",${d.state},${d.price},${d.rent},${d.rentRatio.toFixed(2)},${d.roi},${d.monthlyCashFlow},${d.downPayment},${d.monthlyMortgage},${d.monthlyTax},${d.monthlyInsurance},${d.mlsId},${d.bedrooms},${d.bathrooms},${d.yearBuilt},"${d.propertyType}"`
  );
  
  await fs.writeFile(csvFile, headers + '\n' + rows.join('\n'));
  
  console.log(`\n🎯 ABOVE 1% DEALS: ${csvFile}`);
  console.log(`📊 ${deals.length} properties with rent ratios of 1.1% - 2.0% monthly`);
  console.log(`💰 These beat the standard 1% rule - higher cash flow potential`);
  
  // Show some specific examples by price range
  console.log('\n🏠 EXAMPLES BY PRICE RANGE:');
  
  const under100k = deals.filter(d => d.price < 100000).slice(0, 3);
  const between100_200k = deals.filter(d => d.price >= 100000 && d.price < 200000).slice(0, 3);
  const above200k = deals.filter(d => d.price >= 200000).slice(0, 3);
  
  if (under100k.length > 0) {
    console.log('\nUnder $100k:');
    under100k.forEach(d => {
      console.log(`  $${d.price.toLocaleString()} → $${d.rent}/mo (${d.rentRatio.toFixed(1)}%) - ${d.city}, ${d.state}`);
    });
  }
  
  if (between100_200k.length > 0) {
    console.log('\n$100k-$200k:');
    between100_200k.forEach(d => {
      console.log(`  $${d.price.toLocaleString()} → $${d.rent}/mo (${d.rentRatio.toFixed(1)}%) - ${d.city}, ${d.state}`);
    });
  }
  
  if (above200k.length > 0) {
    console.log('\nAbove $200k:');
    above200k.forEach(d => {
      console.log(`  $${d.price.toLocaleString()} → $${d.rent}/mo (${d.rentRatio.toFixed(1)}%) - ${d.city}, ${d.state}`);
    });
  }
  
  console.log('\n✅ These properties exceed the 1% rule - prime investment targets!');
}

findAboveOnePercentDeals().catch(console.error);