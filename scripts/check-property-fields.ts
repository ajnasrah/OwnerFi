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

async function checkPropertyFields() {
  console.log('=== CHECKING ZILLOW_IMPORTS ===\n');

  const zillowSnapshot = await db
    .collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(10)
    .get();
  console.log(`Total zillow_imports docs (first 10): ${zillowSnapshot.size}\n`);

  let verifiedCount = 0;
  let unverifiedCount = 0;

  zillowSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const isVerified = data.ownerFinanceVerified === true;

    if (isVerified) verifiedCount++;
    else unverifiedCount++;

    console.log(`Property ID: ${doc.id}`);
    console.log(`  Address: ${data.fullAddress || data.address}`);
    console.log(`  ownerFinanceVerified: ${data.ownerFinanceVerified}`);
    console.log(`  status: ${data.status}`);
    console.log(`  foundAt: ${data.foundAt?.toDate?.() || data.foundAt}`);
    console.log('');
  });

  console.log(`Summary: ${verifiedCount} verified, ${unverifiedCount} unverified\n`);

  console.log('=== CHECKING PROPERTIES COLLECTION ===\n');

  const propsSnapshot = await db
    .collection('properties')
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();

  console.log(`Total properties docs (first 10): ${propsSnapshot.size}\n`);

  let activeCount = 0;
  let inactiveCount = 0;

  propsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const isActive = data.isActive === true;

    if (isActive) activeCount++;
    else inactiveCount++;

    console.log(`Property ID: ${doc.id}`);
    console.log(`  Address: ${data.fullAddress || data.address}`);
    console.log(`  isActive: ${data.isActive}`);
    console.log(`  status: ${data.status}`);
    console.log(`  updatedAt: ${data.updatedAt?.toDate?.() || data.updatedAt}`);
    console.log('');
  });

  console.log(`Summary: ${activeCount} active, ${inactiveCount} inactive\n`);

  process.exit(0);
}

checkPropertyFields().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
