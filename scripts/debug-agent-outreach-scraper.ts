import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function debugAgentOutreach() {
  console.log('='.repeat(80));
  console.log('DEBUGGING AGENT OUTREACH SCRAPER');
  console.log('='.repeat(80));

  // Check when items were last added
  const allItems = await db.collection('agent_outreach_queue')
    .orderBy('addedAt', 'desc')
    .limit(10)
    .get();

  console.log('\n📥 MOST RECENT ITEMS ADDED:');
  allItems.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  - ${d.address}, ${d.city} ${d.state}`);
    console.log(`    Added: ${d.addedAt?.toDate?.()}`);
    console.log(`    Status: ${d.status}`);
    console.log(`    Source: ${d.source}`);
  });

  // Check items by day
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentItems = await db.collection('agent_outreach_queue').get();

  const byDay: Record<string, number> = {};
  recentItems.docs.forEach(doc => {
    const d = doc.data();
    const addedAt = d.addedAt?.toDate?.();
    if (addedAt && addedAt >= sevenDaysAgo) {
      const dateKey = addedAt.toLocaleDateString();
      byDay[dateKey] = (byDay[dateKey] || 0) + 1;
    }
  });

  console.log('\n📅 ITEMS ADDED BY DAY (Last 7 Days):');
  if (Object.keys(byDay).length === 0) {
    console.log('  No items added in last 7 days!');
  } else {
    Object.entries(byDay)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count}`);
      });
  }

  // Check cron_locks for agent outreach
  console.log('\n🔒 CRON LOCKS:');
  const locks = await db.collection('cron_locks').get();
  const outreachLock = locks.docs.find(d => d.id.includes('agent') || d.id.includes('outreach'));
  if (outreachLock) {
    const d = outreachLock.data();
    console.log(`  Job: ${outreachLock.id}`);
    console.log(`  Locked: ${d.locked}`);
    console.log(`  Last Run: ${d.lastRunAt?.toDate?.()}`);
    console.log(`  Last Result: ${JSON.stringify(d.lastResult || {}).substring(0, 300)}`);
  } else {
    console.log('  No agent outreach lock found');
  }

  // Check pending items (waiting to be sent to GHL)
  const pending = await db.collection('agent_outreach_queue')
    .where('status', '==', 'pending')
    .get();

  console.log(`\n⏳ PENDING ITEMS (waiting to send to GHL): ${pending.size}`);

  // Check Apify usage again
  console.log('\n💰 APIFY STATUS:');
  const response = await fetch('https://api.apify.com/v2/users/me/limits', {
    headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` }
  });
  const data = await response.json();
  console.log(`  Monthly Limit: $${data.data.limits.maxMonthlyUsageUsd}`);
  console.log(`  Current Usage: $${data.data.current.monthlyUsageUsd.toFixed(2)}`);
  console.log(`  Remaining: $${(data.data.limits.maxMonthlyUsageUsd - data.data.current.monthlyUsageUsd).toFixed(2)}`);

  // Check vercel.json schedule
  console.log('\n📅 CRON SCHEDULE (from vercel.json):');
  console.log('  run-agent-outreach-scraper: "0 6,14,22 * * *" (6am, 2pm, 10pm UTC)');
  console.log('  process-agent-outreach-queue: "0 8,16,0 * * *" (8am, 4pm, 12am UTC)');

  // Check total counts
  const total = await db.collection('agent_outreach_queue').count().get();
  const zillowImports = await db.collection('zillow_imports').count().get();
  const cashDeals = await db.collection('cash_deals').count().get();

  console.log('\n📊 TOTAL COUNTS:');
  console.log(`  agent_outreach_queue: ${total.data().count}`);
  console.log(`  zillow_imports: ${zillowImports.data().count}`);
  console.log(`  cash_deals: ${cashDeals.data().count}`);

  console.log('\n' + '='.repeat(80));
}

debugAgentOutreach()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
