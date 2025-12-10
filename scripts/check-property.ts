import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
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
  const zpid = '126639728';
  const url = 'https://www.zillow.com/homedetails/1094-Fortyniner-Ln-Bonners-Ferry-ID-83805/126639728_zpid/';

  // Check scraper_queue by zpid
  const queueDocs = await db.collection('scraper_queue')
    .where('zpid', '==', zpid)
    .get();

  console.log('=== SCRAPER_QUEUE (by zpid) ===');
  if (queueDocs.empty) {
    console.log('NOT in scraper_queue by zpid');
  } else {
    queueDocs.docs.forEach(doc => {
      const d = doc.data();
      console.log('Status:', d.status);
      console.log('Failure Reason:', d.failureReason || 'N/A');
    });
  }

  // Check scraper_queue by URL
  const urlDocs = await db.collection('scraper_queue')
    .where('url', '==', url)
    .get();

  console.log('\n=== SCRAPER_QUEUE (by URL) ===');
  if (urlDocs.empty) {
    console.log('NOT in queue by URL');
  } else {
    urlDocs.docs.forEach(doc => {
      const d = doc.data();
      console.log('Status:', d.status);
      console.log('Failure Reason:', d.failureReason || 'N/A');
    });
  }

  // Check zillow_imports
  const importDocs = await db.collection('zillow_imports')
    .where('zpid', '==', parseInt(zpid))
    .get();

  console.log('\n=== ZILLOW_IMPORTS ===');
  if (importDocs.empty) {
    console.log('NOT in zillow_imports');
  } else {
    importDocs.docs.forEach(doc => {
      const d = doc.data();
      console.log('Found in zillow_imports!');
      console.log('Address:', d.fullAddress);
      console.log('Matched Keywords:', d.matchedKeywords);
    });
  }
}

main().then(() => process.exit(0));
