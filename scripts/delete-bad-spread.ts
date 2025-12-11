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

async function deleteBadSpread() {
  console.log('🧹 Deleting properties with bad spread (<20%)...\n');

  const snap = await db.collection('cash_houses').get();
  const batch = db.batch();
  let count = 0;

  snap.forEach(doc => {
    const data = doc.data();
    const price = data.price || 0;
    const estimate = data.estimate || data.zestimate || 0;

    if (!estimate || !price) return; // Skip if no estimate

    const spreadPercent = ((estimate - price) / estimate) * 100;

    // Delete if spread is less than 20%
    if (spreadPercent < 20) {
      console.log('🗑️  Deleting: ' + (data.fullAddress || data.streetAddress) + ' (Spread: ' + spreadPercent.toFixed(1) + '%)');
      batch.delete(doc.ref);
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log('\n✅ Deleted ' + count + ' properties with bad spread');
  } else {
    console.log('No bad spread properties found');
  }
}

deleteBadSpread().catch(console.error);
