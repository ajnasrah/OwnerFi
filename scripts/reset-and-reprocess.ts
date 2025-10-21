import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

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

async function resetAndReprocess() {
  console.log('🔄 RESET AND REPROCESS SCRIPT\n');
  console.log('This will:');
  console.log('1. Delete ALL properties from zillow_imports collection');
  console.log('2. Reset ALL queue items to "pending" status');
  console.log('3. Allow cron to reprocess with NEW extraction logic\n');

  // Step 1: Count and delete all zillow_imports
  console.log('📊 Step 1: Counting zillow_imports...');
  const importsSnapshot = await db.collection('zillow_imports').get();
  console.log(`   Found ${importsSnapshot.size} properties to delete\n`);

  if (importsSnapshot.size > 0) {
    console.log('🗑️  Deleting all zillow_imports...');
    const batchSize = 500;
    let deleted = 0;

    for (let i = 0; i < importsSnapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = importsSnapshot.docs.slice(i, i + batchSize);

      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deleted += chunk.length;
      console.log(`   Deleted ${deleted}/${importsSnapshot.size}`);
    }

    console.log(`✅ Deleted ${deleted} properties from zillow_imports\n`);
  }

  // Step 2: Reset queue to pending
  console.log('📊 Step 2: Counting scraper_queue items...');
  const queueSnapshot = await db.collection('scraper_queue').get();
  console.log(`   Found ${queueSnapshot.size} queue items\n`);

  if (queueSnapshot.size > 0) {
    console.log('🔄 Resetting all queue items to "pending"...');
    const batchSize = 500;
    let reset = 0;

    for (let i = 0; i < queueSnapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = queueSnapshot.docs.slice(i, i + batchSize);

      chunk.forEach(doc => {
        batch.update(doc.ref, {
          status: 'pending',
          processingStartedAt: null,
          completedAt: null,
        });
      });

      await batch.commit();
      reset += chunk.length;
      console.log(`   Reset ${reset}/${queueSnapshot.size}`);
    }

    console.log(`✅ Reset ${reset} queue items to "pending"\n`);
  }

  // Step 3: Summary
  console.log('📊 SUMMARY:');
  console.log(`   🗑️  Deleted: ${importsSnapshot.size} properties`);
  console.log(`   🔄 Reset: ${queueSnapshot.size} queue items`);
  console.log('\n✅ Ready for reprocessing!');
  console.log('The cron will automatically process the queue every 15 minutes.');
  console.log('Or manually trigger: curl https://ownerfi.ai/api/cron/process-scraper-queue');
}

resetAndReprocess()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
