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

async function debugScraperIssue() {
  console.log('='.repeat(80));
  console.log('SCRAPER DEBUGGING ANALYSIS');
  console.log('='.repeat(80));

  // 1. Check queue status breakdown
  const allQueue = await db.collection('scraper_queue').get();
  const statusCounts: Record<string, number> = {};
  allQueue.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\n📋 QUEUE STATUS BREAKDOWN:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // 2. Check cron locks
  const locks = await db.collection('cron_locks').get();
  console.log('\n🔒 CRON LOCKS:');
  if (locks.empty) {
    console.log('  No cron locks found');
  } else {
    locks.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  ---`);
      console.log(`  Job: ${doc.id}`);
      console.log(`  Locked: ${d.locked}`);
      console.log(`  Last Run: ${d.lastRunAt?.toDate?.() || 'Never'}`);
      console.log(`  Last Result: ${JSON.stringify(d.lastResult || {}).substring(0, 200)}`);
    });
  }

  // 3. Check recent failed items with reasons
  const failed = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .limit(10)
    .get();

  console.log('\n❌ FAILED QUEUE ITEMS (sample of 10):');
  failed.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ---`);
    console.log(`  URL: ${d.url?.substring(0, 70)}...`);
    console.log(`  Failure Reason: ${d.failureReason || d.error || 'No reason'}`);
    console.log(`  Retry Count: ${d.retryCount || 0}`);
    console.log(`  Failed At: ${d.failedAt?.toDate?.() || 'Unknown'}`);
  });

  // 4. Check scraper_runs collection if it exists
  try {
    const runs = await db.collection('scraper_runs').orderBy('startedAt', 'desc').limit(5).get();
    console.log('\n🏃 RECENT SCRAPER RUNS:');
    if (runs.empty) {
      console.log('  No scraper runs recorded');
    } else {
      runs.docs.forEach(doc => {
        const d = doc.data();
        console.log(`  ---`);
        console.log(`  Started: ${d.startedAt?.toDate?.()}`);
        console.log(`  Status: ${d.status}`);
        console.log(`  Properties Found: ${d.propertiesFound || 0}`);
      });
    }
  } catch (e) {
    console.log('\n🏃 SCRAPER RUNS: Collection does not exist or no index');
  }

  // 5. Check recent additions to zillow_imports
  const recentImports = await db.collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(5)
    .get();

  console.log('\n📥 MOST RECENT IMPORTS:');
  recentImports.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ---`);
    console.log(`  Address: ${d.fullAddress || d.streetAddress}`);
    console.log(`  Found At: ${d.foundAt?.toDate?.()}`);
    console.log(`  Status: ${d.homeStatus}`);
    console.log(`  Keywords: ${d.matchedKeywords?.join(', ') || 'None recorded'}`);
  });

  // 6. Check Vercel cron schedule (from vercel.json)
  console.log('\n📅 EXPECTED CRON SCHEDULE:');
  console.log('  run-search-scraper: Monday & Thursday at 9 AM');
  console.log('  process-scraper-queue: Should run after search scraper');

  // 7. Check if there are any pending items
  const pending = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .limit(5)
    .get();

  console.log('\n⏳ PENDING ITEMS:');
  if (pending.empty) {
    console.log('  No pending items - this is a problem!');
    console.log('  The search scraper should add items to the queue');
  } else {
    console.log(`  Found ${pending.size} pending items (showing first 5)`);
    pending.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  - ${d.url?.substring(0, 60)}... (added ${d.addedAt?.toDate?.()})`);
    });
  }

  // 8. Check when the last search scraper ran by looking at addedAt dates
  const recentQueue = await db.collection('scraper_queue')
    .where('source', '==', 'search_cron')
    .orderBy('addedAt', 'desc')
    .limit(1)
    .get();

  console.log('\n🔍 LAST SEARCH SCRAPER RUN:');
  if (recentQueue.empty) {
    console.log('  No items from search_cron source found');
  } else {
    const d = recentQueue.docs[0].data();
    console.log(`  Last item added at: ${d.addedAt?.toDate?.()}`);
    console.log(`  URL: ${d.url?.substring(0, 60)}...`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));
}

debugScraperIssue()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
