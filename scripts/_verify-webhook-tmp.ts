const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();

  // 1. Overall queue status breakdown
  const all = await db.collection('agent_outreach_queue').get();
  const byStatus: Record<string, number> = {};
  all.forEach(d => {
    const s = d.data().status || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  console.log('=== agent_outreach_queue STATUS ===');
  console.log(byStatus);

  // 2. Recent YES responses — prove webhook → queue update works
  const yesSnap = await db.collection('agent_outreach_queue')
    .where('status','==','agent_yes').limit(100).get();
  const yesSorted = yesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.agentResponseAt?.toDate?.()?.getTime() || 0) - (a.agentResponseAt?.toDate?.()?.getTime() || 0));
  console.log(`\n=== RECENT agent_yes (showing top 5 of ${yesSnap.size}) ===`);
  yesSorted.slice(0, 5).forEach((x: any) => {
    console.log({
      id: x.id,
      zpid: x.zpid,
      address: x.address,
      agentResponse: x.agentResponse,
      agentResponseAt: x.agentResponseAt?.toDate?.()?.toISOString(),
      agentNote: x.agentNote?.slice(0, 60),
      routedTo: x.routedTo,
    });
  });

  // 3. Recent NO responses
  const noSnap = await db.collection('agent_outreach_queue')
    .where('status','==','agent_no').limit(100).get();
  const noSorted = noSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.agentResponseAt?.toDate?.()?.getTime() || 0) - (a.agentResponseAt?.toDate?.()?.getTime() || 0));
  console.log(`\n=== RECENT agent_no (showing top 3 of ${noSnap.size}) ===`);
  noSorted.slice(0, 3).forEach((x: any) => {
    console.log({
      id: x.id,
      zpid: x.zpid,
      agentResponseAt: x.agentResponseAt?.toDate?.()?.toISOString(),
      agentNote: x.agentNote?.slice(0, 60),
    });
  });

  // 4. Properties collection — how many confirmed OF via agent response?
  const propSnap = await db.collection('properties')
    .where('agentConfirmedOwnerfinance','==',true).get();
  console.log(`\n=== properties with agentConfirmedOwnerfinance=true ===`);
  console.log('Total:', propSnap.size);
  const sortedProps = propSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.agentConfirmedAt?.toDate?.()?.getTime() || 0) - (a.agentConfirmedAt?.toDate?.()?.getTime() || 0));
  sortedProps.slice(0, 3).forEach((x: any) => {
    console.log({
      id: x.id,
      zpid: x.zpid,
      address: x.streetAddress || x.fullAddress,
      agentConfirmedAt: x.agentConfirmedAt?.toDate?.()?.toISOString(),
      ownerFinanceVerified: x.ownerFinanceVerified,
      isOwnerfinance: x.isOwnerfinance,
      dealTypes: x.dealTypes,
    });
  });

  // 5. Webhook debug logs — any recent failures?
  const debugSnap = await db.collection('webhook_debug_logs').limit(100).get();
  const recent = debugSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((x: any) => {
      const t = x.timestamp?.toDate?.()?.getTime() || x.createdAt?.toDate?.()?.getTime() || 0;
      return t > Date.now() - 48*3600*1000;
    })
    .sort((a: any, b: any) => {
      const ta = a.timestamp?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
      const tb = b.timestamp?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
      return tb - ta;
    });
  console.log(`\n=== WEBHOOK DEBUG LOGS (last 48h): ${recent.length} ===`);
  recent.slice(0, 5).forEach((x: any) => {
    const t = x.timestamp?.toDate?.()?.toISOString() || x.createdAt?.toDate?.()?.toISOString();
    console.log({
      id: x.id,
      ts: t,
      source: x.source,
      reason: x.reason,
      error: x.error?.slice?.(0, 80),
      status: x.status,
    });
  });
}
main().catch(e => { console.error(e); process.exit(1); });
