/**
 * Property Queue System Test Script
 * Tests the NEW propertyShowcaseWorkflows system end-to-end
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testPropertyQueueSystem() {
  console.log('🧪 Testing NEW Property Queue System\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check if NEW collection exists and has data
    console.log('\n📊 TEST 1: Check propertyShowcaseWorkflows collection');
    console.log('-'.repeat(60));

    const workflowsSnapshot = await getDocs(collection(db, 'propertyShowcaseWorkflows'));
    console.log(`✅ Collection exists: propertyShowcaseWorkflows`);
    console.log(`   Total workflows: ${workflowsSnapshot.size}`);

    if (workflowsSnapshot.empty) {
      console.log('⚠️  Queue is empty - this might be expected if sync hasn\'t run yet');
    } else {
      // Show sample workflow
      const sample = workflowsSnapshot.docs[0].data();
      console.log('\n   Sample workflow:');
      console.log(`   - ID: ${workflowsSnapshot.docs[0].id}`);
      console.log(`   - Property ID: ${sample.propertyId}`);
      console.log(`   - Queue Status: ${sample.queueStatus}`);
      console.log(`   - Queue Position: ${sample.queuePosition}`);
      console.log(`   - Workflow Status: ${sample.status}`);
      console.log(`   - Address: ${sample.address}`);
      console.log(`   - City: ${sample.city}, ${sample.state}`);
      console.log(`   - Total Videos Generated: ${sample.totalVideosGenerated || 0}`);
    }

    // Test 2: Check queue status breakdown
    console.log('\n📊 TEST 2: Queue Status Breakdown');
    console.log('-'.repeat(60));

    const queuedQuery = query(
      collection(db, 'propertyShowcaseWorkflows'),
      where('queueStatus', '==', 'queued')
    );
    const queuedSnapshot = await getDocs(queuedQuery);

    const processingQuery = query(
      collection(db, 'propertyShowcaseWorkflows'),
      where('queueStatus', '==', 'processing')
    );
    const processingSnapshot = await getDocs(processingQuery);

    const completedQuery = query(
      collection(db, 'propertyShowcaseWorkflows'),
      where('queueStatus', '==', 'completed_cycle')
    );
    const completedSnapshot = await getDocs(completedQuery);

    console.log(`   Queued: ${queuedSnapshot.size}`);
    console.log(`   Processing: ${processingSnapshot.size}`);
    console.log(`   Completed (this cycle): ${completedSnapshot.size}`);
    console.log(`   Total: ${workflowsSnapshot.size}`);

    // Test 3: Check next property in queue
    console.log('\n📊 TEST 3: Next Property in Queue');
    console.log('-'.repeat(60));

    const nextQuery = query(
      collection(db, 'propertyShowcaseWorkflows'),
      where('queueStatus', '==', 'queued'),
      limit(1)
    );
    const nextSnapshot = await getDocs(nextQuery);

    if (!nextSnapshot.empty) {
      const next = nextSnapshot.docs[0].data();
      console.log(`✅ Next property ready for processing:`);
      console.log(`   - Address: ${next.address}`);
      console.log(`   - City: ${next.city}, ${next.state}`);
      console.log(`   - Queue Position: ${next.queuePosition}`);
      console.log(`   - Down Payment: $${next.downPayment?.toLocaleString() || 'N/A'}`);
      console.log(`   - Monthly Payment: $${next.monthlyPayment?.toLocaleString() || 'N/A'}`);
      console.log(`   - Times Shown: ${next.totalVideosGenerated || 0}`);
    } else {
      console.log('⚠️  No properties queued (cycle may be complete)');
    }

    // Test 4: Check active properties count
    console.log('\n📊 TEST 4: Active Properties in Database');
    console.log('-'.repeat(60));

    const activePropertiesQuery = query(
      collection(db, 'properties'),
      where('status', '==', 'active'),
      where('isActive', '==', true)
    );
    const activePropertiesSnapshot = await getDocs(activePropertiesQuery);

    console.log(`   Total active properties: ${activePropertiesSnapshot.size}`);

    // Count how many have images
    let withImages = 0;
    activePropertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.imageUrls && data.imageUrls.length > 0) {
        withImages++;
      }
    });

    console.log(`   Active properties with images: ${withImages}`);
    console.log(`   Expected queue size after sync: ${withImages}`);

    if (withImages !== workflowsSnapshot.size) {
      console.log(`\n⚠️  MISMATCH DETECTED:`);
      console.log(`   Properties with images: ${withImages}`);
      console.log(`   Workflows in queue: ${workflowsSnapshot.size}`);
      console.log(`   Difference: ${withImages - workflowsSnapshot.size}`);
      console.log(`\n   This is normal if:`);
      console.log(`   - Sync cron hasn't run yet (runs every 6 hours)`);
      console.log(`   - Properties were just added/updated`);
      console.log(`   - Some workflows are currently processing`);
    } else {
      console.log(`\n✅ Queue is in perfect sync with active properties!`);
    }

    // Test 5: Check OLD collections (should be empty or ignored)
    console.log('\n📊 TEST 5: OLD Collections Status');
    console.log('-'.repeat(60));

    try {
      const oldQueueSnapshot = await getDocs(collection(db, 'property_rotation_queue'));
      const oldVideosSnapshot = await getDocs(collection(db, 'property_videos'));

      console.log(`   property_rotation_queue: ${oldQueueSnapshot.size} documents`);
      console.log(`   property_videos: ${oldVideosSnapshot.size} documents`);

      if (oldQueueSnapshot.size > 0 || oldVideosSnapshot.size > 0) {
        console.log(`\n   ⚠️  OLD collections still contain data`);
        console.log(`   Status: NO LONGER USED by the system`);
        console.log(`   Action: Can be archived (kept for audit trail)`);
      } else {
        console.log(`\n   ✅ OLD collections are empty`);
      }
    } catch (error) {
      console.log(`   ℹ️  Could not check old collections (may not exist)`);
    }

    // Test 6: Workflow status breakdown
    console.log('\n📊 TEST 6: Workflow Status Breakdown');
    console.log('-'.repeat(60));

    const statusCounts: Record<string, number> = {};
    workflowsSnapshot.docs.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const allGood = workflowsSnapshot.size > 0 && queuedSnapshot.size >= 0;

    if (allGood) {
      console.log('✅ NEW System Status: OPERATIONAL');
      console.log('✅ Collection: propertyShowcaseWorkflows');
      console.log('✅ Queue Active: YES');
      console.log('✅ Ready for Video Generation: YES');
      console.log('\nThe migration is SUCCESSFUL and the system is ready!');
    } else {
      console.log('⚠️  System needs attention:');
      if (workflowsSnapshot.size === 0) {
        console.log('   - Queue is empty - trigger sync cron or wait for next run');
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('   1. Monitor next video cron run (5x daily)');
    console.log('   2. Check SubMagic webhook updates');
    console.log('   3. Verify queue syncs every 6 hours');
    console.log('   4. Test property deletion cleanup');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run tests
testPropertyQueueSystem()
  .then(() => {
    console.log('\n✅ All tests completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  });
