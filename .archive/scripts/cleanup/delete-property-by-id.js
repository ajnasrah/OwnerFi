// Script to delete a specific property by ID
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

async function deletePropertyById(propertyId) {
  if (!propertyId) {
    console.error('Please provide a property ID as argument');
    console.log('Usage: node scripts/delete-property-by-id.js <PROPERTY_ID>');
    process.exit(1);
  }

  try {
    console.log(`Fetching property with ID: ${propertyId}`);

    // Get the property first to show details
    const doc = await db.collection('properties').doc(propertyId).get();

    if (!doc.exists) {
      console.log(`Property with ID ${propertyId} not found`);
      return;
    }

    const data = doc.data();
    console.log('\nProperty details:');
    console.log(`- Address: ${data.address}`);
    console.log(`- City: ${data.city}, ${data.state}`);
    console.log(`- Price: $${data.listPrice}`);
    console.log(`- Balloon Years: ${data.balloonYears || 'N/A'}`);

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will permanently delete this property from the database.');
    console.log('Type "DELETE" to confirm (or press Ctrl+C to cancel):');

    // Simple confirmation for now
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('', async (answer) => {
      if (answer === 'DELETE') {
        await doc.ref.delete();
        console.log(`\n✅ Successfully deleted property ${propertyId}`);
      } else {
        console.log('\nDeletion cancelled');
      }
      readline.close();
      await admin.app().delete();
    });

  } catch (error) {
    console.error('Error deleting property:', error);
    await admin.app().delete();
  }
}

// Get property ID from command line
const propertyId = process.argv[2];
deletePropertyById(propertyId);