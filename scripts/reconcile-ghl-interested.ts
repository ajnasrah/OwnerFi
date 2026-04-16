import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const rows: any[] = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });

  console.log(`CSV total rows: ${rows.length}`);

  const interested = rows.filter(r => String(r.stage || '').trim().toLowerCase() === 'interested');
  console.log(`CSV "Interested" stage: ${interested.length}\n`);

  // Load all agent_outreach queue docs with firebase_id as doc ID
  // interested[i].firebase_id is the agent_outreach_queue doc ID
  let yesInDb = 0;
  let stillInQueue = 0;
  let notFound = 0;
  let routedButNoProperty = 0;
  let inPropertiesOK = 0;

  const discrepancies: any[] = [];
  const perfectMatches: any[] = [];

  for (const row of interested) {
    const firebaseId = row.firebase_id?.trim();
    const addr = row['Property Address'];
    const opportunityId = row['Opportunity ID']?.trim();

    if (!firebaseId) {
      discrepancies.push({ addr, reason: 'no firebase_id in CSV', opportunityId });
      notFound++;
      continue;
    }

    const queueDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();
    if (!queueDoc.exists) {
      discrepancies.push({ addr, firebaseId, reason: 'queue doc does not exist' });
      notFound++;
      continue;
    }

    const q = queueDoc.data()!;
    const zpid = q.zpid;
    const queueStatus = q.status;
    const routedTo = q.routedTo;

    // Check if property is in properties collection with agent_outreach source
    const propDocId = `zpid_${zpid}`;
    const propDoc = await db.collection('properties').doc(propDocId).get();

    if (queueStatus === 'agent_yes' && propDoc.exists && propDoc.data()!.isOwnerfinance) {
      inPropertiesOK++;
      perfectMatches.push({ addr, firebaseId, zpid });
    } else if (queueStatus === 'agent_yes' && !propDoc.exists) {
      routedButNoProperty++;
      discrepancies.push({ addr, firebaseId, zpid, reason: 'queue=agent_yes but NO property doc', routedTo });
    } else if (queueStatus !== 'agent_yes') {
      stillInQueue++;
      discrepancies.push({ addr, firebaseId, zpid, reason: `queue status is "${queueStatus}" not agent_yes`, routedTo: routedTo || null });
    }
  }

  console.log(`=== RECONCILIATION RESULT ===`);
  console.log(`GHL "Interested" CSV rows: ${interested.length}`);
  console.log(`✅ Perfectly flipped (agent_yes + in properties + isOwnerfinance): ${inPropertiesOK}`);
  console.log(`⚠️  queue=agent_yes but property doc missing: ${routedButNoProperty}`);
  console.log(`❌ NOT flipped — queue status still not agent_yes: ${stillInQueue}`);
  console.log(`❓ Not found in DB at all: ${notFound}\n`);

  if (discrepancies.length) {
    console.log(`\n=== DISCREPANCIES (${discrepancies.length}) ===`);
    // Group by reason
    const byReason: Record<string, any[]> = {};
    for (const d of discrepancies) {
      const key = d.reason;
      (byReason[key] ||= []).push(d);
    }
    for (const [reason, list] of Object.entries(byReason)) {
      console.log(`\n[${reason}] — ${list.length}`);
      list.slice(0, 20).forEach(d => console.log(`  ${d.firebaseId || '(no id)'} | ${d.addr} ${d.zpid ? '| zpid=' + d.zpid : ''} ${d.routedTo ? '| routedTo=' + d.routedTo : ''}`));
      if (list.length > 20) console.log(`  ...and ${list.length - 20} more`);
    }

    fs.writeFileSync('scripts/interested-discrepancies.json', JSON.stringify(discrepancies, null, 2));
    console.log(`\nFull list → scripts/interested-discrepancies.json`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
