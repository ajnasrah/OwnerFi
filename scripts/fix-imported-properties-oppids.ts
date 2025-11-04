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

async function fixImportedProperties() {
  console.log('\n🔄 Fixing imported properties with Opportunity IDs...\n');

  // Read CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);

  const opportunityIdIdx = headers.findIndex(h => h === 'Opportunity ID');
  const stageIdx = headers.findIndex(h => h.toLowerCase().includes('stage'));
  const addressIdx = headers.findIndex(h => h === 'Property Address');

  // Build map of addresses to opportunity IDs for "exported to website" stage
  const addressToOppId = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const oppId = values[opportunityIdIdx]?.trim();
    const stage = values[stageIdx]?.trim().toLowerCase();
    const address = values[addressIdx]?.trim();

    if (stage === 'exported to website' && address && oppId) {
      addressToOppId.set(address.toLowerCase(), oppId);
    }
  }

  console.log(`📊 Found ${addressToOppId.size} addresses with Opportunity IDs in CSV\n`);

  // Get all Firebase properties without Opportunity IDs
  const propertiesSnapshot = await db.collection('properties').get();
  const toUpdate = [];
  const toDelete = [];

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();

    if (!data.opportunityId && data.source === 'import') {
      const address = (data.address || '').toLowerCase();
      const oppId = addressToOppId.get(address);

      if (oppId) {
        toUpdate.push({ docId: doc.id, address: data.address, city: data.city, oppId });
      } else {
        // Property is imported but NOT in "exported to website" stage - should be deleted
        toDelete.push({ docId: doc.id, address: data.address, city: data.city });
      }
    }
  });

  console.log(`✅ Found ${toUpdate.length} properties to update with Opportunity IDs`);
  console.log(`❌ Found ${toDelete.length} properties to DELETE (not in exported stage)\n`);

  if (toDelete.length > 0) {
    console.log('Properties to DELETE (not in "exported to website" stage):');
    toDelete.forEach((prop, idx) => {
      console.log(`   ${idx + 1}. ${prop.address}, ${prop.city}`);
    });
    console.log('');
  }

  // Update properties with Opportunity IDs
  let updated = 0;
  for (const prop of toUpdate) {
    try {
      await db.collection('properties').doc(prop.docId).update({
        opportunityId: prop.oppId,
        id: prop.oppId,
        source: 'gohighlevel'
      });
      // Also update the document ID to match Opportunity ID
      const oldDoc = await db.collection('properties').doc(prop.docId).get();
      if (oldDoc.exists && prop.docId !== prop.oppId) {
        await db.collection('properties').doc(prop.oppId).set(oldDoc.data()!);
        await db.collection('properties').doc(prop.docId).delete();
        console.log(`✅ Updated & moved: ${prop.address}, ${prop.city} -> ${prop.oppId}`);
      } else {
        console.log(`✅ Updated: ${prop.address}, ${prop.city} -> ${prop.oppId}`);
      }
      updated++;
    } catch (error: any) {
      console.error(`❌ Failed to update ${prop.address}: ${error.message}`);
    }
  }

  console.log(`\n✅ Successfully updated ${updated}/${toUpdate.length} properties!\n`);

  // Delete properties not in exported stage
  if (toDelete.length > 0) {
    console.log(`\n🗑️  Deleting ${toDelete.length} properties not in "exported to website" stage...\n`);

    let deleted = 0;
    for (const prop of toDelete) {
      try {
        await db.collection('properties').doc(prop.docId).delete();
        console.log(`✅ Deleted: ${prop.address}, ${prop.city}`);
        deleted++;
      } catch (error: any) {
        console.error(`❌ Failed to delete ${prop.address}: ${error.message}`);
      }
    }

    console.log(`\n✅ Successfully deleted ${deleted}/${toDelete.length} properties!\n`);
  }
}

fixImportedProperties().catch(console.error);
