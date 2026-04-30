#!/usr/bin/env npx tsx
/**
 * REALISTIC 15%+ ROI Properties
 * 
 * Filter out the bullshit. Real houses, real prices, real deals.
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
    monthlyTax: Math.round(monthlyTax),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    roi: Math.round(roi * 100) / 100
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

async function findRealistic15PercentDeals() {
  console.log('=== REALISTIC 15%+ ROI DEALS ===\n');
  console.log('🎯 FILTERS:');
  console.log('• Price: $50,000 - $500,000 (real houses)');
  console.log('• Rent: $800+ (livable)');
  console.log('• ROI: 15% - 200% (realistic range)');
  console.log('• Real tax data only');
  console.log('• Active MLS listings\n');
  
  const { db } = getFirebaseAdmin();
  
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();
  
  console.log(`Checking ${snapshot.size} properties...`);
  
  const deals: any[] = [];
  let processed = 0;
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    processed++;
    
    // Basic filters
    if (!property.mlsId) continue;
    if (property.isActive === false || property.offMarketReason) continue;
    if (!property.rentEstimate || !property.price) continue;
    
    // REALISTIC PRICE RANGE ($50k - $500k)
    if (property.price < 50000 || property.price > 500000) continue;
    
    // REALISTIC RENT ($800+)
    if (property.rentEstimate < 800) continue;
    
    // Must have real tax data
    const taxCheck = hasRealTaxData(property);
    if (!taxCheck.has) continue;
    
    // Calculate cash flow
    const hoaFee = property.monthlyHoaFee || property.hoa || 0;
    const cashFlow = calculateCashFlow(property.price, property.rentEstimate, taxCheck.amount, hoaFee);
    
    // REALISTIC ROI RANGE (15% - 200%)
    if (cashFlow.roi < 15 || cashFlow.roi > 200) continue;
    
    // MUST CASH FLOW POSITIVE
    if (cashFlow.monthlyCashFlow <= 0) continue;
    
    deals.push({
      zpid: property.zpid,
      address: property.fullAddress || property.streetAddress || property.address,
      city: property.city || 'Unknown',
      state: property.state || 'Unknown',
      price: property.price,
      rent: property.rentEstimate,
      monthlyTax: cashFlow.monthlyTax,
      monthlyCashFlow: cashFlow.monthlyCashFlow,
      roi: cashFlow.roi,
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
  
  // Sort by ROI descending
  deals.sort((a, b) => b.roi - a.roi);
  
  console.log(`\n✅ FOUND ${deals.length} REALISTIC 15%+ ROI PROPERTIES\n`);
  
  if (deals.length === 0) {
    console.log('❌ No properties met the realistic criteria');
    return;
  }
  
  // Show top 15
  console.log('🏆 TOP 15 REALISTIC DEALS:');
  deals.slice(0, 15).forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.address}, ${deal.city}, ${deal.state}`);
    console.log(`   Price: $${deal.price.toLocaleString()} | Rent: $${deal.rent} | ROI: ${deal.roi}%`);
    console.log(`   Cash Flow: $${deal.monthlyCashFlow}/mo | ${deal.bedrooms}br/${deal.bathrooms}ba | Built: ${deal.yearBuilt}`);
    console.log('');
  });
  
  // Create realistic deals CSV
  const timestamp = new Date().toISOString().split('T')[0];
  const csvFile = `REALISTIC_15_PERCENT_ROI_DEALS_${timestamp}.csv`;
  
  const headers = 'ZPID,Address,City,State,Price,Monthly Rent,Monthly Cash Flow,ROI %,Monthly Tax,MLS ID,Bedrooms,Bathrooms,Year Built,Property Type';
  
  const rows = deals.map(d => 
    `${d.zpid},"${d.address}","${d.city}",${d.state},${d.price},${d.rent},${d.monthlyCashFlow},${d.roi},${d.monthlyTax},${d.mlsId},${d.bedrooms},${d.bathrooms},${d.yearBuilt},"${d.propertyType}"`
  );
  
  await fs.writeFile(csvFile, headers + '\n' + rows.join('\n'));
  
  console.log(`\n🎯 REALISTIC DEALS SHEET: ${csvFile}`);
  console.log(`📊 ${deals.length} properties ($50k-$500k, $800+ rent, 15%-200% ROI)`);
  
  if (deals.length > 0) {
    console.log(`🥇 Best ROI: ${deals[0].roi}% - ${deals[0].address}`);
    console.log(`💰 Average ROI: ${Math.round(deals.reduce((sum, d) => sum + d.roi, 0) / deals.length)}%`);
    console.log(`🏠 Average Price: $${Math.round(deals.reduce((sum, d) => sum + d.price, 0) / deals.length).toLocaleString()}`);
    console.log(`💵 Average Cash Flow: $${Math.round(deals.reduce((sum, d) => sum + d.monthlyCashFlow, 0) / deals.length)}/month`);
  }
  
  console.log('\n✅ REALISTIC NUMBERS ONLY. No more insane bullshit.');
}

findRealistic15PercentDeals().catch(console.error);