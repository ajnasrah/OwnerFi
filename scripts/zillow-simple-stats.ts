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

async function simpleStats() {
  console.log('\n🔍 ZILLOW SCRAPER STATISTICS\n');
  console.log('='.repeat(80));

  // Calculate date ranges
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // ========================================
  // Get ALL properties and analyze in memory
  // ========================================
  console.log('\n📥 Fetching all properties from zillow_imports...');
  const allProperties = await db.collection('zillow_imports').get();
  console.log(`✅ Loaded ${allProperties.size} properties\n`);

  // Analyze properties
  const stats = {
    total: allProperties.size,
    last3Days: 0,
    last7Days: 0,
    sentToGHL: 0,
    sentToGHLLast3Days: 0,
    sentToGHLLast7Days: 0,
    byStatus: {} as Record<string, number>,
    byHomeStatus: {} as Record<string, number>,
    withContact: 0,
    withoutContact: 0,
  };

  const propertiesByDay: Record<string, number> = {};
  const sentByDay: Record<string, number> = {};
  let mostRecentProperty: any = null;
  let mostRecentSent: any = null;

  allProperties.docs.forEach(doc => {
    const data = doc.data();

    // Date analysis
    const foundAt = data.foundAt?.toDate();
    if (foundAt) {
      if (foundAt >= threeDaysAgo) stats.last3Days++;
      if (foundAt >= sevenDaysAgo) stats.last7Days++;

      // Track by day
      const dateKey = foundAt.toLocaleDateString();
      propertiesByDay[dateKey] = (propertiesByDay[dateKey] || 0) + 1;

      // Track most recent
      if (!mostRecentProperty || foundAt > mostRecentProperty.foundAt) {
        mostRecentProperty = { ...data, foundAt };
      }
    }

    // Sent to GHL analysis
    if (data.sentToGHL === true) {
      stats.sentToGHL++;

      const sentAt = data.sentToGHLAt?.toDate();
      if (sentAt) {
        if (sentAt >= threeDaysAgo) stats.sentToGHLLast3Days++;
        if (sentAt >= sevenDaysAgo) stats.sentToGHLLast7Days++;

        const sentDateKey = sentAt.toLocaleDateString();
        sentByDay[sentDateKey] = (sentByDay[sentDateKey] || 0) + 1;

        if (!mostRecentSent || sentAt > mostRecentSent.sentAt) {
          mostRecentSent = { ...data, sentAt };
        }
      }
    }

    // Status breakdown
    const status = data.status || 'null';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Home status breakdown
    const homeStatus = data.homeStatus || 'UNKNOWN';
    stats.byHomeStatus[homeStatus] = (stats.byHomeStatus[homeStatus] || 0) + 1;

    // Contact info
    if (data.agentPhoneNumber || data.brokerPhoneNumber) {
      stats.withContact++;
    } else {
      stats.withoutContact++;
    }
  });

  // ========================================
  // Display Results
  // ========================================

  console.log('📊 OVERALL STATS');
  console.log('-'.repeat(80));
  console.log(`Total Properties: ${stats.total}`);
  console.log(`With Contact Info: ${stats.withContact} (${((stats.withContact / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Without Contact Info: ${stats.withoutContact} (${((stats.withoutContact / stats.total) * 100).toFixed(1)}%)`);

  console.log('\n📅 PROPERTIES ADDED');
  console.log('-'.repeat(80));
  console.log(`Last 3 days: ${stats.last3Days} properties`);
  console.log(`Last 7 days: ${stats.last7Days} properties`);

  if (mostRecentProperty) {
    console.log(`\nMost Recent Property:`);
    console.log(`  Address: ${mostRecentProperty.fullAddress || mostRecentProperty.streetAddress}`);
    console.log(`  Added: ${mostRecentProperty.foundAt.toLocaleString()}`);
    console.log(`  Status: ${mostRecentProperty.homeStatus || 'Unknown'}`);
  }

  console.log('\n📅 Properties Added by Day (Last 7 Days):');
  const last7DaysKeys = Object.entries(propertiesByDay)
    .filter(([date]) => new Date(date) >= sevenDaysAgo)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());

  if (last7DaysKeys.length > 0) {
    last7DaysKeys.forEach(([date, count]) => {
      console.log(`  ${date}: ${count} properties`);
    });
  } else {
    console.log('  No properties added in last 7 days');
  }

  console.log('\n📤 PROPERTIES SENT TO WEBSITE (GHL)');
  console.log('-'.repeat(80));
  console.log(`Total Sent (All Time): ${stats.sentToGHL} (${((stats.sentToGHL / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Last 3 days: ${stats.sentToGHLLast3Days} properties`);
  console.log(`Last 7 days: ${stats.sentToGHLLast7Days} properties`);

  if (mostRecentSent) {
    console.log(`\nMost Recently Sent:`);
    console.log(`  Address: ${mostRecentSent.fullAddress || mostRecentSent.streetAddress}`);
    console.log(`  Sent: ${mostRecentSent.sentAt.toLocaleString()}`);
  }

  console.log('\n📅 Sent to Website by Day (Last 7 Days):');
  const last7DaysSent = Object.entries(sentByDay)
    .filter(([date]) => new Date(date) >= sevenDaysAgo)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());

  if (last7DaysSent.length > 0) {
    last7DaysSent.forEach(([date, count]) => {
      console.log(`  ${date}: ${count} properties`);
    });
  } else {
    console.log('  No properties sent in last 7 days');
  }

  console.log('\n🏠 HOME STATUS BREAKDOWN');
  console.log('-'.repeat(80));
  Object.entries(stats.byHomeStatus)
    .sort(([, a], [, b]) => b - a)
    .forEach(([status, count]) => {
      const pct = ((count / stats.total) * 100).toFixed(1);
      console.log(`${status}: ${count} (${pct}%)`);
    });

  // ========================================
  // Scraper Queue
  // ========================================
  console.log('\n\n📋 SCRAPER QUEUE');
  console.log('-'.repeat(80));

  const allQueue = await db.collection('scraper_queue').get();
  const queueStats = {
    total: allQueue.size,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    last3Days: 0,
  };

  let mostRecentQueueItem: any = null;

  allQueue.docs.forEach(doc => {
    const data = doc.data();
    const status = data.status || 'unknown';

    if (status === 'pending') queueStats.pending++;
    else if (status === 'processing') queueStats.processing++;
    else if (status === 'completed') queueStats.completed++;
    else if (status === 'failed') queueStats.failed++;

    const addedAt = data.addedAt?.toDate();
    if (addedAt) {
      if (addedAt >= threeDaysAgo) queueStats.last3Days++;

      if (!mostRecentQueueItem || addedAt > mostRecentQueueItem.addedAt) {
        mostRecentQueueItem = { ...data, addedAt };
      }
    }
  });

  console.log(`Total Queue Items: ${queueStats.total}`);
  console.log(`  Completed: ${queueStats.completed} (${queueStats.total > 0 ? ((queueStats.completed / queueStats.total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Pending: ${queueStats.pending}`);
  console.log(`  Processing: ${queueStats.processing}`);
  console.log(`  Failed: ${queueStats.failed}`);
  console.log(`\nQueue Items Added (Last 3 Days): ${queueStats.last3Days}`);

  if (mostRecentQueueItem) {
    console.log(`\nMost Recent Queue Item:`);
    console.log(`  URL: ${mostRecentQueueItem.url?.substring(0, 70)}...`);
    console.log(`  Added: ${mostRecentQueueItem.addedAt.toLocaleString()}`);
    console.log(`  Status: ${mostRecentQueueItem.status || 'Unknown'}`);
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n\n📊 EXECUTIVE SUMMARY - LAST 3 DAYS');
  console.log('='.repeat(80));
  console.log(`\n✅ Properties Added to Database: ${stats.last3Days}`);
  console.log(`✅ Properties Sent to Website: ${stats.sentToGHLLast3Days}`);
  console.log(`✅ Queue Items Added: ${queueStats.last3Days}`);

  if (stats.last3Days === 0) {
    console.log('\n⚠️  WARNING: No properties have been added in the last 3 days!');
    console.log('   This could mean:');
    console.log('   - The scraper is not running');
    console.log('   - No properties match the owner financing filter');
    console.log('   - The scraper queue is not being processed');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!\n');
}

// Run the analysis
simpleStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
