/**
 * Investigate: Cash deals with no Zestimate
 *
 * Why do 1,151 properties have isCashDeal=true but no Zestimate?
 *
 * Usage: npx tsx scripts/investigate-no-zestimate.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  console.log('Investigating cash deals with no Zestimate...\n');

  // Get all cash deals
  const snapshot = await db.collection('properties')
    .where('isCashDeal', '==', true)
    .get();

  console.log(`Total cash deals: ${snapshot.size}\n`);

  let noZestimate = 0;
  let hasZestimate = 0;

  // Track sources, field patterns, creation dates
  const sources = new Map<string, number>();
  const zestimateFieldNames = new Set<string>();
  const creationDates = new Map<string, number>(); // month -> count
  const sampleDocs: any[] = [];

  // All possible Zestimate field names to check
  const zestFields = ['zestimate', 'estimate', 'estimatedValue', 'homeValue', 'zEstimate', 'Zestimate'];

  for (const doc of snapshot.docs) {
    const d = doc.data();

    // Check all possible zestimate fields
    let foundZestimate = false;
    let zestValue = 0;
    for (const field of zestFields) {
      if (d[field] && d[field] > 0) {
        foundZestimate = true;
        zestValue = d[field];
        zestimateFieldNames.add(field);
        break;
      }
    }

    if (foundZestimate) {
      hasZestimate++;
    } else {
      noZestimate++;

      // Track source
      const source = d.source || d.importMethod || d.sourceType || 'unknown';
      sources.set(source, (sources.get(source) || 0) + 1);

      // Track creation date
      const createdAt = d.createdAt?.toDate?.() || d.foundAt?.toDate?.() || d.importedAt?.toDate?.() || d.dateAdded;
      if (createdAt) {
        const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        creationDates.set(monthKey, (creationDates.get(monthKey) || 0) + 1);
      }

      // Sample first 10 for deep inspection
      if (sampleDocs.length < 10) {
        // Get ALL fields on the doc to find any zestimate-like fields
        const allKeys = Object.keys(d);
        const priceFields = allKeys.filter(k =>
          k.toLowerCase().includes('zest') ||
          k.toLowerCase().includes('estim') ||
          k.toLowerCase().includes('value') ||
          k.toLowerCase().includes('arv') ||
          k.toLowerCase().includes('comp')
        );

        sampleDocs.push({
          id: doc.id,
          address: d.streetAddress || d.address || d.fullAddress || '?',
          price: d.price || d.listPrice || 0,
          source: d.source || 'unknown',
          importMethod: d.importMethod || 'unknown',
          isCashDeal: d.isCashDeal,
          isOwnerfinance: d.isOwnerfinance,
          dealTypes: d.dealTypes || [],
          cashDealReason: d.cashDealReason,
          discountPercentage: d.discountPercentage,
          eightyPercentOfZestimate: d.eightyPercentOfZestimate,
          isActive: d.isActive,
          homeStatus: d.homeStatus,
          createdAt: d.createdAt?.toDate?.()?.toISOString() || d.dateAdded || 'unknown',
          priceRelatedFields: priceFields,
          priceFieldValues: Object.fromEntries(priceFields.map(k => [k, d[k]])),
          allFieldCount: allKeys.length,
        });
      }
    }
  }

  // Results
  console.log('--- ZESTIMATE FIELD ANALYSIS ---');
  console.log(`Cash deals WITH Zestimate: ${hasZestimate}`);
  console.log(`Cash deals WITHOUT Zestimate: ${noZestimate}`);
  console.log(`Zestimate field names found in valid docs: ${[...zestimateFieldNames].join(', ')}`);

  console.log('\n--- SOURCES OF NO-ZESTIMATE CASH DEALS ---');
  const sortedSources = [...sources.entries()].sort((a, b) => b[1] - a[1]);
  for (const [source, count] of sortedSources) {
    console.log(`  ${source}: ${count}`);
  }

  console.log('\n--- CREATION DATES ---');
  const sortedDates = [...creationDates.entries()].sort();
  for (const [month, count] of sortedDates) {
    console.log(`  ${month}: ${count}`);
  }

  console.log('\n--- SAMPLE DOCS (first 10 no-zestimate cash deals) ---');
  for (const doc of sampleDocs) {
    console.log(`\n  ${doc.id}`);
    console.log(`    Address: ${doc.address}`);
    console.log(`    Price: $${doc.price?.toLocaleString()}`);
    console.log(`    Source: ${doc.source} / ${doc.importMethod}`);
    console.log(`    Deal types: ${JSON.stringify(doc.dealTypes)}`);
    console.log(`    isCashDeal: ${doc.isCashDeal}, isOwnerfinance: ${doc.isOwnerfinance}`);
    console.log(`    cashDealReason: ${doc.cashDealReason}`);
    console.log(`    discountPercentage: ${doc.discountPercentage}`);
    console.log(`    eightyPercentOfZestimate: ${doc.eightyPercentOfZestimate}`);
    console.log(`    isActive: ${doc.isActive}`);
    console.log(`    Created: ${doc.createdAt}`);
    console.log(`    Price-related fields: ${doc.priceRelatedFields.join(', ') || 'NONE'}`);
    if (Object.keys(doc.priceFieldValues).length > 0) {
      console.log(`    Field values: ${JSON.stringify(doc.priceFieldValues)}`);
    }
  }

  // Check: how many have discountPercentage but no zestimate?
  let hasDiscountNoZest = 0;
  let hasEightyPctNoZest = 0;
  let hasCashDealReasonNoZest = 0;

  for (const doc of snapshot.docs) {
    const d = doc.data();
    let hasZest = false;
    for (const field of zestFields) {
      if (d[field] && d[field] > 0) { hasZest = true; break; }
    }
    if (hasZest) continue;

    if (d.discountPercentage && d.discountPercentage > 0) hasDiscountNoZest++;
    if (d.eightyPercentOfZestimate && d.eightyPercentOfZestimate > 0) hasEightyPctNoZest++;
    if (d.cashDealReason) hasCashDealReasonNoZest++;
  }

  console.log('\n--- GHOST DATA CHECK ---');
  console.log(`No-zestimate cash deals with discountPercentage > 0: ${hasDiscountNoZest}`);
  console.log(`No-zestimate cash deals with eightyPercentOfZestimate > 0: ${hasEightyPctNoZest}`);
  console.log(`No-zestimate cash deals with cashDealReason set: ${hasCashDealReasonNoZest}`);
}

main().catch(console.error).finally(() => process.exit(0));
