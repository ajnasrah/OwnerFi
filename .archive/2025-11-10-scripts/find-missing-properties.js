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

async function findMissingProperties() {
  console.log('========================================');
  console.log('FINDING MISSING PROPERTIES');
  console.log('========================================\n');

  try {
    // Get all properties from Firestore
    console.log('Fetching properties from Firestore...');
    const snapshot = await db.collection('properties').get();

    const firestoreOpportunityIds = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.opportunityId) {
        firestoreOpportunityIds.add(data.opportunityId);
      }
    });

    console.log(`✅ Found ${firestoreOpportunityIds.size} properties in Firestore with opportunityId\n`);

    // Read CSV file
    console.log('Reading opportunities from CSV...');
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

    const exportedOpportunities = [];
    const missingFromWebsite = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          // Check if stage is "exported to website"
          if (row.stage && row.stage.toLowerCase().includes('exported to website')) {
            const oppId = row['Opportunity ID'];
            exportedOpportunities.push({
              opportunityId: oppId,
              name: row['Opportunity Name'],
              address: row['Property Address'],
              city: row['Property city'],
              state: row['State '], // Note the space in column name
              price: row['Price '],
              createdOn: row['Created on'],
              updatedOn: row['Updated on']
            });

            // Check if this opportunity exists in Firestore
            if (!firestoreOpportunityIds.has(oppId)) {
              missingFromWebsite.push({
                opportunityId: oppId,
                name: row['Opportunity Name'],
                address: row['Property Address'],
                city: row['Property city'],
                state: row['State '],
                price: row['Price '],
                createdOn: row['Created on'],
                updatedOn: row['Updated on']
              });
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`✅ Found ${exportedOpportunities.length} opportunities with "exported to website" status in CSV\n`);

    console.log('========================================');
    console.log('MISSING PROPERTIES REPORT');
    console.log('========================================\n');

    if (missingFromWebsite.length === 0) {
      console.log('✅ All exported properties are on the website!');
    } else {
      console.log(`❌ Found ${missingFromWebsite.length} properties missing from website:\n`);

      missingFromWebsite.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.name}`);
        console.log(`   Opportunity ID: ${prop.opportunityId}`);
        console.log(`   Address: ${prop.address}`);
        console.log(`   City: ${prop.city}`);
        console.log(`   State: ${prop.state}`);
        console.log(`   Price: ${prop.price}`);
        console.log(`   Created: ${prop.createdOn}`);
        console.log(`   Updated: ${prop.updatedOn}`);
        console.log('');
      });

      // Check for common issues
      console.log('========================================');
      console.log('ANALYZING MISSING PROPERTIES');
      console.log('========================================\n');

      let missingAddress = 0;
      let missingCity = 0;
      let missingState = 0;
      let missingPrice = 0;

      missingFromWebsite.forEach(prop => {
        if (!prop.address || prop.address.trim() === '') missingAddress++;
        if (!prop.city || prop.city.trim() === '') missingCity++;
        if (!prop.state || prop.state.trim() === '') missingState++;
        if (!prop.price || prop.price.trim() === '') missingPrice++;
      });

      console.log('Common issues found:');
      if (missingAddress > 0) console.log(`- ${missingAddress} properties missing address`);
      if (missingCity > 0) console.log(`- ${missingCity} properties missing city`);
      if (missingState > 0) console.log(`- ${missingState} properties missing state`);
      if (missingPrice > 0) console.log(`- ${missingPrice} properties missing price`);

      // Save to file for easy review
      const reportPath = path.join(__dirname, 'missing-properties-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(missingFromWebsite, null, 2));
      console.log(`\n📄 Full report saved to: ${reportPath}`);
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Total in Firestore: ${firestoreOpportunityIds.size}`);
    console.log(`Total exported in GHL: ${exportedOpportunities.length}`);
    console.log(`Missing from website: ${missingFromWebsite.length}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error finding missing properties:', error);
  }
}

// Run the script
findMissingProperties()
  .then(() => {
    console.log('Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
