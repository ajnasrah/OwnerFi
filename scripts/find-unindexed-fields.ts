/**
 * Find all fields in Firestore that are NOT indexed in Typesense
 */

import { getAdminDb } from '../src/lib/firebase-admin';

// Current Typesense schema fields
const TYPESENSE_FIELDS = new Set([
  'id',
  'address',
  'city',
  'state',
  'zipCode',
  'description',
  'title',
  'location', // geopoint [lat, lng]
  'dealType',
  'listPrice',
  'monthlyPayment',
  'downPaymentAmount',
  'bedrooms',
  'bathrooms',
  'squareFeet',
  'yearBuilt',
  'zestimate',
  'discountPercent',
  'isActive',
  'ownerFinanceVerified',
  'needsWork',
  'manuallyVerified',
  'sourceType',
  'propertyType',
  'financingType',
  'primaryImage',
  'createdAt',
  'updatedAt',
  'nearbyCities',
  'ownerFinanceKeywords',
]);

// Fields that are intentionally not indexed (too large, not searchable, or derived)
const SKIP_FIELDS = new Set([
  'propertyImages', // Array of URLs - too large
  'images', // Array
  'photos', // Array
  'responsivePhotos', // Array
  'taxHistory', // Complex nested array
  'priceHistory', // Complex nested array
  'resoFacts', // Large nested object
  'attributionInfo', // Nested object
  'thirdPartyVirtualTour', // Nested
  'cashFlow', // Calculated object
  'nearbyCitiesSource', // Metadata
  'nearbyCitiesUpdatedAt', // Metadata
  'allFinancingTypes', // Array derived from financingType
  'financingTypeLabel', // Derived
  'importedAt', // Use createdAt instead
  'scrapedAt', // Use createdAt instead
  'foundAt', // Use createdAt instead
  'verifiedAt', // Low priority
  'soldAt', // Low priority
]);

async function main() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to get database');
    return;
  }

  // Get sample from both collections
  const cash = await db.collection('cash_houses').limit(100).get();
  const zillow = await db.collection('zillow_imports').where('ownerFinanceVerified', '==', true).limit(100).get();

  console.log('=== ANALYZING FIRESTORE FIELDS VS TYPESENSE INDEX ===\n');

  // Collect all fields and their frequency
  const allFields = new Map<string, { count: number; samples: any[]; collections: Set<string> }>();

  // Process cash_houses
  for (const doc of cash.docs) {
    const data = doc.data();
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        const existing = allFields.get(key) || { count: 0, samples: [], collections: new Set() };
        existing.count++;
        existing.collections.add('cash_houses');
        if (existing.samples.length < 2 && typeof value !== 'object') {
          existing.samples.push(value);
        }
        allFields.set(key, existing);
      }
    }
  }

  // Process zillow_imports
  for (const doc of zillow.docs) {
    const data = doc.data();
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        const existing = allFields.get(key) || { count: 0, samples: [], collections: new Set() };
        existing.count++;
        existing.collections.add('zillow_imports');
        if (existing.samples.length < 2 && typeof value !== 'object') {
          existing.samples.push(value);
        }
        allFields.set(key, existing);
      }
    }
  }

  const totalDocs = cash.docs.length + zillow.docs.length;

  // Categorize fields
  const indexed: string[] = [];
  const notIndexed: Array<{ field: string; count: number; samples: any[]; collections: string }> = [];
  const skipped: string[] = [];

  for (const [field, info] of allFields.entries()) {
    if (TYPESENSE_FIELDS.has(field)) {
      indexed.push(field);
    } else if (SKIP_FIELDS.has(field)) {
      skipped.push(field);
    } else {
      notIndexed.push({
        field,
        count: info.count,
        samples: info.samples,
        collections: Array.from(info.collections).join(', '),
      });
    }
  }

  // Sort by frequency
  notIndexed.sort((a, b) => b.count - a.count);

  console.log('INDEXED IN TYPESENSE (' + indexed.length + ' fields):');
  console.log('================================================');
  console.log(indexed.sort().join(', '));

  console.log('\n\nSKIPPED (intentionally not indexed):');
  console.log('=====================================');
  console.log(skipped.sort().join(', '));

  console.log('\n\n⚠️  NOT INDEXED - SHOULD REVIEW (' + notIndexed.length + ' fields):');
  console.log('=========================================================\n');

  // Group by importance
  const highPriority: typeof notIndexed = [];
  const mediumPriority: typeof notIndexed = [];
  const lowPriority: typeof notIndexed = [];

  for (const item of notIndexed) {
    const fieldLower = item.field.toLowerCase();

    // High priority - commonly used for filtering/display
    if (
      fieldLower.includes('price') ||
      fieldLower.includes('rent') ||
      fieldLower.includes('tax') ||
      fieldLower.includes('hoa') ||
      fieldLower.includes('estimate') ||
      fieldLower.includes('zest') ||
      fieldLower.includes('percent') ||
      fieldLower.includes('discount') ||
      fieldLower.includes('arv')
    ) {
      highPriority.push(item);
    }
    // Medium priority - useful metadata
    else if (
      fieldLower.includes('url') ||
      fieldLower.includes('zpid') ||
      fieldLower.includes('status') ||
      fieldLower.includes('days') ||
      fieldLower.includes('agent') ||
      fieldLower.includes('broker') ||
      fieldLower.includes('lot') ||
      fieldLower.includes('county')
    ) {
      mediumPriority.push(item);
    }
    // Low priority
    else {
      lowPriority.push(item);
    }
  }

  if (highPriority.length > 0) {
    console.log('🔴 HIGH PRIORITY (value/pricing fields):');
    console.log('-----------------------------------------');
    for (const item of highPriority) {
      const sampleStr = item.samples.slice(0, 2).join(', ');
      console.log(`  ${item.field.padEnd(30)} | ${item.count}/${totalDocs} docs | ${item.collections}`);
      console.log(`    Sample: ${sampleStr}`);
    }
  }

  if (mediumPriority.length > 0) {
    console.log('\n🟡 MEDIUM PRIORITY (useful metadata):');
    console.log('--------------------------------------');
    for (const item of mediumPriority) {
      const sampleStr = item.samples.slice(0, 2).join(', ');
      console.log(`  ${item.field.padEnd(30)} | ${item.count}/${totalDocs} docs | ${item.collections}`);
      if (sampleStr) console.log(`    Sample: ${sampleStr.slice(0, 60)}`);
    }
  }

  if (lowPriority.length > 0) {
    console.log('\n🟢 LOW PRIORITY (less critical):');
    console.log('---------------------------------');
    for (const item of lowPriority) {
      console.log(`  ${item.field.padEnd(30)} | ${item.count}/${totalDocs} docs | ${item.collections}`);
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`Total fields in Firestore: ${allFields.size}`);
  console.log(`Currently indexed: ${indexed.length}`);
  console.log(`Intentionally skipped: ${skipped.length}`);
  console.log(`Not indexed (review needed): ${notIndexed.length}`);
  console.log(`  - High priority: ${highPriority.length}`);
  console.log(`  - Medium priority: ${mediumPriority.length}`);
  console.log(`  - Low priority: ${lowPriority.length}`);
}

main().catch(console.error);
