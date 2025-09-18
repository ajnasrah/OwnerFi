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

async function updateInterestRates() {
  const results = [];
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  console.log('Starting to read CSV file...');

  // Read and parse CSV file
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        // Extract opportunity ID and interest rate
        const opportunityId = row['Opportunity ID']?.trim();
        const interestRateStr = row['Interest rate ']?.trim();

        if (opportunityId && interestRateStr) {
          // Parse interest rate - remove any % symbols and convert to number
          const interestRate = parseFloat(interestRateStr.replace('%', '').trim());

          if (!isNaN(interestRate) && interestRate > 0) {
            results.push({
              opportunityId,
              interestRate
            });
          } else {
            console.log(`Skipping opportunity ${opportunityId} - invalid interest rate: ${interestRateStr}`);
          }
        }
      })
      .on('end', async () => {
        console.log(`\nFound ${results.length} properties with valid interest rates to update`);
        console.log('Starting database updates...\n');

        // Process updates in batches to avoid overwhelming the database
        const BATCH_SIZE = 10;

        for (let i = 0; i < results.length; i += BATCH_SIZE) {
          const batch = results.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async ({ opportunityId, interestRate }) => {
            try {
              // Check if the property exists
              const docRef = db.collection('properties').doc(opportunityId);
              const doc = await docRef.get();

              if (doc.exists) {
                // Update the interest rate
                await docRef.update({
                  interestRate: interestRate,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  lastUpdated: new Date().toISOString()
                });

                successCount++;
                console.log(`✅ Updated property ${opportunityId} with interest rate: ${interestRate}%`);
                return { success: true, opportunityId, interestRate };
              } else {
                skippedCount++;
                console.log(`⚠️  Property ${opportunityId} not found in database`);
                return { success: false, opportunityId, reason: 'not found' };
              }
            } catch (error) {
              errorCount++;
              console.error(`❌ Error updating property ${opportunityId}:`, error.message);
              return { success: false, opportunityId, error: error.message };
            }
          });

          // Wait for batch to complete
          await Promise.all(batchPromises);
          processedCount += batch.length;

          // Show progress
          const progress = ((processedCount / results.length) * 100).toFixed(1);
          console.log(`\nProgress: ${processedCount}/${results.length} (${progress}%)`);
        }

        // Print summary
        console.log('\n========================================');
        console.log('UPDATE COMPLETE - SUMMARY');
        console.log('========================================');
        console.log(`Total properties processed: ${processedCount}`);
        console.log(`✅ Successfully updated: ${successCount}`);
        console.log(`⚠️  Skipped (not found): ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('========================================\n');

        resolve();
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
        reject(error);
      });
  });
}

// Run the update
updateInterestRates()
  .then(() => {
    console.log('Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Process failed:', error);
    process.exit(1);
  });