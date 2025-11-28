import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

async function check() {
  const now = new Date();
  console.log('Current time:', now.toISOString());
  console.log('');

  // Check most recent status checks
  const snap = await db.collection('zillow_imports')
    .orderBy('lastStatusCheck', 'desc')
    .limit(10)
    .get();

  console.log('📊 Most recent status checks on properties:');
  snap.forEach(doc => {
    const data = doc.data();
    const lastCheck = data.lastStatusCheck?.toDate?.();
    const address = (data.fullAddress || data.streetAddress || 'Unknown').substring(0, 45);
    const ago = lastCheck ? Math.round((now.getTime() - lastCheck.getTime()) / 1000 / 60) : null;
    console.log(`  ${address}`);
    console.log(`    Last check: ${lastCheck ? lastCheck.toISOString() : 'never'} (${ago ? ago + ' min ago' : 'N/A'})`);
  });

  // Check status_change_reports for recent runs
  const reports = await db.collection('status_change_reports')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log('\n📋 Recent cron runs (status_change_reports):');
  if (reports.empty) {
    console.log('  No reports found (cron only saves reports when there are changes/deletions)');
  } else {
    reports.forEach(doc => {
      const data = doc.data();
      const date = data.createdAt?.toDate?.();
      const ago = date ? Math.round((now.getTime() - date.getTime()) / 1000 / 60 / 60) : null;
      console.log(`  ${date ? date.toISOString() : 'unknown'} (${ago ? ago + 'h ago' : 'N/A'})`);
      console.log(`    Checked: ${data.totalChecked}, Changes: ${data.statusChanges}, Deleted: ${data.deleted}`);
    });
  }

  // Calculate when properties were last checked
  const allSnap = await db.collection('zillow_imports').get();
  let checkedLast2Hours = 0;
  let checkedLast24Hours = 0;
  let neverChecked = 0;

  const twoHoursAgo = now.getTime() - (2 * 60 * 60 * 1000);
  const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);

  allSnap.forEach(doc => {
    const lastCheck = doc.data().lastStatusCheck?.toDate?.()?.getTime();
    if (!lastCheck) {
      neverChecked++;
    } else if (lastCheck > twoHoursAgo) {
      checkedLast2Hours++;
    } else if (lastCheck > oneDayAgo) {
      checkedLast24Hours++;
    }
  });

  console.log('\n⏰ Check timing summary:');
  console.log(`  Checked in last 2 hours: ${checkedLast2Hours}`);
  console.log(`  Checked in last 24 hours: ${checkedLast24Hours}`);
  console.log(`  Never checked: ${neverChecked}`);
  console.log(`  Total: ${allSnap.size}`);

  if (checkedLast2Hours > 0) {
    console.log('\n✅ Cron IS running - properties were checked in the last 2 hours');
  } else if (checkedLast24Hours > 0) {
    console.log('\n⚠️  Cron may be running slowly - no checks in last 2 hours but some in last 24h');
  } else {
    console.log('\n❌ Cron may NOT be running - no recent checks found');
  }
}

check().catch(console.error);
