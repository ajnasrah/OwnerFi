// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();

  // --- 1. Recent cron_logs for queue processor (filter server-side, sort client-side) ---
  console.log('=== QUEUE PROCESSOR CRON LOGS (last 50, newest first) ===');
  const logs = await db.collection('cron_logs')
    .where('cron', '==', 'process-agent-outreach-queue')
    .limit(500)
    .get();
  const sorted = logs.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .sort((a, b) => {
      const ta = a.data.timestamp?.toDate?.()?.getTime?.() || 0;
      const tb = b.data.timestamp?.toDate?.()?.getTime?.() || 0;
      return tb - ta;
    })
    .slice(0, 50);
  console.log(`Found ${logs.size} total log docs. Showing newest 50.\n`);
  for (const { data } of sorted) {
    const t = data.timestamp?.toDate?.() || data.timestamp;
    const pending = data.pendingCount ?? '-';
    const retry = data.retryableCount ?? '-';
    const sent = data.sent ?? data.sentCount ?? '-';
    const err = data.errors ?? data.error ?? '';
    console.log(`  ${t?.toISOString?.() || t} | ${String(data.status).padEnd(10)} | pending=${pending} retry=${retry} sent=${sent} err=${err}`);
  }

  // --- 2. Scraper cron logs ---
  console.log('\n=== SCRAPER CRON LOGS (last 20) ===');
  const slogs = await db.collection('cron_logs')
    .where('cron', '==', 'run-agent-outreach-scraper')
    .limit(100)
    .get();
  const sortedS = slogs.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .sort((a, b) => {
      const ta = a.data.timestamp?.toDate?.()?.getTime?.() || 0;
      const tb = b.data.timestamp?.toDate?.()?.getTime?.() || 0;
      return tb - ta;
    })
    .slice(0, 20);
  for (const { data } of sortedS) {
    const t = data.timestamp?.toDate?.() || data.timestamp;
    console.log(`  ${t?.toISOString?.() || t} | ${String(data.status).padEnd(10)} | added=${data.addedCount ?? data.queuedCount ?? '-'} | err=${data.error || ''}`);
  }

  // --- 3. Cron lock state (if one exists) ---
  console.log('\n=== CRON LOCKS ===');
  const locks = await db.collection('cron_locks').get();
  for (const d of locks.docs) {
    const data = d.data();
    const start = data.startedAt?.toDate?.() || data.startedAt;
    const expires = data.expiresAt?.toDate?.() || data.expiresAt;
    console.log(`  ${d.id} | locked=${data.locked} | start=${start?.toISOString?.() || start} | expires=${expires?.toISOString?.() || expires}`);
  }

  // --- 4. Daily send histogram (last 14 days) — by sentToGHLAt date UTC ---
  console.log('\n=== DAILY SEND HISTOGRAM (last 14d by sentToGHLAt UTC date) ===');
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000);
  const sent = await db.collection('agent_outreach_queue')
    .where('sentToGHLAt', '>=', fourteenDaysAgo)
    .orderBy('sentToGHLAt', 'desc')
    .get();
  const byDay: Record<string, { count: number; hours: Set<string> }> = {};
  for (const d of sent.docs) {
    const t = d.data().sentToGHLAt?.toDate?.();
    if (!t) continue;
    const day = t.toISOString().slice(0, 10);
    const hr = t.toISOString().slice(0, 13); // yyyy-mm-ddTHH
    if (!byDay[day]) byDay[day] = { count: 0, hours: new Set() };
    byDay[day].count++;
    byDay[day].hours.add(hr);
  }
  const days = Object.keys(byDay).sort().reverse();
  for (const day of days) {
    const hourList = Array.from(byDay[day].hours).sort().map(h => h.slice(11) + 'z').join(', ');
    console.log(`  ${day} | ${String(byDay[day].count).padStart(4)} sent across hours: ${hourList}`);
  }

  // --- 5. Added but never sent? (gap between addedAt and sentToGHLAt) ---
  console.log('\n=== OLDEST 5 DOCS STILL IN sent_to_ghl (time since send) ===');
  // Use orderBy addedAt so it doesn't need composite index
  const stale = await db.collection('agent_outreach_queue')
    .where('status', '==', 'sent_to_ghl')
    .orderBy('addedAt', 'asc')
    .limit(5)
    .get();
  for (const d of stale.docs) {
    const data = d.data();
    const added = data.addedAt?.toDate?.();
    const sentAt = data.sentToGHLAt?.toDate?.();
    console.log(`  added=${added?.toISOString?.()} sent=${sentAt?.toISOString?.() || '(null!)'} | ${data.address}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
