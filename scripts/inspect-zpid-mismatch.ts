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

function normAddr(a: string) {
  return String(a || '').toLowerCase().trim().replace(/[#,\.]/g, '').replace(/\s+/g, ' ');
}

async function main() {
  // 1. Deep look at the known mismatch
  console.log('=== KNOWN MISMATCH: MDVXfXMrKB3Rhjig4jDz ===');
  const mq = (await db.collection('agent_outreach_queue').doc('MDVXfXMrKB3Rhjig4jDz').get()).data()!;
  console.log('Queue:');
  console.log(`  address: ${mq.address}`);
  console.log(`  city/state: ${mq.city} ${mq.state} ${mq.zipCode}`);
  console.log(`  zpid in queue: ${mq.zpid} (type: ${typeof mq.zpid})`);
  console.log(`  ghlOpportunityId: ${mq.ghlOpportunityId}`);
  console.log(`  url: ${mq.url}`);
  console.log(`  rawData.zpid: ${mq.rawData?.zpid} (type: ${typeof mq.rawData?.zpid})`);
  console.log(`  rawData.streetAddress: ${mq.rawData?.streetAddress}`);

  // The address-matched property
  const addrMatch = await db.collection('properties').doc('zpid_294367').get();
  if (addrMatch.exists) {
    const d = addrMatch.data()!;
    console.log(`\nAddress-matched property (zpid_294367):`);
    console.log(`  address: ${d.address}  city: ${d.city} ${d.state}`);
    console.log(`  zpid in doc: ${d.zpid}`);
    console.log(`  originalQueueId: ${d.originalQueueId}`);
    console.log(`  source: ${d.source}`);
    console.log(`  url: ${d.url}`);
  }

  // 2. Scan ALL interested CSV rows for zpid-to-address mismatches between CSV and queue
  console.log('\n\n=== SCAN: CSV address vs Queue address for all Interested rows ===');
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities (3).csv';
  const rows: any[] = parse(fs.readFileSync(csvPath), {
    columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true
  });
  const interested = rows.filter(r => String(r.stage || '').trim().toLowerCase() === 'interested');

  let matches = 0;
  let mismatches: any[] = [];
  for (const row of interested) {
    const fbId = row.firebase_id?.trim();
    if (!fbId) continue;
    const q = (await db.collection('agent_outreach_queue').doc(fbId).get()).data();
    if (!q) continue;
    const csvAddr = normAddr(row['Property Address']);
    const queueAddr = normAddr(q.address);
    if (csvAddr === queueAddr) matches++;
    else {
      mismatches.push({
        firebaseId: fbId,
        csvAddr: row['Property Address'],
        csvCity: row['Property city'],
        queueAddr: q.address,
        queueCity: q.city,
        queueZpid: q.zpid,
        opportunityId: row['Opportunity ID'],
      });
    }
  }

  console.log(`CSV address matches queue address: ${matches}`);
  console.log(`MISMATCHES (GHL opportunity linked to different property than queue): ${mismatches.length}`);
  if (mismatches.length) {
    mismatches.slice(0, 20).forEach(m => {
      console.log(`\n  firebase_id: ${m.firebaseId}`);
      console.log(`    CSV says:   "${m.csvAddr}" in ${m.csvCity}`);
      console.log(`    Queue says: "${m.queueAddr}" in ${m.queueCity} (zpid=${m.queueZpid})`);
      console.log(`    opportunityId: ${m.opportunityId}`);
    });
    if (mismatches.length > 20) console.log(`  ...and ${mismatches.length - 20} more`);
    fs.writeFileSync('scripts/ghl-zpid-mismatches.json', JSON.stringify(mismatches, null, 2));
  }

  // 3. Also: same opportunityId used for two different queue docs?
  console.log('\n\n=== SCAN: duplicate opportunityId across queue docs ===');
  const qAll = await db.collection('agent_outreach_queue').get();
  const oppMap: Record<string, string[]> = {};
  for (const d of qAll.docs) {
    const opp = d.data().ghlOpportunityId;
    if (!opp) continue;
    (oppMap[opp] ||= []).push(d.id);
  }
  const dupes = Object.entries(oppMap).filter(([,v]) => v.length > 1);
  console.log(`Duplicate opportunityId count: ${dupes.length}`);
  dupes.slice(0, 10).forEach(([opp, ids]) => console.log(`  opp=${opp} used by ${ids.length} queue docs: ${ids.join(', ')}`));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
