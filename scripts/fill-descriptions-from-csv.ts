import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

interface CSVRow {
  address: string;
  city: string;
  state: string;
  description: string;
  stage: string;
}

function parseCSV(csvPath: string): CSVRow[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const addressIdx = headers.findIndex(h => h.toLowerCase().includes('property address'));
  const cityIdx = headers.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIdx = headers.findIndex(h => h.toLowerCase().includes('state'));
  const descriptionIdx = headers.findIndex(h => h.toLowerCase().includes('description'));
  const stageIdx = headers.findIndex(h => h.toLowerCase().includes('stage'));

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Handle CSV with quoted fields that may contain commas
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    const stage = fields[stageIdx]?.trim() || '';

    // Only process rows marked as "exported to website"
    if (stage.toLowerCase() !== 'exported to website') {
      continue;
    }

    const address = fields[addressIdx]?.trim() || '';
    const city = fields[cityIdx]?.trim() || '';
    const state = fields[stateIdx]?.trim() || '';
    const description = fields[descriptionIdx]?.trim() || '';

    if (address && description) {
      rows.push({ address, city, state, description, stage });
    }
  }

  return rows;
}

async function fillDescriptions() {
  console.log('📖 Reading CSV file...\n');

  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities_cleaned.csv';
  const rows = parseCSV(csvPath);

  console.log(`Found ${rows.length} properties with "exported to website" status\n`);

  let updated = 0;
  let notFound = 0;
  let alreadyHasDescription = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      // Find property by address
      const snapshot = await db.collection('properties')
        .where('address', '==', row.address)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`❌ Not found: ${row.address}`);
        notFound++;
        continue;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      // Check if already has description
      if (data.description && data.description.trim().length > 0) {
        console.log(`⏭️  Already has description: ${row.address}`);
        alreadyHasDescription++;
        continue;
      }

      // Update with description
      await doc.ref.update({
        description: row.description
      });

      console.log(`✅ Updated: ${row.address}`);
      console.log(`   Description: ${row.description.substring(0, 80)}...`);
      updated++;

    } catch (error: any) {
      console.log(`❌ Failed to update ${row.address}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n━'.repeat(80));
  console.log('📊 SUMMARY:');
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Already had description: ${alreadyHasDescription}`);
  console.log(`❌ Not found in database: ${notFound}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total in CSV: ${rows.length}`);
  console.log('━'.repeat(80));
}

fillDescriptions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
