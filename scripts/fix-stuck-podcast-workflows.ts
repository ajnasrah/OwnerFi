/**
 * Fix stuck podcast workflows by resetting them to failed
 * These workflows are stuck with status='heygen_processing' but no heygenVideoId
 */

import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function fixStuckPodcasts() {
  console.log('🔧 Fixing stuck podcast workflows...\n');

  const snapshot = await db.collection('podcast_workflow_queue')
    .where('status', '==', 'heygen_processing')
    .limit(20)
    .get();

  console.log(`Found ${snapshot.size} workflows in heygen_processing status\n`);

  let fixed = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const workflowId = doc.id;
    const videoId = data.heygenVideoId;

    console.log(`📄 ${workflowId}: ${data.episodeTitle}`);

    // If no video ID, this workflow never actually started HeyGen processing
    if (!videoId) {
      console.log(`   ❌ No heygenVideoId found - marking as failed`);

      await doc.ref.update({
        status: 'failed',
        error: 'Stuck in heygen_processing with no heygenVideoId - likely HeyGen API call failed',
        failedAt: Date.now(),
        updatedAt: Date.now()
      });

      fixed++;
    } else {
      console.log(`   ✅ Has video ID ${videoId} - skipping (will be handled by cron)`);
      skipped++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Fixed: ${fixed} workflows`);
  console.log(`⏭️  Skipped: ${skipped} workflows (have video ID)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

fixStuckPodcasts().catch(console.error);
