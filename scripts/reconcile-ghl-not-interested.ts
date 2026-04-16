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
  const rows: any[] = parse(fs.readFileSync(csvPath), {
    columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true
  });

  const notInterested = rows.filter(r => String(r.stage || '').trim().toLowerCase() === 'not interested');
  console.log(`CSV "not interested" stage: ${notInterested.length}\n`);

  const buckets = {
    correctAgentNo: 0,             // queue status=agent_no ✅ correct
    stillAgentYes: 0,              // queue=agent_yes but GHL says not interested ❌
    orphanedPropertyDoc: 0,        // queue=agent_no but properties doc exists ❌ (like Exeter)
    noFirebaseId: 0,
    queueMissing: 0,
    otherStatus: 0,                // queue has another status (sent_to_ghl, etc.)
  };

  const issues: any[] = [];

  for (const row of notInterested) {
    const firebaseId = row.firebase_id?.trim();
    const addr = row['Property Address'];

    if (!firebaseId) { buckets.noFirebaseId++; continue; }

    const qDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();
    if (!qDoc.exists) { buckets.queueMissing++; continue; }
    const q = qDoc.data()!;

    if (q.status === 'agent_yes') {
      buckets.stillAgentYes++;
      issues.push({ type: 'queue=agent_yes but CSV=not_interested', firebaseId, addr, zpid: q.zpid, queueStatus: q.status });
    } else if (q.status === 'agent_no') {
      // Check if the properties doc exists (Exeter-style orphan)
      const propDoc = await db.collection('properties').doc(`zpid_${q.zpid}`).get();
      if (propDoc.exists && propDoc.data()!.isActive) {
        buckets.orphanedPropertyDoc++;
        issues.push({
          type: 'agent_no but properties doc still active (Exeter bug)',
          firebaseId, addr, zpid: q.zpid,
          propIsActive: true,
          propSource: propDoc.data()!.source,
          propConfirmedAt: propDoc.data()!.agentConfirmedAt?.toDate?.()?.toISOString?.() || null,
        });
      } else {
        buckets.correctAgentNo++;
      }
    } else {
      buckets.otherStatus++;
      issues.push({ type: `queue status="${q.status}"`, firebaseId, addr, zpid: q.zpid, queueStatus: q.status });
    }
  }

  console.log(`=== RECONCILIATION — GHL "not interested" vs DB ===`);
  console.log(`Total CSV rows: ${notInterested.length}`);
  console.log(`✅ Correctly agent_no (no orphan): ${buckets.correctAgentNo}`);
  console.log(`❌ Queue still agent_yes (NOT flipped to no): ${buckets.stillAgentYes}`);
  console.log(`❌ Orphaned property doc (Exeter-style: agent_no but properties still active): ${buckets.orphanedPropertyDoc}`);
  console.log(`❓ Queue status other (sent_to_ghl/pending/etc.): ${buckets.otherStatus}`);
  console.log(`❓ No firebase_id in CSV: ${buckets.noFirebaseId}`);
  console.log(`❓ Queue doc missing: ${buckets.queueMissing}`);

  if (issues.length) {
    const byType: Record<string, any[]> = {};
    for (const i of issues) (byType[i.type] ||= []).push(i);
    for (const [type, list] of Object.entries(byType)) {
      console.log(`\n--- [${type}] (${list.length}) ---`);
      list.slice(0, 15).forEach(i => console.log(`  ${i.firebaseId} | ${i.addr} | zpid=${i.zpid}${i.propConfirmedAt ? ' | confirmedAt='+i.propConfirmedAt.slice(0,10) : ''}`));
      if (list.length > 15) console.log(`  ...and ${list.length - 15} more`);
    }
    fs.writeFileSync('scripts/not-interested-issues.json', JSON.stringify(issues, null, 2));
    console.log(`\nFull: scripts/not-interested-issues.json`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
