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

async function analyzeZillowScraperStats() {
  console.log('🔍 ZILLOW SCRAPER ANALYSIS - LAST 3 DAYS\n');
  console.log('='.repeat(80));

  // Calculate date 3 days ago
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);

  console.log(`📅 Analyzing from: ${threeDaysAgo.toLocaleDateString()} to ${new Date().toLocaleDateString()}\n`);

  // ========================================
  // PART 1: Properties Added to zillow_imports
  // ========================================
  console.log('\n📊 PART 1: PROPERTIES ADDED TO ZILLOW_IMPORTS (Last 3 Days)');
  console.log('-'.repeat(80));

  const zillowImportsSnapshot = await db
    .collection('zillow_imports')
    .where('foundAt', '>=', threeDaysAgo)
    .get();

  const totalAdded = zillowImportsSnapshot.size;
  console.log(`\n✅ Total properties added to zillow_imports: ${totalAdded}`);

  // Breakdown by status
  const statusBreakdown: Record<string, number> = {};
  const sentToGHLCount = { yes: 0, no: 0 };
  const verifiedCount = { yes: 0, no: 0 };
  const contactInfoBreakdown = { agent: 0, broker: 0, both: 0, none: 0 };
  const homeStatusBreakdown: Record<string, number> = {};

  zillowImportsSnapshot.docs.forEach(doc => {
    const data = doc.data();

    // Status breakdown
    const status = data.status || 'null';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

    // Sent to GHL breakdown
    if (data.sentToGHL === true) {
      sentToGHLCount.yes++;
    } else {
      sentToGHLCount.no++;
    }

    // Verified breakdown
    if (data.ownerFinanceVerified === true) {
      verifiedCount.yes++;
    } else {
      verifiedCount.no++;
    }

    // Contact info breakdown
    const hasAgent = !!data.agentPhoneNumber;
    const hasBroker = !!data.brokerPhoneNumber;
    if (hasAgent && hasBroker) {
      contactInfoBreakdown.both++;
    } else if (hasAgent) {
      contactInfoBreakdown.agent++;
    } else if (hasBroker) {
      contactInfoBreakdown.broker++;
    } else {
      contactInfoBreakdown.none++;
    }

    // Home status breakdown
    const homeStatus = data.homeStatus || 'UNKNOWN';
    homeStatusBreakdown[homeStatus] = (homeStatusBreakdown[homeStatus] || 0) + 1;
  });

  console.log('\n📋 Status Breakdown:');
  Object.entries(statusBreakdown).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n🏠 Home Status Breakdown:');
  Object.entries(homeStatusBreakdown).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n✅ Owner Finance Verified:');
  console.log(`   Yes: ${verifiedCount.yes}`);
  console.log(`   No: ${verifiedCount.no}`);

  console.log('\n📞 Contact Info:');
  console.log(`   Agent only: ${contactInfoBreakdown.agent}`);
  console.log(`   Broker only: ${contactInfoBreakdown.broker}`);
  console.log(`   Both: ${contactInfoBreakdown.both}`);
  console.log(`   None: ${contactInfoBreakdown.none}`);

  console.log('\n📤 Sent to GHL (Website):');
  console.log(`   ✅ Yes: ${sentToGHLCount.yes}`);
  console.log(`   ❌ No: ${sentToGHLCount.no}`);

  // ========================================
  // PART 2: Properties that Passed Filter and Went to Website
  // ========================================
  console.log('\n\n📊 PART 2: PROPERTIES SENT TO WEBSITE (GHL) - Last 3 Days');
  console.log('-'.repeat(80));

  // Query without compound index - filter sentToGHLAt in memory
  const allSentSnapshot = await db
    .collection('zillow_imports')
    .where('sentToGHL', '==', true)
    .get();

  // Filter in memory for date range
  const sentInLastThreeDays = allSentSnapshot.docs.filter(doc => {
    const data = doc.data();
    if (!data.sentToGHLAt) return false;
    const sentDate = data.sentToGHLAt.toDate();
    return sentDate >= threeDaysAgo;
  });

  const totalSentToWebsite = sentInLastThreeDays.length;
  console.log(`\n✅ Total properties sent to website: ${totalSentToWebsite}`);

  // Breakdown of sent properties
  const sentKeywordsMap: Record<string, number> = {};
  const sentByDay: Record<string, number> = {};

  sentInLastThreeDays.forEach(doc => {
    const data = doc.data();

    // Keywords breakdown
    if (data.matchedKeywords && Array.isArray(data.matchedKeywords)) {
      data.matchedKeywords.forEach((keyword: string) => {
        sentKeywordsMap[keyword] = (sentKeywordsMap[keyword] || 0) + 1;
      });
    }

    // By day breakdown
    if (data.sentToGHLAt) {
      const date = data.sentToGHLAt.toDate().toLocaleDateString();
      sentByDay[date] = (sentByDay[date] || 0) + 1;
    }
  });

  console.log('\n🔑 Matched Keywords (for properties sent to website):');
  Object.entries(sentKeywordsMap)
    .sort(([, a], [, b]) => b - a)
    .forEach(([keyword, count]) => {
      console.log(`   "${keyword}": ${count}`);
    });

  console.log('\n📅 Sent to Website by Day:');
  Object.entries(sentByDay)
    .sort()
    .forEach(([date, count]) => {
      console.log(`   ${date}: ${count} properties`);
    });

  // ========================================
  // PART 3: Scraper Queue Stats
  // ========================================
  console.log('\n\n📊 PART 3: SCRAPER QUEUE STATS - Last 3 Days');
  console.log('-'.repeat(80));

  const queueSnapshot = await db
    .collection('scraper_queue')
    .where('addedAt', '>=', threeDaysAgo)
    .get();

  const queueStats = {
    total: queueSnapshot.size,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  queueSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const status = data.status || 'unknown';
    if (status === 'pending') queueStats.pending++;
    else if (status === 'processing') queueStats.processing++;
    else if (status === 'completed') queueStats.completed++;
    else if (status === 'failed') queueStats.failed++;
  });

  console.log(`\n📋 Total queue items: ${queueStats.total}`);
  console.log(`   ⏳ Pending: ${queueStats.pending}`);
  console.log(`   ⚙️  Processing: ${queueStats.processing}`);
  console.log(`   ✅ Completed: ${queueStats.completed}`);
  console.log(`   ❌ Failed: ${queueStats.failed}`);

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n\n📊 SUMMARY - ZILLOW SCRAPER (Last 3 Days)');
  console.log('='.repeat(80));
  console.log(`\n1️⃣  Properties Added to Database: ${totalAdded}`);
  console.log(`   - With contact info: ${contactInfoBreakdown.agent + contactInfoBreakdown.broker + contactInfoBreakdown.both}`);
  console.log(`   - Without contact info: ${contactInfoBreakdown.none}`);
  console.log(`   - Owner finance verified: ${verifiedCount.yes}`);
  console.log(`   - FOR_SALE status: ${homeStatusBreakdown.FOR_SALE || 0}`);

  console.log(`\n2️⃣  Properties Sent to Website (GHL): ${totalSentToWebsite}`);
  console.log(`   - Conversion rate: ${totalAdded > 0 ? ((totalSentToWebsite / totalAdded) * 100).toFixed(1) : 0}%`);

  console.log(`\n3️⃣  Scraper Queue Performance:`);
  console.log(`   - Success rate: ${queueStats.total > 0 ? ((queueStats.completed / queueStats.total) * 100).toFixed(1) : 0}%`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!\n');
}

// Run the analysis
analyzeZillowScraperStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
