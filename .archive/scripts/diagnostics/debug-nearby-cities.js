#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function debugNearbyCities() {
  console.log('🔍 Debugging nearbyCities structure...\n');

  const snapshot = await db.collection('properties').limit(5).get();

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nProperty: ${data.address}`);
    console.log(`City: ${data.city}, State: ${data.state}`);
    console.log(`nearbyCities type: ${typeof data.nearbyCities}`);
    console.log(`nearbyCities is Array: ${Array.isArray(data.nearbyCities)}`);

    if (data.nearbyCities) {
      console.log(`nearbyCities length: ${data.nearbyCities.length}`);
      console.log(`nearbyCities raw:`, JSON.stringify(data.nearbyCities, null, 2));

      if (Array.isArray(data.nearbyCities) && data.nearbyCities.length > 0) {
        console.log(`First item type: ${typeof data.nearbyCities[0]}`);
        console.log(`First item:`, data.nearbyCities[0]);
      }
    } else {
      console.log('No nearbyCities field');
    }
    console.log('-'.repeat(50));
  });
}

debugNearbyCities()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });