import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}
const db = getFirestore();

async function main() {
  const doc = await db.collection('buyer_profiles').doc('buyer_1765942034909_47fnuxdan').get();
  if (doc.exists) {
    const data = doc.data();
    console.log('Profile fields:', JSON.stringify({
      city: data?.city,
      state: data?.state,
      searchCity: data?.searchCity,
      searchState: data?.searchState,
      preferredCity: data?.preferredCity,
      preferredState: data?.preferredState,
      location: data?.location
    }, null, 2));
  } else {
    console.log('Profile not found');
  }
}
main();
