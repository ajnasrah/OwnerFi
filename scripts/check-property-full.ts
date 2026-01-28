/**
 * Get full details of a specific property
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const ZPID = '299122';

async function getFullProperty() {
  console.log('\n=== Full Property Details for ZPID:', ZPID, '===\n');

  // Check properties collection
  const propDocId = `zpid_${ZPID}`;
  const propDoc = await db.collection('properties').doc(propDocId).get();

  if (!propDoc.exists) {
    console.log('Property not found');
    return;
  }

  const data = propDoc.data();

  console.log('Document ID:', propDoc.id);
  console.log('');
  console.log('--- Core Fields ---');
  console.log('Address:', data.address || data.fullAddress);
  console.log('City:', data.city);
  console.log('State:', data.state);
  console.log('Price:', data.price);
  console.log('');
  console.log('--- Status Fields ---');
  console.log('isActive:', data.isActive);
  console.log('status:', data.status);
  console.log('homeStatus:', data.homeStatus);
  console.log('ownerFinanceVerified:', data.ownerFinanceVerified);
  console.log('');
  console.log('--- Metadata ---');
  console.log('source:', data.source);
  console.log('matchedKeywords:', data.matchedKeywords);
  console.log('createdAt:', data.createdAt?.toDate?.() || data.createdAt);
  console.log('updatedAt:', data.updatedAt?.toDate?.() || data.updatedAt);
  console.log('addedAt:', data.addedAt?.toDate?.() || data.addedAt);
  console.log('');
  console.log('--- All Fields ---');
  console.log(JSON.stringify(data, (key, value) => {
    if (value && typeof value === 'object' && value._seconds) {
      return new Date(value._seconds * 1000).toISOString();
    }
    return value;
  }, 2));
}

getFullProperty()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
