// Script to remove the test property with "Property Address TBD"
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function removeTestProperty() {
  try {
    console.log('Searching for test property with "Property Address TBD"...');

    // Search for the property
    const snapshot = await db.collection('properties')
      .where('address', '==', 'Property Address TBD')
      .get();

    if (snapshot.empty) {
      console.log('No test property found with "Property Address TBD"');

      // Also search for Memphis properties with price 247400
      console.log('\nSearching for Memphis properties with price $247,400...');
      const memphisSnapshot = await db.collection('properties')
        .where('city', '==', 'Memphis')
        .where('listPrice', '==', 247400)
        .get();

      if (!memphisSnapshot.empty) {
        console.log(`Found ${memphisSnapshot.size} Memphis properties with price $247,400:`);

        memphisSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`\nID: ${doc.id}`);
          console.log(`Address: ${data.address}`);
          console.log(`City: ${data.city}, ${data.state}`);
          console.log(`Price: $${data.listPrice}`);
          console.log(`Balloon Years: ${data.balloonYears}`);

          // Check if this looks like a test property
          if (data.address === 'Property Address TBD' ||
              data.address?.includes('TBD') ||
              data.opportunityName === 'Memphis Investment Property') {
            console.log('>>> This appears to be a TEST property');
          }
        });

        // Ask for confirmation before deleting
        console.log('\n----------------------------------------');
        console.log('To delete a specific property, run:');
        console.log('node scripts/delete-property-by-id.js <PROPERTY_ID>');
      } else {
        console.log('No Memphis properties found with price $247,400');
      }

      return;
    }

    // Found the test property
    console.log(`Found ${snapshot.size} test property(ies) to remove:`);

    const deletePromises = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nRemoving property ID: ${doc.id}`);
      console.log(`- Address: ${data.address}`);
      console.log(`- City: ${data.city}, ${data.state}`);
      console.log(`- Price: $${data.listPrice}`);

      deletePromises.push(doc.ref.delete());
    });

    await Promise.all(deletePromises);
    console.log(`\n✅ Successfully removed ${snapshot.size} test property(ies)`);

  } catch (error) {
    console.error('Error removing test property:', error);
  } finally {
    await admin.app().delete();
  }
}

// Run the script
removeTestProperty();