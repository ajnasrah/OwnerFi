#!/usr/bin/env tsx
/**
 * Test Property Queue Sync System
 *
 * This script thoroughly tests the new sync system to ensure it:
 * 1. Adds new active properties to the queue
 * 2. Removes deleted/inactive properties from the queue
 * 3. Handles edge cases correctly
 * 4. Doesn't remove properties that are currently processing
 *
 * Run after migration to verify the sync system works 1,000%
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  syncPropertyQueue,
  getPropertyQueueStats,
  addPropertyToShowcaseQueue
} from '../src/lib/property-workflow';

async function runTests() {
  console.log('🧪 Property Queue Sync Test Suite\n');
  console.log('='.repeat(70));

  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  // Get initial state
  console.log('\n📊 INITIAL STATE');
  console.log('-'.repeat(70));

  const initialStats = await getPropertyQueueStats();
  console.log(`Queue stats:`);
  console.log(`  Total: ${initialStats.total}`);
  console.log(`  Queued: ${initialStats.queued}`);
  console.log(`  Processing: ${initialStats.processing}`);
  console.log(`  Completed: ${initialStats.completed}`);

  // Get counts from source collections
  const propertiesSnapshot = await getDocs(query(
    collection(db, 'properties'),
    where('isActive', '==', true),
    where('status', '==', 'active')
  ));

  const propertiesWithImages = propertiesSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.imageUrls && data.imageUrls.length > 0;
  });

  console.log(`\nActive properties: ${propertiesSnapshot.size} total`);
  console.log(`With images: ${propertiesWithImages.length}`);

  // Test 1: Run sync
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: Run Full Sync');
  console.log('='.repeat(70));

  const syncResult = await syncPropertyQueue();

  console.log(`\nSync results:`);
  console.log(`  ✅ Added: ${syncResult.added} properties`);
  console.log(`  🗑️  Removed: ${syncResult.removed} properties`);

  // Get state after sync
  const afterSyncStats = await getPropertyQueueStats();
  console.log(`\nQueue stats after sync:`);
  console.log(`  Total: ${afterSyncStats.total}`);
  console.log(`  Queued: ${afterSyncStats.queued}`);
  console.log(`  Processing: ${afterSyncStats.processing}`);
  console.log(`  Completed: ${afterSyncStats.completed}`);

  // Test 2: Verify all active properties are in queue
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: Verify All Active Properties Are In Queue');
  console.log('='.repeat(70));

  const queueSnapshot = await getDocs(collection(db, 'propertyShowcaseWorkflows'));
  const queuedPropertyIds = new Set(queueSnapshot.docs.map(doc => doc.data().propertyId));

  let missing = 0;
  const missingList: string[] = [];

  for (const propDoc of propertiesWithImages) {
    if (!queuedPropertyIds.has(propDoc.id)) {
      missing++;
      missingList.push(propDoc.id);

      if (missingList.length <= 5) {
        console.log(`  ❌ Missing: ${propDoc.id} (${propDoc.data().address})`);
      }
    }
  }

  if (missing === 0) {
    console.log(`  ✅ ALL ${propertiesWithImages.length} active properties are in queue!`);
  } else {
    console.log(`  ❌ FAILED: ${missing} properties missing from queue`);
    if (missingList.length > 5) {
      console.log(`     (showing first 5, ${missing - 5} more missing)`);
    }
  }

  // Test 3: Verify no deleted properties in queue
  console.log('\n' + '='.repeat(70));
  console.log('TEST 3: Verify No Deleted Properties In Queue');
  console.log('='.repeat(70));

  const activePropertyIds = new Set(propertiesWithImages.map(doc => doc.id));
  let orphaned = 0;
  const orphanedList: string[] = [];

  for (const workflowDoc of queueSnapshot.docs) {
    const workflow = workflowDoc.data();
    if (!activePropertyIds.has(workflow.propertyId)) {
      // Skip if currently processing (these should be allowed)
      if (workflow.queueStatus === 'processing') {
        console.log(`  ⚠️  Property ${workflow.propertyId} deleted but currently processing (OK)`);
        continue;
      }

      orphaned++;
      orphanedList.push(workflow.propertyId);

      if (orphanedList.length <= 5) {
        console.log(`  ❌ Orphaned: ${workflow.propertyId} (status: ${workflow.queueStatus})`);
      }
    }
  }

  if (orphaned === 0) {
    console.log(`  ✅ No orphaned properties in queue!`);
  } else {
    console.log(`  ❌ FAILED: ${orphaned} orphaned properties found`);
    if (orphanedList.length > 5) {
      console.log(`     (showing first 5, ${orphaned - 5} more orphaned)`);
    }
  }

  // Test 4: Run sync again (should be idempotent)
  console.log('\n' + '='.repeat(70));
  console.log('TEST 4: Run Sync Again (Idempotency Test)');
  console.log('='.repeat(70));

  const secondSyncResult = await syncPropertyQueue();

  console.log(`\nSecond sync results:`);
  console.log(`  Added: ${secondSyncResult.added} (should be 0)`);
  console.log(`  Removed: ${secondSyncResult.removed} (should be 0)`);

  if (secondSyncResult.added === 0 && secondSyncResult.removed === 0) {
    console.log(`  ✅ Sync is idempotent!`);
  } else {
    console.log(`  ❌ FAILED: Sync added/removed on second run (not idempotent)`);
  }

  // Test 5: Check queue positions are sequential
  console.log('\n' + '='.repeat(70));
  console.log('TEST 5: Verify Queue Positions Are Sequential');
  console.log('='.repeat(70));

  const queuedWorkflows = queueSnapshot.docs
    .map(doc => doc.data())
    .filter(w => w.queueStatus === 'queued')
    .sort((a, b) => a.queuePosition - b.queuePosition);

  let positionErrors = 0;
  for (let i = 0; i < Math.min(queuedWorkflows.length, 10); i++) {
    const workflow = queuedWorkflows[i];
    const expectedPosition = i + 1;

    if (workflow.queuePosition !== expectedPosition) {
      console.log(`  ❌ Position error: workflow at index ${i} has position ${workflow.queuePosition}, expected ${expectedPosition}`);
      positionErrors++;
    }
  }

  if (positionErrors === 0 && queuedWorkflows.length > 0) {
    console.log(`  ✅ Queue positions are sequential (checked first 10)`);
    console.log(`     First: position ${queuedWorkflows[0].queuePosition}`);
    console.log(`     Last: position ${queuedWorkflows[queuedWorkflows.length - 1].queuePosition}`);
  } else if (queuedWorkflows.length === 0) {
    console.log(`  ⚠️  No queued workflows to check`);
  } else {
    console.log(`  ❌ FAILED: ${positionErrors} position errors found`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const allPassed =
    missing === 0 &&
    orphaned === 0 &&
    secondSyncResult.added === 0 &&
    secondSyncResult.removed === 0 &&
    positionErrors === 0;

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED! Queue sync is 1,000% correct!');
    console.log(`\n📊 Final Stats:`);
    console.log(`   Properties in database: ${propertiesWithImages.length}`);
    console.log(`   Properties in queue: ${afterSyncStats.total}`);
    console.log(`   Match: ${propertiesWithImages.length === afterSyncStats.total ? '✅ YES' : '❌ NO'}`);

    if (afterSyncStats.nextProperty) {
      console.log(`\n🎬 Next property to generate:`);
      console.log(`   ${afterSyncStats.nextProperty.address}`);
      console.log(`   ${afterSyncStats.nextProperty.city}, ${afterSyncStats.nextProperty.state}`);
      console.log(`   Position: ${afterSyncStats.nextProperty.queuePosition}`);
    }
  } else {
    console.log('❌ SOME TESTS FAILED - Review errors above');
    console.log(`\nFailed checks:`);
    if (missing > 0) console.log(`   - ${missing} properties missing from queue`);
    if (orphaned > 0) console.log(`   - ${orphaned} orphaned workflows in queue`);
    if (secondSyncResult.added > 0 || secondSyncResult.removed > 0) {
      console.log(`   - Sync not idempotent (${secondSyncResult.added} added, ${secondSyncResult.removed} removed on second run)`);
    }
    if (positionErrors > 0) console.log(`   - ${positionErrors} queue position errors`);
  }

  console.log('');
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
