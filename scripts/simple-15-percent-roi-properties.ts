#!/usr/bin/env npx tsx
/**
 * SIMPLE: Properties with 15%+ Cash-on-Cash Return
 * 
 * One sheet. Real tax data only. 15%+ ROI minimum.
 */

import * as dotenv from 'dotenv';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import * as fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

interface SimpleDeal {
  zpid: string;
  address: string;
  city: string;
  state: string;
  price: number;
  rent: number;
  monthlyTax: number;
  monthlyCashFlow: number;
  roi: number;
  mlsId: string;
}

function calculateCashFlow(price: number, rent: number, annualTax: number, hoaFee: number = 0) {
  const downPayment = price * 0.10;
  const loanAmount = price * 0.90;
  
  // Monthly mortgage (5%, 30 years)
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
  // Check for real tax data
  if (property.annualTaxAmount && property.annualTaxAmount > 0) {
    return { has: true, amount: property.annualTaxAmount };
  }
  
  if (property.taxAnnualAmount && property.taxAnnualAmount > 0) {
    return { has: true, amount: property.taxAnnualAmount };
  }
  
  if (property.propertyTaxRate && property.propertyTaxRate > 0 && property.price) {
    return { has: true, amount: property.price * (property.propertyTaxRate / 100) };
  }
  
  return { has: false, amount: 0 };
}

async function find15PercentROIProperties() {
  console.log('=== SIMPLE: 15%+ CASH-ON-CASH RETURN PROPERTIES ===\n');
  console.log('🎯 CRITERIA: Real tax data only, 15%+ ROI, active MLS\n');
  
  const { db } = getFirebaseAdmin();
  
  // Get active owner finance properties
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('homeStatus', '==', 'FOR_SALE')
    .get();
  
  console.log(`Checking ${snapshot.size} FOR_SALE properties...`);
  
  const deals: SimpleDeal[] = [];
  let processed = 0;
  
  for (const doc of snapshot.docs) {
    const property = doc.data();
    processed++;
    
    // Must have MLS ID
    if (!property.mlsId) continue;
    
    // Must be active
    if (property.isActive === false || property.offMarketReason) continue;
    
    // Must have rent and price
    if (!property.rentEstimate || !property.price || property.rentEstimate <= 0 || property.price <= 0) continue;
    
    // Must have REAL tax data
    const taxCheck = hasRealTaxData(property);
    if (!taxCheck.has) continue;
    
    // Calculate cash flow
    const hoaFee = property.monthlyHoaFee || property.hoa || 0;
    const cashFlow = calculateCashFlow(property.price, property.rentEstimate, taxCheck.amount, hoaFee);
    
    // Must have 15%+ ROI
    if (cashFlow.roi < 15) continue;
    
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
      mlsId: property.mlsId
    });
    
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed}/${snapshot.size}, found ${deals.length} deals...`);
    }
  }
  
  // Sort by ROI descending
  deals.sort((a, b) => b.roi - a.roi);
  
  console.log(`\n✅ FOUND ${deals.length} PROPERTIES WITH 15%+ ROI\n`);
  
  // Show top 10
  console.log('🏆 TOP 10 DEALS:');
  deals.slice(0, 10).forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.address}, ${deal.city}, ${deal.state}`);
    console.log(`   Price: $${deal.price.toLocaleString()} | Rent: $${deal.rent} | ROI: ${deal.roi}%`);
    console.log(`   Cash Flow: $${deal.monthlyCashFlow}/mo | Tax: $${deal.monthlyTax}/mo | MLS: ${deal.mlsId}`);
    console.log('');
  });
  
  // Create ONE simple CSV
  const timestamp = new Date().toISOString().split('T')[0];
  const csvFile = `15_PERCENT_ROI_DEALS_${timestamp}.csv`;
  
  const headers = 'ZPID,Address,City,State,Price,Monthly Rent,Monthly Tax,Monthly Cash Flow,ROI %,MLS ID';
  
  const rows = deals.map(d => 
    `${d.zpid},"${d.address}","${d.city}",${d.state},${d.price},${d.rent},${d.monthlyTax},${d.monthlyCashFlow},${d.roi},${d.mlsId}`
  );
  
  await fs.writeFile(csvFile, headers + '\n' + rows.join('\n'));
  
  console.log(`\n🎯 SIMPLE SHEET CREATED: ${csvFile}`);
  console.log(`📊 ${deals.length} properties with 15%+ cash-on-cash return`);
  console.log(`🥇 Best ROI: ${deals[0]?.roi}% (${deals[0]?.address})`);
  console.log(`💰 Average ROI: ${Math.round(deals.reduce((sum, d) => sum + d.roi, 0) / deals.length)}%`);
  
  console.log('\n✅ DONE. One simple sheet with exactly what you want.');
}

find15PercentROIProperties().catch(console.error);