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

async function checkMissingZpids() {
  const snapshot = await db.collection('zillow_imports').get();

  let hasUrl = 0;
  let hasZpid = 0;
  let missingZpid = 0;
  let emptyZpid = 0;
  const missingZpidDocs: Array<{id: string, address: string, url: string}> = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.url) {
      hasUrl++;
      const zpid = data.zpid;
      if (zpid && String(zpid).trim() !== '') {
        hasZpid++;
      } else if (zpid === '' || zpid === null) {
        emptyZpid++;
        missingZpidDocs.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          url: data.url,
        });
      } else {
        missingZpid++;
        missingZpidDocs.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          url: data.url,
        });
      }
    }
  });

  console.log('\n📊 ZPID ANALYSIS');
  console.log('='.repeat(50));
  console.log('Properties with URL:', hasUrl);
  console.log('Properties with valid ZPID:', hasZpid);
  console.log('Properties with empty/null ZPID:', emptyZpid);
  console.log('Properties with undefined ZPID:', missingZpid);
  console.log('Total missing ZPID (will be MISSED):', emptyZpid + missingZpid);

  if (missingZpidDocs.length > 0) {
    console.log('\n⚠️  Sample properties missing ZPID:');
    missingZpidDocs.slice(0, 10).forEach(doc => {
      console.log(`  - ${doc.address}`);
      console.log(`    ID: ${doc.id}`);
      console.log(`    URL: ${doc.url.substring(0, 80)}...`);
    });
    if (missingZpidDocs.length > 10) {
      console.log(`  ... and ${missingZpidDocs.length - 10} more`);
    }
  }

  process.exit(0);
}

checkMissingZpids().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
