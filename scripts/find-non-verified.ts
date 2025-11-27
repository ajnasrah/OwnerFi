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

async function findNonVerified() {
  console.log('=== FINDING PROPERTIES WITHOUT ownerFinanceVerified=true ===\n');

  // Get all imports where ownerFinanceVerified is NOT true
  const allSnap = await db.collection('zillow_imports').get();

  const notVerified: any[] = [];

  allSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.ownerFinanceVerified !== true) {
      notVerified.push({ id: doc.id, ...data });
    }
  });

  console.log(`Found ${notVerified.length} properties without ownerFinanceVerified=true:\n`);

  for (const prop of notVerified) {
    console.log(`ID: ${prop.id}`);
    console.log(`Address: ${prop.fullAddress || prop.streetAddress || 'N/A'}`);
    console.log(`Price: $${prop.price?.toLocaleString() || 'N/A'}`);
    console.log(`Status: ${prop.homeStatus || prop.status || 'N/A'}`);
    console.log(`Source: ${prop.source || 'N/A'}`);
    console.log(`ownerFinanceVerified: ${prop.ownerFinanceVerified}`);
    console.log(`matchedKeywords: ${prop.matchedKeywords?.join(', ') || 'NONE'}`);

    const desc = (prop.description || '').toLowerCase();
    const hasOF = desc.includes('owner financ') || desc.includes('seller financ') ||
                  desc.includes('rent to own') || desc.includes('lease option');
    console.log(`Has OF in description: ${hasOF ? 'YES' : 'NO'}`);
    console.log('---\n');
  }
}

findNonVerified().catch(console.error);
