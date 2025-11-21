import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
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

async function fullAnalysis() {
  console.log('\n🔍 COMPREHENSIVE ZILLOW SCRAPER ANALYSIS\n');
  console.log('='.repeat(80));

  // ========================================
  // Overall Database Stats
  // ========================================
  console.log('\n📊 OVERALL DATABASE STATS');
  console.log('-'.repeat(80));

  const allProperties = await db.collection('zillow_imports').get();
  console.log(`\n📦 Total properties in zillow_imports: ${allProperties.size}`);

  // Find most recent property
  const recentProperties = await db
    .collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(10)
    .get();

  if (!recentProperties.empty) {
    console.log('\n📅 Most Recent Properties Added:');
    recentProperties.docs.slice(0, 5).forEach((doc, idx) => {
      const data = doc.data();
      const foundAt = data.foundAt?.toDate?.() || 'Unknown';
      console.log(`   ${idx + 1}. ${data.fullAddress || 'No address'}`);
      console.log(`      Added: ${foundAt instanceof Date ? foundAt.toLocaleString() : foundAt}`);
      console.log(`      Status: ${data.homeStatus || 'Unknown'}`);
      console.log(`      Sent to GHL: ${data.sentToGHL ? 'Yes' : 'No'}`);
    });
  }

  // Properties sent to GHL
  const sentToGHL = await db
    .collection('zillow_imports')
    .where('sentToGHL', '==', true)
    .get();

  console.log(`\n📤 Total properties sent to GHL (all time): ${sentToGHL.size}`);

  if (!sentToGHL.empty) {
    const mostRecentSent = await db
      .collection('zillow_imports')
      .where('sentToGHL', '==', true)
      .orderBy('sentToGHLAt', 'desc')
      .limit(5)
      .get();

    console.log('\n📅 Most Recently Sent to GHL:');
    mostRecentSent.docs.forEach((doc, idx) => {
      const data = doc.data();
      const sentAt = data.sentToGHLAt?.toDate?.() || 'Unknown';
      console.log(`   ${idx + 1}. ${data.fullAddress || 'No address'}`);
      console.log(`      Sent: ${sentAt instanceof Date ? sentAt.toLocaleString() : sentAt}`);
    });
  }

  // ========================================
  // Scraper Queue Stats
  // ========================================
  console.log('\n\n📊 SCRAPER QUEUE STATS (All Time)');
  console.log('-'.repeat(80));

  const allQueue = await db.collection('scraper_queue').get();
  const queueByStatus = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    unknown: 0,
  };

  allQueue.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    if (status in queueByStatus) {
      queueByStatus[status as keyof typeof queueByStatus]++;
    } else {
      queueByStatus.unknown++;
    }
  });

  console.log(`\n📋 Total queue items (all time): ${allQueue.size}`);
  console.log(`   ✅ Completed: ${queueByStatus.completed}`);
  console.log(`   ⏳ Pending: ${queueByStatus.pending}`);
  console.log(`   ⚙️  Processing: ${queueByStatus.processing}`);
  console.log(`   ❌ Failed: ${queueByStatus.failed}`);
  console.log(`   ❓ Unknown: ${queueByStatus.unknown}`);

  // Most recent queue items
  const recentQueue = await db
    .collection('scraper_queue')
    .orderBy('addedAt', 'desc')
    .limit(5)
    .get();

  if (!recentQueue.empty) {
    console.log('\n📅 Most Recent Queue Items:');
    recentQueue.docs.forEach((doc, idx) => {
      const data = doc.data();
      const addedAt = data.addedAt?.toDate?.() || 'Unknown';
      console.log(`   ${idx + 1}. URL: ${data.url?.substring(0, 60)}...`);
      console.log(`      Added: ${addedAt instanceof Date ? addedAt.toLocaleString() : addedAt}`);
      console.log(`      Status: ${data.status || 'Unknown'}`);
    });
  }

  // ========================================
  // Last 7 Days Analysis
  // ========================================
  console.log('\n\n📊 LAST 7 DAYS ANALYSIS');
  console.log('-'.repeat(80));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const last7Days = await db
    .collection('zillow_imports')
    .where('foundAt', '>=', sevenDaysAgo)
    .get();

  console.log(`\n✅ Properties added (last 7 days): ${last7Days.size}`);

  // Breakdown by day
  const byDay: Record<string, number> = {};
  last7Days.docs.forEach(doc => {
    const foundAt = doc.data().foundAt?.toDate();
    if (foundAt) {
      const dateKey = foundAt.toLocaleDateString();
      byDay[dateKey] = (byDay[dateKey] || 0) + 1;
    }
  });

  if (Object.keys(byDay).length > 0) {
    console.log('\n📅 Properties by Day (last 7 days):');
    Object.entries(byDay)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .forEach(([date, count]) => {
        console.log(`   ${date}: ${count} properties`);
      });
  }

  // Last 30 Days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const last30Days = await db
    .collection('zillow_imports')
    .where('foundAt', '>=', thirtyDaysAgo)
    .get();

  console.log(`\n✅ Properties added (last 30 days): ${last30Days.size}`);

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n\n📊 EXECUTIVE SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n📦 Total Properties in Database: ${allProperties.size}`);
  console.log(`📤 Total Sent to Website (GHL): ${sentToGHL.size}`);
  console.log(`📊 Conversion Rate: ${allProperties.size > 0 ? ((sentToGHL.size / allProperties.size) * 100).toFixed(1) : 0}%`);
  console.log(`\n📅 Recent Activity:`);
  console.log(`   Last 7 days: ${last7Days.size} properties added`);
  console.log(`   Last 30 days: ${last30Days.size} properties added`);
  console.log(`\n🔄 Queue Status:`);
  console.log(`   Total items: ${allQueue.size}`);
  console.log(`   Success rate: ${allQueue.size > 0 ? ((queueByStatus.completed / allQueue.size) * 100).toFixed(1) : 0}%`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!\n');
}

// Run the analysis
fullAnalysis()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
