/**
 * Count unsent regional properties
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const REGIONAL_STATES = ['TN', 'AR', 'MS', 'AL', 'KY'];

async function countUnsent() {
  console.log('=== UNSENT REGIONAL PROPERTIES ===\n');

  let totalUnsent = 0;
  let totalSent = 0;

  for (const state of REGIONAL_STATES) {
    const snapshot = await db.collection('properties')
      .where('state', '==', state)
      .where('isActive', '==', true)
      .get();

    let unsent = 0;
    let sent = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.sentToGHL) {
        sent++;
      } else {
        unsent++;
      }
    });

    console.log(`${state}: ${unsent} unsent, ${sent} already sent (${snapshot.size} total)`);
    totalUnsent += unsent;
    totalSent += sent;
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`TOTAL UNSENT: ${totalUnsent}`);
  console.log(`TOTAL ALREADY SENT: ${totalSent}`);
  console.log(`\nRun this to send them all:`);
  console.log(`npx -y dotenv-cli -e .env.local -- npx tsx scripts/backfill-ghl-regional.ts`);
}

countUnsent().catch(console.error);
