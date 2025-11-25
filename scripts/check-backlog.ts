import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'dotenv/config';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

async function main() {
  const db = getFirestore();
  const snap = await db.collection('zillow_imports').get();

  let total = 0, withUrl = 0, neverChecked = 0, neverCheckedWithUrl = 0;
  let dunnChecked = false;

  for (const doc of snap.docs) {
    const d = doc.data();
    total++;
    if (d.url) withUrl++;
    if (!d.lastStatusCheck) {
      neverChecked++;
      if (d.url) neverCheckedWithUrl++;
    }
    if (doc.id === 'hIStmebp0QwrWXYXsagP' && d.lastStatusCheck) {
      dunnChecked = true;
    }
  }

  console.log('=== BACKLOG STATUS ===');
  console.log('Total properties:', total);
  console.log('With URL:', withUrl);
  console.log('Never checked:', neverChecked);
  console.log('Never checked WITH URL:', neverCheckedWithUrl);
  console.log('4485 Dunn Ave checked:', dunnChecked ? 'YES' : 'NO');
  console.log('\nAt 63-70 per run, need', Math.ceil(neverCheckedWithUrl / 65), 'more runs');
}

main();
