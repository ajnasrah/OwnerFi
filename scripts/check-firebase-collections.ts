import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Sample firebase_ids from the CSV
const sampleIds = [
  '88zqMqibCHlAgrH5GazC',  // 14 Evergreen Ct - Interested
  'gkgfTotSN6IbaQ7BEB1n',  // 35 Whispering Creek Cv - Interested
  'vi3kx8MmeNnuU66T5mFF',  // 5325 B St - Not Interested
  'm4uZuaDF0xaCWa9pf4Xx',  // 4356 Cedar Hills Rd - Not Interested
  'OENtHag4jWNDmpeRznse',  // 11060 Memphis Arlington Rd - New (from line 2)
];

async function checkCollections() {
  const collections = [
    'properties',
    'properties_unified',
    'buyerProfiles',
    'realtors',
    'users',
    'scraperQueue',
    'propertyInteractions'
  ];

  console.log('Checking collections for sample firebase IDs...\n');

  for (const collectionName of collections) {
    console.log(`\n=== Collection: ${collectionName} ===`);

    for (const id of sampleIds) {
      try {
        const docRef = db.collection(collectionName).doc(id);
        const doc = await docRef.get();

        if (doc.exists) {
          const data = doc.data();
          console.log(`✓ FOUND in ${collectionName}: ${id}`);
          console.log(`  Keys: ${Object.keys(data || {}).slice(0, 10).join(', ')}...`);
          if (data?.address) console.log(`  Address: ${data.address}`);
          if (data?.firstName) console.log(`  Name: ${data.firstName} ${data.lastName}`);
        }
      } catch (error) {
        console.log(`  Error checking ${id}: ${error}`);
      }
    }
  }

  // Also check total counts
  console.log('\n\n=== Collection Document Counts ===');
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();
      const countSnapshot = await db.collection(collectionName).count().get();
      console.log(`${collectionName}: ${countSnapshot.data().count} documents`);
    } catch (error) {
      console.log(`${collectionName}: Error - ${error}`);
    }
  }

  // List some actual properties to compare IDs
  console.log('\n\n=== Sample Property IDs from Firebase ===');
  const propertiesSnapshot = await db.collection('properties').limit(10).get();
  propertiesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Address: ${data.address}, ${data.city}, ${data.state}`);
    console.log(`  Status: ${data.status}, isActive: ${data.isActive}`);
    console.log('');
  });
}

checkCollections()
  .then(() => {
    console.log('\nCheck complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
