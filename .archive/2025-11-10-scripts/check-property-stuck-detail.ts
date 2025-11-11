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

async function main() {
  const doc = await db.collection('property_videos').doc('property_15sec_1761914427106_khlp2').get();
  const data = doc.data();
  
  console.log('Property Stuck Workflow Details:');
  console.log(JSON.stringify(data, null, 2));
}

main();
