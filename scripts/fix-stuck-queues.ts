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

async function fixQueues() {
  console.log('🔧 FIXING STUCK QUEUES');
  console.log('='.repeat(70));
  
  // 1. Reset cash deals stuck processing items (older than 10 min)
  console.log('\n1️⃣ Resetting stuck cash deals queue items...');
  const stuckCash = await db.collection('cash_deals_queue')
    .where('status', '==', 'processing')
    .get();
  
  if (!stuckCash.empty) {
    const batch = db.batch();
    stuckCash.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'pending', processingStartedAt: null });
    });
    await batch.commit();
    console.log('   Reset ' + stuckCash.size + ' stuck cash deals items to pending');
  } else {
    console.log('   No stuck items found');
  }
  
  // 2. Reset owner finance failed items for retry
  console.log('\n2️⃣ Resetting failed owner finance queue items...');
  const failedOwner = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .get();
  
  if (!failedOwner.empty) {
    // Reset in batches of 500
    const docs = failedOwner.docs;
    let batchNum = 0;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      const slice = docs.slice(i, i + 500);
      slice.forEach(doc => {
        batch.update(doc.ref, { 
          status: 'pending', 
          failedAt: null,
          failureReason: null,
          retryCount: 0
        });
      });
      await batch.commit();
      batchNum++;
      console.log('   Reset batch ' + batchNum + ': ' + slice.length + ' items');
    }
    console.log('   Reset ' + failedOwner.size + ' failed items to pending');
  } else {
    console.log('   No failed items found');
  }
  
  console.log('\nQueue fixes complete!');
}

fixQueues().catch(console.error);
