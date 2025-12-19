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

async function trace() {
  // Get a sample of manual_import_11k items
  const snap = await db.collection('scraper_queue')
    .where('source', '==', 'manual_import_11k')
    .limit(10)
    .get();

  console.log('=== MANUAL_IMPORT_11K SAMPLES ===\n');

  snap.docs.forEach((doc, i) => {
    const d = doc.data();
    const addedAt = d.addedAt?.toDate?.() || new Date(d.addedAt);
    console.log(`[${i + 1}] Added: ${addedAt.toISOString()}`);
    console.log(`    URL: ${d.url}`);
    console.log(`    Address: ${d.address || 'N/A'}`);
    console.log(`    ZPID: ${d.zpid || 'N/A'}`);
    console.log(`    Status: ${d.status}`);
    console.log('');
  });

  // Check when these were added
  const allSnap = await db.collection('scraper_queue')
    .where('source', '==', 'manual_import_11k')
    .get();

  const dates = allSnap.docs.map(doc => {
    const d = doc.data();
    return d.addedAt?.toDate?.() || new Date(d.addedAt);
  });

  dates.sort((a, b) => a.getTime() - b.getTime());

  console.log('=== TIMING ===');
  console.log(`Total items: ${dates.length}`);
  console.log(`First added: ${dates[0]?.toISOString()}`);
  console.log(`Last added: ${dates[dates.length - 1]?.toISOString()}`);

  // Check if all on same day
  const uniqueDays = new Set(dates.map(d => d.toISOString().substring(0, 10)));
  console.log(`Unique days: ${[...uniqueDays].join(', ')}`);

  process.exit(0);
}

trace();
