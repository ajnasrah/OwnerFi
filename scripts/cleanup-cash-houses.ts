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

async function cleanup() {
  console.log('=== CLEANING UP CASH_HOUSES WITHOUT ARV ===\n');

  const snap = await db.collection('cash_houses').get();
  const toDelete: string[] = [];

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.arv || d.arv === 0) {
      toDelete.push(doc.id);
    }
  });

  console.log(`Found ${toDelete.length} entries without ARV to delete`);
  console.log(`Keeping ${snap.size - toDelete.length} valid entries\n`);

  // Delete in batches
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);

    for (const docId of chunk) {
      batch.delete(db.collection('cash_houses').doc(docId));
    }

    await batch.commit();
    deleted += chunk.length;
    console.log(`Deleted ${deleted}/${toDelete.length}`);
  }

  console.log(`\n✅ Cleaned up ${deleted} invalid entries`);
  console.log(`Remaining valid cash deals: ${snap.size - deleted}`);
}

cleanup();
