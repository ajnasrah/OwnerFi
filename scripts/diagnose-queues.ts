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

async function diagnose() {
  console.log('='.repeat(70));
  console.log('🔴 OWNER FINANCE QUEUE - FAILED ITEMS ANALYSIS');
  console.log('='.repeat(70));
  
  const failedItems = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .limit(5)
    .get();
  
  console.log(`Checking failed items...`);
  console.log('');
  console.log('Sample of failures:');
  failedItems.docs.forEach(doc => {
    const d = doc.data();
    console.log('  URL:', (d.url || '').substring(0, 70) + '...');
    console.log('  Reason:', d.failureReason || 'Unknown');
    console.log('  Retry Count:', d.retryCount || 0);
    console.log('');
  });
  
  // Check permanently failed
  const permFailed = await db.collection('scraper_queue')
    .where('status', '==', 'permanently_failed')
    .count().get();
  console.log('Permanently failed:', permFailed.data().count);
  
  console.log('');
  console.log('='.repeat(70));
  console.log('💰 CASH DEALS QUEUE - STUCK PROCESSING ANALYSIS');
  console.log('='.repeat(70));
  
  const stuckItems = await db.collection('cash_deals_queue')
    .where('status', '==', 'processing')
    .limit(10)
    .get();
  
  console.log(`Stuck processing: ${stuckItems.size} items`);
  if (!stuckItems.empty) {
    const now = Date.now();
    stuckItems.docs.slice(0, 3).forEach(doc => {
      const d = doc.data();
      const startedAt = d.processingStartedAt?.toDate?.();
      const ageMin = startedAt ? Math.round((now - startedAt.getTime()) / 60000) : 'Unknown';
      console.log('  Age:', ageMin, 'minutes');
    });
  }
  
  console.log('');
  console.log('='.repeat(70));
  console.log('📋 LAST STATUS REFRESH REPORTS');
  console.log('='.repeat(70));
  
  const reports = await db.collection('status_change_reports')
    .orderBy('date', 'desc')
    .limit(3)
    .get();
  
  if (reports.empty) {
    console.log('No status reports found');
  } else {
    reports.docs.forEach(doc => {
      const r = doc.data();
      console.log('Date:', r.date?.toDate?.()?.toISOString().split('T')[0]);
      console.log('  Checked:', r.totalChecked, '| Changes:', r.statusChanges, '| Deleted:', r.deleted);
    });
  }
  
  console.log('');
  console.log('='.repeat(70));
  console.log('🔒 CRON LOCKS');
  console.log('='.repeat(70));
  
  const locks = await db.collection('cron_locks').get();
  if (locks.empty) {
    console.log('No cron locks found');
  } else {
    locks.docs.forEach(doc => {
      const d = doc.data();
      const lockedAt = d.lockedAt?.toDate?.();
      const ageMin = lockedAt ? Math.round((Date.now() - lockedAt.getTime()) / 60000) : 0;
      console.log(doc.id + ':', d.isLocked ? `LOCKED (${ageMin} min ago)` : 'unlocked');
    });
  }
}

diagnose().catch(console.error);
