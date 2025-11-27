import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function findNoResultProperties() {
  // Find properties with the "no result" note
  const snapshot = await db.collection('zillow_imports')
    .where('lastStatusCheckNote', '==', 'No Apify result - URL may be invalid or property removed')
    .limit(20)
    .get();

  console.log('\n📊 PROPERTIES WITH NO APIFY RESULT');
  console.log('='.repeat(60));
  console.log('Total found:', snapshot.size);
  console.log('');

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('Address:', data.fullAddress || data.streetAddress || 'Unknown');
    console.log('URL:', data.url);
    console.log('ZPID:', data.zpid);
    console.log('Last Check:', data.lastStatusCheck?.toDate?.()?.toISOString() || 'never');
    console.log('Current Status:', data.homeStatus || 'unknown');
    console.log('Days on Zillow:', data.daysOnZillow || 'unknown');
    console.log('---');
  }

  // Also check URLs to see if they're valid
  if (snapshot.size > 0) {
    console.log('\n🔍 Testing first 3 URLs...');
    const testDocs = snapshot.docs.slice(0, 3);
    for (const doc of testDocs) {
      const url = doc.data().url;
      console.log(`\nURL: ${url}`);
      try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        console.log(`  Status: ${response.status} ${response.statusText}`);
        console.log(`  Final URL: ${response.url}`);
      } catch (err: any) {
        console.log(`  Error: ${err.message}`);
      }
    }
  }

  process.exit(0);
}

findNoResultProperties().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
