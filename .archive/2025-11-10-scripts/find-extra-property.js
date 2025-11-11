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

async function findExtraProperty() {
  console.log('Finding property on website but not in GHL "exported to website"...\n');

  try {
    // Get all properties from Firestore
    const snapshot = await db.collection('properties').get();
    const firestoreProperties = new Map();

    snapshot.forEach(doc => {
      const data = doc.data();
      firestoreProperties.set(data.opportunityId, {
        id: doc.id,
        opportunityId: data.opportunityId,
        address: data.address,
        city: data.city,
        state: data.state,
        price: data.price
      });
    });

    console.log(`Firestore properties: ${firestoreProperties.size}\n`);

    // Read GHL CSV and get only "exported to website"
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities-3.csv';
    const ghlExported = new Set();

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const stage = row.stage || '';
          if (stage.toLowerCase().includes('exported to website')) {
            ghlExported.add(row['Opportunity ID']);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`GHL exported to website: ${ghlExported.size}\n`);

    // Find properties in Firestore but not in GHL exported
    const extraProperties = [];

    firestoreProperties.forEach((prop, oppId) => {
      if (!ghlExported.has(oppId)) {
        extraProperties.push(prop);
      }
    });

    console.log('========================================');
    console.log(`Found ${extraProperties.length} property(ies) on website but NOT in GHL "exported to website":\n`);

    extraProperties.forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.address}`);
      console.log(`   Firestore ID: ${prop.id}`);
      console.log(`   Opportunity ID: ${prop.opportunityId}`);
      console.log(`   City: ${prop.city}, ${prop.state}`);
      console.log(`   Price: $${prop.price}\n`);
    });

    const reportPath = path.join(__dirname, 'extra-properties-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(extraProperties, null, 2));
    console.log(`📄 Saved to: ${reportPath}\n`);

  } catch (error) {
    console.error('Error:', error);
  }
}

findExtraProperty()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
