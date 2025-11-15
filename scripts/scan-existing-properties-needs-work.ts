/**
 * Scan existing properties to find how many match "needs work" criteria
 * Run with: npx tsx scripts/scan-existing-properties-needs-work.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { detectNeedsWork, getMatchingKeywords } from '../src/lib/property-needs-work-detector';

// Dynamic import to ensure env vars are loaded first
async function initializeFirebase() {
  const { db } = await import('../src/lib/firebase');
  if (!db) {
    throw new Error('Firebase not initialized. Check your .env.local configuration.');
  }
  return db;
}

async function scanProperties() {
  console.log('\n🔍 Scanning Existing Properties for "Needs Work" Keywords\n');
  console.log('═'.repeat(70));

  // Initialize Firebase
  const db = await initializeFirebase();

  const results = {
    cashHousesTotal: 0,
    cashHousesWithDealType: 0,
    cashHousesNeedsWork: 0,
    zillowImportsTotal: 0,
    zillowImportsNeedsWork: 0,
    zillowImportsSamples: [] as any[],
  };

  // 1. Check cash_houses collection
  console.log('\n📋 Scanning cash_houses collection...');
  try {
    const cashHousesRef = collection(db, 'cash_houses');
    const cashHousesQuery = query(cashHousesRef, orderBy('importedAt', 'desc'), limit(500));
    const cashHousesSnap = await getDocs(cashHousesQuery);
    results.cashHousesTotal = cashHousesSnap.size;

    cashHousesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.dealType) {
        results.cashHousesWithDealType++;
      }
      if (data.needsWork || data.dealType === 'needs_work' || data.dealType === 'owner_finance') {
        results.cashHousesNeedsWork++;
      }
    });

    console.log(`   Total properties: ${results.cashHousesTotal}`);
    console.log(`   With dealType tag: ${results.cashHousesWithDealType}`);
    console.log(`   Needs work/Owner finance: ${results.cashHousesNeedsWork}`);
  } catch (error: any) {
    console.log(`   ⚠️  Collection not found or error: ${error.message}`);
  }

  // 2. Check zillow_imports collection
  console.log('\n📋 Scanning zillow_imports collection...');
  try {
    const zillowRef = collection(db, 'zillow_imports');
    const zillowQuery = query(zillowRef, orderBy('createdAt', 'desc'), limit(100));
    const zillowSnap = await getDocs(zillowQuery);

    results.zillowImportsTotal = zillowSnap.size;

    zillowSnap.docs.forEach(doc => {
      const data = doc.data();
      const description = data.description || '';

      if (detectNeedsWork(description)) {
        results.zillowImportsNeedsWork++;

        // Collect first 5 samples
        if (results.zillowImportsSamples.length < 5) {
          const keywords = getMatchingKeywords(description);
          results.zillowImportsSamples.push({
            address: data.fullAddress || data.streetAddress || 'Unknown',
            price: data.price,
            keywords: keywords.slice(0, 3),
          });
        }
      }
    });

    console.log(`   Total properties scanned: ${results.zillowImportsTotal} (most recent)`);
    console.log(`   Would match "needs work": ${results.zillowImportsNeedsWork}`);
    console.log(`   Match rate: ${((results.zillowImportsNeedsWork / results.zillowImportsTotal) * 100).toFixed(1)}%`);
  } catch (error: any) {
    console.log(`   ⚠️  Collection not found or error: ${error.message}`);
  }

  // 3. Show samples
  if (results.zillowImportsSamples.length > 0) {
    console.log('\n📝 Sample Properties That Would Match:');
    results.zillowImportsSamples.forEach((sample, i) => {
      console.log(`\n   ${i + 1}. ${sample.address}`);
      console.log(`      Price: $${sample.price?.toLocaleString() || 'N/A'}`);
      console.log(`      Keywords: ${sample.keywords.join(', ')}`);
    });
  }

  // Summary
  console.log('\n═'.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`\n   Cash Houses Collection:`);
  console.log(`      Total: ${results.cashHousesTotal}`);
  console.log(`      Already tagged: ${results.cashHousesWithDealType}`);
  console.log(`      Needs work: ${results.cashHousesNeedsWork}`);

  console.log(`\n   Zillow Imports Collection:`);
  console.log(`      Scanned: ${results.zillowImportsTotal} recent properties`);
  console.log(`      Would match: ${results.zillowImportsNeedsWork}`);
  console.log(`      Match rate: ${((results.zillowImportsNeedsWork / results.zillowImportsTotal) * 100).toFixed(1)}%`);

  console.log('\n💡 Note: Going forward, all new properties will be automatically');
  console.log('   filtered and tagged as they come through the scrapers.\n');
}

scanProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
