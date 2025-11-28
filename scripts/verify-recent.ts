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

async function verify() {
  const snap = await db.collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(5)
    .get();

  console.log('=== 5 Most Recent zillow_imports ===\n');
  snap.docs.forEach((doc, i) => {
    const d = doc.data();
    console.log(`${i+1}. ${d.streetAddress || d.fullAddress}`);
    console.log(`   Price: $${d.price?.toLocaleString() || 'N/A'}`);
    console.log(`   ARV: $${(d.estimate || d.arv)?.toLocaleString() || 'N/A'}`);
    console.log(`   Rent: $${d.rentEstimate?.toLocaleString() || 'N/A'}`);
    console.log(`   cashFlow stored: ${d.cashFlow ? 'YES' : 'NO'}`);
    if (d.cashFlow) {
      console.log(`   monthlyCashFlow: $${d.cashFlow.monthlyCashFlow}`);
      console.log(`   calculatedAt: ${d.cashFlow.calculatedAt}`);
    }
    console.log('');
  });
}

verify().catch(console.error);
