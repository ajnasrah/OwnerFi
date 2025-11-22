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

async function countAllProperties() {
  console.log('=== COUNTING ALL PROPERTIES ===\n');

  // Count zillow_imports with ownerFinanceVerified = true
  const zillowAll = await db
    .collection('zillow_imports')
    .get();

  const zillowVerified = zillowAll.docs.filter(
    doc => doc.data().ownerFinanceVerified === true
  );

  console.log(`zillow_imports total: ${zillowAll.size}`);
  console.log(`zillow_imports with ownerFinanceVerified=true: ${zillowVerified.length}\n`);

  // Count properties with isActive = true
  const propsAll = await db
    .collection('properties')
    .get();

  const propsActive = propsAll.docs.filter(
    doc => doc.data().isActive === true
  );

  console.log(`properties total: ${propsAll.size}`);
  console.log(`properties with isActive=true: ${propsActive.length}\n`);

  console.log(`=== TOTAL PROPERTIES THAT SHOULD SHOW IN ADMIN ===`);
  console.log(`${zillowVerified.length + propsActive.length} properties`);
  console.log(`(${zillowVerified.length} from Zillow + ${propsActive.length} from GHL)\n`);

  process.exit(0);
}

countAllProperties().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
