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

async function findProperty() {
  const searchTerms = ['6916', 'Lagrange'];
  const collections = ['zillow_imports', 'cash_houses', 'properties', 'property_queue', 'scraper_queue'];

  console.log('=== Searching for 6916 Lagrange Pines Dr ===\n');

  for (const col of collections) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const addr = (d.address || d.streetAddress || '').toLowerCase();
      if (addr.includes('6916') || addr.includes('lagrange')) {
        console.log(`Found in ${col}:`);
        console.log('  ID:', doc.id);
        console.log('  Address:', d.address || d.streetAddress);
        console.log('  City:', d.city);
        console.log('  imageEnhanced:', d.imageEnhanced);
        console.log('  imgSrc:', d.imgSrc || 'NO IMAGE');
        console.log('');
      }
    }
  }

  console.log('=== Done ===');
}

findProperty().catch(console.error);
