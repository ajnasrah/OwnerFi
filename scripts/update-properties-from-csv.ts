import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import csv from 'csv-parser';

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    }),
  });
}

const db = getFirestore();

interface CSVProperty {
  'Opportunity ID': string;
  'Property Address': string;
  'Property city': string;
  'State ': string;
  'zip code ': string;
  'yearBuilt': string;
  'bedrooms': string;
  'bathrooms': string;
  'livingArea': string;
  'homeType': string;
  'Price ': string;
  'description ': string;
  'lot sizes': string;
  'Image link': string;
  'Tax amount ': string;
  'hoa ': string;
  'zestimate ': string;
  'Rental estimate ': string;
  'Contact ID': string;
  'phone': string;
  'email': string;
  'Contact Name': string;
  'daysOnZillow': string;
  'source': string;
}

async function readCSV(filePath: string): Promise<CSVProperty[]> {
  return new Promise((resolve, reject) => {
    const results: CSVProperty[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function cleanValue(value: any): any {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (str === '' || str === ' ') return null;
  return str;
}

function parseNumber(value: any): number | null {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function buildUpdateData(csvRecord: CSVProperty): any {
  const updateData: any = {};

  // Only add fields that have values
  const address = cleanValue(csvRecord['Property Address']);
  const city = cleanValue(csvRecord['Property city']);
  const state = cleanValue(csvRecord['State ']);
  const zipCode = cleanValue(csvRecord['zip code ']);
  const yearBuilt = parseNumber(csvRecord['yearBuilt']);
  const bedrooms = parseNumber(csvRecord['bedrooms']);
  const bathrooms = parseNumber(csvRecord['bathrooms']);
  const livingArea = parseNumber(csvRecord['livingArea']);
  const homeType = cleanValue(csvRecord['homeType']);
  const price = parseNumber(csvRecord['Price ']);
  const description = cleanValue(csvRecord['description ']);
  const lotSize = parseNumber(csvRecord['lot sizes']);
  const imageUrl = cleanValue(csvRecord['Image link']);
  const taxAmount = parseNumber(csvRecord['Tax amount ']);
  const hoa = parseNumber(csvRecord['hoa ']);
  const zestimate = parseNumber(csvRecord['zestimate ']);
  const rentalEstimate = parseNumber(csvRecord['Rental estimate ']);
  const contactId = cleanValue(csvRecord['Contact ID']);
  const contactPhone = cleanValue(csvRecord['phone']);
  const contactEmail = cleanValue(csvRecord['email']);
  const contactName = cleanValue(csvRecord['Contact Name']);
  const daysOnZillow = parseNumber(csvRecord['daysOnZillow']);
  const source = cleanValue(csvRecord['source']);

  // Property details
  if (address !== null) updateData.address = address;
  if (city !== null) updateData.city = city;
  if (state !== null) updateData.state = state;
  if (zipCode !== null) updateData.zipCode = zipCode;
  if (yearBuilt !== null) updateData.yearBuilt = yearBuilt;
  if (bedrooms !== null) updateData.bedrooms = bedrooms;
  if (bathrooms !== null) updateData.bathrooms = bathrooms;
  if (livingArea !== null) updateData.livingArea = livingArea;
  if (homeType !== null) updateData.homeType = homeType;
  if (price !== null) updateData.price = price;
  if (description !== null) updateData.description = description;
  if (lotSize !== null) updateData.lotSize = lotSize;
  if (imageUrl !== null) updateData.imageUrl = imageUrl;
  if (taxAmount !== null) updateData.taxAmount = taxAmount;
  if (hoa !== null) updateData.hoa = hoa;
  if (zestimate !== null) updateData.zestimate = zestimate;
  if (rentalEstimate !== null) updateData.rentalEstimate = rentalEstimate;

  // Contact info
  if (contactId !== null) updateData.contactId = contactId;
  if (contactPhone !== null) updateData.contactPhone = contactPhone;
  if (contactEmail !== null) updateData.contactEmail = contactEmail;
  if (contactName !== null) updateData.contactName = contactName;

  // Metadata
  if (daysOnZillow !== null) updateData.daysOnZillow = daysOnZillow;
  if (source !== null) updateData.source = source;

  updateData.updatedAt = new Date();

  return updateData;
}

async function updatePropertiesFromCSV(dryRun: boolean = true) {
  console.log('🔄 Starting Property Update from CSV...\n');

  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made to the database\n');
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated!\n');
  }

  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  console.log('📄 Reading CSV file...');
  const csvRecords = await readCSV(csvPath);
  console.log(`✅ Found ${csvRecords.length} records in CSV\n`);

  console.log('🔥 Fetching properties from Firestore...');
  const propertiesSnapshot = await db.collection('properties').get();
  const properties = new Map();

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.opportunityId) {
      properties.set(data.opportunityId, { docId: doc.id, ...data });
    }
  });
  console.log(`✅ Found ${properties.size} properties in database\n`);

  const stats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    fieldsUpdated: {
      address: 0,
      city: 0,
      state: 0,
      zipCode: 0,
      yearBuilt: 0,
      bedrooms: 0,
      bathrooms: 0,
      livingArea: 0,
      homeType: 0,
      price: 0,
      description: 0,
      lotSize: 0,
      imageUrl: 0,
      taxAmount: 0,
      hoa: 0,
      zestimate: 0,
      rentalEstimate: 0,
      contactId: 0,
      contactPhone: 0,
      contactEmail: 0,
      contactName: 0,
      daysOnZillow: 0,
      source: 0,
    }
  };

  console.log('🔍 Processing properties...\n');

  let progressCount = 0;
  const totalToProcess = csvRecords.filter(r => properties.has(r['Opportunity ID'])).length;

  for (const csvRecord of csvRecords) {
    const oppId = csvRecord['Opportunity ID'];
    const dbProperty = properties.get(oppId);

    if (!dbProperty) {
      stats.skipped++;
      continue; // Skip properties not in database
    }

    stats.total++;
    progressCount++;

    try {
      const updateData = buildUpdateData(csvRecord);

      // Track which fields will be updated
      for (const field of Object.keys(updateData)) {
        if (field !== 'updatedAt' && updateData[field] !== null) {
          const dbValue = dbProperty[field];
          if (dbValue === undefined || dbValue === null || dbValue === '') {
            if (stats.fieldsUpdated.hasOwnProperty(field)) {
              (stats.fieldsUpdated as any)[field]++;
            }
          }
        }
      }

      if (!dryRun) {
        await db.collection('properties').doc(dbProperty.docId).update(updateData);
      }

      stats.updated++;

      // Show progress every 50 properties
      if (progressCount % 50 === 0) {
        console.log(`   Progress: ${progressCount}/${totalToProcess} properties processed...`);
      }

    } catch (error: any) {
      stats.errors++;
      console.error(`   ❌ Error updating ${oppId}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log(`Total CSV records:              ${csvRecords.length}`);
  console.log(`Properties in database:         ${properties.size}`);
  console.log(`Properties to update:           ${stats.total}`);
  console.log(`Successfully updated:           ${stats.updated}`);
  console.log(`Skipped (not in DB):            ${stats.skipped}`);
  console.log(`Errors:                         ${stats.errors}\n`);

  console.log('='.repeat(80));
  console.log('📝 FIELDS UPDATED (Missing → Populated)');
  console.log('='.repeat(80) + '\n');

  const sortedFields = Object.entries(stats.fieldsUpdated)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  sortedFields.forEach(([field, count]) => {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${field.padEnd(20)} → ${count} properties (${percentage}%)`);
  });

  console.log('\n' + '='.repeat(80));

  if (dryRun) {
    console.log('🧪 DRY RUN COMPLETE - No changes were made');
    console.log('\nTo apply these changes, run the script with --live flag');
  } else {
    console.log('✅ UPDATE COMPLETE - All changes have been applied to the database');
  }
  console.log('='.repeat(80) + '\n');
}

// Check for command line arguments
const args = process.argv.slice(2);
const isLiveMode = args.includes('--live');

updatePropertiesFromCSV(!isLiveMode)
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
