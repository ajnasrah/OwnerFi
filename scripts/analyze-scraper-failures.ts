/**
 * Analyzes scraper queue data to identify failure rates and issues
 *
 * Run with: npx tsx scripts/analyze-scraper-failures.ts
 */

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

async function analyzeScraperFailures() {
  console.log('📊 Analyzing Scraper Queue Data...\n');

  // Analyze regular scraper queue
  console.log('🔍 REGULAR SCRAPER QUEUE (scraper_queue)');
  console.log('==========================================');

  const scraperQueueSnapshot = await db.collection('scraper_queue').get();
  const scraperQueueData = scraperQueueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const scraperStats = {
    total: scraperQueueData.length,
    pending: scraperQueueData.filter(d => d.status === 'pending').length,
    processing: scraperQueueData.filter(d => d.status === 'processing').length,
    completed: scraperQueueData.filter(d => d.status === 'completed').length,
    failed: scraperQueueData.filter(d => d.status === 'failed').length,
    stuck: scraperQueueData.filter(d => {
      if (d.status === 'processing' && d.processingStartedAt) {
        const processingTime = Date.now() - d.processingStartedAt.toDate().getTime();
        return processingTime > 10 * 60 * 1000; // Stuck if processing > 10 minutes
      }
      return false;
    }).length,
  };

  console.log(`Total Items: ${scraperStats.total}`);
  console.log(`✅ Completed: ${scraperStats.completed} (${(scraperStats.completed/scraperStats.total*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${scraperStats.failed} (${(scraperStats.failed/scraperStats.total*100).toFixed(1)}%)`);
  console.log(`⏳ Pending: ${scraperStats.pending}`);
  console.log(`🔄 Processing: ${scraperStats.processing}`);
  console.log(`🚨 Stuck (processing >10min): ${scraperStats.stuck}`);

  // Analyze failure reasons
  if (scraperStats.failed > 0) {
    console.log(`\n📋 Failure Reasons:`);
    const failureReasons: Record<string, number> = {};
    scraperQueueData
      .filter(d => d.status === 'failed')
      .forEach(d => {
        const reason = d.failureReason || 'Unknown';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });
    Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
  }

  console.log('\n');

  // Analyze cash deals queue
  console.log('💰 CASH DEALS QUEUE (cash_deals_queue)');
  console.log('==========================================');

  const cashDealsQueueSnapshot = await db.collection('cash_deals_queue').get();
  const cashDealsQueueData = cashDealsQueueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const cashStats = {
    total: cashDealsQueueData.length,
    pending: cashDealsQueueData.filter(d => d.status === 'pending').length,
    processing: cashDealsQueueData.filter(d => d.status === 'processing').length,
    completed: cashDealsQueueData.filter(d => d.status === 'completed').length,
    failed: cashDealsQueueData.filter(d => d.status === 'failed').length,
    stuck: cashDealsQueueData.filter(d => {
      if (d.status === 'processing' && d.processingStartedAt) {
        const processingTime = Date.now() - d.processingStartedAt.toDate().getTime();
        return processingTime > 10 * 60 * 1000;
      }
      return false;
    }).length,
  };

  console.log(`Total Items: ${cashStats.total}`);
  console.log(`✅ Completed: ${cashStats.completed} (${(cashStats.completed/cashStats.total*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${cashStats.failed} (${(cashStats.failed/cashStats.total*100).toFixed(1)}%)`);
  console.log(`⏳ Pending: ${cashStats.pending}`);
  console.log(`🔄 Processing: ${cashStats.processing}`);
  console.log(`🚨 Stuck (processing >10min): ${cashStats.stuck}`);

  if (cashStats.failed > 0) {
    console.log(`\n📋 Failure Reasons:`);
    const failureReasons: Record<string, number> = {};
    cashDealsQueueData
      .filter(d => d.status === 'failed')
      .forEach(d => {
        const reason = d.failureReason || 'Unknown';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });
    Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
  }

  console.log('\n');

  // Analyze saved properties
  console.log('📦 SAVED PROPERTIES');
  console.log('==========================================');

  const zillowImportsSnapshot = await db.collection('zillow_imports').limit(5000).get();
  const cashHousesSnapshot = await db.collection('cash_houses').limit(5000).get();

  console.log(`Regular Properties (zillow_imports): ${zillowImportsSnapshot.size}`);
  console.log(`Cash Houses: ${cashHousesSnapshot.size}`);

  // Analyze GHL webhook status
  const propertiesWithGHLStatus = zillowImportsSnapshot.docs.filter(doc => doc.data().ghlSendStatus);
  const ghlSuccess = propertiesWithGHLStatus.filter(doc => doc.data().ghlSendStatus === 'success').length;
  const ghlFailed = propertiesWithGHLStatus.filter(doc => doc.data().ghlSendStatus === 'failed').length;

  console.log(`\nGHL Webhook Status:`);
  console.log(`   Success: ${ghlSuccess}`);
  console.log(`   Failed: ${ghlFailed}`);
  if (propertiesWithGHLStatus.length > 0) {
    console.log(`   Success Rate: ${(ghlSuccess/(ghlSuccess+ghlFailed)*100).toFixed(1)}%`);
  }

  // Check for missing data issues
  console.log(`\n🔍 Data Quality Checks:`);

  const missingAgent = zillowImportsSnapshot.docs.filter(doc => !doc.data().agentPhoneNumber && !doc.data().brokerPhoneNumber).length;
  const missingZestimate = zillowImportsSnapshot.docs.filter(doc => !doc.data().estimate).length;
  const missingPrice = zillowImportsSnapshot.docs.filter(doc => !doc.data().price).length;

  console.log(`   Missing contact info: ${missingAgent} (${(missingAgent/zillowImportsSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   Missing zestimate: ${missingZestimate} (${(missingZestimate/zillowImportsSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   Missing price: ${missingPrice} (${(missingPrice/zillowImportsSnapshot.size*100).toFixed(1)}%)`);

  console.log('\n');

  // Summary
  console.log('📊 OVERALL SUMMARY');
  console.log('==========================================');
  console.log(`Total Queue Items: ${scraperStats.total + cashStats.total}`);
  console.log(`Total Completed: ${scraperStats.completed + cashStats.completed}`);
  console.log(`Total Failed: ${scraperStats.failed + cashStats.failed}`);
  console.log(`Total Saved Properties: ${zillowImportsSnapshot.size + cashHousesSnapshot.size}`);

  const overallFailureRate = ((scraperStats.failed + cashStats.failed) / (scraperStats.total + cashStats.total) * 100).toFixed(1);
  console.log(`\n❌ Overall Failure Rate: ${overallFailureRate}%`);

  if (scraperStats.stuck > 0 || cashStats.stuck > 0) {
    console.log(`\n⚠️  WARNING: ${scraperStats.stuck + cashStats.stuck} items are stuck in processing state!`);
    console.log(`   Run the cron jobs to recover these items.`);
  }

  console.log('\n✅ Analysis complete!\n');
}

analyzeScraperFailures().catch(console.error);
