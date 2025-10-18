/**
 * Delete properties from Firebase based on Excel file
 * Usage: tsx scripts/delete-properties-from-excel.ts /path/to/file.xlsx
 */

import * as XLSX from 'xlsx';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local file
const dotenvPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  throw new Error('Missing Firebase credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env.local');
}

initializeApp({
  credential: cert({
    projectId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    clientEmail,
  })
});

const db = getFirestore();

async function deletePropertiesFromExcel(filePath: string) {
  console.log(`📖 Reading Excel file: ${filePath}`);

  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} properties in Excel file`);

  if (data.length === 0) {
    console.log('No properties to delete');
    return;
  }

  // Extract property IDs (check multiple possible column names)
  const propertyIds: string[] = [];

  for (const row of data as any[]) {
    const id = row['Property ID'] || row['id'] || row['ID'] || row['propertyId'];
    if (id) {
      propertyIds.push(String(id).trim());
    }
  }

  console.log(`\nFound ${propertyIds.length} property IDs to delete`);

  if (propertyIds.length === 0) {
    console.log('❌ No property IDs found in Excel file');
    console.log('Expected column names: "Property ID", "id", "ID", or "propertyId"');
    return;
  }

  // Show first few IDs for confirmation
  console.log('\nFirst 5 property IDs:');
  propertyIds.slice(0, 5).forEach(id => console.log(`  - ${id}`));

  // Ask for confirmation
  console.log(`\n⚠️  WARNING: This will delete ${propertyIds.length} properties from Firebase`);
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Delete properties in batches
  const batchSize = 500;
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < propertyIds.length; i += batchSize) {
    const batch = propertyIds.slice(i, i + batchSize);

    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} (${batch.length} properties)...`);

    // Delete each property
    for (const propertyId of batch) {
      try {
        await db.collection('properties').doc(propertyId).delete();
        deletedCount++;
        process.stdout.write(`\r  Deleted: ${deletedCount}/${propertyIds.length}`);
      } catch (error) {
        errorCount++;
        console.error(`\n  ❌ Error deleting ${propertyId}:`, (error as Error).message);
      }
    }
  }

  console.log(`\n\n✅ Deletion complete!`);
  console.log(`   Successfully deleted: ${deletedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${propertyIds.length}`);
}

// Main execution
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Error: Please provide path to Excel file');
  console.error('Usage: tsx scripts/delete-properties-from-excel.ts /path/to/file.xlsx');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ Error: File not found: ${filePath}`);
  process.exit(1);
}

deletePropertiesFromExcel(filePath)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
