#!/usr/bin/env node

/**
 * Script to update property financial data from CSV
 * Updates interest rate, down payment percentage, and balloon years
 * Handles multiline CSV fields properly
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { parse } = require('csv-parse');

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
  propertiesWithOnlyPartialData: 0,
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
 * Also handles cases where the value might be a state abbreviation or other text
 */
function parseNumber(value) {
  if (!value || value === '') return null;

  // Check if it's a state abbreviation or other non-numeric text
  if (typeof value === 'string' && /^[a-zA-Z]{2,}$/i.test(value.trim())) {
    return null;
  }

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

  // Read and parse CSV with proper multiline handling
  const parser = fs
    .createReadStream(CSV_FILE_PATH)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true
    }));

  for await (const row of parser) {
    stats.totalRows++;

    const propertyAddress = row['Property Address'];
    const interestRate = parseNumber(row['Interest rate']);
    const downPaymentPercent = parseNumber(row['down payment']);
    const balloonYears = parseNumber(row['Balloon']);

    // Only process if we have an address AND at least one financial field
    if (propertyAddress && (interestRate !== null || downPaymentPercent !== null || balloonYears !== null)) {
      updates.push({
        address: propertyAddress,
        normalizedAddress: normalizeAddress(propertyAddress),
        interestRate,
        downPaymentPercent,
        balloonYears,
        hasPartialData: (interestRate !== null ? 1 : 0) +
                       (downPaymentPercent !== null ? 1 : 0) +
                       (balloonYears !== null ? 1 : 0) < 3
      });
    }
  }

  console.log(`📊 Found ${updates.length} properties with financial data in CSV`);
  console.log(`   → ${updates.filter(u => u.hasPartialData).length} properties have partial data (1-2 fields)\n`);

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
      const updatedFields = [];

      // Update each field independently - don't require all three
      if (update.interestRate !== null && update.interestRate !== firebaseProperty.data.interestRate) {
        updateData.interestRate = update.interestRate;
        updatedFields.push(`Interest: ${update.interestRate}%`);
        hasUpdates = true;
      }

      if (update.downPaymentPercent !== null && update.downPaymentPercent !== firebaseProperty.data.downPaymentPercent) {
        updateData.downPaymentPercent = update.downPaymentPercent;
        updatedFields.push(`Down Payment: ${update.downPaymentPercent}%`);
        hasUpdates = true;
      }

      if (update.balloonYears !== null && update.balloonYears !== firebaseProperty.data.balloonYears) {
        updateData.balloonYears = update.balloonYears;
        updatedFields.push(`Balloon: ${update.balloonYears} years`);
        hasUpdates = true;
      }

      if (hasUpdates) {
        try {
          await db.collection('properties').doc(firebaseProperty.id).update({
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          stats.propertiesUpdated++;
          if (update.hasPartialData) {
            stats.propertiesWithOnlyPartialData++;
          }

          console.log(`✅ Updated: ${update.address}`);
          updatedFields.forEach(field => console.log(`   → ${field}`));
          if (update.hasPartialData) {
            console.log(`   ⚠️  Note: Only partial data available`);
          }
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
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total CSV rows processed: ${stats.totalRows}`);
  console.log(`Properties with financial data: ${updates.length}`);
  console.log(`Properties found in database: ${stats.propertiesFound}`);
  console.log(`Properties updated: ${stats.propertiesUpdated}`);
  console.log(`  → With complete data: ${stats.propertiesUpdated - stats.propertiesWithOnlyPartialData}`);
  console.log(`  → With partial data: ${stats.propertiesWithOnlyPartialData}`);
  console.log(`Properties not found: ${stats.propertiesNotFound.length}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.propertiesNotFound.length > 0 && stats.propertiesNotFound.length <= 20) {
    console.log('\n⚠️  Properties not found in database:');
    stats.propertiesNotFound.forEach(addr => {
      console.log(`   - ${addr}`);
    });
  } else if (stats.propertiesNotFound.length > 20) {
    console.log(`\n⚠️  ${stats.propertiesNotFound.length} properties not found (too many to list)`);
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