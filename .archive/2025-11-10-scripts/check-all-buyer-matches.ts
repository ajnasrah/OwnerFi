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

async function checkMatchedProperties() {
  console.log('\n📊 Checking propertyBuyerMatches collection...\n');

  const matchesSnapshot = await db.collection('propertyBuyerMatches').limit(10).get();
  console.log(`Sample size from propertyBuyerMatches: ${matchesSnapshot.size}\n`);

  if (matchesSnapshot.size > 0) {
    console.log('Sample matches:');
    matchesSnapshot.docs.slice(0, 5).forEach((doc, idx) => {
      const data = doc.data();
      console.log(`  ${idx + 1}. Buyer ID: ${data.buyerId}, Property ID: ${data.propertyId}`);
    });
  } else {
    console.log('❌ No matches found in propertyBuyerMatches collection!');
  }

  console.log('\n---\n');

  const buyersSnapshot = await db.collection('buyerProfiles').get();
  console.log(`Total buyer profiles: ${buyersSnapshot.size}\n`);

  let buyersWithMatches = 0;
  let totalMatches = 0;
  const buyersWithMatchesList = [];

  for (const doc of buyersSnapshot.docs) {
    const data = doc.data();
    const matchedSnapshot = await db.collection('propertyBuyerMatches')
      .where('buyerId', '==', data.userId)
      .get();

    if (matchedSnapshot.size > 0) {
      buyersWithMatches++;
      totalMatches += matchedSnapshot.size;
      buyersWithMatchesList.push({
        email: data.email || 'Unknown',
        matches: matchedSnapshot.size
      });
    }
  }

  console.log(`📊 Summary:`);
  console.log(`   Buyers with matches: ${buyersWithMatches}/${buyersSnapshot.size}`);
  console.log(`   Total matches: ${totalMatches}`);

  if (buyersWithMatches === 0) {
    console.log(`\n❌ NO BUYERS HAVE MATCHED PROPERTIES!`);
    console.log(`   The matching system may not be running or matches were never created.\n`);
  } else {
    console.log(`\n✅ Buyers with matches:`);
    buyersWithMatchesList.forEach(buyer => {
      console.log(`   ${buyer.email}: ${buyer.matches} matches`);
    });
    console.log('');
  }
}

checkMatchedProperties().catch(console.error);
