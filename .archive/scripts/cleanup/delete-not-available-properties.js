const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

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

async function deleteProperties() {
  console.log('========================================');
  console.log('DELETING "NOT AVAILABLE" PROPERTIES');
  console.log('========================================\n');

  try {
    // Read the properties to delete from the JSON file
    const filePath = path.join(__dirname, 'properties-to-delete.json');
    const propertiesToDelete = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`Found ${propertiesToDelete.length} properties to delete\n`);

    const results = {
      total: propertiesToDelete.length,
      deleted: 0,
      failed: 0,
      errors: []
    };

    // Delete each property
    for (const property of propertiesToDelete) {
      try {
        console.log(`Deleting: ${property.address}`);
        console.log(`  Firestore ID: ${property.id}`);
        console.log(`  City: ${property.city}, ${property.state}`);

        await db.collection('properties').doc(property.id).delete();

        console.log(`  ✅ Deleted successfully\n`);
        results.deleted++;
      } catch (error) {
        console.log(`  ❌ Failed to delete`);
        console.log(`  Error: ${error.message}\n`);
        results.failed++;
        results.errors.push({
          property: property.address,
          id: property.id,
          error: error.message
        });
      }
    }

    console.log('========================================');
    console.log('DELETION COMPLETE');
    console.log('========================================');
    console.log(`Total properties: ${results.total}`);
    console.log(`✅ Successfully deleted: ${results.deleted}`);
    console.log(`❌ Failed to delete: ${results.failed}`);
    console.log('========================================\n');

    if (results.errors.length > 0) {
      console.log('ERRORS:\n');
      results.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.property} (ID: ${err.id})`);
        console.log(`   Error: ${err.error}\n`);
      });
    }

    // Save results
    const resultsPath = path.join(__dirname, 'deletion-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${resultsPath}\n`);

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the script
deleteProperties()
  .then(() => {
    console.log('Deletion completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deletion failed:', error);
    process.exit(1);
  });
