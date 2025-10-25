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

async function matchOpportunityIds() {
  console.log('========================================');
  console.log('MATCHING OPPORTUNITY IDS');
  console.log('========================================\n');

  try {
    // Get all properties from Firestore
    console.log('Fetching properties from Firestore...');
    const snapshot = await db.collection('properties').get();

    const firestoreByOppId = new Map();
    const firestoreWithoutOppId = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.opportunityId) {
        firestoreByOppId.set(data.opportunityId, {
          id: doc.id,
          opportunityId: data.opportunityId,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price,
          status: data.status,
          isActive: data.isActive
        });
      } else {
        firestoreWithoutOppId.push({
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price
        });
      }
    });

    console.log(`✅ Found ${snapshot.size} properties in Firestore`);
    console.log(`   - With opportunity ID: ${firestoreByOppId.size}`);
    console.log(`   - Without opportunity ID: ${firestoreWithoutOppId.length}\n`);

    // Read CSV file
    console.log('Reading opportunities from GoHighLevel CSV...');
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities-2.csv';

    const ghlOpportunities = new Map();
    const ghlExported = new Map();
    const ghlNotAvailable = new Map();

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const oppId = row['Opportunity ID'];
          const stage = row.stage || '';
          const address = row['Property Address'] || '';
          const city = row['Property city'] || '';
          const state = (row['State '] || row['State'] || '').trim();

          const oppData = {
            opportunityId: oppId,
            name: row['Opportunity Name'],
            address,
            city,
            state,
            stage,
            price: row['Price '] || row['Price']
          };

          ghlOpportunities.set(oppId, oppData);

          if (stage.toLowerCase().includes('exported to website')) {
            ghlExported.set(oppId, oppData);
          } else if (stage.toLowerCase().includes('not available')) {
            ghlNotAvailable.set(oppId, oppData);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`✅ Found ${ghlOpportunities.size} opportunities in GoHighLevel`);
    console.log(`   - Exported to website: ${ghlExported.size}`);
    console.log(`   - Not available: ${ghlNotAvailable.size}\n`);

    // Analysis
    console.log('========================================');
    console.log('MATCHING ANALYSIS');
    console.log('========================================\n');

    // 1. Properties on website that should be deleted (marked "not available" in GHL)
    const shouldDelete = [];
    firestoreByOppId.forEach((prop, oppId) => {
      if (ghlNotAvailable.has(oppId)) {
        shouldDelete.push({
          ...prop,
          ghlStage: ghlNotAvailable.get(oppId).stage
        });
      }
    });

    // 2. Properties marked "exported" in GHL but missing from website
    const shouldAdd = [];
    ghlExported.forEach((ghlProp, oppId) => {
      if (!firestoreByOppId.has(oppId)) {
        shouldAdd.push(ghlProp);
      }
    });

    // 3. Properties on website but not in GHL at all
    const orphaned = [];
    firestoreByOppId.forEach((prop, oppId) => {
      if (!ghlOpportunities.has(oppId)) {
        orphaned.push(prop);
      }
    });

    // 4. Properties on website that match GHL (correctly synced)
    const matched = [];
    firestoreByOppId.forEach((prop, oppId) => {
      if (ghlExported.has(oppId)) {
        matched.push({
          ...prop,
          ghlStage: ghlExported.get(oppId).stage
        });
      }
    });

    console.log('📊 RESULTS:\n');
    console.log(`✅ Correctly synced: ${matched.length} properties`);
    console.log(`❌ Should be DELETED (marked "not available"): ${shouldDelete.length}`);
    console.log(`⚠️  Should be ADDED (exported but missing): ${shouldAdd.length}`);
    console.log(`🔍 Orphaned (on website but not in GHL): ${orphaned.length}`);
    console.log(`⚪ Missing opportunity ID in Firestore: ${firestoreWithoutOppId.length}\n`);

    // Show details
    if (shouldDelete.length > 0) {
      console.log('========================================');
      console.log('PROPERTIES TO DELETE (NOT AVAILABLE)');
      console.log('========================================\n');
      shouldDelete.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}`);
        console.log(`   Opportunity ID: ${prop.opportunityId}`);
        console.log(`   City: ${prop.city}, ${prop.state}`);
        console.log(`   GHL Stage: ${prop.ghlStage}\n`);
      });

      const deleteReportPath = path.join(__dirname, 'properties-to-delete-by-oppid.json');
      fs.writeFileSync(deleteReportPath, JSON.stringify(shouldDelete, null, 2));
      console.log(`📄 Saved to: ${deleteReportPath}\n`);
    }

    if (shouldAdd.length > 0) {
      console.log('========================================');
      console.log('PROPERTIES TO ADD (MISSING FROM WEBSITE)');
      console.log('========================================\n');
      shouldAdd.slice(0, 10).forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address || prop.name}`);
        console.log(`   Opportunity ID: ${prop.opportunityId}`);
        console.log(`   City: ${prop.city}, ${prop.state}\n`);
      });
      if (shouldAdd.length > 10) {
        console.log(`... and ${shouldAdd.length - 10} more\n`);
      }

      const addReportPath = path.join(__dirname, 'properties-to-add-by-oppid.json');
      fs.writeFileSync(addReportPath, JSON.stringify(shouldAdd, null, 2));
      console.log(`📄 Full list saved to: ${addReportPath}\n`);
    }

    if (orphaned.length > 0) {
      console.log('========================================');
      console.log('ORPHANED PROPERTIES (NOT IN GHL)');
      console.log('========================================\n');
      orphaned.slice(0, 10).forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}`);
        console.log(`   Firestore ID: ${prop.id}`);
        console.log(`   Opportunity ID: ${prop.opportunityId}`);
        console.log(`   City: ${prop.city}, ${prop.state}\n`);
      });
      if (orphaned.length > 10) {
        console.log(`... and ${orphaned.length - 10} more\n`);
      }

      const orphanedReportPath = path.join(__dirname, 'orphaned-properties.json');
      fs.writeFileSync(orphanedReportPath, JSON.stringify(orphaned, null, 2));
      console.log(`📄 Full list saved to: ${orphanedReportPath}\n`);
    }

    // Summary report
    const summary = {
      firestore: {
        total: snapshot.size,
        withOpportunityId: firestoreByOppId.size,
        withoutOpportunityId: firestoreWithoutOppId.length
      },
      gohighlevel: {
        total: ghlOpportunities.size,
        exportedToWebsite: ghlExported.size,
        notAvailable: ghlNotAvailable.size
      },
      matching: {
        correctlySynced: matched.length,
        shouldDelete: shouldDelete.length,
        shouldAdd: shouldAdd.length,
        orphaned: orphaned.length
      }
    };

    const summaryPath = path.join(__dirname, 'opportunity-matching-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(JSON.stringify(summary, null, 2));
    console.log(`\n📄 Summary saved to: ${summaryPath}\n`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
matchOpportunityIds()
  .then(() => {
    console.log('Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
