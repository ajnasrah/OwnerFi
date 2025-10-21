#!/usr/bin/env npx tsx

/**
 * Test script to verify field extraction from Apify JSON
 */

import * as fs from 'fs';

const filePath = process.argv[2] || '/Users/abdullahabunasrah/Downloads/dataset_zillow-detail-scraper_2025-10-21_15-41-24-538.json';

console.log(`\n🧪 Testing Field Extraction from: ${filePath}\n`);

const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const firstProperty = rawData[0];

console.log('📊 Testing extraction for first property:\n');

// Test agent extraction
const agentName = firstProperty.attributionInfo?.agentName || firstProperty.agentName || '';
const agentPhone = firstProperty.attributionInfo?.agentPhoneNumber || firstProperty.agentPhoneNumber || '';
const brokerName = firstProperty.attributionInfo?.brokerName || firstProperty.brokerName || '';
const brokerPhone = firstProperty.attributionInfo?.brokerPhoneNumber || firstProperty.brokerPhoneNumber || '';

console.log('✅ Agent Information:');
console.log(`   Agent Name: ${agentName || '(empty)'}`);
console.log(`   Agent Phone: ${agentPhone || '(empty)'}`);
console.log(`   Broker Name: ${brokerName || '(empty)'}`);
console.log(`   Broker Phone: ${brokerPhone || '(empty)'}`);

// Test images extraction
const images = Array.isArray(firstProperty.responsivePhotos)
  ? firstProperty.responsivePhotos.map((p: any) => p.url).filter(Boolean)
  : [];

console.log(`\n✅ Images (${images.length} total):`);
if (images.length > 0) {
  console.log(`   First Image: ${images[0]}`);
  console.log(`   Last Image: ${images[images.length - 1]}`);
} else {
  console.log('   (empty)');
}

// Test tax extraction
const taxHistory = firstProperty.taxHistory;
const annualTax = Array.isArray(taxHistory) && taxHistory[0]?.taxPaid || 0;
const recentTaxValue = Array.isArray(taxHistory) && taxHistory[0]?.value || 0;

console.log(`\n✅ Tax Information:`);
console.log(`   Annual Tax Paid: ${annualTax || '(empty)'}`);
console.log(`   Recent Tax Assessment: ${recentTaxValue || '(empty)'}`);
if (Array.isArray(taxHistory) && taxHistory.length > 0) {
  console.log(`   Tax History Count: ${taxHistory.length} entries`);
}

// Summary
console.log('\n\n📋 Summary:');
console.log('='.repeat(60));

const hasAgent = !!(agentName || agentPhone);
const hasBroker = !!(brokerName || brokerPhone);
const hasImages = images.length > 0;
const hasTax = !!(annualTax || recentTaxValue);

console.log(`${hasAgent ? '✅' : '❌'} Agent data present`);
console.log(`${hasBroker ? '✅' : '❌'} Broker data present`);
console.log(`${hasImages ? '✅' : '❌'} Images present (${images.length} images)`);
console.log(`${hasTax ? '✅' : '❌'} Tax data present`);

if (!hasAgent && !hasBroker && !hasImages && !hasTax) {
  console.log('\n⚠️  WARNING: No data found for requested fields!');
  console.log('This could mean:');
  console.log('  1. The property doesn\'t have this data on Zillow');
  console.log('  2. The Apify scraper structure has changed');
  console.log('  3. The field names are different than expected');
} else if (hasAgent || hasBroker || hasImages || hasTax) {
  console.log('\n✅ SUCCESS: Field extraction is working!');
  console.log('The updated import script should capture this data.');
}

console.log('\n');
