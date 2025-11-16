/**
 * Migration Script: Update existing zillow_imports with new filter system
 *
 * This will:
 * 1. Re-run strict filter on all existing properties
 * 2. Add new fields (status, keywords, etc.) to properties that pass
 * 3. DELETE properties that don't pass strict filter
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function migrateProperties() {
  console.log('🔄 Migrating Existing Properties to New Filter System\n');
  console.log('=' .repeat(80));
  console.log('⚠️  WARNING: This will DELETE properties that fail the strict filter!');
  console.log('=' .repeat(80));

  // Get all existing properties
  const snapshot = await db.collection('zillow_imports').get();
  console.log(`\n📊 Found ${snapshot.size.toLocaleString()} properties to process\n`);

  let updated = 0;
  let deleted = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 500;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const description = data.description || '';

      // Run strict filter
      const filterResult = hasStrictOwnerFinancing(description);

      if (filterResult.passes) {
        // PASS: Update with new fields
        batch.update(doc.ref, {
          // Owner Finance Detection
          ownerFinanceVerified: true,
          primaryKeyword: filterResult.primaryKeyword,
          matchedKeywords: filterResult.matchedKeywords,

          // Status tracking - starts as null until financing terms are filled
          status: null,
          foundAt: data.importedAt || new Date(),
          verifiedAt: null,
          soldAt: null,

          // Keep existing GHL tracking
          // sentToGHL, ghlSentAt, etc. stay as-is
        });

        updated++;
        console.log(`✅ ${updated}. UPDATED: ${data.fullAddress || 'N/A'} (${filterResult.primaryKeyword})`);
      } else {
        // FAIL: Delete property
        batch.delete(doc.ref);
        deleted++;
        console.log(`❌ ${deleted}. DELETED: ${data.fullAddress || 'N/A'} (no owner finance keywords)`);
      }

      batchCount++;

      // Commit batch if limit reached
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`\n💾 Committed batch of ${batchCount} operations\n`);
        batchCount = 0;
      }

    } catch (error: any) {
      console.error(`⚠️  Error processing ${doc.id}: ${error.message}`);
      errors++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`\n💾 Committed final batch of ${batchCount} operations\n`);
  }

  console.log('\n' + '=' .repeat(80));
  console.log('📊 MIGRATION COMPLETE');
  console.log('=' .repeat(80));
  console.log(`Total processed: ${snapshot.size.toLocaleString()}`);
  console.log(`✅ Updated (passed filter): ${updated.toLocaleString()}`);
  console.log(`❌ Deleted (failed filter): ${deleted.toLocaleString()}`);
  console.log(`⚠️  Errors: ${errors.toLocaleString()}`);
  console.log('=' .repeat(80));

  const keepPercentage = ((updated / snapshot.size) * 100).toFixed(1);
  console.log(`\n📈 Keep Rate: ${keepPercentage}% of properties passed strict filter`);

  console.log('\n✅ Migration complete!');
  console.log('   Buyers will now see these properties on the dashboard.');
}

// Run migration
console.log('\n⚠️  This migration will DELETE properties that don\'t mention owner financing!');
console.log('Starting in 3 seconds... Press Ctrl+C to cancel\n');

setTimeout(() => {
  migrateProperties().catch(console.error);
}, 3000);
