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

async function check() {
  // Check scraper queue status
  const [pending, failed, processing, completed] = await Promise.all([
    db.collection('scraper_queue').where('status', '==', 'pending').count().get(),
    db.collection('scraper_queue').where('status', '==', 'failed').count().get(),
    db.collection('scraper_queue').where('status', '==', 'processing').count().get(),
    db.collection('scraper_queue').where('status', '==', 'completed').count().get()
  ]);

  console.log('=== ZILLOW SCRAPER QUEUE ===');
  console.log('Pending:', pending.data().count);
  console.log('Processing:', processing.data().count);
  console.log('Completed:', completed.data().count);
  console.log('Failed:', failed.data().count);

  // Check cash deals queue
  const [cashPending, cashFailed, cashProcessing, cashCompleted] = await Promise.all([
    db.collection('cash_deals_queue').where('status', '==', 'pending').count().get(),
    db.collection('cash_deals_queue').where('status', '==', 'failed').count().get(),
    db.collection('cash_deals_queue').where('status', '==', 'processing').count().get(),
    db.collection('cash_deals_queue').where('status', '==', 'completed').count().get()
  ]);

  console.log('\n=== CASH DEALS QUEUE ===');
  console.log('Pending:', cashPending.data().count);
  console.log('Processing:', cashProcessing.data().count);
  console.log('Completed:', cashCompleted.data().count);
  console.log('Failed:', cashFailed.data().count);

  // Get recent failed items from zillow scraper
  const recentFailed = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .limit(10)
    .get();

  if (recentFailed.docs.length > 0) {
    console.log('\n=== RECENT ZILLOW FAILURES ===');
    recentFailed.docs.slice(0, 5).forEach(doc => {
      const d = doc.data();
      console.log('URL:', d.url?.substring(0, 70));
      console.log('Error:', d.error || d.errorMessage || 'No error message');
      console.log('Retry count:', d.retryCount || 0);
      console.log('---');
    });
  }

  // Get recent failed items from cash deals
  const cashRecentFailed = await db.collection('cash_deals_queue')
    .where('status', '==', 'failed')
    .limit(10)
    .get();

  if (cashRecentFailed.docs.length > 0) {
    console.log('\n=== RECENT CASH DEALS FAILURES ===');
    cashRecentFailed.docs.slice(0, 5).forEach(doc => {
      const d = doc.data();
      console.log('URL:', d.url?.substring(0, 70));
      console.log('Error:', d.error || d.errorMessage || 'No error message');
      console.log('Retry count:', d.retryCount || 0);
      console.log('---');
    });
  }

  // Check if there are stuck processing items
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const stuckProcessing = await db.collection('scraper_queue')
    .where('status', '==', 'processing')
    .get();

  const stuckItems = stuckProcessing.docs.filter(doc => {
    const d = doc.data();
    const startedAt = d.startedAt?.toDate?.() || d.updatedAt?.toDate?.();
    return startedAt && startedAt < tenMinutesAgo;
  });

  if (stuckItems.length > 0) {
    console.log('\n=== STUCK PROCESSING (>10 min) ===');
    console.log('Count:', stuckItems.length);
  }

  process.exit(0);
}
check();
