const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();

  // 1. Queue status breakdown
  const all = await db.collection('agent_outreach_queue').get();
  const byStatus: Record<string, number> = {};
  all.forEach(d => { const s = d.data().status || 'unknown'; byStatus[s] = (byStatus[s] || 0) + 1; });
  console.log('=== 1. QUEUE STATUS ===');
  console.log(byStatus);
  console.log('TOTAL:', all.size);

  // 2. Recent agent responses (last hour)
  const oneHourAgo = new Date(Date.now() - 3600*1000);
  const recentYes = await db.collection('agent_outreach_queue')
    .where('agentResponseAt', '>=', oneHourAgo)
    .where('agentResponse', '==', 'yes').get();
  const recentNo = await db.collection('agent_outreach_queue')
    .where('agentResponseAt', '>=', oneHourAgo)
    .where('agentResponse', '==', 'no').get();
  console.log('\n=== 2. LAST HOUR RESPONSES ===');
  console.log('agent_yes:', recentYes.size, '| agent_no:', recentNo.size);

  // 3. Count agent_pending docs
  const pending = await db.collection('agent_outreach_queue').where('status','==','agent_pending').get();
  console.log('\n=== 3. agent_pending status ===');
  console.log('count:', pending.size);

  // 4. Verify the 15 YES backfilled properties exist + have right fields
  const backfillZpids = [1076539, 303789163, 42140337, 1293924, 1104217, 1047114, 1046615, 1037160, 1043217, 1037461, 1032344, 1027215, 42220345, 42165506, 116212335];
  console.log('\n=== 4. 15 BACKFILLED YES PROPERTIES ===');
  let propsOk = 0;
  for (const z of backfillZpids) {
    const d = await db.collection('properties').doc(`zpid_${z}`).get();
    if (!d.exists) { console.log(`  ❌ zpid_${z} MISSING`); continue; }
    const x: any = d.data();
    const ok = x.isOwnerfinance && x.ownerFinanceVerified && x.agentConfirmedOwnerfinance && x.isActive && (x.dealTypes || []).includes('owner_finance');
    if (ok) propsOk++;
    else console.log(`  ⚠️ zpid_${z} fields off:`, { isOwnerfinance: x.isOwnerfinance, verified: x.ownerFinanceVerified, active: x.isActive, dealTypes: x.dealTypes });
  }
  console.log(`  ${propsOk}/${backfillZpids.length} properties correctly flagged`);

  // 5. Recent webhook_debug_logs — any new failures or fallbacks since deploy?
  const deployCutoff = new Date(Date.now() - 30*60*1000); // last 30 min
  const logs = await db.collection('webhook_debug_logs').limit(200).get();
  const recent = logs.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((x: any) => (x.receivedAt?.toDate?.() || new Date(0)) >= deployCutoff)
    .sort((a: any, b: any) => (b.receivedAt?.toDate?.()?.getTime() || 0) - (a.receivedAt?.toDate?.()?.getTime() || 0));
  const statusCounts: Record<string, number> = {};
  recent.forEach((x: any) => { statusCounts[x.status] = (statusCounts[x.status] || 0) + 1; });
  console.log('\n=== 5. WEBHOOK DEBUG LOGS LAST 30 MIN ===');
  console.log('count:', recent.length, 'by status:', statusCounts);
  if (recent.length > 0) {
    console.log('latest 3:');
    recent.slice(0, 3).forEach((x: any) => {
      console.log(`  ${x.receivedAt?.toDate?.()?.toISOString()} ${x.status} method=${x.method || '-'} fbId=${x.firebaseId || '-'}`);
    });
  }

  // 6. Properties with agentConfirmedOwnerfinance — total count
  const conf = await db.collection('properties').where('agentConfirmedOwnerfinance','==',true).get();
  console.log('\n=== 6. TOTAL CONFIRMED-OF PROPERTIES ===');
  console.log('count:', conf.size, '(before backfill: 68; expected now: 83)');

  // 7. Git / deploy sanity
  console.log('\n=== 7. LOCAL VS DEPLOYED ===');
  console.log('Webhook fallback commit: 7a1fef13 (pushed)');
  console.log('Vercel auto-deploys main on push — check production logs');
}
main().catch(e => { console.error(e); process.exit(1); });
