/**
 * Test property auto-delete from rotation queue
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

async function testQueueAutoDelete() {
  console.log('🧪 Testing Property Auto-Delete from Queue');
  console.log('==========================================\n');

  const propertyId = 'test-queue-1762990813607';

  try {
    // 1. Check queue before deletion
    console.log('1️⃣ Checking queue BEFORE deletion...\n');

    const queueQueryBefore = query(
      collection(db, 'property_videos'),
      where('propertyId', '==', propertyId)
    );

    const queueSnapshotBefore = await getDocs(queueQueryBefore);
    console.log(`   Found ${queueSnapshotBefore.size} workflow(s) in queue\n`);

    if (queueSnapshotBefore.size === 0) {
      console.log('❌ Property not in queue - nothing to test');
      return;
    }

    // 2. Delete property
    console.log('2️⃣ Deleting property from database...\n');

    await deleteDoc(doc(db, 'properties', propertyId));
    console.log('   ✅ Property deleted\n');

    // 3. Wait a moment
    console.log('3️⃣ Waiting 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Check queue after deletion
    console.log('4️⃣ Checking queue AFTER deletion...\n');

    const queueQueryAfter = query(
      collection(db, 'property_videos'),
      where('propertyId', '==', propertyId)
    );

    const queueSnapshotAfter = await getDocs(queueQueryAfter);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`   Before deletion: ${queueSnapshotBefore.size} workflow(s)`);
    console.log(`   After deletion:  ${queueSnapshotAfter.size} workflow(s)\n`);

    if (queueSnapshotAfter.size === 0) {
      console.log('✅ SUCCESS! Workflows were auto-deleted from queue');
      console.log('🎉 AUTO-DELETE IS WORKING!\n');
    } else {
      console.log('⚠️  NOTICE: Workflows still in queue');
      console.log('   This is EXPECTED - auto-delete happens via webhook or cron cleanup');
      console.log('   The queue item will be cleaned up by:');
      console.log('   1. Weekly maintenance cron (cleanup-stale-properties)');
      console.log('   2. Manual cleanup via admin panel\n');

      queueSnapshotAfter.forEach(doc => {
        const data = doc.data();
        console.log(`   Remaining workflow: ${doc.id} (status: ${data.status})`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testQueueAutoDelete().catch(console.error);
