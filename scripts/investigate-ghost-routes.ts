import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

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
  const ghosts = require('../scripts/interested-discrepancies.json')
    .filter((d: any) => d.reason === 'queue=agent_yes but NO property doc');

  console.log(`Investigating ${ghosts.length} ghost-routed properties...\n`);

  for (const g of ghosts.slice(0, 5)) {
    console.log(`\n=== ${g.firebaseId} | ${g.addr} | zpid=${g.zpid} ===`);

    // Check queue doc
    const q = (await db.collection('agent_outreach_queue').doc(g.firebaseId).get()).data()!;
    console.log(`  queue status=${q.status} routedTo=${q.routedTo} agentResponse=${q.agentResponse}`);
    console.log(`  agentResponseAt: ${q.agentResponseAt?.toDate?.() || q.agentResponseAt}`);
    console.log(`  zpid in queue: ${q.zpid}  (type: ${typeof q.zpid})`);

    // Check properties by various ID formats
    const idsToTry = [`zpid_${q.zpid}`, `zpid_${String(q.zpid)}`, String(q.zpid)];
    for (const id of idsToTry) {
      const p = await db.collection('properties').doc(id).get();
      console.log(`  properties/${id}: ${p.exists ? 'EXISTS' : 'missing'}`);
    }

    // Query by zpid field
    const byZpidNum = await db.collection('properties').where('zpid', '==', q.zpid).limit(3).get();
    const byZpidStr = await db.collection('properties').where('zpid', '==', String(q.zpid)).limit(3).get();
    console.log(`  query where zpid=="${q.zpid}" (as-is): ${byZpidNum.size} results`);
    console.log(`  query where zpid==String: ${byZpidStr.size} results`);
    if (byZpidNum.size > 0) byZpidNum.docs.forEach(d => console.log(`    → found doc: ${d.id}`));
    if (byZpidStr.size > 0) byZpidStr.docs.forEach(d => console.log(`    → found doc: ${d.id}`));

    // Check status_change_reports or any other collection
    // Also check all caps / differences
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
