#!/usr/bin/env npx tsx

/**
 * Test phone number validation and fallback logic
 */

import * as fs from 'fs';

const filePath = process.argv[2] || '/Users/abdullahabunasrah/Downloads/dataset_zillow-detail-scraper_2025-10-21_15-41-24-538.json';

console.log(`\n🧪 Testing Phone Number Validation\n`);
console.log('Rules:');
console.log('  1. If agent phone is missing, use broker phone');
console.log('  2. If both are missing, SKIP the property');
console.log('='.repeat(80));

const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`\nAnalyzing ${rawData.length} properties...\n`);

let hasAgentPhone = 0;
let hasBrokerPhone = 0;
let hasBoth = 0;
let hasNeither = 0;
let willUseAgentPhone = 0;
let willUseBrokerAsAgent = 0;
let willSkip = 0;

const skipExamples: any[] = [];
const fallbackExamples: any[] = [];

rawData.forEach((property: any, index: number) => {
  const agentPhone = property.attributionInfo?.agentPhoneNumber || '';
  const brokerPhone = property.attributionInfo?.brokerPhoneNumber || '';
  const address = property.streetAddress || property.address?.streetAddress || 'Unknown';
  const zpid = property.zpid || 'N/A';

  // Count what's available
  if (agentPhone) hasAgentPhone++;
  if (brokerPhone) hasBrokerPhone++;
  if (agentPhone && brokerPhone) hasBoth++;
  if (!agentPhone && !brokerPhone) hasNeither++;

  // Determine what will happen
  if (!agentPhone && !brokerPhone) {
    willSkip++;
    if (skipExamples.length < 5) {
      skipExamples.push({
        index: index + 1,
        address,
        zpid,
        agentPhone: 'MISSING',
        brokerPhone: 'MISSING'
      });
    }
  } else if (agentPhone) {
    willUseAgentPhone++;
  } else {
    willUseBrokerAsAgent++;
    if (fallbackExamples.length < 5) {
      fallbackExamples.push({
        index: index + 1,
        address,
        zpid,
        agentPhone: 'MISSING',
        brokerPhone
      });
    }
  }
});

console.log('📊 STATISTICS:');
console.log('='.repeat(80));
console.log(`Total Properties:               ${rawData.length}`);
console.log(`\nPhone Number Availability:`);
console.log(`  Has Agent Phone:              ${hasAgentPhone} (${((hasAgentPhone/rawData.length)*100).toFixed(1)}%)`);
console.log(`  Has Broker Phone:             ${hasBrokerPhone} (${((hasBrokerPhone/rawData.length)*100).toFixed(1)}%)`);
console.log(`  Has Both:                     ${hasBoth} (${((hasBoth/rawData.length)*100).toFixed(1)}%)`);
console.log(`  Has Neither:                  ${hasNeither} (${((hasNeither/rawData.length)*100).toFixed(1)}%)`);

console.log(`\nImport Results (with new logic):`);
console.log(`  ✅ Will Import (has agent):   ${willUseAgentPhone} (${((willUseAgentPhone/rawData.length)*100).toFixed(1)}%)`);
console.log(`  ✅ Will Import (broker→agent): ${willUseBrokerAsAgent} (${((willUseBrokerAsAgent/rawData.length)*100).toFixed(1)}%)`);
console.log(`  ❌ Will SKIP (no phone):      ${willSkip} (${((willSkip/rawData.length)*100).toFixed(1)}%)`);

console.log(`\n📈 SUMMARY:`);
console.log(`  Total to Import:              ${willUseAgentPhone + willUseBrokerAsAgent} properties`);
console.log(`  Total to Skip:                ${willSkip} properties`);

if (fallbackExamples.length > 0) {
  console.log('\n\n✅ BROKER PHONE FALLBACK EXAMPLES (will use broker phone as agent phone):\n');
  console.log('='.repeat(80));
  fallbackExamples.forEach((ex) => {
    console.log(`${ex.index}. ${ex.address} (ZPID: ${ex.zpid})`);
    console.log(`   Agent Phone: ${ex.agentPhone}`);
    console.log(`   Broker Phone: ${ex.brokerPhone} ← WILL USE THIS\n`);
  });
}

if (skipExamples.length > 0) {
  console.log('\n❌ WILL BE SKIPPED (no phone numbers):\n');
  console.log('='.repeat(80));
  skipExamples.forEach((ex) => {
    console.log(`${ex.index}. ${ex.address} (ZPID: ${ex.zpid})`);
    console.log(`   Agent Phone: ${ex.agentPhone}`);
    console.log(`   Broker Phone: ${ex.brokerPhone}\n`);
  });
}

console.log('\n');
