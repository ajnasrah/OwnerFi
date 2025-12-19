import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function findOrigin() {
  // Get first and last items with this source
  const firstSnap = await db.collection('scraper_queue')
    .where('source', '==', 'manual_import_11k')
    .orderBy('addedAt', 'asc')
    .limit(3)
    .get();

  const lastSnap = await db.collection('scraper_queue')
    .where('source', '==', 'manual_import_11k')
    .orderBy('addedAt', 'desc')
    .limit(3)
    .get();

  console.log('=== MANUAL_IMPORT_11K ORIGIN ===\n');

  if (!firstSnap.empty) {
    console.log('FIRST items added:');
    firstSnap.docs.forEach(doc => {
      const d = doc.data();
      const addedAt = d.addedAt?.toDate?.() || new Date(d.addedAt);
      console.log(`  ${addedAt.toISOString()}`);
      console.log(`  URL: ${d.url}`);
      console.log('');
    });
  }

  if (!lastSnap.empty) {
    console.log('LAST items added:');
    lastSnap.docs.forEach(doc => {
      const d = doc.data();
      const addedAt = d.addedAt?.toDate?.() || new Date(d.addedAt);
      console.log(`  ${addedAt.toISOString()}`);
      console.log(`  URL: ${d.url}`);
      console.log('');
    });
  }

  // Check a sample URL to see what kind of property it is
  if (!firstSnap.empty) {
    const sampleUrl = firstSnap.docs[0].data().url;
    console.log('Sample URL to check manually:');
    console.log(sampleUrl);
  }

  process.exit(0);
}

findOrigin();
