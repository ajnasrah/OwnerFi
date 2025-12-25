import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function checkScraperLogs() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check scraper_runs collection
  console.log('=== SCRAPER RUNS (Last 24 hours) ===\n');

  const runs = await db.collection('scraper_runs')
    .where('startedAt', '>=', oneDayAgo)
    .orderBy('startedAt', 'desc')
    .get();

  console.log('Total runs found:', runs.size);

  let totalAdded = 0;
  let totalProcessed = 0;
  let totalDuplicates = 0;

  runs.forEach(doc => {
    const data = doc.data();
    const added = data.propertiesAdded || data.added || data.newProperties || 0;
    const found = data.propertiesFound || data.totalFound || 0;
    const dupes = data.duplicates || data.skipped || 0;

    console.log('---');
    console.log('Time:', data.startedAt?.toDate?.() || 'N/A');
    console.log('Status:', data.status);
    console.log('Query:', data.query || data.searchQuery || 'N/A');
    console.log('Found:', found, '| Added:', added, '| Duplicates:', dupes);

    totalAdded += added;
    totalProcessed += found;
    totalDuplicates += dupes;
  });

  // Also check cron_logs for scraper-related entries
  console.log('\n\n=== CRON LOGS (Scraper-related, Last 24 hours) ===\n');

  const cronLogs = await db.collection('cron_logs')
    .where('startedAt', '>=', oneDayAgo)
    .orderBy('startedAt', 'desc')
    .get();

  let scraperCronCount = 0;
  cronLogs.forEach(doc => {
    const data = doc.data();
    const type = data.type || data.cron || '';
    if (type.includes('scraper') || type.includes('property')) {
      scraperCronCount++;
      console.log('---');
      console.log('Type:', type);
      console.log('Time:', data.startedAt?.toDate?.() || data.timestamp?.toDate?.() || 'N/A');
      console.log('Status:', data.status);
      if (data.results) {
        console.log('Results:', JSON.stringify(data.results, null, 2));
      }
    }
  });

  console.log('\nScraper-related cron logs:', scraperCronCount);

  // Check properties collection for recently added
  console.log('\n\n=== PROPERTIES ADDED (Last 24 hours) ===\n');

  const recentProperties = await db.collection('properties')
    .where('createdAt', '>=', oneDayAgo)
    .orderBy('createdAt', 'desc')
    .get();

  console.log('Properties added in last 24 hours:', recentProperties.size);

  // Group by source
  const bySource: Record<string, number> = {};
  recentProperties.forEach(doc => {
    const data = doc.data();
    const source = data.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });

  console.log('\nBy source:');
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

  // Also check scrapedAt field
  const recentScraped = await db.collection('properties')
    .where('scrapedAt', '>=', oneDayAgo)
    .orderBy('scrapedAt', 'desc')
    .get();

  console.log('\nProperties scraped in last 24 hours:', recentScraped.size);

  console.log('\n' + '='.repeat(60));
  console.log('=== SUMMARY ===');
  console.log('Scraper runs:', runs.size);
  console.log('Total processed:', totalProcessed);
  console.log('Total added:', totalAdded);
  console.log('Total duplicates:', totalDuplicates);
  console.log('Properties with createdAt in last 24h:', recentProperties.size);
}

checkScraperLogs().catch(console.error);
