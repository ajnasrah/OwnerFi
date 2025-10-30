/**
 * Reset Property Rotation Queue
 * Marks all 22 completed properties as "queued" again to start a fresh cycle
 *
 * Run with: npx tsx scripts/reset-property-queue.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function resetQueue() {
  console.log('🔄 Resetting Property Rotation Queue\n');
  console.log('='.repeat(80));

  try {
    // Get all properties in rotation queue
    const queueSnapshot = await db.collection('property_rotation_queue').get();

    console.log(`\n📊 Current Queue Status:`);
    console.log(`   Total properties: ${queueSnapshot.size}`);

    const stats = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    queueSnapshot.docs.forEach(doc => {
      const status = doc.data().status as keyof typeof stats;
      if (stats[status] !== undefined) {
        stats[status]++;
      }
    });

    console.log(`   Queued: ${stats.queued}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Failed: ${stats.failed}`);

    if (stats.completed === 0) {
      console.log('\n⚠️  No completed properties found. Queue may already be reset or empty.');
      return;
    }

    // Reset all completed properties to queued
    console.log(`\n🔄 Resetting ${stats.completed} completed properties to "queued"...`);

    const batch = db.batch();
    let resetCount = 0;

    queueSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed') {
        batch.update(doc.ref, {
          status: 'queued',
          currentCycleCount: (data.currentCycleCount || 0) + 1,
          lastResetAt: Date.now()
        });
        resetCount++;
      }
    });

    if (resetCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully reset ${resetCount} properties!`);
    }

    // Get updated stats
    console.log(`\n📊 Updated Queue Status:`);
    const updatedSnapshot = await db.collection('property_rotation_queue').get();

    const updatedStats = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    updatedSnapshot.docs.forEach(doc => {
      const status = doc.data().status as keyof typeof updatedStats;
      if (updatedStats[status] !== undefined) {
        updatedStats[status]++;
      }
    });

    console.log(`   Queued: ${updatedStats.queued}`);
    console.log(`   Processing: ${updatedStats.processing}`);
    console.log(`   Completed: ${updatedStats.completed}`);
    console.log(`   Failed: ${updatedStats.failed}`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Queue reset complete! All 22 properties are now queued for video generation.');
    console.log('\n💡 Next steps:');
    console.log('   1. Wait for the next cron run (scheduled in vercel.json)');
    console.log('   2. OR manually trigger: curl /api/property/video-cron');
    console.log('   3. Monitor progress with: npx tsx scripts/check-property-stuck.ts');
    console.log('');

  } catch (error) {
    console.error('❌ Error resetting queue:', error);
    throw error;
  }
}

resetQueue().catch(console.error);
