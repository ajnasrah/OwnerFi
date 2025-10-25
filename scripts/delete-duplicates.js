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

async function deleteDuplicates() {
  console.log('========================================');
  console.log('DELETING DUPLICATE PROPERTIES');
  console.log('========================================\n');

  try {
    const filePath = path.join(__dirname, 'duplicate-properties-to-delete.json');
    const duplicates = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`Found ${duplicates.length} duplicate properties to delete\n`);

    let deleted = 0;
    let failed = 0;

    for (const prop of duplicates) {
      try {
        console.log(`Deleting: ${prop.address}`);
        console.log(`  ID: ${prop.id}`);
        console.log(`  Opportunity ID: ${prop.opportunityId || 'none'}`);

        await db.collection('properties').doc(prop.id).delete();

        console.log(`  ✅ Deleted\n`);
        deleted++;
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}\n`);
        failed++;
      }
    }

    console.log('========================================');
    console.log('DELETION COMPLETE');
    console.log('========================================');
    console.log(`✅ Deleted: ${deleted}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

deleteDuplicates()
  .then(() => {
    console.log('Completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
