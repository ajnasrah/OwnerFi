const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const csv = require('csv-parser');

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

async function findNotAvailableProperties() {
  console.log('========================================');
  console.log('FINDING "NOT AVAILABLE" PROPERTIES');
  console.log('========================================\n');

  try {
    // Get all properties from Firestore
    console.log('Fetching properties from Firestore...');
    const snapshot = await db.collection('properties').get();

    const firestoreProperties = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      // Store by opportunityId for easier lookup
      if (data.opportunityId) {
        firestoreProperties.set(data.opportunityId, {
          id: doc.id,
          opportunityId: data.opportunityId,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price
        });
      }
      // Also store by street address (first part before comma/city)
      if (data.address) {
        const streetNum = data.address.split(' ')[0]; // Get just the street number
        firestoreProperties.set(streetNum.toLowerCase(), {
          id: doc.id,
          opportunityId: data.opportunityId,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price
        });
      }
    });

    console.log(`✅ Found ${snapshot.size} properties in Firestore\n`);

    // Read CSV file
    console.log('Reading opportunities from CSV...');
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities-3.csv';

    const notAvailableOpportunities = [];
    const shouldBeDeleted = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          // Check if stage is "not available"
          if (row.stage && row.stage.toLowerCase().includes('not available')) {
            const oppId = row['Opportunity ID'];
            const address = row['Property Address'];
            const streetNum = address ? address.split(' ')[0] : '';

            notAvailableOpportunities.push({
              opportunityId: oppId,
              name: row['Opportunity Name'],
              address: address,
              city: row['Property city'],
              state: row['State '] || row['State'],
              stage: row.stage
            });

            // Check if this property exists in Firestore by opportunity ID or street address
            const existsByOppId = firestoreProperties.has(oppId);
            const existsByAddress = streetNum && firestoreProperties.has(streetNum.toLowerCase());

            if (existsByOppId || existsByAddress) {
              const prop = existsByOppId
                ? firestoreProperties.get(oppId)
                : firestoreProperties.get(streetNum.toLowerCase());

              shouldBeDeleted.push({
                ...prop,
                ghlAddress: address,
                ghlStage: row.stage
              });
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`✅ Found ${notAvailableOpportunities.length} opportunities with "not available" status in CSV\n`);

    console.log('========================================');
    console.log('PROPERTIES TO DELETE FROM WEBSITE');
    console.log('========================================\n');

    if (shouldBeDeleted.length === 0) {
      console.log('✅ No "not available" properties found on website!');
    } else {
      console.log(`❌ Found ${shouldBeDeleted.length} properties marked "not available" that are still on website:\n`);

      shouldBeDeleted.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address || prop.ghlAddress}`);
        console.log(`   Firestore ID: ${prop.id}`);
        console.log(`   Opportunity ID: ${prop.opportunityId}`);
        console.log(`   City: ${prop.city}`);
        console.log(`   State: ${prop.state}`);
        console.log(`   GHL Stage: ${prop.ghlStage}`);
        console.log('');
      });

      // Save to file for deletion
      const reportPath = path.join(__dirname, 'properties-to-delete.json');
      fs.writeFileSync(reportPath, JSON.stringify(shouldBeDeleted, null, 2));
      console.log(`📄 Full list saved to: ${reportPath}`);
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Total "not available" in GHL: ${notAvailableOpportunities.length}`);
    console.log(`Still listed on website: ${shouldBeDeleted.length}`);
    console.log(`Need to be deleted: ${shouldBeDeleted.length}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error finding properties:', error);
  }
}

// Run the script
findNotAvailableProperties()
  .then(() => {
    console.log('Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
