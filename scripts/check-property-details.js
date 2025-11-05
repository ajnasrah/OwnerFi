const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

async function checkPropertyDetails() {
  const opportunityId = 'mT1a3NbMTl3u6tdGtjtp';

  console.log(`Fetching FULL details for opportunity ID: ${opportunityId}\n`);

  try {
    const snapshot = await db.collection('properties')
      .where('opportunityId', '==', opportunityId)
      .get();

    if (snapshot.empty) {
      console.log('❌ Property NOT found');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('✅ Property FOUND\n');
      console.log('Document ID:', doc.id);
      console.log('\nFull Property Data:');
      console.log(JSON.stringify(data, null, 2));

      console.log('\n=== KEY FIELDS FOR LISTING ===');
      console.log('status:', data.status);
      console.log('isActive:', data.isActive);
      console.log('price:', data.price);
      console.log('address:', data.address);
      console.log('city:', data.city);
      console.log('state:', data.state);
      console.log('bedrooms:', data.bedrooms);
      console.log('bathrooms:', data.bathrooms);
      console.log('imageUrls:', data.imageUrls);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPropertyDetails()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
