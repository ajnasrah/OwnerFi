/**
 * Diagnose agent outreach system slowdown
 * Usage: npx tsx scripts/diagnose-outreach.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

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
  // 1. Cron logs - only type we found was refresh-zillow-status
  // Check if outreach logs exist under different naming
  console.log('=== All Cron Log Types ===');
  const allLogs = await db.collection('cron_logs')
    .orderBy('startedAt', 'desc')
    .limit(50)
    .get();
  const typeMap: Record<string, number> = {};
  allLogs.docs.forEach((doc: any) => {
    const t = doc.data().type || doc.id;
    typeMap[t] = (typeMap[t] || 0) + 1;
  });
  for (const [k, v] of Object.entries(typeMap)) {
    console.log(`  ${k}: ${v} runs`);
  }

  // 2. Queue - just get count + recent items
  console.log('\n=== Agent Outreach Queue (counts only) ===');
  const queueCount = await db.collection('agent_outreach_queue').count().get();
  console.log('Total documents:', queueCount.data().count);

  // Get recent pending
  const pendingSnap = await db.collection('agent_outreach_queue')
    .where('status', '==', 'pending')
    .limit(5)
    .get();
  console.log('Sample pending items:', pendingSnap.size);

  // Get recent sent
  const sentSnap = await db.collection('agent_outreach_queue')
    .where('status', '==', 'sent')
    .limit(1)
    .get();
  console.log('Has sent items:', sentSnap.size > 0);

  // 3. Contacted agents - count + recent
  console.log('\n=== Contacted Agents ===');
  const contactedCount = await db.collection('contacted_agents').count().get();
  console.log('Total contacted:', contactedCount.data().count);

  const recentContacted = await db.collection('contacted_agents')
    .orderBy('contactedAt', 'desc')
    .limit(15)
    .get();

  if (recentContacted.size > 0) {
    console.log('Last 15 contacts:');
    recentContacted.docs.forEach((doc: any) => {
      const d = doc.data();
      const at = d.contactedAt?.toDate?.() || d.contactedAt;
      console.log(`  ${at} | ${d.agentName || 'unknown'} | ${d.status || 'N/A'} | ${d.zpid || doc.id}`);
    });
  }

  // 4. Failed filter properties
  console.log('\n=== Failed Filter Properties ===');
  const failedCount = await db.collection('failed_filter_properties').count().get();
  console.log('Total failed:', failedCount.data().count);

  const recentFailed = await db.collection('failed_filter_properties')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (recentFailed.size > 0) {
    const reasons: Record<string, number> = {};
    recentFailed.docs.forEach((doc: any) => {
      const d = doc.data();
      const r = d.filterResult || d.reason || 'unknown';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    console.log('Last 10 failure reasons:');
    for (const [k, v] of Object.entries(reasons)) {
      console.log(`  ${k}: ${v}`);
    }
    const newest = (recentFailed.docs[0] as any).data();
    console.log('Most recent:', newest.createdAt?.toDate?.() || newest.createdAt);
  }

  // 5. Check Vercel deployment logs endpoint
  console.log('\n=== Scraper Route Check ===');
  console.log('Cron path: /api/cron/run-agent-outreach-scraper');
  console.log('Schedule: 0 11 * * * (11 AM UTC daily)');
  console.log('Queue path: /api/cron/process-agent-outreach-queue');
  console.log('Schedule: 0 */2 * * * (every 2 hours)');

  // 6. Check if the scraper cron even logged recently
  // Maybe it logs to a different collection
  console.log('\n=== Checking alternate log locations ===');
  const scraperRuns = await db.collection('scraper_runs')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get()
    .catch(() => ({ empty: true, docs: [] }));

  if (!scraperRuns.empty) {
    console.log('scraper_runs collection:');
    (scraperRuns as any).docs.forEach((doc: any) => {
      const d = doc.data();
      console.log(`  ${d.startedAt?.toDate?.() || d.startedAt} | ${d.type || doc.id}`);
    });
  } else {
    console.log('No scraper_runs collection or empty');
  }
}

main().catch(console.error);
