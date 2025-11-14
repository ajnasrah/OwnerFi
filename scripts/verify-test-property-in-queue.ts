#!/usr/bin/env tsx
/**
 * Verify Test Property in Queue
 *
 * Checks if the test property was automatically added to the queue
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function verifyTestProperty() {
  console.log('🔍 Verifying Test Property in Queue\n');
  console.log('='.repeat(70));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  // Find all test properties
  const propertiesSnapshot = await db.collection('properties')
    .where('source', '==', 'test_sync_script')
    .get();

  console.log(`\n📊 Found ${propertiesSnapshot.size} test properties in database\n`);

  if (propertiesSnapshot.empty) {
    console.log('❌ No test properties found!');
    console.log('   Run: npx tsx scripts/create-test-property-for-sync.ts');
    return;
  }

  let totalFound = 0;
  let totalMissing = 0;

  for (const propDoc of propertiesSnapshot.docs) {
    const prop = propDoc.data();
    const propId = propDoc.id;

    console.log(`Property: ${propId}`);
    console.log(`  Address: ${prop.address}`);
    console.log(`  City: ${prop.city}, ${prop.state}`);
    console.log(`  Status: ${prop.status}`);
    console.log(`  Active: ${prop.isActive}`);
    console.log(`  Images: ${prop.imageUrls?.length || 0}`);

    // Check if in queue
    const queueSnapshot = await db.collection('propertyShowcaseWorkflows')
      .where('propertyId', '==', propId)
      .get();

    if (queueSnapshot.empty) {
      console.log(`  ❌ NOT IN QUEUE`);
      totalMissing++;
    } else {
      const workflow = queueSnapshot.docs[0].data();
      console.log(`  ✅ IN QUEUE`);
      console.log(`     Workflow ID: ${queueSnapshot.docs[0].id}`);
      console.log(`     Queue Status: ${workflow.queueStatus}`);
      console.log(`     Queue Position: ${workflow.queuePosition}`);
      console.log(`     Status: ${workflow.status}`);
      totalFound++;
    }

    console.log('');
  }

  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ In Queue: ${totalFound}`);
  console.log(`❌ Missing: ${totalMissing}`);

  if (totalMissing === 0) {
    console.log('\n🎉 ALL test properties are in the queue!');
    console.log('   Sync is working correctly!');
  } else {
    console.log('\n⚠️  Some test properties are missing from queue');
    console.log('   Run sync again: npx tsx scripts/trigger-sync-cron.ts');
  }

  console.log('');
}

verifyTestProperty().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
