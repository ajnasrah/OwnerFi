import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
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

async function testBuyerQueries() {
  console.log('=== TESTING BUYER API QUERIES ===\n');

  const searchState = 'TX'; // Test with Texas
  const fetchLimit = 150;

  try {
    console.log(`1. Testing properties query (isActive=true, state=${searchState})...`);
    const propsQuery = db
      .collection('properties')
      .where('isActive', '==', true)
      .where('state', '==', searchState)
      .orderBy('monthlyPayment', 'asc')
      .limit(fetchLimit);

    const propsSnapshot = await propsQuery.get();
    console.log(`✅ properties query succeeded: ${propsSnapshot.size} properties\n`);

    console.log(`2. Testing zillow_imports query (ownerFinanceVerified=true, state=${searchState})...`);
    const zillowQuery = db
      .collection('zillow_imports')
      .where('state', '==', searchState)
      .where('ownerFinanceVerified', '==', true)
      .limit(fetchLimit);

    const zillowSnapshot = await zillowQuery.get();
    console.log(`✅ zillow_imports query succeeded: ${zillowSnapshot.size} properties\n`);

    console.log('=== RESULTS ===');
    console.log(`Total properties that would be shown to buyer in ${searchState}: ${propsSnapshot.size + zillowSnapshot.size}`);
    console.log(`  - From properties: ${propsSnapshot.size}`);
    console.log(`  - From zillow_imports: ${zillowSnapshot.size}`);

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.error('\nFull error:', error);

    if (error.message?.includes('index')) {
      console.error('\n⚠️  This looks like a Firestore index issue!');
      console.error('You need to create composite indexes in Firebase Console.');
      console.error('\nIndex URL:', error.message.match(/https:\/\/[^\s]+/)?.[0]);
    }
  }

  process.exit(0);
}

testBuyerQueries().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
