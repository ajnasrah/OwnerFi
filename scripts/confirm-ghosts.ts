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

  console.log(`Confirming ${ghosts.length} ghost properties...\n`);
  let confirmed = 0;
  let falsePositive = 0;

  for (const g of ghosts) {
    const q = (await db.collection('agent_outreach_queue').doc(g.firebaseId).get()).data()!;
    const zpid = q.zpid;

    // Try all reasonable doc id formats
    const idsToTry = [`zpid_${zpid}`, String(zpid), `zpid_${String(zpid)}`];
    let found: any = null;
    for (const id of idsToTry) {
      const p = await db.collection('properties').doc(id).get();
      if (p.exists) { found = { id, data: p.data() }; break; }
    }

    // Also by zpid field query
    if (!found) {
      const snap = await db.collection('properties').where('zpid', '==', zpid).limit(1).get();
      if (!snap.empty) found = { id: snap.docs[0].id, data: snap.docs[0].data() };
      const snap2 = await db.collection('properties').where('zpid', '==', String(zpid)).limit(1).get();
      if (!found && !snap2.empty) found = { id: snap2.docs[0].id, data: snap2.docs[0].data() };
    }

    const ts = q.agentResponseAt?.toDate?.()?.toISOString?.().slice(0,10) || 'unknown';
    if (found) {
      falsePositive++;
      console.log(`❗ FALSE GHOST — ${g.firebaseId} | ${g.addr} | zpid=${zpid} — EXISTS as ${found.id} isActive=${found.data.isActive}`);
    } else {
      confirmed++;
      console.log(`✅ GHOST — ${g.firebaseId} | ${g.addr} | zpid=${zpid} | confirmedAt=${ts}`);
    }
  }

  console.log(`\n=== RESULT ===`);
  console.log(`Confirmed ghosts (truly missing): ${confirmed}`);
  console.log(`False positives (doc actually exists): ${falsePositive}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
