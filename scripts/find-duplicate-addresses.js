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

async function findDuplicates() {
  console.log('========================================');
  console.log('FINDING DUPLICATE PROPERTIES BY ADDRESS');
  console.log('========================================\n');

  try {
    const snapshot = await db.collection('properties').get();

    const addressMap = new Map();
    const duplicates = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const address = data.address?.toLowerCase().trim();

      if (address) {
        if (!addressMap.has(address)) {
          addressMap.set(address, []);
        }
        addressMap.set(address, [...addressMap.get(address), {
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price,
          opportunityId: data.opportunityId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        }]);
      }
    });

    // Find addresses with more than one property
    addressMap.forEach((properties, address) => {
      if (properties.length > 1) {
        duplicates.push({
          address: properties[0].address, // Use original casing
          count: properties.length,
          properties: properties.sort((a, b) => {
            // Sort by createdAt, oldest first
            const dateA = a.createdAt?._seconds || 0;
            const dateB = b.createdAt?._seconds || 0;
            return dateA - dateB;
          })
        });
      }
    });

    console.log(`Total properties: ${snapshot.size}`);
    console.log(`Unique addresses: ${addressMap.size}`);
    console.log(`Duplicate addresses found: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!\n');
      return;
    }

    console.log('========================================');
    console.log('DUPLICATE PROPERTIES');
    console.log('========================================\n');

    const propertiesToDelete = [];

    duplicates.forEach((dup, index) => {
      console.log(`${index + 1}. ${dup.address} (${dup.count} copies)`);
      dup.properties.forEach((prop, propIndex) => {
        const isOldest = propIndex === 0;
        const createdDate = prop.createdAt?._seconds
          ? new Date(prop.createdAt._seconds * 1000).toISOString()
          : 'unknown';

        console.log(`   ${isOldest ? '📌 KEEP' : '❌ DELETE'}: ID: ${prop.id}`);
        console.log(`      Opportunity ID: ${prop.opportunityId || 'none'}`);
        console.log(`      City: ${prop.city}, ${prop.state}`);
        console.log(`      Price: $${prop.price}`);
        console.log(`      Created: ${createdDate}`);

        if (!isOldest) {
          propertiesToDelete.push(prop);
        }
      });
      console.log('');
    });

    // Save list of properties to delete
    const reportPath = path.join(__dirname, 'duplicate-properties-to-delete.json');
    const fs = require('fs');
    fs.writeFileSync(reportPath, JSON.stringify(propertiesToDelete, null, 2));

    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Total duplicates found: ${duplicates.length} addresses`);
    console.log(`Properties to delete: ${propertiesToDelete.length}`);
    console.log(`Properties to keep: ${duplicates.length}`);
    console.log(`\n📄 List saved to: ${reportPath}\n`);

  } catch (error) {
    console.error('Error:', error);
  }
}

findDuplicates()
  .then(() => {
    console.log('Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
