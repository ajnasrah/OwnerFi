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
  console.log('🧹 Cleaning up properties with bad statuses...\n');

  const snap = await db.collection('zillow_imports').get();

  // Statuses that indicate property should be removed
  const badStatuses = ['OTHER', 'UNKNOWN', 'PENDING', 'SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'FOR_RENT', 'CONTINGENT'];

  const toDelete: Array<{id: string, address: string, status: string, price: number}> = [];

  snap.forEach(doc => {
    const data = doc.data();
    const status = data.homeStatus;
    const price = data.price || data.listPrice || 0;

    // Delete if bad status OR price is 0/missing
    if (badStatuses.includes(status) || price === 0) {
      toDelete.push({
        id: doc.id,
        address: data.fullAddress || data.streetAddress || 'Unknown',
        status: status || 'NO_STATUS',
        price
      });
    }
  });

  console.log(`Found ${toDelete.length} properties to delete\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // Group by reason
  const byStatus: Record<string, number> = {};
  toDelete.forEach(p => {
    const reason = p.price === 0 ? 'PRICE_ZERO' : p.status;
    byStatus[reason] = (byStatus[reason] || 0) + 1;
  });

  console.log('Breakdown:');
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // Show first 20
  console.log('\nFirst 20 properties to delete:');
  toDelete.slice(0, 20).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.address}`);
    console.log(`      Status: ${p.status}, Price: $${p.price}`);
  });

  // Delete in batches
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

  console.log(`\n✅ Deleted ${deleted} properties with bad statuses`);
}

cleanup().catch(console.error);
