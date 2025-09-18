const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
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

// CSV file path
const CSV_FILE_PATH = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

async function updateAllInterestRates() {
  const propertiesWithRates = [];
  let processedCount = 0;
  let successCount = 0;
  let notFoundCount = 0;
  let alreadyCorrectCount = 0;
  let updatedCount = 0;

  console.log('========================================');
  console.log('UPDATING ALL INTEREST RATES FROM CSV');
  console.log('========================================\n');

  // Step 1: Read CSV and extract ALL properties with interest rates
  console.log('📖 Reading CSV file and extracting interest rates...\n');

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        const opportunityId = row['Opportunity ID']?.trim();
        const interestRateStr = row['Interest rate ']?.trim(); // Note the space after "rate"
        const opportunityName = row['Opportunity Name']?.trim();
        const propertyAddress = row['Property Address']?.trim();

        // Only process rows with valid opportunity IDs and interest rates
        if (opportunityId && interestRateStr && interestRateStr !== '' && interestRateStr !== 'N/A') {
          const interestRate = parseFloat(interestRateStr.replace('%', '').trim());

          if (!isNaN(interestRate) && interestRate > 0) {
            propertiesWithRates.push({
              opportunityId,
              interestRate,
              name: opportunityName || 'Unknown',
              address: propertyAddress || 'Unknown'
            });
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`✅ Found ${propertiesWithRates.length} properties with valid interest rates in CSV\n`);
  console.log('Starting database updates...\n');

  // Step 2: Update properties in batches
  const BATCH_SIZE = 10;
  const updateResults = [];

  for (let i = 0; i < propertiesWithRates.length; i += BATCH_SIZE) {
    const batch = propertiesWithRates.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async ({ opportunityId, interestRate, name, address }) => {
      try {
        // Check if the property exists in database
        const docRef = db.collection('properties').doc(opportunityId);
        const doc = await docRef.get();

        if (doc.exists) {
          const currentData = doc.data();
          const currentInterestRate = currentData.interestRate;

          // Check if update is needed
          if (currentInterestRate !== interestRate) {
            // Update the property with new interest rate
            await docRef.update({
              interestRate: interestRate,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastUpdated: new Date().toISOString(),
              interestRateUpdatedFrom: 'CSV_bulk_update'
            });

            updatedCount++;
            console.log(`✅ Updated ${opportunityId}: ${currentInterestRate || 'none'}% → ${interestRate}%`);

            updateResults.push({
              status: 'updated',
              opportunityId,
              oldRate: currentInterestRate || null,
              newRate: interestRate,
              name,
              address
            });
          } else {
            alreadyCorrectCount++;
            console.log(`✓ Already correct ${opportunityId}: ${interestRate}%`);

            updateResults.push({
              status: 'already_correct',
              opportunityId,
              rate: interestRate,
              name,
              address
            });
          }

          successCount++;
        } else {
          notFoundCount++;
          console.log(`⚠️ Not found in database: ${opportunityId} (${name})`);

          updateResults.push({
            status: 'not_found',
            opportunityId,
            rate: interestRate,
            name,
            address
          });
        }

        return { success: true, opportunityId };
      } catch (error) {
        console.error(`❌ Error processing ${opportunityId}:`, error.message);

        updateResults.push({
          status: 'error',
          opportunityId,
          error: error.message,
          name,
          address
        });

        return { success: false, opportunityId, error: error.message };
      }
    });

    // Wait for batch to complete
    await Promise.all(batchPromises);
    processedCount += batch.length;

    // Show progress
    const progress = ((processedCount / propertiesWithRates.length) * 100).toFixed(1);
    console.log(`\n📊 Progress: ${processedCount}/${propertiesWithRates.length} (${progress}%)\n`);
  }

  // Step 3: Generate summary report
  console.log('\n========================================');
  console.log('UPDATE COMPLETE - DETAILED SUMMARY');
  console.log('========================================');
  console.log(`Total properties with interest rates in CSV: ${propertiesWithRates.length}`);
  console.log(`✅ Successfully processed: ${successCount}`);
  console.log(`  - 🔄 Updated: ${updatedCount}`);
  console.log(`  - ✓ Already correct: ${alreadyCorrectCount}`);
  console.log(`⚠️ Not found in database: ${notFoundCount}`);
  console.log(`❌ Errors: ${propertiesWithRates.length - successCount - notFoundCount}`);
  console.log('========================================\n');

  // Step 4: Show detailed breakdown of not found properties
  const notFoundProperties = updateResults.filter(r => r.status === 'not_found');
  if (notFoundProperties.length > 0) {
    console.log('PROPERTIES NOT FOUND IN DATABASE:');
    console.log('----------------------------------------');
    console.log(`Total: ${notFoundProperties.length} properties\n`);

    // Group by interest rate
    const byRate = {};
    notFoundProperties.forEach(prop => {
      if (!byRate[prop.rate]) {
        byRate[prop.rate] = [];
      }
      byRate[prop.rate].push(prop);
    });

    // Show first few from each rate group
    Object.keys(byRate).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(rate => {
      console.log(`\nInterest Rate ${rate}%: (${byRate[rate].length} properties)`);
      byRate[rate].slice(0, 2).forEach(prop => {
        console.log(`  - ${prop.opportunityId}: ${prop.name}`);
      });
      if (byRate[rate].length > 2) {
        console.log(`  ... and ${byRate[rate].length - 2} more`);
      }
    });
  }

  // Step 5: Save detailed report to file
  const report = {
    summary: {
      totalInCSV: propertiesWithRates.length,
      successfullyProcessed: successCount,
      updated: updatedCount,
      alreadyCorrect: alreadyCorrectCount,
      notFound: notFoundCount,
      errors: propertiesWithRates.length - successCount - notFoundCount
    },
    updateResults: updateResults,
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(__dirname, 'interest-rate-update-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Detailed report saved to: ${reportPath}`);

  // Step 6: Final verification
  console.log('\n🔍 PERFORMING FINAL VERIFICATION...\n');

  const verifySnapshot = await db.collection('properties').get();
  let verifiedWithRates = 0;

  verifySnapshot.forEach(doc => {
    const data = doc.data();
    if (data.interestRate && data.interestRate > 0) {
      verifiedWithRates++;
    }
  });

  console.log(`Final database state:`);
  console.log(`- Total properties: ${verifySnapshot.size}`);
  console.log(`- Properties with interest rates: ${verifiedWithRates}`);
  console.log(`- Properties without interest rates: ${verifySnapshot.size - verifiedWithRates}`);
}

// Run the update
updateAllInterestRates()
  .then(() => {
    console.log('\n✅ All interest rate updates completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update process failed:', error);
    process.exit(1);
  });