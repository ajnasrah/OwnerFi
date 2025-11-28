import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function check() {
  const snapshot = await db.collection('cash_houses').limit(3).get();

  snapshot.docs.forEach((doc, idx) => {
    const data = doc.data();
    console.log('\n=== Property ' + (idx + 1) + ': ' + (data.address || data.streetAddress) + ' ===');
    console.log('All fields:', Object.keys(data).sort().join(', '));
    console.log('rentEstimate:', data.rentEstimate);
    console.log('rentZestimate:', data.rentZestimate);
    console.log('rent:', data.rent);
  });
}

check();
