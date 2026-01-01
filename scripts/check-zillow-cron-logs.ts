import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function getLogs() {
  // Get recent cron_logs - just order by startedAt, filter in JS
  const cronLogs = await db.collection('cron_logs')
    .orderBy('startedAt', 'desc')
    .limit(50)
    .get();

  const zillowLogs = cronLogs.docs.filter(doc => doc.data().type === 'refresh-zillow-status');

  console.log('=== RECENT CRON RUNS (last 20) ===\n');

  let totalDeleted = 0;
  let totalProcessed = 0;
  let totalNoResult = 0;

  zillowLogs.forEach(doc => {
    const d = doc.data();
    const started = d.startedAt?.toDate?.() || new Date(d.startedAt);
    const results = d.results || {};

    totalDeleted += results.deleted || 0;
    totalProcessed += results.processed || 0;
    totalNoResult += results.noResult || 0;

    console.log(`${started.toLocaleString()}`);
    console.log(`  Status: ${d.status}`);
    console.log(`  Processed: ${results.processed || 0}`);
    console.log(`  Updated: ${results.updated || 0}`);
    console.log(`  Deleted/Inactive: ${results.deleted || 0}`);
    console.log(`  No Result: ${results.noResult || 0}`);
    console.log(`  Status Changed: ${results.statusChanged || 0}`);
    console.log('');
  });

  console.log('=== SUMMARY ===');
  console.log(`Total runs: ${zillowLogs.length}`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total marked inactive: ${totalDeleted}`);
  console.log(`Total no result: ${totalNoResult}`);

  // Get recent status_change_reports for deletion details
  console.log('\n=== RECENT DELETION DETAILS (last 30 reports with deletions) ===\n');

  const reports = await db.collection('status_change_reports')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const reportsWithDeletions = reports.docs.filter(doc => (doc.data().deleted || 0) > 0).slice(0, 30);

  reportsWithDeletions.forEach(doc => {
    const d = doc.data();
    const date = d.createdAt?.toDate?.() || new Date(d.createdAt);

    console.log(`Report from ${date.toLocaleString()}:`);
    console.log(`  Deleted: ${d.deleted || 0}`);

    if (d.deletions && d.deletions.length > 0) {
      console.log('  Reasons:');
      const reasonCounts: Record<string, number> = {};
      d.deletions.forEach((del: { reason: string }) => {
        reasonCounts[del.reason] = (reasonCounts[del.reason] || 0) + 1;
      });
      Object.entries(reasonCounts).forEach(([reason, count]) => {
        console.log(`    ${reason}: ${count}`);
      });
    }
    console.log('');
  });

  // Show all "Status: OTHER" deletions with addresses
  console.log('\n=== ALL "STATUS: OTHER" DELETIONS ===\n');

  const allOtherDeletions: Array<{address: string, date: Date}> = [];

  reports.docs.forEach(doc => {
    const d = doc.data();
    const date = d.createdAt?.toDate?.() || new Date(d.createdAt);

    if (d.deletions && d.deletions.length > 0) {
      d.deletions.forEach((del: { reason: string; address: string }) => {
        if (del.reason === 'Status: OTHER') {
          allOtherDeletions.push({ address: del.address, date });
        }
      });
    }
  });

  console.log(`Total "Status: OTHER" deletions: ${allOtherDeletions.length}\n`);

  allOtherDeletions.forEach(({ address, date }) => {
    console.log(`  ${date.toLocaleString()} - ${address}`);
  });

  // Also check what these properties look like in Firestore now
  console.log('\n\n=== CHECKING INACTIVE PROPERTIES WITH "OTHER" STATUS ===\n');

  const inactiveOther = await db.collection('properties')
    .where('isActive', '==', false)
    .where('homeStatus', '==', 'OTHER')
    .limit(20)
    .get();

  console.log(`Found ${inactiveOther.size} inactive properties with homeStatus=OTHER:\n`);

  inactiveOther.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.fullAddress || d.streetAddress || d.address || doc.id}`);
    console.log(`    - Reason: ${d.offMarketReason || 'N/A'}`);
    console.log(`    - Last check: ${d.lastStatusCheck?.toDate?.().toLocaleString() || 'N/A'}`);
    console.log(`    - Price: $${d.price?.toLocaleString() || 'N/A'}`);
    console.log(`    - URL: ${d.url || 'N/A'}`);
    console.log(`    - ZPID: ${d.zpid || doc.id}`);
    console.log('');
  });

  // Check a few recently deleted ones by looking them up
  console.log('\n=== LOOKING UP RECENT "OTHER" DELETIONS ===\n');

  const recentOtherAddresses = [
    '171 Flintlock Trl',
    '256 Yellow Snapdragon Dr',
    '222 N El Paso Ave',
    '2709 Robert Hiram Dr',
  ];

  for (const addr of recentOtherAddresses) {
    const snap = await db.collection('properties')
      .where('streetAddress', '==', addr)
      .limit(1)
      .get();

    if (!snap.empty) {
      const d = snap.docs[0].data();
      console.log(`${addr}:`);
      console.log(`  - isActive: ${d.isActive}`);
      console.log(`  - homeStatus: ${d.homeStatus}`);
      console.log(`  - URL: ${d.url || d.hdpUrl || 'N/A'}`);
      console.log(`  - ZPID: ${d.zpid || snap.docs[0].id}`);
      console.log('');
    } else {
      console.log(`${addr}: NOT FOUND in properties collection`);
    }
  }
}

getLogs().catch(console.error);
