import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  result.push(current.trim());
  return result;
}

async function syncFirebaseToGHLExported() {
  console.log('\n🔄 Starting Firebase to GHL "exported to website" sync...\n');

  // Read CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);

  const opportunityIdIdx = headers.findIndex(h => h === 'Opportunity ID');
  const stageIdx = headers.findIndex(h => h.toLowerCase().includes('stage'));

  // Build set of Opportunity IDs that are in "exported to website" stage
  const exportedOppIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const oppId = values[opportunityIdIdx]?.trim();
    const stage = values[stageIdx]?.trim().toLowerCase();

    if (stage === 'exported to website' && oppId) {
      exportedOppIds.add(oppId);
    }
  }

  console.log(`✅ Found ${exportedOppIds.size} properties in GHL "exported to website" stage\n`);

  // Get all Firebase properties
  const propertiesSnapshot = await db.collection('properties').get();
  console.log(`📊 Current Firebase properties: ${propertiesSnapshot.size}\n`);

  const toDelete: string[] = [];
  const keptProperties: string[] = [];

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();

    if (data.opportunityId) {
      // Property has an Opportunity ID - check if it's in exported stage
      if (exportedOppIds.has(data.opportunityId)) {
        keptProperties.push(doc.id);
      } else {
        // Property is NOT in "exported to website" stage - mark for deletion
        toDelete.push(doc.id);
        console.log(`❌ Will delete: ${data.address}, ${data.city}, ${data.state} (Opp ID: ${data.opportunityId}) - Not in exported stage`);
      }
    } else {
      // Property has NO Opportunity ID (manually imported)
      // Keep these for now - they'll be updated separately
      console.log(`⚠️  Keeping (no Opp ID): ${data.address}, ${data.city}, ${data.state} (Source: ${data.source})`);
      keptProperties.push(doc.id);
    }
  });

  console.log(`\n📋 Summary:`);
  console.log(`   Properties to DELETE: ${toDelete.length}`);
  console.log(`   Properties to KEEP: ${keptProperties.length}`);
  console.log(`   Expected final count: ${keptProperties.length} (should match ~614 after adding missing ones)\n`);

  if (toDelete.length === 0) {
    console.log('✅ No properties to delete. Database is already in sync!\n');
    return;
  }

  // Ask for confirmation
  console.log(`\n⚠️  WARNING: About to DELETE ${toDelete.length} properties from Firebase!\n`);
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🗑️  Deleting properties...\n');

  // Delete in batches
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchIds = toDelete.slice(i, Math.min(i + BATCH_SIZE, toDelete.length));

    for (const docId of batchIds) {
      batch.delete(db.collection('properties').doc(docId));
    }

    await batch.commit();
    deleted += batchIds.length;
    console.log(`   Deleted ${deleted}/${toDelete.length} properties...`);
  }

  console.log(`\n✅ Successfully deleted ${deleted} properties!\n`);

  // Verify final count
  const finalSnapshot = await db.collection('properties').get();
  console.log(`\n📊 Final Firebase count: ${finalSnapshot.size}`);
  console.log(`📊 GHL "exported to website" count: ${exportedOppIds.size}`);
  console.log(`📊 Difference: ${Math.abs(finalSnapshot.size - exportedOppIds.size)} (these are the missing properties to add + manually imported ones)\n`);

  console.log('✅ Sync complete!\n');
}

syncFirebaseToGHLExported().catch(console.error);
