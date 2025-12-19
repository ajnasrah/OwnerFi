import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function analyzeFailures() {
  console.log('=== FULL SCRAPER SYSTEM DIAGNOSIS ===\n');

  // 1. Queue Status
  console.log('--- QUEUE STATUS ---');
  const pendingSnap = await db.collection('scraper_queue').where('status', '==', 'pending').get();
  const processingSnap = await db.collection('scraper_queue').where('status', '==', 'processing').get();
  const failedSnap = await db.collection('scraper_queue').where('status', '==', 'failed').get();
  const permFailedSnap = await db.collection('scraper_queue').where('status', '==', 'permanently_failed').get();
  const completedSnap = await db.collection('scraper_queue').where('status', '==', 'completed').get();

  console.log('Pending:', pendingSnap.docs.length);
  console.log('Processing:', processingSnap.docs.length);
  console.log('Failed:', failedSnap.docs.length);
  console.log('Permanently Failed:', permFailedSnap.docs.length);
  console.log('Completed:', completedSnap.docs.length);

  // 2. Analyze Failure Reasons
  console.log('\n--- FAILURE REASONS ---');
  const reasons = new Map<string, number>();
  const retryCounts = new Map<number, number>();
  const failDates: Date[] = [];

  failedSnap.docs.forEach(doc => {
    const d = doc.data();
    const reason = d.failureReason || 'No reason provided';
    reasons.set(reason, (reasons.get(reason) || 0) + 1);

    const retries = d.retryCount || 0;
    retryCounts.set(retries, (retryCounts.get(retries) || 0) + 1);

    if (d.failedAt) {
      const failedAt = d.failedAt.toDate?.() || new Date(d.failedAt);
      failDates.push(failedAt);
    }
  });

  [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`${count}x: ${reason.substring(0, 120)}`);
    });

  console.log('\n--- RETRY DISTRIBUTION ---');
  [...retryCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([retries, count]) => {
      console.log(`Retry count ${retries}: ${count} items`);
    });

  // 3. Failure Timeline
  if (failDates.length > 0) {
    failDates.sort((a, b) => b.getTime() - a.getTime());
    console.log('\n--- FAILURE TIMELINE ---');
    console.log('Most recent:', failDates[0].toISOString());
    console.log('Oldest:', failDates[failDates.length - 1].toISOString());

    const byDay = new Map<string, number>();
    failDates.forEach(d => {
      const key = d.toISOString().substring(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + 1);
    });

    console.log('\nFailures by day:');
    [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10)
      .forEach(([day, count]) => {
        console.log(`  ${day}: ${count}`);
      });
  }

  // 4. Check stuck processing items
  console.log('\n--- STUCK PROCESSING ANALYSIS ---');
  const now = new Date();
  let stuckCount = 0;
  processingSnap.docs.forEach(doc => {
    const d = doc.data();
    const startedAt = d.processingStartedAt?.toDate?.() || new Date();
    const ageMinutes = (now.getTime() - startedAt.getTime()) / 1000 / 60;
    if (ageMinutes > 10) stuckCount++;
  });
  console.log(`Items stuck >10 min: ${stuckCount} / ${processingSnap.docs.length}`);

  // 5. Check zillow_imports recent activity
  console.log('\n--- ZILLOW_IMPORTS RECENT ACTIVITY ---');
  const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentImports = await db.collection('zillow_imports')
    .where('importedAt', '>=', last7days)
    .get();

  console.log(`Properties imported in last 7 days: ${recentImports.docs.length}`);

  const importsByDay = new Map<string, number>();
  recentImports.docs.forEach(doc => {
    const d = doc.data();
    const date = d.importedAt?.toDate?.() || new Date(d.importedAt);
    const key = date.toISOString().substring(0, 10);
    importsByDay.set(key, (importsByDay.get(key) || 0) + 1);
  });

  console.log('\nImports by day:');
  [...importsByDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([day, count]) => {
      console.log(`  ${day}: ${count}`);
    });

  // 6. Check what sources are in the queue
  console.log('\n--- QUEUE SOURCES ---');
  const sources = new Map<string, number>();
  const allQueue = [...pendingSnap.docs, ...failedSnap.docs, ...processingSnap.docs];
  allQueue.forEach(doc => {
    const source = doc.data().source || 'unknown';
    sources.set(source, (sources.get(source) || 0) + 1);
  });

  [...sources.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      console.log(`${source}: ${count}`);
    });

  // 7. Check sample failed URLs
  console.log('\n--- SAMPLE FAILED URLS ---');
  failedSnap.docs.slice(0, 5).forEach(doc => {
    const d = doc.data();
    console.log(`URL: ${d.url?.substring(0, 70)}...`);
    console.log(`  Reason: ${d.failureReason || 'None'}`);
    console.log(`  Retries: ${d.retryCount || 0}`);
  });

  process.exit(0);
}

analyzeFailures();
