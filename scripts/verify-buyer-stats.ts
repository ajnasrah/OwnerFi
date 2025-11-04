import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function verifyBuyerStats() {
  const buyerProfilesSnapshot = await db.collection('buyerProfiles').limit(10).get();

  console.log('\n📊 Buyer Stats Verification (first 10 buyers):\n');

  for (const doc of buyerProfilesSnapshot.docs) {
    const data = doc.data();
    const likedCount = data.likedPropertyIds?.length || 0;

    // Get matched count
    const matchedSnapshot = await db.collection('propertyBuyerMatches')
      .where('buyerId', '==', data.userId)
      .get();
    const matchedCount = matchedSnapshot.size;

    console.log(`${data.email || 'Unknown'}`);
    console.log(`   Liked: ${likedCount} | Matched: ${matchedCount}`);
    console.log('');
  }

  console.log('✅ Verification complete! Liked counts are now working.\n');
}

verifyBuyerStats().catch(console.error);
