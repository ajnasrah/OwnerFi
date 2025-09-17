#!/usr/bin/env node

/**
 * Script to update property financial data from CSV
 * Updates interest rate, down payment percentage, and balloon years
 */

const admin = require('firebase-admin');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error('❌ Missing Firebase credentials in environment variables');
  console.error('   Please ensure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    clientEmail,
  })
});

const db = admin.firestore();

// CSV file path
const CSV_FILE_PATH = '/Users/abdullahabunasrah/Downloads/opportunities_geocoded.csv';

// Stats for tracking
let stats = {
  totalRows: 0,
  propertiesFound: 0,
  propertiesUpdated: 0,
  propertiesNotFound: [],
  errors: []
};

/**
 * Normalize address for matching
 */
function normalizeAddress(address) {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse numeric value from string
 */
function parseNumber(value) {
  if (!value || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Process CSV and update properties
 */
async function processCSV() {
  console.log('🚀 Starting property financial data update...');
  console.log(`📄 Reading CSV from: ${CSV_FILE_PATH}\n`);

  const updates = [];

  // Read and parse CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => {
        stats.totalRows++;

        const propertyAddress = row['Property Address'];
        const interestRate = parseNumber(row['Interest rate']);
        const downPaymentPercent = parseNumber(row['down payment']);
        const balloonYears = parseNumber(row['Balloon']);

        if (propertyAddress) {
          updates.push({
            address: propertyAddress,
            normalizedAddress: normalizeAddress(propertyAddress),
            interestRate,
            downPaymentPercent,
            balloonYears,
            originalRow: row
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📊 Found ${updates.length} properties with addresses in CSV\n`);

  // Get all properties from Firebase
  console.log('🔍 Fetching properties from Firebase...');
  const propertiesSnapshot = await db.collection('properties').get();
  const propertiesMap = new Map();

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.address) {
      const normalized = normalizeAddress(data.address);
      propertiesMap.set(normalized, { id: doc.id, data });
    }
  });

  console.log(`✅ Found ${propertiesMap.size} properties in Firebase\n`);

  // Process updates
  console.log('🔄 Updating properties...\n');

  for (const update of updates) {
    const firebaseProperty = propertiesMap.get(update.normalizedAddress);

    if (firebaseProperty) {
      stats.propertiesFound++;

      const updateData = {};
      let hasUpdates = false;

      // Only update if value exists and is different
      if (update.interestRate !== null && update.interestRate !== firebaseProperty.data.interestRate) {
        updateData.interestRate = update.interestRate;
        hasUpdates = true;
      }

      if (update.downPaymentPercent !== null && update.downPaymentPercent !== firebaseProperty.data.downPaymentPercent) {
        updateData.downPaymentPercent = update.downPaymentPercent;
        hasUpdates = true;
      }

      if (update.balloonYears !== null && update.balloonYears !== firebaseProperty.data.balloonYears) {
        updateData.balloonYears = update.balloonYears;
        hasUpdates = true;
      }

      if (hasUpdates) {
        try {
          await db.collection('properties').doc(firebaseProperty.id).update({
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          stats.propertiesUpdated++;
          console.log(`✅ Updated: ${update.address}`);
          console.log(`   → Interest Rate: ${update.interestRate || 'N/A'}%`);
          console.log(`   → Down Payment: ${update.downPaymentPercent || 'N/A'}%`);
          console.log(`   → Balloon Years: ${update.balloonYears || 'N/A'}`);
          console.log('');
        } catch (error) {
          console.error(`❌ Error updating ${update.address}:`, error.message);
          stats.errors.push({ address: update.address, error: error.message });
        }
      } else {
        console.log(`⏭️  Skipped: ${update.address} (no new data)`);
      }
    } else {
      stats.propertiesNotFound.push(update.address);
      console.log(`⚠️  Not found in database: ${update.address}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total CSV rows: ${stats.totalRows}`);
  console.log(`Properties found in database: ${stats.propertiesFound}`);
  console.log(`Properties updated: ${stats.propertiesUpdated}`);
  console.log(`Properties not found: ${stats.propertiesNotFound.length}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.propertiesNotFound.length > 0) {
    console.log('\n⚠️  Properties not found in database:');
    stats.propertiesNotFound.forEach(addr => {
      console.log(`   - ${addr}`);
    });
  }

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    stats.errors.forEach(({ address, error }) => {
      console.log(`   - ${address}: ${error}`);
    });
  }

  console.log('\n✅ Update process completed!');
}

// Run the script
processCSV()
  .then(() => {
    console.log('\n👍 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });