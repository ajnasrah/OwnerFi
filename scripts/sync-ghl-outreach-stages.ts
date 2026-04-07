/**
 * Sync GHL Outreach Stages to Firestore
 *
 * Reads opportunities.csv from GHL and updates both:
 * 1. agent_outreach_queue - updates status (agent_yes / agent_no)
 * 2. properties collection - sets ownerFinanceVerified / agentConfirmedOwnerFinance
 *
 * Mappings:
 * - "Interested" -> owner finance positive (ownerFinanceVerified=true)
 * - "not interested" -> owner finance negative (ownerFinanceVerified=false)
 *
 * Usage: npx tsx scripts/sync-ghl-outreach-stages.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();
const DRY_RUN = process.argv.includes('--dry-run');

interface CsvRow {
  address: string;
  contactName: string;
  stage: string;
  firebaseId: string;
  opportunityId: string;
  city: string;
  state: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
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
  return fields;
}

async function processRow(
  row: CsvRow,
  isInterested: boolean
): Promise<{ status: 'fixed' | 'already_correct' | 'queue_not_found' | 'error'; detail?: string }> {
  // 1. Look up in agent_outreach_queue
  const queueRef = db.collection('agent_outreach_queue').doc(row.firebaseId);
  const queueDoc = await queueRef.get();

  if (!queueDoc.exists) {
    return { status: 'queue_not_found' };
  }

  const queueData = queueDoc.data()!;
  const zpid = queueData.zpid;
  const expectedQueueStatus = isInterested ? 'agent_yes' : 'agent_no';

  // Check if queue doc already correct
  const queueCorrect = queueData.status === expectedQueueStatus;

  // 2. Check properties collection
  let propertyCorrect = true;
  let propertyExists = false;
  const propertyDocId = zpid ? `zpid_${zpid}` : null;

  if (propertyDocId) {
    const propRef = db.collection('properties').doc(propertyDocId);
    const propDoc = await propRef.get();
    propertyExists = propDoc.exists;

    if (propertyExists) {
      const propData = propDoc.data()!;
      if (isInterested) {
        propertyCorrect = propData.ownerFinanceVerified === true && propData.agentConfirmedOwnerFinance === true;
      } else {
        propertyCorrect = propData.ownerFinanceVerified === false || propData.ownerFinanceVerified === undefined;
      }
    }
  }

  if (queueCorrect && propertyCorrect) {
    return { status: 'already_correct' };
  }

  // 3. Apply fixes
  if (!DRY_RUN) {
    // Update queue status
    if (!queueCorrect) {
      await queueRef.update({
        status: expectedQueueStatus,
        agentResponse: isInterested ? 'yes' : 'no',
        agentResponseAt: new Date(),
        routedTo: isInterested ? 'properties' : 'rejected',
        updatedAt: new Date(),
      });
    }

    // Update properties collection
    if (propertyDocId) {
      if (isInterested) {
        // Create or update property as owner finance positive
        const propRef = db.collection('properties').doc(propertyDocId);
        if (propertyExists) {
          await propRef.update({
            ownerFinanceVerified: true,
            agentConfirmedOwnerFinance: true,
            isOwnerfinance: true,
            dealTypes: ['owner_finance'],
            agentConfirmedAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Create property from queue data
          await propRef.set({
            zpid: queueData.zpid,
            url: queueData.url,
            address: queueData.address || '',
            streetAddress: queueData.address || '',
            fullAddress: `${queueData.address}, ${queueData.city}, ${queueData.state} ${queueData.zipCode}`,
            city: queueData.city || '',
            state: queueData.state || '',
            zipCode: queueData.zipCode || '',
            price: queueData.price || 0,
            listPrice: queueData.price || 0,
            zestimate: queueData.zestimate || null,
            bedrooms: queueData.beds || 0,
            bathrooms: queueData.baths || 0,
            squareFoot: queueData.squareFeet || 0,
            homeType: queueData.propertyType || 'SINGLE_FAMILY',
            homeStatus: 'FOR_SALE',
            agentName: queueData.agentName,
            agentPhoneNumber: queueData.agentPhone,
            agentEmail: queueData.agentEmail || null,
            imgSrc: queueData.rawData?.hiResImageLink || queueData.rawData?.imgSrc || null,
            ownerFinanceVerified: true,
            agentConfirmedOwnerFinance: true,
            isOwnerfinance: true,
            isCashDeal: false,
            dealTypes: ['owner_finance'],
            isActive: true,
            source: 'agent_outreach',
            agentConfirmedAt: new Date(),
            originalQueueId: row.firebaseId,
            importedAt: new Date(),
            createdAt: new Date(),
          });
        }
      } else {
        // Not interested - update property if it exists
        if (propertyExists) {
          const propRef = db.collection('properties').doc(propertyDocId);
          await propRef.update({
            ownerFinanceVerified: false,
            agentConfirmedOwnerFinance: false,
            agentRejectedAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  const details: string[] = [];
  if (!queueCorrect) details.push(`queue: ${queueData.status} -> ${expectedQueueStatus}`);
  if (!propertyCorrect) details.push(`property: ${isInterested ? 'set positive' : 'set negative'}${!propertyExists && isInterested ? ' (CREATED)' : ''}`);

  return { status: 'fixed', detail: details.join(', ') };
}

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const header = parseCsvLine(lines[0]);
  const stageIdx = header.findIndex(h => h.toLowerCase() === 'stage');
  const firebaseIdIdx = header.findIndex(h => h.toLowerCase() === 'firebase_id');
  const addressIdx = header.findIndex(h => h.toLowerCase().includes('property address'));
  const cityIdx = header.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIdx = header.findIndex(h => h.toLowerCase().includes('state'));
  const contactIdx = header.findIndex(h => h.toLowerCase() === 'contact name');
  const opportunityIdx = header.findIndex(h => h.toLowerCase() === 'opportunity id');

  const interested: CsvRow[] = [];
  const notInterested: CsvRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const stage = (fields[stageIdx] || '').toLowerCase().trim();
    const firebaseId = (fields[firebaseIdIdx] || '').trim();

    if (!firebaseId) continue;

    const row: CsvRow = {
      address: (fields[addressIdx] || '').trim(),
      contactName: (fields[contactIdx] || '').trim(),
      stage: fields[stageIdx]?.trim() || '',
      firebaseId,
      opportunityId: (fields[opportunityIdx] || '').trim(),
      city: (fields[cityIdx] || '').trim(),
      state: (fields[stateIdx] || '').trim(),
    };

    if (stage.includes('interested') && !stage.includes('not')) {
      interested.push(row);
    } else if (stage.includes('not interested')) {
      notInterested.push(row);
    } else {
      skipped++;
    }
  }

  console.log(`=== CSV Summary ===`);
  console.log(`Interested (owner finance positive): ${interested.length}`);
  console.log(`Not Interested (owner finance negative): ${notInterested.length}`);
  console.log(`Skipped (New/pending): ${skipped}`);
  console.log(`DRY RUN: ${DRY_RUN}\n`);

  // Process Interested
  const stats = { fixed: 0, already_correct: 0, queue_not_found: 0, error: 0 };

  console.log(`--- Processing ${interested.length} INTERESTED (owner finance positive) ---`);
  for (const row of interested) {
    const result = await processRow(row, true);
    stats[result.status]++;
    if (result.status === 'fixed') {
      console.log(`  [FIX] ${row.address} - ${result.detail}`);
    } else if (result.status === 'queue_not_found') {
      console.log(`  [NOT FOUND] ${row.address} (${row.firebaseId})`);
    }
  }

  console.log(`\nInterested results: ${stats.fixed} fixed, ${stats.already_correct} already correct, ${stats.queue_not_found} not found`);

  // Process Not Interested
  const niStats = { fixed: 0, already_correct: 0, queue_not_found: 0, error: 0 };

  console.log(`\n--- Processing ${notInterested.length} NOT INTERESTED (owner finance negative) ---`);
  const BATCH = 25;
  for (let i = 0; i < notInterested.length; i += BATCH) {
    const batch = notInterested.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(row => processRow(row, false)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      niStats[result.status]++;
      if (result.status === 'fixed' && result.detail?.includes('set negative')) {
        console.log(`  [FIX] ${batch[j].address} - ${result.detail}`);
      }
    }

    process.stdout.write(`  Processed ${Math.min(i + BATCH, notInterested.length)}/${notInterested.length}...\r`);
  }

  console.log(`\nNot Interested results: ${niStats.fixed} fixed, ${niStats.already_correct} already correct, ${niStats.queue_not_found} not found`);

  // Final summary
  const totalFixed = stats.fixed + niStats.fixed;
  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`Total fixed: ${totalFixed}`);
  console.log(`Total already correct: ${stats.already_correct + niStats.already_correct}`);
  console.log(`Total not found: ${stats.queue_not_found + niStats.queue_not_found}`);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] No changes made. Run without --dry-run to apply.`);
  } else {
    console.log(`\nDone! ${totalFixed} properties updated.`);
  }
}

main().catch(console.error);
