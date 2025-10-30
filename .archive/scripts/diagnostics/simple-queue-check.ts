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

async function simpleCheck() {
  console.log('🔍 Checking scraper_queue (no index required)...\n');

  // Get ALL items (no filtering - doesn't need index)
  const allItems = await db
    .collection('scraper_queue')
    .limit(100)
    .get();

  console.log(`📊 Total items in queue: ${allItems.size}\n`);

  if (allItems.empty) {
    console.log('❌ Queue is empty. No properties have been added yet.');
    console.log('\nMake sure you:');
    console.log('1. Reloaded the Chrome extension (chrome://extensions/)');
    console.log('2. Clicked "Save to Queue" on a Zillow search page');
    return;
  }

  // Count by status
  let pending = 0;
  let processing = 0;
  let completed = 0;

  allItems.forEach(doc => {
    const data = doc.data();
    if (data.status === 'pending') pending++;
    else if (data.status === 'processing') processing++;
    else if (data.status === 'completed') completed++;

    // Show first 5 items
    if (pending + processing + completed <= 5) {
      console.log(`${data.status === 'pending' ? '⏳' : data.status === 'completed' ? '✅' : '🔄'} ${data.status.toUpperCase()}: ${data.address || 'No address'}`);
      console.log(`   URL: ${data.url?.substring(0, 60)}...`);
      console.log(`   Added: ${data.addedAt?.toDate?.() || 'Unknown'}\n`);
    }
  });

  console.log('📊 STATUS SUMMARY:');
  console.log(`   ⏳ Pending: ${pending}`);
  console.log(`   🔄 Processing: ${processing}`);
  console.log(`   ✅ Completed: ${completed}`);

  if (pending > 0) {
    console.log('\n✅ Good! Properties are in the queue.');
    console.log('   They will be processed once the Firestore index finishes building (2-5 min).');
  }
}

simpleCheck()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
