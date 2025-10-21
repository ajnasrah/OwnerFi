#!/usr/bin/env npx tsx

/**
 * Debug script to see what's actually being extracted from Apify JSON
 */

import * as fs from 'fs';

const filePath = '/Users/abdullahabunasrah/Downloads/dataset_zillow-detail-scraper_2025-10-21_15-41-24-538.json';

console.log(`\n🔍 Debugging Apify Data Extraction\n`);

const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const firstProperty = rawData[0];

console.log('📊 RAW DATA STRUCTURE (First Property):\n');
console.log('='.repeat(80));

// Check what we're trying to extract
console.log('\n1️⃣ Agent Phone Extraction:');
console.log(`   attributionInfo?.agentPhoneNumber: ${firstProperty.attributionInfo?.agentPhoneNumber || 'MISSING'}`);
console.log(`   agentPhoneNumber: ${firstProperty.agentPhoneNumber || 'MISSING'}`);
console.log(`   agentPhone: ${firstProperty.agentPhone || 'MISSING'}`);

console.log('\n2️⃣ Broker Phone Extraction:');
console.log(`   attributionInfo?.brokerPhoneNumber: ${firstProperty.attributionInfo?.brokerPhoneNumber || 'MISSING'}`);
console.log(`   brokerPhoneNumber: ${firstProperty.brokerPhoneNumber || 'MISSING'}`);
console.log(`   brokerPhone: ${firstProperty.brokerPhone || 'MISSING'}`);

console.log('\n3️⃣ Images Extraction:');
console.log(`   responsivePhotos: ${Array.isArray(firstProperty.responsivePhotos) ? `${firstProperty.responsivePhotos.length} photos` : 'MISSING'}`);
if (Array.isArray(firstProperty.responsivePhotos) && firstProperty.responsivePhotos.length > 0) {
  console.log(`   First image URL: ${firstProperty.responsivePhotos[0].url || 'NO URL'}`);
}

console.log('\n4️⃣ Tax Data Extraction:');
console.log(`   taxHistory: ${Array.isArray(firstProperty.taxHistory) ? `${firstProperty.taxHistory.length} entries` : 'MISSING'}`);
if (Array.isArray(firstProperty.taxHistory) && firstProperty.taxHistory.length > 0) {
  console.log(`   First entry taxPaid: ${firstProperty.taxHistory[0].taxPaid || 'MISSING'}`);
  console.log(`   First entry value: ${firstProperty.taxHistory[0].value || 'MISSING'}`);
  const withTaxPaid = firstProperty.taxHistory.find((t: any) => t.taxPaid);
  console.log(`   Entry with taxPaid: ${withTaxPaid?.taxPaid || 'NONE FOUND'}`);
}

console.log('\n5️⃣ ZPID:');
console.log(`   zpid: ${firstProperty.zpid || 'MISSING'}`);

console.log('\n6️⃣ Address:');
console.log(`   streetAddress: ${firstProperty.streetAddress || 'MISSING'}`);
console.log(`   address.streetAddress: ${firstProperty.address?.streetAddress || 'MISSING'}`);

// Now simulate the transformation
console.log('\n\n📦 SIMULATED TRANSFORMATION RESULT:\n');
console.log('='.repeat(80));

const agentPhone = firstProperty.attributionInfo?.agentPhoneNumber || firstProperty.agentPhoneNumber || firstProperty.agentPhone || '';
const brokerPhone = firstProperty.attributionInfo?.brokerPhoneNumber || firstProperty.brokerPhoneNumber || firstProperty.brokerPhone || '';
const finalAgentPhone = agentPhone || brokerPhone;

const images = Array.isArray(firstProperty.responsivePhotos)
  ? firstProperty.responsivePhotos.map((p: any) => p.url).filter(Boolean)
  : [];

const annualTaxPaid = (Array.isArray(firstProperty.taxHistory) && firstProperty.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0;

console.log(`agentPhone (extracted): "${agentPhone}"`);
console.log(`brokerPhone (extracted): "${brokerPhone}"`);
console.log(`finalAgentPhone (will save): "${finalAgentPhone}"`);
console.log(`images count: ${images.length}`);
console.log(`first image: ${images[0] || 'NONE'}`);
console.log(`annualTaxPaid: ${annualTaxPaid}`);
console.log(`zpid: ${firstProperty.zpid || 0}`);

if (!agentPhone && !brokerPhone) {
  console.log('\n❌ This property would be SKIPPED (no phone numbers)');
} else {
  console.log('\n✅ This property would be IMPORTED');
}

console.log('\n');
