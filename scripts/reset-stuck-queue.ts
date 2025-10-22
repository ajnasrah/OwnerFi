import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function resetStuckQueue() {
  console.log('🔧 Resetting stuck queue items...\n');

  // Find items stuck in "processing" status for more than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const stuckItems = await db
    .collection('scraper_queue')
    .where('status', '==', 'processing')
    .get();

  console.log(`Found ${stuckItems.size} items in "processing" status\n`);

  if (stuckItems.size === 0) {
    console.log('✅ No stuck items to reset!');
    return;
  }

  let resetCount = 0;
  const batch = db.batch();

  stuckItems.docs.forEach(doc => {
    const data = doc.data();
    const processingStartedAt = data.processingStartedAt?.toDate?.();

    // Reset if processing started more than 10 minutes ago or has no start time
    if (!processingStartedAt || processingStartedAt < tenMinutesAgo) {
      batch.update(doc.ref, {
        status: 'pending',
        processingStartedAt: null,
        completedAt: null,
      });
      resetCount++;
    }
  });

  if (resetCount > 0) {
    await batch.commit();
    console.log(`✅ Reset ${resetCount} stuck items back to "pending"`);
  } else {
    console.log('ℹ️  All processing items are recent (< 10 minutes old)');
  }

  // Show updated stats
  const pendingCount = await db.collection('scraper_queue').where('status', '==', 'pending').get();
  const processingCount = await db.collection('scraper_queue').where('status', '==', 'processing').get();

  console.log(`\n📊 Updated Queue Status:`);
  console.log(`   ⏳ Pending: ${pendingCount.size}`);
  console.log(`   🔄 Processing: ${processingCount.size}`);
  console.log(`\n✅ Queue is ready for the next cron run!`);
}

resetStuckQueue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
