/**
 * Check Property Video Workflows for Stuck Status
 * Run with: npx tsx scripts/check-property-stuck.ts
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

async function checkStuckPropertyWorkflows() {
  console.log('🔍 Checking property video workflows for stuck status...\n');

  try {
    // Check property_rotation_queue
    console.log('📊 Property Rotation Queue:');
    const rotationSnapshot = await db.collection('property_rotation_queue')
      .orderBy('status')
      .orderBy('position')
      .get();

    const stats = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    rotationSnapshot.docs.forEach(doc => {
      const data = doc.data();
      stats[data.status as keyof typeof stats]++;
    });

    console.log(`   Total properties: ${rotationSnapshot.size}`);
    console.log(`   Queued: ${stats.queued}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Failed: ${stats.failed}\n`);

    // Check property_videos collection for stuck workflows
    console.log('📊 Property Videos Collection:');
    const now = Date.now();
    const statuses = ['pending', 'heygen_processing', 'submagic_processing', 'video_processing', 'posting'];

    for (const status of statuses) {
      const snapshot = await db.collection('property_videos')
        .where('status', '==', status)
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();

      if (snapshot.size > 0) {
        console.log(`\n   Status: ${status} (${snapshot.size} workflows)`);

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const stuckMinutes = Math.round((now - data.updatedAt) / 60000);
          const stuckHours = Math.round(stuckMinutes / 60);

          console.log(`      - ${doc.id}`);
          console.log(`        Property: ${data.address || 'N/A'}`);
          console.log(`        Stuck: ${stuckHours}h (${stuckMinutes}m)`);
          console.log(`        Retry count: ${data.retryCount || 0}`);
          if (data.error) {
            console.log(`        Error: ${data.error}`);
          }
        });
      }
    }

    // Check for workflows stuck in posting for >10 minutes
    console.log('\n🚨 Workflows Stuck in Posting (>10 minutes):');
    const tenMinutesAgo = now - (10 * 60 * 1000);

    const stuckPosting = await db.collection('property_videos')
      .where('status', '==', 'posting')
      .where('updatedAt', '<', tenMinutesAgo)
      .get();

    if (stuckPosting.size > 0) {
      console.log(`   Found ${stuckPosting.size} stuck in posting!`);
      stuckPosting.docs.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((now - data.updatedAt) / 60000);
        console.log(`      - ${doc.id}: ${data.address} (${stuckMinutes}m stuck)`);
        console.log(`        Has video URL: ${!!data.finalVideoUrl}`);
        console.log(`        Retry count: ${data.retryCount || 0}`);
      });
    } else {
      console.log('   No workflows stuck in posting >10 minutes');
    }

    // Check for workflows stuck in video_processing for >10 minutes
    console.log('\n🚨 Workflows Stuck in Video Processing (>10 minutes):');

    const stuckProcessing = await db.collection('property_videos')
      .where('status', '==', 'video_processing')
      .where('updatedAt', '<', tenMinutesAgo)
      .get();

    if (stuckProcessing.size > 0) {
      console.log(`   Found ${stuckProcessing.size} stuck in video_processing!`);
      stuckProcessing.docs.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((now - data.updatedAt) / 60000);
        console.log(`      - ${doc.id}: ${data.address} (${stuckMinutes}m stuck)`);
        console.log(`        Submagic project ID: ${data.submagicProjectId || 'N/A'}`);
        console.log(`        Retry count: ${data.retryCount || 0}`);
      });
    } else {
      console.log('   No workflows stuck in video_processing >10 minutes');
    }

    // Check recent completed workflows
    console.log('\n✅ Recent Completed Workflows:');
    const completed = await db.collection('property_videos')
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(5)
      .get();

    if (completed.size > 0) {
      console.log(`   Last ${completed.size} completed:`);
      completed.docs.forEach(doc => {
        const data = doc.data();
        const completedAgo = Math.round((now - data.completedAt) / (1000 * 60 * 60));
        console.log(`      - ${data.address}: ${completedAgo}h ago`);
      });
    } else {
      console.log('   No completed workflows found');
    }

  } catch (error) {
    console.error('❌ Error checking workflows:', error);
  }
}

checkStuckPropertyWorkflows().catch(console.error);
