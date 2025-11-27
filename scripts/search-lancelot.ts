import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

async function search() {
  // Search in scraper_queue
  const queueSnap = await db.collection('scraper_queue').get();
  console.log('=== SCRAPER_QUEUE ===');
  console.log('Total docs:', queueSnap.size);

  for (const doc of queueSnap.docs) {
    const data = doc.data();
    const url = data.url || '';
    if (url.toLowerCase().includes('lancelot')) {
      console.log('FOUND:', doc.id);
      console.log('  url:', url);
      console.log('  status:', data.status);
    }
  }

  // Also search zillow using broader criteria
  console.log('\n=== Searching zillow_imports for "665" ===');
  const zillowSnap = await db.collection('zillow_imports').get();
  for (const doc of zillowSnap.docs) {
    const data = doc.data();
    const addr = data.streetAddress || data.fullAddress || data.address || '';
    if (addr.includes('665')) {
      console.log('Found 665:', addr);
    }
  }

  process.exit(0);
}
search();
