import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkLatest() {
  const snapshot = await db.collection('properties')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  const data = snapshot.docs[0].data();

  console.log('Latest property:');
  console.log('Address:', data.address);
  console.log('City:', data.city + ', ' + data.state);
  console.log('Created:', new Date(data.createdAt.toDate()).toLocaleString());
  console.log('');
  console.log('Description:', data.description || '(NO DESCRIPTION)');
  console.log('');
  console.log('Has description:', data.description ? 'YES' : 'NO');
  console.log('Description length:', data.description ? data.description.length : 0);
}

checkLatest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
