import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

async function investigate() {
  console.log('='.repeat(70));
  console.log('SCRAPER SYSTEM INVESTIGATION');
  console.log('='.repeat(70));
  console.log(`Current time: ${new Date().toISOString()}`);

  // ===== 1. CHECK CRON LOCKS =====
  console.log('\n\n=== 1. CRON LOCKS ===');
  const locks = await db.collection('cron_locks').get();
  if (locks.empty) {
    console.log('No cron locks found');
  } else {
    locks.forEach(doc => {
      const d = doc.data();
      console.log(`${doc.id}:`);
      console.log(`  locked: ${d.locked}`);
      console.log(`  lockedAt: ${d.lockedAt?.toDate?.()?.toISOString() || 'N/A'}`);
      console.log(`  unlockedAt: ${d.unlockedAt?.toDate?.()?.toISOString() || 'N/A'}`);
    });
  }

  // ===== 2. CHECK CRON LOGS (last 10) =====
  console.log('\n\n=== 2. RECENT CRON LOGS ===');
  const cronLogs = await db.collection('cron_logs')
    .orderBy('timestamp', 'desc')
    .limit(15)
    .get();

  if (cronLogs.empty) {
    console.log('No cron logs found');
  } else {
    cronLogs.forEach((doc, idx) => {
      const d = doc.data();
      const ts = d.timestamp?.toDate?.()?.toISOString() || 'unknown';
      console.log(`\n${idx + 1}. [${d.cronName}] ${ts}`);
      console.log(`   Status: ${d.status || 'unknown'}`);
      if (d.error) console.log(`   Error: ${d.error}`);
      if (d.message) console.log(`   Message: ${d.message?.substring(0, 100)}`);
      if (d.metrics) {
        const m = d.metrics;
        console.log(`   Metrics: found=${m.totalPropertiesFound || 0}, saved=${m.savedToProperties || 0}, dupes=${m.duplicatesSkipped || 0}, filtered=${m.filteredOut || 0}`);
      }
      if (d.duration) console.log(`   Duration: ${d.duration}`);
    });
  }

  // ===== 3. CHECK SCRAPER QUEUE =====
  console.log('\n\n=== 3. SCRAPER QUEUE STATUS ===');
  const queuePending = await db.collection('scraper_queue').where('status', '==', 'pending').count().get();
  const queueProcessing = await db.collection('scraper_queue').where('status', '==', 'processing').count().get();
  const queueCompleted = await db.collection('scraper_queue').where('status', '==', 'completed').count().get();
  const queueFailed = await db.collection('scraper_queue').where('status', '==', 'failed').count().get();

  console.log(`Pending: ${queuePending.data().count}`);
  console.log(`Processing: ${queueProcessing.data().count}`);
  console.log(`Completed: ${queueCompleted.data().count}`);
  console.log(`Failed: ${queueFailed.data().count}`);

  // ===== 4. CHECK PROPERTIES COLLECTION (unified) =====
  console.log('\n\n=== 4. PROPERTIES COLLECTION (unified) ===');

  // Get counts
  const totalProps = await db.collection('properties').count().get();
  const ownerFinance = await db.collection('properties').where('isOwnerFinance', '==', true).count().get();
  const cashDeals = await db.collection('properties').where('isCashDeal', '==', true).count().get();

  console.log(`Total properties: ${totalProps.data().count}`);
  console.log(`Owner Finance: ${ownerFinance.data().count}`);
  console.log(`Cash Deals: ${cashDeals.data().count}`);

  // Get last 5 properties by createdAt
  console.log('\nLast 5 properties added:');
  const last5 = await db.collection('properties')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  last5.forEach((doc, i) => {
    const d = doc.data();
    const types = [];
    if (d.isOwnerFinance) types.push('OF');
    if (d.isCashDeal) types.push('CD');
    console.log(`${i + 1}. [${types.join('+')}] ${d.fullAddress || d.streetAddress || doc.id}`);
    console.log(`   Created: ${d.createdAt?.toDate?.()?.toISOString()}`);
    console.log(`   Source: ${d.source || 'unknown'}`);
  });

  // ===== 5. CHECK ZILLOW_IMPORTS COLLECTION (legacy) =====
  console.log('\n\n=== 5. ZILLOW_IMPORTS COLLECTION (legacy) ===');
  const zillowTotal = await db.collection('zillow_imports').count().get();
  console.log(`Total: ${zillowTotal.data().count}`);

  const last5Zillow = await db.collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(5)
    .get();

  if (!last5Zillow.empty) {
    console.log('\nLast 5 zillow_imports:');
    last5Zillow.forEach((doc, i) => {
      const d = doc.data();
      console.log(`${i + 1}. ${d.fullAddress || doc.id}`);
      console.log(`   Imported: ${d.importedAt?.toDate?.()?.toISOString() || d.foundAt?.toDate?.()?.toISOString()}`);
    });
  }

  // ===== 6. TIME-BASED ANALYSIS =====
  console.log('\n\n=== 6. TIME-BASED ANALYSIS ===');

  // Last 7 days breakdown
  const now = new Date();
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const dayStart = new Date(now.getTime() - (daysAgo + 1) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const propsInDay = await db.collection('properties')
      .where('createdAt', '>=', Timestamp.fromDate(dayStart))
      .where('createdAt', '<', Timestamp.fromDate(dayEnd))
      .count()
      .get();

    const dayLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
    console.log(`${dayLabel} (${dayStart.toDateString()}): ${propsInDay.data().count} properties`);
  }

  // ===== 7. CHECK FOR SCRAPER V2 SPECIFIC LOGS =====
  console.log('\n\n=== 7. SCRAPER V2 SPECIFIC LOGS ===');
  const v2Logs = await db.collection('cron_logs')
    .where('cronName', '==', 'unified-scraper-v2')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();

  if (v2Logs.empty) {
    console.log('No unified-scraper-v2 logs found');

    // Try alternate name
    const altLogs = await db.collection('cron_logs')
      .where('cronName', '==', 'scraper-v2')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (!altLogs.empty) {
      console.log('Found scraper-v2 logs:');
      altLogs.forEach((doc, i) => {
        const d = doc.data();
        console.log(`${i + 1}. ${d.timestamp?.toDate?.()?.toISOString()} - ${d.status}`);
        if (d.metrics) console.log(`   Metrics: ${JSON.stringify(d.metrics).substring(0, 200)}`);
      });
    }
  } else {
    v2Logs.forEach((doc, i) => {
      const d = doc.data();
      console.log(`${i + 1}. ${d.timestamp?.toDate?.()?.toISOString()}`);
      console.log(`   Status: ${d.status}`);
      if (d.metrics) {
        console.log(`   Found: ${d.metrics.totalPropertiesFound}, Saved: ${d.metrics.savedToProperties}`);
      }
    });
  }

  console.log('\n' + '='.repeat(70));
}

investigate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
