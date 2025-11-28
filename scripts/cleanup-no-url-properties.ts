import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  console.log('🧹 Cleaning up properties without URLs...\n');

  const snap = await db.collection('zillow_imports').get();

  const toDelete: Array<{id: string, address: string}> = [];

  snap.forEach(doc => {
    const data = doc.data();
    if (!data.url) {
      toDelete.push({
        id: doc.id,
        address: data.fullAddress || data.streetAddress || 'Unknown'
      });
    }
  });

  console.log(`Found ${toDelete.length} properties without URLs\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // Show what we're deleting
  console.log('Properties to delete:');
  toDelete.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.address}`);
  });

  // Delete in batches of 500 (Firestore limit)
  console.log('\n🗑️  Deleting...');

  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + batchSize);

    chunk.forEach(p => {
      batch.delete(db.collection('zillow_imports').doc(p.id));
    });

    await batch.commit();
    deleted += chunk.length;
    console.log(`  Deleted ${deleted}/${toDelete.length}`);
  }

  console.log(`\n✅ Deleted ${deleted} properties without URLs`);
}

cleanup().catch(console.error);
