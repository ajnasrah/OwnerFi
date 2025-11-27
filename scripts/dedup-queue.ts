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

async function dedupQueue() {
  console.log('🧹 DEDUPLICATING SCRAPER QUEUE');
  console.log('==============================\n');

  // Get all pending items
  const snapshot = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .get();

  console.log(`Total pending items: ${snapshot.size}`);

  // Group by URL
  const urlToDocIds: Map<string, string[]> = new Map();

  snapshot.docs.forEach(doc => {
    const url = doc.data().url;
    if (!url) return;

    const existing = urlToDocIds.get(url) || [];
    existing.push(doc.id);
    urlToDocIds.set(url, existing);
  });

  console.log(`Unique URLs: ${urlToDocIds.size}`);

  // Find duplicates
  let duplicateCount = 0;
  const docsToDelete: string[] = [];

  urlToDocIds.forEach((docIds, url) => {
    if (docIds.length > 1) {
      // Keep first, delete rest
      duplicateCount += docIds.length - 1;
      docsToDelete.push(...docIds.slice(1));
    }
  });

  console.log(`Duplicate entries: ${duplicateCount}`);
  console.log(`Documents to delete: ${docsToDelete.length}\n`);

  if (docsToDelete.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  // Delete duplicates in batches
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchDocs = docsToDelete.slice(i, i + BATCH_SIZE);

    for (const docId of batchDocs) {
      batch.delete(db.collection('scraper_queue').doc(docId));
    }

    await batch.commit();
    deleted += batchDocs.length;
    console.log(`Deleted ${deleted}/${docsToDelete.length} duplicates...`);
  }

  console.log(`\n✅ DEDUP COMPLETE`);
  console.log(`   Unique URLs remaining: ${urlToDocIds.size}`);
  console.log(`   Duplicates removed: ${duplicateCount}`);
}

dedupQueue().catch(console.error);
