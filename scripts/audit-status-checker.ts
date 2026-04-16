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
  console.log('=== STATUS CHECKER AUDIT ===\n');

  // 1. Coverage: how many properties exist?
  const [activeSnap, inactiveSnap] = await Promise.all([
    db.collection('properties').where('isActive', '==', true).get(),
    db.collection('properties').where('isActive', '==', false).get(),
  ]);

  console.log('PROPERTY COUNTS:');
  console.log(`  Active:   ${activeSnap.size}`);
  console.log(`  Inactive: ${inactiveSnap.size}`);
  console.log(`  Total:    ${activeSnap.size + inactiveSnap.size}\n`);

  // 2. Last status check age distribution (active only)
  const now = Date.now();
  const buckets: Record<string, number> = {
    'never': 0,
    '<12h': 0,
    '12-24h': 0,
    '1-3d': 0,
    '3-7d': 0,
    '7-14d': 0,
    '14-30d': 0,
    '>30d': 0,
  };

  const homeStatusCounts: Record<string, number> = {};
  const offendingProps: Array<{ addr: string; status: string; lastCheck: string; isActive: boolean }> = [];

  for (const doc of activeSnap.docs) {
    const d = doc.data();
    const lastCheck = d.lastStatusCheck?.toDate?.()?.getTime?.() || 0;
    if (!lastCheck) buckets.never++;
    else {
      const ageMs = now - lastCheck;
      const ageH = ageMs / 3600000;
      if (ageH < 12) buckets['<12h']++;
      else if (ageH < 24) buckets['12-24h']++;
      else if (ageH < 72) buckets['1-3d']++;
      else if (ageH < 168) buckets['3-7d']++;
      else if (ageH < 336) buckets['7-14d']++;
      else if (ageH < 720) buckets['14-30d']++;
      else buckets['>30d']++;
    }

    const status = (d.homeStatus || 'UNKNOWN').toUpperCase();
    homeStatusCounts[status] = (homeStatusCounts[status] || 0) + 1;

    // Surface ACTIVE props with stale-bad statuses
    if (['PENDING', 'CONTINGENT', 'OFF_MARKET', 'SOLD', 'RECENTLY_SOLD', 'UNDER_CONTRACT'].includes(status)) {
      offendingProps.push({
        addr: d.fullAddress || d.streetAddress || d.address || doc.id,
        status,
        lastCheck: lastCheck ? new Date(lastCheck).toISOString().slice(0, 19) : 'never',
        isActive: d.isActive,
      });
    }
  }

  console.log('ACTIVE PROPERTIES — LAST STATUS CHECK AGE:');
  for (const [k, v] of Object.entries(buckets)) {
    const pct = ((v / activeSnap.size) * 100).toFixed(1);
    console.log(`  ${k.padEnd(8)}: ${String(v).padStart(5)}  (${pct}%)`);
  }

  console.log('\nACTIVE PROPERTIES — homeStatus DISTRIBUTION:');
  for (const [k, v] of Object.entries(homeStatusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)}: ${v}`);
  }

  console.log(`\n⚠️ ACTIVE PROPS WITH BAD STATUS (${offendingProps.length} total):`);
  for (const p of offendingProps.slice(0, 30)) {
    console.log(`  [${p.status.padEnd(15)}] ${p.lastCheck}  ${p.addr}`);
  }
  if (offendingProps.length > 30) console.log(`  ... and ${offendingProps.length - 30} more`);

  // 3. Recent cron run stats
  console.log('\n=== RECENT CRON RUN STATS (last 50 runs) ===');
  const recentLogs = await db.collection('cron_logs')
    .where('type', '==', 'refresh-zillow-status')
    .orderBy('startedAt', 'desc')
    .limit(50)
    .get();

  let totalProcessed = 0;
  let runsCompleted = 0;
  let runsFailed = 0;
  let oldestRun: Date | null = null;
  let newestRun: Date | null = null;
  const sampleRuns: any[] = [];

  for (const doc of recentLogs.docs) {
    const d = doc.data();
    const startedAt = d.startedAt?.toDate?.();
    if (startedAt) {
      if (!newestRun || startedAt > newestRun) newestRun = startedAt;
      if (!oldestRun || startedAt < oldestRun) oldestRun = startedAt;
    }
    if (d.status === 'completed') runsCompleted++;
    else if (d.status === 'failed') runsFailed++;
    if (d.results?.processed) totalProcessed += d.results.processed;
    if (sampleRuns.length < 10) {
      sampleRuns.push({
        startedAt: startedAt?.toISOString().slice(0, 19),
        status: d.status,
        processed: d.results?.processed || d.batchSize || 0,
        activeBatch: d.activeBatch,
        inactiveBatch: d.inactiveBatch,
        deactivated: d.results?.deactivated,
        deleted: d.results?.deleted,
        durationS: d.durationMs ? (d.durationMs / 1000).toFixed(1) : '?',
      });
    }
  }

  console.log(`Runs returned: ${recentLogs.size}`);
  console.log(`  Completed: ${runsCompleted}`);
  console.log(`  Failed:    ${runsFailed}`);
  console.log(`  Other:     ${recentLogs.size - runsCompleted - runsFailed}`);
  if (oldestRun && newestRun) {
    const spanH = (newestRun.getTime() - oldestRun.getTime()) / 3600000;
    console.log(`Time span: ${oldestRun.toISOString().slice(0, 19)} → ${newestRun.toISOString().slice(0, 19)} (${spanH.toFixed(1)}h)`);
    const ratePerHr = recentLogs.size / Math.max(spanH, 0.1);
    console.log(`Run frequency: ${ratePerHr.toFixed(2)}/hr  (expected: 2/hr if every-30min)`);
    const propsPerHr = totalProcessed / Math.max(spanH, 0.1);
    console.log(`Total processed: ${totalProcessed} over ${spanH.toFixed(1)}h = ${propsPerHr.toFixed(0)} props/hr`);
    console.log(`Projected per day: ${(propsPerHr * 24).toFixed(0)}`);
    console.log(`Projected per week: ${(propsPerHr * 24 * 7).toFixed(0)}`);
  }

  console.log('\nLAST 10 RUNS:');
  for (const r of sampleRuns) {
    console.log(`  ${r.startedAt}  ${r.status.padEnd(10)}  proc=${String(r.processed).padStart(3)}  actBatch=${r.activeBatch}  inactBatch=${r.inactiveBatch}  deact=${r.deactivated}  del=${r.deleted}  ${r.durationS}s`);
  }

  // 4. Coverage projection: with current batch sizes, can we cover the whole DB?
  console.log('\n=== COVERAGE PROJECTION ===');
  const TARGET_ROTATION_DAYS = 3;
  const RUNS_PER_DAY = 48;
  const MIN_BATCH = 10;
  const MAX_BATCH = 100;
  const activeOptimalBatch = Math.ceil(activeSnap.size / (TARGET_ROTATION_DAYS * RUNS_PER_DAY));
  const activeBatchSize = Math.max(MIN_BATCH, Math.min(MAX_BATCH, activeOptimalBatch));
  const activeFullCycleHrs = (activeSnap.size / activeBatchSize) * (24 / RUNS_PER_DAY);
  console.log(`Active batch size per run: ${activeBatchSize}  (optimal=${activeOptimalBatch}, capped=${MAX_BATCH})`);
  console.log(`Active full-cycle time: ${activeFullCycleHrs.toFixed(1)}h = ${(activeFullCycleHrs / 24).toFixed(1)} days`);
  if (activeFullCycleHrs > TARGET_ROTATION_DAYS * 24) {
    console.log(`⚠️ Active cycle EXCEEDS target rotation of ${TARGET_ROTATION_DAYS} days!`);
  }

  const INACTIVE_TARGET_DAYS = 14;
  const inactiveOptimalBatch = Math.ceil(inactiveSnap.size / (INACTIVE_TARGET_DAYS * RUNS_PER_DAY));
  const inactiveBatchSize = Math.min(Math.max(0, inactiveOptimalBatch), 25);
  const inactiveFullCycleHrs = inactiveSnap.size > 0 && inactiveBatchSize > 0
    ? (inactiveSnap.size / inactiveBatchSize) * (24 / RUNS_PER_DAY)
    : 0;
  console.log(`Inactive batch size per run: ${inactiveBatchSize}  (optimal=${inactiveOptimalBatch}, capped=25)`);
  console.log(`Inactive full-cycle time: ${inactiveFullCycleHrs.toFixed(1)}h = ${(inactiveFullCycleHrs / 24).toFixed(1)} days`);
  if (inactiveFullCycleHrs > INACTIVE_TARGET_DAYS * 24) {
    console.log(`⚠️ Inactive cycle EXCEEDS target rotation of ${INACTIVE_TARGET_DAYS} days!`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
