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

async function checkOpportunity() {
  const opportunityId = 'mT1a3NbMTl3u6tdGtjtp';

  console.log(`Checking for opportunity ID: ${opportunityId}\n`);

  try {
    // Search by opportunityId field
    const snapshot = await db.collection('properties')
      .where('opportunityId', '==', opportunityId)
      .get();

    if (snapshot.empty) {
      console.log('❌ Property NOT found in database');
      console.log('This property needs to be synced.\n');
    } else {
      console.log('✅ Property FOUND in database:');
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  Document ID: ${doc.id}`);
        console.log(`  Address: ${data.address}`);
        console.log(`  City: ${data.city}`);
        console.log(`  State: ${data.state}`);
        console.log(`  Price: $${data.price}`);
        console.log(`  Opportunity ID: ${data.opportunityId}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOpportunity()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
