/**
 * Delete ALL property_videos from queue
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

async function deleteAll() {
  console.log('🗑️  DELETING ALL property_videos from queue...\n');
  console.log('⚠️  WARNING: This will delete ALL 784 workflows!\n');

  // Get total count first
  const countSnapshot = await db.collection('property_videos').count().get();
  const total = countSnapshot.data().count;

  console.log(`Total to delete: ${total}\n`);
  console.log('Starting deletion in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  let deleted = 0;
  let batchCount = 0;

  // Delete in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;

  while (true) {
    // Get next batch
    const snapshot = await db.collection('property_videos')
      .limit(BATCH_SIZE)
      .get();

    if (snapshot.empty) {
      break;
    }

    // Create batch delete
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    try {
      await batch.commit();
      deleted += snapshot.size;
      batchCount++;
      console.log(`   Batch ${batchCount}: Deleted ${snapshot.size} workflows (Total: ${deleted}/${total})...`);
    } catch (error) {
      console.error(`   ❌ Batch ${batchCount} failed:`, error);
      throw error;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Successfully deleted ${deleted} workflows`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Verify deletion
  const finalCount = await db.collection('property_videos').count().get();
  console.log(`Final count: ${finalCount.data().count}`);

  if (finalCount.data().count === 0) {
    console.log('✅ Queue is now empty!');
  } else {
    console.log(`⚠️  Warning: ${finalCount.data().count} workflows still remain`);
  }
}

deleteAll().catch(console.error);
