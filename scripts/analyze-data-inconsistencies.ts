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
}

interface InconsistencyStats {
  totalProperties: number;
  missingFields: { [field: string]: number };
  differentValues: { [field: string]: number };
  examples: {
    field: string;
    oppId: string;
    address: string;
    csvValue: any;
    dbValue: any;
  }[];
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

function normalizeValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim().toLowerCase();
}

function areValuesDifferent(csvValue: any, dbValue: any): boolean {
  const csv = normalizeValue(csvValue);
  const db = normalizeValue(dbValue);

  // If DB value is missing/undefined but CSV has value
  if (!db && csv) return true;

  // If both empty, they match
  if (!csv && !db) return false;

  // For numeric fields, compare as numbers
  if (!isNaN(Number(csv)) && !isNaN(Number(db))) {
    return Math.abs(Number(csv) - Number(db)) >= 0.01;
  }

  return csv !== db;
}

async function analyzeInconsistencies() {
  console.log('🔍 Analyzing Data Inconsistencies Between CSV and Database...\n');

  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvRecords = await readCSV(csvPath);

  const propertiesSnapshot = await db.collection('properties').get();
  const properties = new Map();

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.opportunityId) {
      properties.set(data.opportunityId, { id: doc.id, ...data });
    }
  });

  const stats: InconsistencyStats = {
    totalProperties: 0,
    missingFields: {},
    differentValues: {},
    examples: []
  };

  const fieldMappings = [
    { csv: 'Property Address', db: 'address', name: 'address' },
    { csv: 'Property city', db: 'city', name: 'city' },
    { csv: 'State ', db: 'state', name: 'state' },
    { csv: 'zip code ', db: 'zipCode', name: 'zipCode' },
    { csv: 'yearBuilt', db: 'yearBuilt', name: 'yearBuilt' },
    { csv: 'bedrooms', db: 'bedrooms', name: 'bedrooms' },
    { csv: 'bathrooms', db: 'bathrooms', name: 'bathrooms' },
    { csv: 'livingArea', db: 'livingArea', name: 'livingArea' },
    { csv: 'homeType', db: 'homeType', name: 'homeType' },
    { csv: 'Price ', db: 'price', name: 'price' },
    { csv: 'lot sizes', db: 'lotSize', name: 'lotSize' },
    { csv: 'Image link', db: 'imageUrl', name: 'imageUrl' },
    { csv: 'Tax amount ', db: 'taxAmount', name: 'taxAmount' },
    { csv: 'hoa ', db: 'hoa', name: 'hoa' },
    { csv: 'zestimate ', db: 'zestimate', name: 'zestimate' },
    { csv: 'Rental estimate ', db: 'rentalEstimate', name: 'rentalEstimate' },
  ];

  // Analyze each CSV record that exists in DB
  for (const csvRecord of csvRecords) {
    const oppId = csvRecord['Opportunity ID'];
    const dbProperty = properties.get(oppId);

    if (!dbProperty) continue; // Skip properties not in DB

    stats.totalProperties++;

    for (const { csv: csvField, db: dbField, name } of fieldMappings) {
      const csvValue = csvRecord[csvField as keyof CSVProperty];
      const dbValue = dbProperty[dbField];

      // Check if DB field is missing/undefined
      if ((dbValue === undefined || dbValue === null || dbValue === '') && csvValue) {
        stats.missingFields[name] = (stats.missingFields[name] || 0) + 1;

        if (stats.examples.length < 50 && !stats.examples.find(e => e.field === name)) {
          stats.examples.push({
            field: name,
            oppId,
            address: csvRecord['Property Address'],
            csvValue,
            dbValue: 'undefined/missing'
          });
        }
      }
      // Check if values are different
      else if (areValuesDifferent(csvValue, dbValue)) {
        stats.differentValues[name] = (stats.differentValues[name] || 0) + 1;

        if (stats.examples.length < 50) {
          stats.examples.push({
            field: name,
            oppId,
            address: csvRecord['Property Address'],
            csvValue,
            dbValue
          });
        }
      }
    }
  }

  // Print Results
  console.log('='.repeat(80));
  console.log('📊 INCONSISTENCY ANALYSIS REPORT');
  console.log('='.repeat(80) + '\n');

  console.log(`Total Properties Analyzed: ${stats.totalProperties}`);
  console.log(`(Properties that exist in both CSV and Database)\n`);

  console.log('='.repeat(80));
  console.log('❌ MISSING FIELDS IN DATABASE (CSV has value, DB is undefined/null)');
  console.log('='.repeat(80));

  const sortedMissing = Object.entries(stats.missingFields).sort((a, b) => b[1] - a[1]);
  if (sortedMissing.length === 0) {
    console.log('✅ No missing fields found!\n');
  } else {
    sortedMissing.forEach(([field, count]) => {
      const percentage = ((count / stats.totalProperties) * 100).toFixed(1);
      console.log(`  ${field.padEnd(20)} → ${count} properties (${percentage}%)`);
    });
    console.log();
  }

  console.log('='.repeat(80));
  console.log('⚠️  DIFFERENT VALUES (Both have values but they differ)');
  console.log('='.repeat(80));

  const sortedDifferent = Object.entries(stats.differentValues).sort((a, b) => b[1] - a[1]);
  if (sortedDifferent.length === 0) {
    console.log('✅ No different values found!\n');
  } else {
    sortedDifferent.forEach(([field, count]) => {
      const percentage = ((count / stats.totalProperties) * 100).toFixed(1);
      console.log(`  ${field.padEnd(20)} → ${count} properties (${percentage}%)`);
    });
    console.log();
  }

  console.log('='.repeat(80));
  console.log('📋 EXAMPLE INCONSISTENCIES (First 20)');
  console.log('='.repeat(80) + '\n');

  stats.examples.slice(0, 20).forEach((example, i) => {
    console.log(`${i + 1}. ${example.oppId} - ${example.address}`);
    console.log(`   Field: ${example.field}`);
    console.log(`   CSV:   "${example.csvValue}"`);
    console.log(`   DB:    "${example.dbValue}"`);
    console.log();
  });

  // Summary recommendations
  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80));

  const totalMissingCount = Object.values(stats.missingFields).reduce((a, b) => a + b, 0);
  const totalDifferentCount = Object.values(stats.differentValues).reduce((a, b) => a + b, 0);

  if (totalMissingCount > totalDifferentCount * 2) {
    console.log('⚠️  Most inconsistencies are MISSING FIELDS in the database.');
    console.log('   → The database properties are incomplete compared to CSV.');
    console.log('   → Recommendation: UPDATE database with missing fields from CSV.\n');
  } else if (totalDifferentCount > 0) {
    console.log('⚠️  Significant number of DIFFERENT VALUES detected.');
    console.log('   → CSV and database have conflicting data.');
    console.log('   → Recommendation: Review which source is more current/accurate.\n');
  }

  if (sortedMissing.find(([field]) => field === 'imageUrl')) {
    console.log('🖼️  imageUrl is missing in many DB properties.');
    console.log('   → Images are critical for property display.');
    console.log('   → Recommendation: Prioritize updating imageUrl field.\n');
  }

  console.log('='.repeat(80));
}

analyzeInconsistencies()
  .then(() => {
    console.log('✅ Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
