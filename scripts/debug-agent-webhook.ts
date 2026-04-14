// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();

  // Find a recent agent_outreach_queue doc (sent_to_ghl status = currently awaiting response)
  const snap = await db.collection('agent_outreach_queue')
    .where('status', '==', 'sent_to_ghl')
    .limit(3)
    .get();

  if (snap.empty) {
    console.log('No sent_to_ghl docs found');
    return;
  }

  const testDoc = snap.docs[0];
  const fbId = testDoc.id;
  const d = testDoc.data();
  console.log(`Using test queue doc:`);
  console.log(`  firebase_id: ${fbId}`);
  console.log(`  zpid: ${d.zpid}`);
  console.log(`  address: ${d.address}`);
  console.log(`  status: ${d.status}`);
  console.log(`  dealType: ${d.dealType}`);
  console.log();

  // Fire a test POST to production with response=no
  const payload = {
    firebase_id: fbId,
    response: 'no',
    agent_note: 'TEST webhook debug (claude)',
  };
  console.log('POSTing to production:');
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  const res = await fetch('https://ownerfi.ai/api/webhooks/gohighlevel/agent-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
