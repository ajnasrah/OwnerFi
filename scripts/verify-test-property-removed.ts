#!/usr/bin/env tsx
/**
 * Verify Test Property Removed from Queue
 *
 * Checks that deleted test properties were automatically
 * removed from the queue by the sync cron
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function verifyRemoval() {
  console.log('🔍 Verifying Test Property Removal\n');
  console.log('='.repeat(70));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  // Find any workflows for test properties
  const queueSnapshot = await db.collection('propertyShowcaseWorkflows').get();

  const testWorkflows = queueSnapshot.docs.filter(doc => {
    const workflow = doc.data();
    return workflow.propertyId && workflow.propertyId.startsWith('test_sync_');
  });

  console.log(`\n📊 Checking queue for test properties...\n`);

  if (testWorkflows.length === 0) {
    console.log('✅ No test property workflows found in queue!');
    console.log('   Sync successfully removed deleted properties!');
  } else {
    console.log(`⚠️  Found ${testWorkflows.length} test property workflows still in queue:\n`);

    for (const workflowDoc of testWorkflows) {
      const workflow = workflowDoc.data();
      console.log(`  Workflow: ${workflowDoc.id}`);
      console.log(`    Property ID: ${workflow.propertyId}`);
      console.log(`    Address: ${workflow.address || 'N/A'}`);
      console.log(`    Queue Status: ${workflow.queueStatus}`);
      console.log(`    Status: ${workflow.status}`);
      console.log('');

      // Check if property exists
      const propDoc = await db.collection('properties').doc(workflow.propertyId).get();
      if (propDoc.exists) {
        console.log(`    ⚠️  Property still exists in database`);
      } else {
        console.log(`    ❌ Property deleted but workflow still in queue`);
        console.log(`       This should be removed by next sync run`);
      }
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(70));

  if (testWorkflows.length === 0) {
    console.log('\n🎉 SUCCESS! Sync correctly removed deleted properties!');
  } else {
    console.log('\n⚠️  Test workflows still present');
    console.log('   This is OK if:');
    console.log('   - Workflow queueStatus is "processing" (won\'t be removed until complete)');
    console.log('   - Sync hasn\'t run yet after deletion');
    console.log('\n   Run sync again: npx tsx scripts/trigger-sync-cron.ts');
  }

  console.log('');
}

verifyRemoval().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
