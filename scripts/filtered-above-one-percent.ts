#!/usr/bin/env npx tsx
/**
 * Filtered Above 1% Rule Deals
 * 
 * STRICT CRITERIA:
 * - 2br/1ba minimum
 * - Single family only
 * - 1970 or newer
 * - Monthly rent > 1% of price
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

async function findFilteredDeals() {
  console.log('=== FILTERED ABOVE 1% RULE DEALS ===\n');
  console.log('🎯 STRICT CRITERIA:');
  console.log('• 2br/1ba minimum');
  console.log('• Single family ONLY');
  console.log('• Built 1970 or newer');
  console.log('• Monthly rent > 1% of price');
  console.log('• $75k - $400k price range');
  console.log('• 15%+ ROI\n');
  
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
    wrongPrice: 0,
    wrongRentRatio: 0,
    notSingleFamily: 0,
    tooOld: 0,
    tooSmall: 0,
    noTaxData: 0,
    lowROI: 0,
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
    
    // Price range
    if (property.price < 75000 || property.price > 400000) {
      filtered.wrongPrice++;
      continue;
    }
    
    // Above 1% rule but not crazy
    const monthlyRentRatio = (property.rentEstimate / property.price) * 100;
    if (monthlyRentRatio <= 1.0 || monthlyRentRatio > 2.0) {
      filtered.wrongRentRatio++;
      continue;
    }
    
    // SINGLE FAMILY ONLY
    if (!property.propertyType || !property.propertyType.toLowerCase().includes('single')) {
      filtered.notSingleFamily++;
      continue;
    }
    
    // 1970 OR NEWER
    if (!property.yearBuilt || property.yearBuilt < 1970) {
      filtered.tooOld++;
      continue;
    }
    
    // 2BR/1BA MINIMUM
    if (!property.bedrooms || property.bedrooms < 2 || !property.bathrooms || property.bathrooms < 1) {
      filtered.tooSmall++;
      continue;
    }
    
    // Must have real tax data
    const taxCheck = hasRealTaxData(property);
    if (!taxCheck.has) {
      filtered.noTaxData++;
      continue;
    }
    
    // Calculate cash flow
    const hoaFee = property.monthlyHoaFee || property.hoa || 0;
    const cashFlow = calculateCashFlow(property.price, property.rentEstimate, taxCheck.amount, hoaFee);
    
    // Must have 15%+ ROI
    if (cashFlow.roi < 15) {
      filtered.lowROI++;
      continue;
    }
    
    // Must cash flow positive
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
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      yearBuilt: property.yearBuilt,
      propertyType: property.propertyType
    });
    
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed}/${snapshot.size}, found ${deals.length} qualifying deals...`);
    }
  }
  
  console.log('\n=== FILTERING RESULTS ===');
  console.log(`Total processed: ${processed}`);
  console.log(`No MLS: ${filtered.noMLS}`);
  console.log(`Inactive: ${filtered.inactive}`);
  console.log(`Wrong price range: ${filtered.wrongPrice}`);
  console.log(`Wrong rent ratio (<1% or >2%): ${filtered.wrongRentRatio}`);
  console.log(`Not single family: ${filtered.notSingleFamily}`);
  console.log(`Built before 1970: ${filtered.tooOld}`);
  console.log(`Less than 2br/1ba: ${filtered.tooSmall}`);
  console.log(`No tax data: ${filtered.noTaxData}`);
  console.log(`ROI under 15%: ${filtered.lowROI}`);
  console.log(`Negative cash flow: ${filtered.negativeCashFlow}`);
  console.log(`✅ PASSED ALL FILTERS: ${filtered.passed}`);
  
  if (deals.length === 0) {
    console.log('\n❌ No properties met the strict criteria');
    return;
  }
  
  // Sort by rent ratio descending
  deals.sort((a, b) => b.rentRatio - a.rentRatio);
  
  console.log(`\n✅ FOUND ${deals.length} QUALIFYING SINGLE FAMILY HOMES\n`);
  
  // Show all if reasonable number, otherwise top 20
  const showCount = Math.min(deals.length, 20);
  console.log(`🏆 TOP ${showCount} QUALIFYING DEALS:`);
  
  deals.slice(0, showCount).forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.address}, ${deal.city}, ${deal.state}`);
    console.log(`   Price: $${deal.price.toLocaleString()} | Rent: $${deal.rent} (${deal.rentRatio.toFixed(1)}% monthly)`);
    console.log(`   ${deal.bedrooms}br/${deal.bathrooms}ba | Built: ${deal.yearBuilt} | ROI: ${deal.roi}%`);
    console.log(`   Cash Flow: $${deal.monthlyCashFlow}/mo | MLS: ${deal.mlsId}`);
    console.log('');
  });
  
  if (deals.length > 0) {
    // Analysis
    const avgRentRatio = deals.reduce((sum, d) => sum + d.rentRatio, 0) / deals.length;
    const avgPrice = deals.reduce((sum, d) => sum + d.price, 0) / deals.length;
    const avgYear = deals.reduce((sum, d) => sum + d.yearBuilt, 0) / deals.length;
    
    console.log('\n📊 ANALYSIS:');
    console.log(`Average rent ratio: ${avgRentRatio.toFixed(1)}% monthly`);
    console.log(`Average price: $${Math.round(avgPrice).toLocaleString()}`);
    console.log(`Average year built: ${Math.round(avgYear)}`);
    console.log(`Best ratio: ${deals[0].rentRatio.toFixed(1)}% - ${deals[0].address}`);
    
    // Create CSV
    const timestamp = new Date().toISOString().split('T')[0];
    const csvFile = `FILTERED_SINGLE_FAMILY_DEALS_${timestamp}.csv`;
    
    const headers = 'ZPID,Address,City,State,Price,Monthly Rent,Rent Ratio %,ROI %,Monthly Cash Flow,Bedrooms,Bathrooms,Year Built,MLS ID,Down Payment,Monthly Mortgage,Monthly Tax,Monthly Insurance';
    
    const rows = deals.map(d => 
      `${d.zpid},"${d.address}","${d.city}",${d.state},${d.price},${d.rent},${d.rentRatio.toFixed(2)},${d.roi},${d.monthlyCashFlow},${d.bedrooms},${d.bathrooms},${d.yearBuilt},${d.mlsId},${d.downPayment},${d.monthlyMortgage},${d.monthlyTax},${d.monthlyInsurance}`
    );
    
    await fs.writeFile(csvFile, headers + '\n' + rows.join('\n'));
    
    console.log(`\n🎯 FILTERED DEALS: ${csvFile}`);
    console.log(`📊 ${deals.length} single family homes, 2br/1ba+, 1970+, above 1% rule`);
  }
  
  console.log('\n✅ These meet ALL your criteria - quality single family investment properties!');
}

findFilteredDeals().catch(console.error);