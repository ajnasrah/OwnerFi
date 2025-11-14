#!/usr/bin/env tsx
/**
 * Delete Test Property
 *
 * Deletes the test property from the database to verify
 * the sync cron automatically removes it from the queue
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function deleteTestProperty() {
  console.log('🗑️  Deleting Test Property\n');
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

  console.log(`\n📊 Found ${propertiesSnapshot.size} test properties to delete\n`);

  if (propertiesSnapshot.empty) {
    console.log('❌ No test properties found!');
    return;
  }

  for (const propDoc of propertiesSnapshot.docs) {
    const prop = propDoc.data();
    const propId = propDoc.id;

    console.log(`Deleting: ${propId}`);
    console.log(`  Address: ${prop.address}`);
    console.log(`  City: ${prop.city}, ${prop.state}`);

    // Check if in queue before deleting
    const queueSnapshot = await db.collection('propertyShowcaseWorkflows')
      .where('propertyId', '==', propId)
      .get();

    if (!queueSnapshot.empty) {
      console.log(`  ⚠️  Property is currently in queue (${queueSnapshot.size} workflows)`);
      console.log(`     Will be removed by next sync cron`);
    }

    // Delete from properties
    await propDoc.ref.delete();
    console.log(`  ✅ Deleted from properties collection`);
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('✅ Test Properties Deleted!');
  console.log('='.repeat(70));
  console.log('\n📋 Next Steps:');
  console.log('   1. Run sync cron:');
  console.log('      npx tsx scripts/trigger-sync-cron.ts');
  console.log('');
  console.log('   2. Verify property was removed from queue:');
  console.log('      npx tsx scripts/verify-test-property-removed.ts');
  console.log('');
}

deleteTestProperty().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
