import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function checkLogs() {
  // Check status_change_reports which is where results are saved
  const reports = await db.collection('status_change_reports')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();

  console.log('=== STATUS CHANGE REPORTS ===');
  console.log('Total reports found:', reports.size);

  let totalChecked = 0;
  let totalDeleted = 0;
  let totalUpdated = 0;
  let totalNoResult = 0;

  reports.forEach(doc => {
    const data = doc.data();
    console.log('---');
    console.log('Time:', data.createdAt?.toDate?.() || data.date?.toDate?.() || 'N/A');
    console.log('Checked:', data.totalChecked || 0);
    console.log('Updated:', data.updated || 0);
    console.log('Deleted:', data.deleted || 0);
    console.log('No Result:', data.noResult || 0);
    console.log('Status Changes:', data.statusChanges || 0);
    console.log('Duration:', data.durationMs ? (data.durationMs/1000).toFixed(1) + 's' : 'N/A');

    // Show some deletions if available
    if (data.deletions && data.deletions.length > 0) {
      console.log('Sample deletions:', data.deletions.slice(0, 3).map((d: {address: string, reason: string}) => `${d.address} - ${d.reason}`));
    }

    totalChecked += data.totalChecked || 0;
    totalDeleted += data.deleted || 0;
    totalUpdated += data.updated || 0;
    totalNoResult += data.noResult || 0;
  });

  console.log('\n' + '='.repeat(60));
  console.log('=== TOTALS FROM ALL REPORTS ===');
  console.log('Total properties checked:', totalChecked);
  console.log('Total updated:', totalUpdated);
  console.log('Total marked inactive/removed:', totalDeleted);
  console.log('Total no Apify result:', totalNoResult);

  // Also check current active vs inactive count
  console.log('\n=== CURRENT PROPERTY COUNTS ===');
  const activeCount = await db.collection('properties').where('isActive', '==', true).count().get();
  const inactiveCount = await db.collection('properties').where('isActive', '==', false).count().get();

  console.log('Active properties:', activeCount.data().count);
  console.log('Inactive properties:', inactiveCount.data().count);
}

checkLogs().catch(console.error);
