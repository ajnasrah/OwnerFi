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

async function checkCashQueue() {
  console.log('\n💰 Checking Cash Deals Queue...\n');

  // Get ALL items from queue (no filtering by status to avoid index)
  const queueSnapshot = await db.collection('cash_deals_queue')
    .limit(50)
    .get();

  console.log(`Found ${queueSnapshot.size} items in cash_deals_queue\n`);

  if (queueSnapshot.size === 0) {
    console.log('❌ Queue is empty! The 41 properties were not added.');
    console.log('Please try clicking the Chrome extension button again.\n');
    return;
  }

  const statusCounts: any = {
    pending: 0,
    processing: 0,
    completed: 0,
  };

  queueSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (statusCounts[data.status] !== undefined) {
      statusCounts[data.status]++;
    }
  });

  console.log('📊 Status Breakdown:');
  console.log(`   Pending: ${statusCounts.pending}`);
  console.log(`   Processing: ${statusCounts.processing}`);
  console.log(`   Completed: ${statusCounts.completed}\n`);

  console.log('📋 First 10 items:');
  queueSnapshot.docs.slice(0, 10).forEach((doc, i) => {
    const data = doc.data();
    console.log(`${i + 1}. [${data.status}] ${data.address || 'No address'}`);
    console.log(`   URL: ${data.url || 'No URL'}`);
    console.log(`   Added: ${data.addedAt?.toDate?.()?.toLocaleString() || 'N/A'}\n`);
  });

  // Check cash_houses collection
  console.log('\n🏠 Checking Cash Houses Collection...\n');
  const cashHousesSnapshot = await db.collection('cash_houses')
    .limit(50)
    .get();

  console.log(`Found ${cashHousesSnapshot.size} properties in cash_houses\n`);

  if (cashHousesSnapshot.size > 0) {
    console.log('✅ Cash Houses Found:');
    cashHousesSnapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i + 1}. ${data.fullAddress || data.streetAddress}`);
      console.log(`   Price: $${data.price?.toLocaleString()}`);
      console.log(`   Zestimate: $${data.estimate?.toLocaleString()}`);
      console.log(`   Discount: ${data.discountPercentage?.toFixed(1)}%\n`);
    });
  } else {
    console.log('⚠️  No properties in cash_houses yet.');
    console.log('This means:');
    console.log('  1. Index is still building (check Firebase Console)');
    console.log('  2. OR none of the properties met the 80% criteria');
    console.log('  3. OR properties are still being processed by Apify\n');
  }
}

checkCashQueue().catch(console.error);
