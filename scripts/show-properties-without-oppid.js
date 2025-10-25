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

async function showPropertiesWithoutOppId() {
  console.log('========================================');
  console.log('PROPERTIES WITHOUT OPPORTUNITY ID');
  console.log('========================================\n');

  try {
    const snapshot = await db.collection('properties').get();

    const withoutOppId = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.opportunityId) {
        withoutOppId.push({
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price,
          source: data.source,
          createdAt: data.createdAt,
          dateAdded: data.dateAdded
        });
      }
    });

    console.log(`Found ${withoutOppId.length} properties without opportunity ID\n`);

    withoutOppId.forEach((prop, index) => {
      const createdDate = prop.createdAt?._seconds
        ? new Date(prop.createdAt._seconds * 1000).toISOString()
        : prop.dateAdded || 'unknown';

      console.log(`${index + 1}. ${prop.address}`);
      console.log(`   Firestore ID: ${prop.id}`);
      console.log(`   City: ${prop.city}, ${prop.state}`);
      console.log(`   Price: $${prop.price}`);
      console.log(`   Source: ${prop.source || 'unknown'}`);
      console.log(`   Created: ${createdDate}`);
      console.log('');
    });

    console.log('========================================');
    console.log('OPTIONS');
    console.log('========================================');
    console.log('1. KEEP them - They are legitimate properties from manual imports');
    console.log('2. DELETE them - If you only want GoHighLevel properties');
    console.log('3. MATCH them - Try to find matching opportunity IDs in GoHighLevel');
    console.log('========================================\n');

    // Save to file
    const fs = require('fs');
    const reportPath = path.join(__dirname, 'properties-without-oppid.json');
    fs.writeFileSync(reportPath, JSON.stringify(withoutOppId, null, 2));
    console.log(`📄 Saved to: ${reportPath}\n`);

  } catch (error) {
    console.error('Error:', error);
  }
}

showPropertiesWithoutOppId()
  .then(() => {
    console.log('Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
