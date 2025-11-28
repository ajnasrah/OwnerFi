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

async function main() {
  // Check scraper queue
  const queue = await db.collection('scraper_queue').limit(10).get();
  console.log('Scraper queue items:', queue.size);
  queue.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.status} - ${data.url?.slice(0, 60)}...`);
  });

  // Check recently added zillow_imports with nearbyCities
  console.log('\nRecently added zillow_imports with nearbyCities:');
  const recent = await db.collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(5)
    .get();

  recent.docs.forEach(doc => {
    const data = doc.data();
    const nearbyCities = data.nearbyCities || [];
    console.log(`  - ${data.city}, ${data.state}: ${nearbyCities.length} nearby cities`);
    if (nearbyCities.length > 0) {
      console.log(`    First 3: ${nearbyCities.slice(0, 3).join(', ')}`);
    }
  });
}

main().catch(console.error);
