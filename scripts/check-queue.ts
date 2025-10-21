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

async function checkQueue() {
  console.log('🔍 Checking scraper_queue...\n');

  // Get pending items
  const pending = await db
    .collection('scraper_queue')
    .where('status', '==', 'pending')
    .orderBy('addedAt', 'desc')
    .limit(10)
    .get();

  console.log(`📋 Pending: ${pending.size} items`);
  pending.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.address} (${data.url.substring(0, 50)}...)`);
  });

  // Get processing items
  const processing = await db
    .collection('scraper_queue')
    .where('status', '==', 'processing')
    .get();

  console.log(`\n⏳ Processing: ${processing.size} items`);

  // Get completed items
  const completed = await db
    .collection('scraper_queue')
    .where('status', '==', 'completed')
    .orderBy('completedAt', 'desc')
    .limit(5)
    .get();

  console.log(`\n✅ Recently Completed: ${completed.size} items (showing last 5)`);
  completed.forEach(doc => {
    const data = doc.data();
    const completedAt = data.completedAt?.toDate?.() || 'Unknown';
    console.log(`  - ${data.address} (completed: ${completedAt})`);
  });

  // Get total stats
  const allPending = await db
    .collection('scraper_queue')
    .where('status', '==', 'pending')
    .count()
    .get();

  const allCompleted = await db
    .collection('scraper_queue')
    .where('status', '==', 'completed')
    .count()
    .get();

  console.log('\n📊 TOTAL STATS:');
  console.log(`   Pending: ${allPending.data().count}`);
  console.log(`   Completed: ${allCompleted.data().count}`);
}

checkQueue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
