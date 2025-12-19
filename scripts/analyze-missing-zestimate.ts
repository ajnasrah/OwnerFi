/**
 * Analyze properties missing zestimate to find alternative estimate sources
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to get database');
    return;
  }

  // Get properties without zestimate from cash_houses
  const cashNoZest = await db.collection('cash_houses')
    .where('zestimate', '==', 0)
    .limit(100)
    .get();

  // Get properties without zestimate from zillow_imports
  const zillowNoZest = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .limit(100)
    .get();

  console.log('=== SAMPLE SIZES ===');
  console.log('cash_houses without zestimate:', cashNoZest.docs.length);
  console.log('zillow_imports sample:', zillowNoZest.docs.length);

  // Analyze cash_houses
  console.log('\n=== CASH_HOUSES - VALUE FIELDS ANALYSIS ===');
  analyzeCollection(cashNoZest.docs, 'cash_houses');

  // Analyze zillow_imports
  console.log('\n=== ZILLOW_IMPORTS - VALUE FIELDS ANALYSIS ===');
  analyzeCollection(zillowNoZest.docs, 'zillow_imports');

  // Check for taxHistory and priceHistory
  console.log('\n=== CHECKING TAX AND PRICE HISTORY ===');
  let withTaxHistory = 0;
  let withPriceHistory = 0;
  let withResoFacts = 0;

  const allDocs = [...cashNoZest.docs, ...zillowNoZest.docs];

  for (const doc of allDocs) {
    const data = doc.data();
    if (data.taxHistory && Array.isArray(data.taxHistory) && data.taxHistory.length > 0) {
      withTaxHistory++;
      // Show sample taxHistory
      if (withTaxHistory === 1) {
        console.log('\nSample taxHistory:', JSON.stringify(data.taxHistory.slice(0, 2), null, 2));
      }
    }
    if (data.priceHistory && Array.isArray(data.priceHistory) && data.priceHistory.length > 0) {
      withPriceHistory++;
      if (withPriceHistory === 1) {
        console.log('\nSample priceHistory:', JSON.stringify(data.priceHistory.slice(0, 2), null, 2));
      }
    }
    if (data.resoFacts && typeof data.resoFacts === 'object') {
      withResoFacts++;
      if (withResoFacts === 1) {
        const facts = data.resoFacts;
        console.log('\nSample resoFacts keys:', Object.keys(facts).slice(0, 20));
        // Look for assessment/value fields
        const valueKeys = Object.keys(facts).filter(k =>
          k.toLowerCase().includes('assess') ||
          k.toLowerCase().includes('value') ||
          k.toLowerCase().includes('tax')
        );
        console.log('Value-related resoFacts:', valueKeys);
      }
    }
  }

  console.log(`\nProperties with taxHistory: ${withTaxHistory}/${allDocs.length}`);
  console.log(`Properties with priceHistory: ${withPriceHistory}/${allDocs.length}`);
  console.log(`Properties with resoFacts: ${withResoFacts}/${allDocs.length}`);

  // Deep dive into a few properties
  console.log('\n=== DETAILED PROPERTY ANALYSIS ===');
  for (let i = 0; i < Math.min(5, cashNoZest.docs.length); i++) {
    const data = cashNoZest.docs[i].data();
    console.log(`\n--- Property ${i + 1}: ${data.streetAddress || data.address || 'Unknown'}, ${data.city} ${data.state} ---`);
    console.log('zpid:', data.zpid);
    console.log('price:', data.price);
    console.log('zestimate:', data.zestimate);
    console.log('estimate:', data.estimate);

    // Check tax assessed value from taxHistory
    if (data.taxHistory && data.taxHistory.length > 0) {
      const latestTax = data.taxHistory[0];
      console.log('Latest tax assessed value:', latestTax.value || latestTax.taxAssessedValue);
      console.log('Latest tax paid:', latestTax.taxPaid);
    }

    // Check price history for last sold price
    if (data.priceHistory && data.priceHistory.length > 0) {
      const soldEntries = data.priceHistory.filter((p: any) => p.event === 'Sold' || p.priceChangeRate);
      if (soldEntries.length > 0) {
        console.log('Last sold price:', soldEntries[0].price);
        console.log('Last sold date:', soldEntries[0].date);
      }
    }
  }
}

function analyzeCollection(docs: FirebaseFirestore.QueryDocumentSnapshot[], name: string) {
  const fieldCounts: Record<string, number> = {};
  const sampleValues: Record<string, any> = {};

  for (const doc of docs) {
    const data = doc.data();
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== 0 && value !== '') {
        fieldCounts[key] = (fieldCounts[key] || 0) + 1;
        if (!sampleValues[key]) {
          sampleValues[key] = value;
        }
      }
    }
  }

  // Filter for value/estimate related fields
  const valueFields = Object.keys(fieldCounts).filter(k =>
    k.toLowerCase().includes('value') ||
    k.toLowerCase().includes('estim') ||
    k.toLowerCase().includes('price') ||
    k.toLowerCase().includes('zest') ||
    k.toLowerCase().includes('assess') ||
    k.toLowerCase().includes('tax') ||
    k.toLowerCase().includes('rent') ||
    k.toLowerCase().includes('sold') ||
    k.toLowerCase().includes('arv')
  ).sort();

  console.log(`\nValue-related fields in ${name}:`);
  for (const field of valueFields) {
    const sample = typeof sampleValues[field] === 'object'
      ? JSON.stringify(sampleValues[field]).slice(0, 50) + '...'
      : sampleValues[field];
    console.log(`  ${field}: ${fieldCounts[field]}/${docs.length} docs | sample: ${sample}`);
  }
}

main().catch(console.error);
