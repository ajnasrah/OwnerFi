import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkBuyerMismatch() {
  const usersSnapshot = await db.collection('users').where('role', '==', 'buyer').get();
  const profilesSnapshot = await db.collection('buyerProfiles').get();

  console.log('\nDatabase counts:');
  console.log('users (role=buyer):', usersSnapshot.size);
  console.log('buyerProfiles:', profilesSnapshot.size);

  const userIds = new Set(usersSnapshot.docs.map(d => d.id));
  let withUser = 0;
  let withoutUser = 0;

  profilesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.userId && userIds.has(data.userId)) {
      withUser++;
    } else {
      withoutUser++;
    }
  });

  console.log('\nProfiles WITH user account:', withUser);
  console.log('Profiles WITHOUT user account:', withoutUser);
  console.log('\nAdmin shows:', withUser, 'buyers (only profiles with user accounts)');
}

checkBuyerMismatch().catch(console.error);
