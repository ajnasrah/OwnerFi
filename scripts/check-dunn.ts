import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'dotenv/config';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

async function main() {
  const db = getFirestore();
  const snap = await db.collection('zillow_imports').doc('hIStmebp0QwrWXYXsagP').get();
  const d = snap.data();
  console.log('4485 Dunn Ave, Memphis:');
  console.log('lastStatusCheck:', d?.lastStatusCheck?.toDate?.() || 'Never');
  console.log('lastScrapedAt:', d?.lastScrapedAt?.toDate?.() || 'Never');
  console.log('homeStatus:', d?.homeStatus);
  console.log('price:', d?.price);
  console.log('bedrooms:', d?.bedrooms);
  console.log('bathrooms:', d?.bathrooms);
  console.log('squareFoot:', d?.squareFoot);
  console.log('agentName:', d?.agentName);
  console.log('agentPhoneNumber:', d?.agentPhoneNumber);
}

main();
