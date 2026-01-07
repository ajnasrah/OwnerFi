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

async function count24hProperties() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayTimestamp = Timestamp.fromDate(yesterday);

  console.log('='.repeat(60));
  console.log('PROPERTY COUNTS - LAST 24 HOURS');
  console.log('='.repeat(60));
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Looking since: ${yesterday.toISOString()}`);
  console.log('');

  // Check properties collection (unified)
  const propertiesRef = db.collection('properties');

  // Query by createdAt
  console.log('Querying properties collection by createdAt...');
  const createdRecent = await propertiesRef
    .where('createdAt', '>=', yesterdayTimestamp)
    .get();

  let ownerFinanceCreated = 0;
  let cashDealCreated = 0;
  let bothCreated = 0;

  createdRecent.forEach(doc => {
    const data = doc.data();
    const isOF = data.isOwnerFinance === true;
    const isCD = data.isCashDeal === true;

    if (isOF && isCD) bothCreated++;
    else if (isOF) ownerFinanceCreated++;
    else if (isCD) cashDealCreated++;
  });

  console.log('\n--- BY CREATED AT ---');
  console.log(`Total new properties:      ${createdRecent.size}`);
  console.log(`  Owner Finance only:      ${ownerFinanceCreated}`);
  console.log(`  Cash Deal only:          ${cashDealCreated}`);
  console.log(`  Both (OF + CD):          ${bothCreated}`);
  console.log(`  Neither:                 ${createdRecent.size - ownerFinanceCreated - cashDealCreated - bothCreated}`);

  // Query by scrapedAt
  console.log('\nQuerying properties collection by scrapedAt...');
  const scrapedRecent = await propertiesRef
    .where('scrapedAt', '>=', yesterdayTimestamp)
    .get();

  let ownerFinanceScraped = 0;
  let cashDealScraped = 0;
  let bothScraped = 0;

  scrapedRecent.forEach(doc => {
    const data = doc.data();
    const isOF = data.isOwnerFinance === true;
    const isCD = data.isCashDeal === true;

    if (isOF && isCD) bothScraped++;
    else if (isOF) ownerFinanceScraped++;
    else if (isCD) cashDealScraped++;
  });

  console.log('\n--- BY SCRAPED AT ---');
  console.log(`Total scraped properties:  ${scrapedRecent.size}`);
  console.log(`  Owner Finance only:      ${ownerFinanceScraped}`);
  console.log(`  Cash Deal only:          ${cashDealScraped}`);
  console.log(`  Both (OF + CD):          ${bothScraped}`);
  console.log(`  Neither:                 ${scrapedRecent.size - ownerFinanceScraped - cashDealScraped - bothScraped}`);

  // Get total counts
  console.log('\n--- TOTAL IN DATABASE ---');
  const allOF = await propertiesRef.where('isOwnerFinance', '==', true).count().get();
  const allCD = await propertiesRef.where('isCashDeal', '==', true).count().get();
  console.log(`Total Owner Finance:       ${allOF.data().count}`);
  console.log(`Total Cash Deals:          ${allCD.data().count}`);

  // Show most recent additions
  console.log('\n--- MOST RECENT 5 ADDITIONS ---');
  const recent5 = await propertiesRef
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  recent5.forEach((doc, i) => {
    const d = doc.data();
    const types = [];
    if (d.isOwnerFinance) types.push('OF');
    if (d.isCashDeal) types.push('CD');
    const created = d.createdAt?.toDate?.()?.toISOString() || 'unknown';
    console.log(`${i+1}. [${types.join('+')||'?'}] ${d.fullAddress || d.address || doc.id}`);
    console.log(`   Created: ${created}`);
    console.log(`   Price: $${d.price?.toLocaleString() || '?'}`);
  });

  // Check cron_logs for scraper runs
  console.log('\n--- RECENT SCRAPER RUNS (cron_logs) ---');
  const cronLogs = await db.collection('cron_logs')
    .where('cronName', '==', 'process-scraper-queue')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();

  if (cronLogs.empty) {
    console.log('No scraper cron logs found');
  } else {
    cronLogs.forEach((doc, i) => {
      const d = doc.data();
      const ts = d.timestamp?.toDate?.()?.toISOString() || 'unknown';
      console.log(`${i+1}. ${ts}`);
      console.log(`   Status: ${d.status || 'unknown'}`);
      if (d.metrics) {
        console.log(`   Properties found: ${d.metrics.totalPropertiesFound || 0}`);
        console.log(`   Saved: ${d.metrics.savedToProperties || 0}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));
}

count24hProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
