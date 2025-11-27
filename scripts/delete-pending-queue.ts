import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function deletePendingQueue() {
  console.log('🗑️  DELETING PENDING SCRAPER QUEUE ITEMS\n');

  // Get count first
  const pending = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .get();

  console.log(`Found ${pending.size.toLocaleString()} pending items to delete\n`);

  if (pending.size === 0) {
    console.log('Nothing to delete!');
    return;
  }

  // Delete in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;
  let deleted = 0;

  const docs = pending.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchDocs = docs.slice(i, i + BATCH_SIZE);

    batchDocs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += batchDocs.length;

    console.log(`Deleted ${deleted.toLocaleString()} / ${docs.length.toLocaleString()} items...`);
  }

  console.log(`\n✅ DONE! Deleted ${deleted.toLocaleString()} pending items from scraper_queue`);

  // Verify
  const remaining = await db.collection('scraper_queue').where('status', '==', 'pending').count().get();
  console.log(`Remaining pending items: ${remaining.data().count}`);
}

deletePendingQueue();
