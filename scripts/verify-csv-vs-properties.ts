import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials:');
    console.error('  FIREBASE_PROJECT_ID:', projectId ? 'OK' : 'MISSING');
    console.error('  FIREBASE_PRIVATE_KEY:', privateKey ? 'OK' : 'MISSING');
    console.error('  FIREBASE_CLIENT_EMAIL:', clientEmail ? 'OK' : 'MISSING');
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

interface PropertyData {
  opportunityId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  yearBuilt?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  livingArea?: number | string;
  homeType?: string;
  price?: number | string;
  description?: string;
  lotSize?: number | string;
  imageUrl?: string;
  taxAmount?: number | string;
  hoa?: number | string;
  zestimate?: number | string;
  rentalEstimate?: number | string;
  contactId?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactName?: string;
  daysOnZillow?: number | string;
  source?: string;
  [key: string]: any;
}

interface ComparisonResult {
  opportunityId: string;
  address: string;
  inCSV: boolean;
  inProperties: boolean;
  inExportQueue: boolean;
  fieldsMatch: boolean;
  mismatches: string[];
  csvData?: Partial<CSVProperty>;
  dbData?: PropertyData;
}

function normalizeValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim().toLowerCase();
}

function compareFields(csvValue: any, dbValue: any, fieldName: string): boolean {
  const csv = normalizeValue(csvValue);
  const db = normalizeValue(dbValue);

  // Handle empty values
  if (!csv && !db) return true;
  if (!csv || !db) return false;

  // For numeric fields, compare as numbers
  if (!isNaN(Number(csv)) && !isNaN(Number(db))) {
    return Math.abs(Number(csv) - Number(db)) < 0.01;
  }

  return csv === db;
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

async function verifyPropertiesMatch() {
  console.log('🔍 Starting verification of CSV vs Properties Collection...\n');

  try {
    // Read CSV file
    const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
    console.log('📄 Reading CSV file...');
    const csvRecords = await readCSV(csvPath);
    console.log(`✅ Found ${csvRecords.length} records in CSV\n`);

    // Get all properties from Firestore
    console.log('🔥 Fetching properties from Firestore...');
    const propertiesSnapshot = await db.collection('properties').get();
    const properties = new Map<string, PropertyData>();

    propertiesSnapshot.forEach(doc => {
      const data = doc.data() as PropertyData;
      if (data.opportunityId) {
        properties.set(data.opportunityId, { id: doc.id, ...data });
      }
    });
    console.log(`✅ Found ${properties.size} properties in Firestore\n`);

    // Get export queue
    console.log('🔥 Fetching export-to-website queue...');
    const exportQueueSnapshot = await db.collection('export-to-website').get();
    const exportQueue = new Set<string>();

    exportQueueSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.opportunityId) {
        exportQueue.add(data.opportunityId);
      }
    });
    console.log(`✅ Found ${exportQueue.size} properties in export queue\n`);

    // Compare data
    const results: ComparisonResult[] = [];
    const missingInDB: string[] = [];
    const missingInCSV: string[] = [];
    const dataMismatches: ComparisonResult[] = [];

    // Check each CSV record against Firestore
    for (const csvRecord of csvRecords) {
      const oppId = csvRecord['Opportunity ID'];
      const address = csvRecord['Property Address'];

      if (!oppId) continue;

      const dbProperty = properties.get(oppId);
      const inExportQueue = exportQueue.has(oppId);

      const result: ComparisonResult = {
        opportunityId: oppId,
        address: address,
        inCSV: true,
        inProperties: !!dbProperty,
        inExportQueue: inExportQueue,
        fieldsMatch: true,
        mismatches: [],
        csvData: csvRecord,
        dbData: dbProperty
      };

      if (!dbProperty) {
        missingInDB.push(`${oppId} - ${address}`);
        result.fieldsMatch = false;
        result.mismatches.push('Property not found in database');
      } else {
        // Compare fields
        const fieldComparisons = [
          { csv: csvRecord['Property Address'], db: dbProperty.address, name: 'address' },
          { csv: csvRecord['Property city'], db: dbProperty.city, name: 'city' },
          { csv: csvRecord['State '], db: dbProperty.state, name: 'state' },
          { csv: csvRecord['zip code '], db: dbProperty.zipCode, name: 'zipCode' },
          { csv: csvRecord['yearBuilt'], db: dbProperty.yearBuilt, name: 'yearBuilt' },
          { csv: csvRecord['bedrooms'], db: dbProperty.bedrooms, name: 'bedrooms' },
          { csv: csvRecord['bathrooms'], db: dbProperty.bathrooms, name: 'bathrooms' },
          { csv: csvRecord['livingArea'], db: dbProperty.livingArea, name: 'livingArea' },
          { csv: csvRecord['homeType'], db: dbProperty.homeType, name: 'homeType' },
          { csv: csvRecord['Price '], db: dbProperty.price, name: 'price' },
          { csv: csvRecord['lot sizes'], db: dbProperty.lotSize, name: 'lotSize' },
          { csv: csvRecord['Image link'], db: dbProperty.imageUrl, name: 'imageUrl' },
          { csv: csvRecord['Tax amount '], db: dbProperty.taxAmount, name: 'taxAmount' },
          { csv: csvRecord['hoa '], db: dbProperty.hoa, name: 'hoa' },
          { csv: csvRecord['zestimate '], db: dbProperty.zestimate, name: 'zestimate' },
          { csv: csvRecord['Rental estimate '], db: dbProperty.rentalEstimate, name: 'rentalEstimate' },
        ];

        for (const { csv, db, name } of fieldComparisons) {
          if (!compareFields(csv, db, name)) {
            result.fieldsMatch = false;
            result.mismatches.push(`${name}: CSV="${csv}" vs DB="${db}"`);
          }
        }

        if (result.mismatches.length > 0) {
          dataMismatches.push(result);
        }
      }

      results.push(result);
    }

    // Check for properties in DB but not in CSV
    for (const [oppId, property] of properties.entries()) {
      const inCSV = csvRecords.some(r => r['Opportunity ID'] === oppId);
      if (!inCSV) {
        missingInCSV.push(`${oppId} - ${property.address}`);
      }
    }

    // Print report
    console.log('\n' + '='.repeat(80));
    console.log('📊 VERIFICATION REPORT');
    console.log('='.repeat(80) + '\n');

    console.log(`📄 Total CSV records: ${csvRecords.length}`);
    console.log(`🔥 Total properties in database: ${properties.size}`);
    console.log(`📤 Total in export queue: ${exportQueue.size}\n`);

    console.log('='.repeat(80));
    console.log('❌ PROPERTIES IN CSV BUT NOT IN DATABASE');
    console.log('='.repeat(80));
    if (missingInDB.length === 0) {
      console.log('✅ All CSV properties found in database!\n');
    } else {
      console.log(`⚠️  Found ${missingInDB.length} properties missing from database:\n`);
      missingInDB.forEach((prop, i) => {
        console.log(`${i + 1}. ${prop}`);
      });
      console.log();
    }

    console.log('='.repeat(80));
    console.log('❌ PROPERTIES IN DATABASE BUT NOT IN CSV');
    console.log('='.repeat(80));
    if (missingInCSV.length === 0) {
      console.log('✅ All database properties found in CSV!\n');
    } else {
      console.log(`⚠️  Found ${missingInCSV.length} properties in database not in CSV:\n`);
      missingInCSV.slice(0, 20).forEach((prop, i) => {
        console.log(`${i + 1}. ${prop}`);
      });
      if (missingInCSV.length > 20) {
        console.log(`... and ${missingInCSV.length - 20} more\n`);
      }
      console.log();
    }

    console.log('='.repeat(80));
    console.log('⚠️  DATA MISMATCHES (Same Opportunity ID, Different Data)');
    console.log('='.repeat(80));
    if (dataMismatches.length === 0) {
      console.log('✅ All matching properties have identical data!\n');
    } else {
      console.log(`⚠️  Found ${dataMismatches.length} properties with data mismatches:\n`);
      dataMismatches.slice(0, 10).forEach((result, i) => {
        console.log(`${i + 1}. ${result.opportunityId} - ${result.address}`);
        console.log(`   Mismatches:`);
        result.mismatches.forEach(m => console.log(`   - ${m}`));
        console.log();
      });
      if (dataMismatches.length > 10) {
        console.log(`... and ${dataMismatches.length - 10} more properties with mismatches\n`);
      }
    }

    console.log('='.repeat(80));
    console.log('📤 EXPORT QUEUE STATUS');
    console.log('='.repeat(80));
    const csvInExport = csvRecords.filter(r => exportQueue.has(r['Opportunity ID'])).length;
    const csvNotInExport = csvRecords.filter(r => !exportQueue.has(r['Opportunity ID'])).length;
    console.log(`✅ CSV properties in export queue: ${csvInExport}`);
    console.log(`❌ CSV properties NOT in export queue: ${csvNotInExport}\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    const perfectMatch = missingInDB.length === 0 && missingInCSV.length === 0 && dataMismatches.length === 0;
    if (perfectMatch) {
      console.log('✅ PERFECT MATCH! CSV and database are in sync!');
    } else {
      console.log('⚠️  DISCREPANCIES FOUND:');
      if (missingInDB.length > 0) console.log(`   - ${missingInDB.length} properties in CSV missing from database`);
      if (missingInCSV.length > 0) console.log(`   - ${missingInCSV.length} properties in database missing from CSV`);
      if (dataMismatches.length > 0) console.log(`   - ${dataMismatches.length} properties with data mismatches`);
    }
    console.log('='.repeat(80) + '\n');

    // Write detailed report to file
    const reportPath = path.join(process.cwd(), 'CSV_PROPERTIES_VERIFICATION_REPORT.md');
    let report = `# CSV vs Properties Collection Verification Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **CSV Records:** ${csvRecords.length}\n`;
    report += `- **Database Properties:** ${properties.size}\n`;
    report += `- **Export Queue:** ${exportQueue.size}\n`;
    report += `- **Missing from DB:** ${missingInDB.length}\n`;
    report += `- **Missing from CSV:** ${missingInCSV.length}\n`;
    report += `- **Data Mismatches:** ${dataMismatches.length}\n\n`;

    if (missingInDB.length > 0) {
      report += `## Properties in CSV but NOT in Database (${missingInDB.length})\n\n`;
      missingInDB.forEach(prop => report += `- ${prop}\n`);
      report += `\n`;
    }

    if (missingInCSV.length > 0) {
      report += `## Properties in Database but NOT in CSV (${missingInCSV.length})\n\n`;
      missingInCSV.forEach(prop => report += `- ${prop}\n`);
      report += `\n`;
    }

    if (dataMismatches.length > 0) {
      report += `## Data Mismatches (${dataMismatches.length})\n\n`;
      dataMismatches.forEach(result => {
        report += `### ${result.opportunityId} - ${result.address}\n\n`;
        result.mismatches.forEach(m => report += `- ${m}\n`);
        report += `\n`;
      });
    }

    fs.writeFileSync(reportPath, report);
    console.log(`📝 Detailed report written to: ${reportPath}\n`);

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  }
}

// Run the verification
verifyPropertiesMatch()
  .then(() => {
    console.log('✅ Verification complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
