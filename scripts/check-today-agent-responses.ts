/**
 * Check today's agent responses from the GHL webhook:
 *  - YES responses → properties collection with agentConfirmedOwnerfinance=true
 *  - NO responses  → agent_outreach_queue with status='agent_no'
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();

  // Today = last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log(`Checking agent responses since ${since.toISOString()}\n`);

  // YES: properties with agentConfirmedAt in last 24h
  // (both agent-response webhook and stage-change webhook write this field)
  const yesSnap = await db.collection('properties')
    .where('agentConfirmedAt', '>=', since)
    .get();

  console.log(`========== AGENT YES (flipped to owner finance) ==========`);
  console.log(`Count: ${yesSnap.size}\n`);
  yesSnap.forEach(doc => {
    const d = doc.data();
    const when = d.agentConfirmedAt?.toDate?.() || d.agentConfirmedAt;
    console.log(`  ${d.zpid} | ${d.streetAddress || d.address} (${d.zipCode})`);
    console.log(`    isOwnerfinance=${d.isOwnerfinance}  financingType="${d.financingType}"  price=$${d.listPrice || d.price}`);
    console.log(`    confirmedAt: ${when}`);
    if (d.agentNote) console.log(`    note: ${d.agentNote}`);
    console.log();
  });

  // NO/YES responses in agent_outreach_queue (filter status client-side to
  // avoid needing a composite index)
  const queueSnap = await db.collection('agent_outreach_queue')
    .where('agentResponseAt', '>=', since)
    .get();

  const queueNO = queueSnap.docs.filter(d => d.data().status === 'agent_no');
  const queueYES = queueSnap.docs.filter(d => d.data().status === 'agent_yes');

  console.log(`========== AGENT NO (rejected) ==========`);
  console.log(`Count: ${queueNO.length}\n`);
  queueNO.forEach(doc => {
    const d = doc.data();
    const when = d.agentResponseAt?.toDate?.() || d.agentResponseAt;
    console.log(`  ${d.zpid} | ${d.address} (${d.zipCode})`);
    console.log(`    respondedAt: ${when}`);
    if (d.agentNote) console.log(`    note: ${d.agentNote}`);
    console.log();
  });

  console.log(`========== AGENT YES in queue (should have been routed) ==========`);
  console.log(`Count: ${queueYES.length}\n`);
  queueYES.forEach(doc => {
    const d = doc.data();
    const when = d.agentResponseAt?.toDate?.() || d.agentResponseAt;
    console.log(`  ${d.zpid} | ${d.address} — routedTo: ${d.routedTo}  at: ${when}`);
  });

  // Summary
  // Any queue doc updated in last 24h (catches responses with different field names)
  const recentSnap = await db.collection('agent_outreach_queue')
    .where('updatedAt', '>=', since)
    .get();

  console.log(`========== ANY QUEUE DOC UPDATED IN LAST 24H ==========`);
  console.log(`Count: ${recentSnap.size}`);
  const byStatus: Record<string, number> = {};
  recentSnap.forEach(doc => {
    const status = doc.data().status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  Object.entries(byStatus).forEach(([s, c]) => console.log(`  status=${s}: ${c}`));
  console.log();


  console.log('========== SUMMARY ==========');
  console.log(`Interested (YES → OF):     ${yesSnap.size}`);
  console.log(`Not Interested (NO):       ${queueNO.length}`);
  console.log(`YES still in queue:        ${queueYES.length}`);
  console.log(`Total responses in last 24h: ${yesSnap.size + queueNO.length + queueYES.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
