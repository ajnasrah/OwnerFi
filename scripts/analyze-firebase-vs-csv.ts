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

async function analyzeFirebaseVsCSV() {
  // Read CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);

  const opportunityIdIdx = headers.findIndex(h => h === 'Opportunity ID');
  const stageIdx = headers.findIndex(h => h.toLowerCase().includes('stage'));

  // Build set of all CSV opportunity IDs
  const csvOpportunityIds = new Set<string>();
  const csvByStage: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const oppId = values[opportunityIdIdx]?.trim();
    const stage = values[stageIdx]?.trim().toLowerCase();

    if (oppId) {
      csvOpportunityIds.add(oppId);
    }

    if (stage) {
      csvByStage[stage] = (csvByStage[stage] || 0) + 1;
    }
  }

  console.log(`\n📊 CSV Analysis:`);
  console.log(`Total rows: ${lines.length - 1}`);
  console.log(`Properties with Opportunity IDs: ${csvOpportunityIds.size}`);
  console.log(`\n📌 By Stage:`);
  Object.entries(csvByStage).sort((a, b) => b[1] - a[1]).forEach(([stage, count]) => {
    console.log(`   ${stage}: ${count}`);
  });

  // Get all Firebase properties
  const propertiesSnapshot = await db.collection('properties').get();

  console.log(`\n\n📊 Firebase Properties Analysis:\n`);
  console.log(`Total properties in Firebase: ${propertiesSnapshot.size}`);

  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const withOppId = [];
  const withoutOppId = [];
  const inCSV = [];
  const notInCSV = [];

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();

    // Count by source
    const source = data.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;

    // Count by status
    const status = data.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Track opportunity IDs
    if (data.opportunityId) {
      withOppId.push({
        id: doc.id,
        oppId: data.opportunityId,
        address: data.address,
        city: data.city,
        state: data.state,
        source: data.source
      });

      // Check if in CSV
      if (csvOpportunityIds.has(data.opportunityId)) {
        inCSV.push(data.opportunityId);
      } else {
        notInCSV.push({
          oppId: data.opportunityId,
          address: data.address,
          city: data.city,
          state: data.state,
          source: data.source
        });
      }
    } else {
      withoutOppId.push({
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        source: data.source
      });
    }
  });

  console.log(`\n📌 By Source:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    console.log(`   ${source}: ${count}`);
  });

  console.log(`\n📌 By Status:`);
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log(`\n📌 Opportunity ID Status:`);
  console.log(`   With Opportunity ID: ${withOppId.length}`);
  console.log(`   Without Opportunity ID: ${withoutOppId.length}`);

  console.log(`\n📌 CSV Comparison:`);
  console.log(`   Properties in both Firebase AND CSV: ${inCSV.length}`);
  console.log(`   Properties in Firebase but NOT in CSV: ${notInCSV.length}`);

  if (notInCSV.length > 0) {
    console.log(`\n⚠️  Properties in Firebase but NOT in CSV (these explain the difference):`);
    notInCSV.forEach((prop, idx) => {
      console.log(`   ${idx + 1}. ${prop.address}, ${prop.city}, ${prop.state} (Source: ${prop.source}, OppID: ${prop.oppId})`);
    });
  }

  if (withoutOppId.length > 0) {
    console.log(`\n⚠️  Properties WITHOUT Opportunity ID (first 20):`);
    withoutOppId.slice(0, 20).forEach((prop, idx) => {
      console.log(`   ${idx + 1}. ${prop.address}, ${prop.city}, ${prop.state} (Source: ${prop.source})`);
    });
  }

  console.log(`\n\n🔍 Summary:`);
  console.log(`- CSV has ${lines.length - 1} total properties`);
  console.log(`- CSV has ${csvByStage['exported to website'] || 0} marked as "exported to website"`);
  console.log(`- Firebase has ${propertiesSnapshot.size} total properties`);
  console.log(`- Firebase has ${withOppId.length} properties with Opportunity IDs`);
  console.log(`- Firebase has ${withoutOppId.length} properties WITHOUT Opportunity IDs (likely from scraper/manual entry)`);
  console.log(`- Firebase has ${notInCSV.length} properties that don't exist in the CSV at all`);
  console.log(`\nThe difference (${propertiesSnapshot.size} - ${csvByStage['exported to website'] || 0} = ${propertiesSnapshot.size - (csvByStage['exported to website'] || 0)}) is because:`);
  console.log(`  1. Properties added via scraper/manual entry without GHL sync: ${withoutOppId.length}`);
  console.log(`  2. Properties in Firebase but removed from GHL: ${notInCSV.length}`);
}

analyzeFirebaseVsCSV().catch(console.error);
