/**
 * Sweep: find every agent_outreach_queue doc with status='agent_no' whose
 * paired properties/zpid_X doc still exists as active + agent_outreach source,
 * and remove it (Firestore + Typesense). Mirrors the Exeter bug fix for all
 * historical orphans.
 */
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

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
  const { deletePropertyFromIndex } = await import('../src/lib/typesense/sync');

  const noSnap = await db.collection('agent_outreach_queue').where('status', '==', 'agent_no').get();
  console.log(`Total agent_no queue docs: ${noSnap.size}\n`);

  let deleted = 0;
  let skippedOtherSource = 0;
  let skippedNoProp = 0;
  const deletedList: any[] = [];

  for (const qDoc of noSnap.docs) {
    const q = qDoc.data();
    const zpid = q.zpid;
    if (!zpid) continue;

    const propDocId = `zpid_${zpid}`;
    const propRef = db.collection('properties').doc(propDocId);
    const propSnap = await propRef.get();
    if (!propSnap.exists) { skippedNoProp++; continue; }

    const p = propSnap.data()!;
    if (p.source !== 'agent_outreach') {
      skippedOtherSource++;
      console.log(`  ⏭️  kept ${propDocId} — source=${p.source} ${q.address || ''}`);
      continue;
    }

    await propRef.delete();
    try { await deletePropertyFromIndex(propDocId); } catch (e: any) {
      console.error(`    ⚠️ Typesense delete failed for ${propDocId}: ${e.message}`);
    }
    deleted++;
    deletedList.push({ propDocId, queueId: qDoc.id, address: p.address || q.address, zpid });
    console.log(`  🗑️  ${propDocId} ${p.address || q.address}`);
  }

  console.log(`\n=== SWEEP DONE ===`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Skipped (different source): ${skippedOtherSource}`);
  console.log(`Skipped (no property doc): ${skippedNoProp}`);

  fs.writeFileSync('scripts/sweep-agent-no-deleted.json', JSON.stringify(deletedList, null, 2));
  console.log(`\nDeleted list → scripts/sweep-agent-no-deleted.json`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
