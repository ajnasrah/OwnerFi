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

async function check() {
  const snap = await db.collection('cash_houses').get();

  const bySource: Record<string, { total: number; noArv: number }> = {};

  snap.docs.forEach(doc => {
    const d = doc.data();
    const source = d.source || 'unknown';

    if (!bySource[source]) {
      bySource[source] = { total: 0, noArv: 0 };
    }
    bySource[source].total++;

    if (!d.arv || d.arv === 0) {
      bySource[source].noArv++;
    }
  });

  console.log('Total cash_houses:', snap.size);
  console.log('\nBreakdown by source:');
  for (const [source, counts] of Object.entries(bySource)) {
    console.log(`  ${source}: ${counts.total} total, ${counts.noArv} missing ARV`);
  }

  // Delete entries without ARV
  console.log('\nWant to delete entries without ARV? Run with --delete flag');
}

check();
