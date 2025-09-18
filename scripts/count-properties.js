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

async function countProperties() {
  console.log('========================================');
  console.log('PROPERTY DATABASE COUNT VERIFICATION');
  console.log('========================================\n');

  try {
    // Get ALL properties without any limit
    console.log('Fetching all properties from database...');
    const snapshot = await db.collection('properties').get();

    console.log(`\n✅ Total properties in database: ${snapshot.size}`);

    // Count properties with and without interest rates
    let withInterestRate = 0;
    let withoutInterestRate = 0;
    let withOpportunityId = 0;
    let withoutOpportunityId = 0;

    const propertyIds = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      propertyIds.push(doc.id);

      if (data.interestRate && data.interestRate > 0) {
        withInterestRate++;
      } else {
        withoutInterestRate++;
      }

      if (data.opportunityId) {
        withOpportunityId++;
      } else {
        withoutOpportunityId++;
      }
    });

    console.log(`\nProperty Statistics:`);
    console.log(`- With interest rate: ${withInterestRate}`);
    console.log(`- Without interest rate: ${withoutInterestRate}`);
    console.log(`- With opportunity ID field: ${withOpportunityId}`);
    console.log(`- Without opportunity ID field: ${withoutOpportunityId}`);

    // Show sample of property IDs
    console.log(`\nSample of first 10 property IDs:`);
    propertyIds.slice(0, 10).forEach(id => {
      console.log(`  - ${id}`);
    });

    // Check if there are any subcollections or different naming
    console.log('\nChecking for any properties in different states...');

    // Check for properties with specific conditions
    const activeProperties = await db.collection('properties')
      .where('status', '==', 'active')
      .get();

    console.log(`Properties with status='active': ${activeProperties.size}`);

    // Check for properties with isActive field
    const isActiveProperties = await db.collection('properties')
      .where('isActive', '==', true)
      .get();

    console.log(`Properties with isActive=true: ${isActiveProperties.size}`);

    // Get collection statistics by counting in batches
    console.log('\nPerforming batch count verification...');
    let batchCount = 0;
    const batchSize = 100;
    let lastDoc = null;

    while (true) {
      let q = db.collection('properties')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);

      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const batch = await q.get();
      if (batch.empty) break;

      batchCount += batch.size;
      lastDoc = batch.docs[batch.docs.length - 1];

      if (batch.size < batchSize) break;
    }

    console.log(`Batch count verification: ${batchCount} properties`);

    console.log('\n========================================');
    console.log('FINAL COUNT SUMMARY');
    console.log('========================================');
    console.log(`Total properties in database: ${snapshot.size}`);
    console.log(`Expected by user: 314`);
    console.log(`Difference: ${314 - snapshot.size}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error counting properties:', error);
  }
}

// Run the count
countProperties()
  .then(() => {
    console.log('Count verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Count verification failed:', error);
    process.exit(1);
  });