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

async function testAdminQueries() {
  console.log('=== TESTING ADMIN API QUERIES ===\n');

  try {
    console.log('1. Testing zillow_imports query with filters...');
    const zillowQuery = db
      .collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .orderBy('foundAt', 'desc');

    const zillowSnapshot = await zillowQuery.get();
    console.log(`✅ zillow_imports query succeeded: ${zillowSnapshot.size} properties\n`);

    console.log('2. Testing properties query with filters (without orderBy)...');
    const propsQuery = db
      .collection('properties')
      .where('isActive', '==', true);

    const propsSnapshot = await propsQuery.get();
    console.log(`✅ properties query succeeded: ${propsSnapshot.size} properties\n`);

    console.log('=== RESULTS ===');
    console.log(`Total properties that would be returned by API: ${zillowSnapshot.size + propsSnapshot.size}`);
    console.log(`  - From zillow_imports: ${zillowSnapshot.size}`);
    console.log(`  - From properties: ${propsSnapshot.size}`);

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.error('\nFull error:', error);

    if (error.message?.includes('index')) {
      console.error('\n⚠️  This looks like a Firestore index issue!');
      console.error('You need to create composite indexes in Firebase Console.');
    }
  }

  process.exit(0);
}

testAdminQueries().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
