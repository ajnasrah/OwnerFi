import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);
const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

console.log('\n📊 Matching successful Firebase jobs to Apify runs...\n');

// Get successful Firebase jobs from today
const jobsSnapshot = await db
  .collection('scraper_jobs')
  .where('status', '==', 'complete')
  .orderBy('startedAt', 'desc')
  .limit(5)
  .get();

console.log(`Found ${jobsSnapshot.size} successful jobs:\n`);

for (const jobDoc of jobsSnapshot.docs) {
  const job = jobDoc.data();
  const startTime = job.startedAt.toDate();

  console.log(`Job: ${jobDoc.id}`);
  console.log(`  Started: ${startTime}`);
  console.log(`  Total: ${job.total}, Imported: ${job.imported}`);

  // Find Apify runs around this time (within ±5 minutes)
  const runsList = await apify.actor('maxcopell/zillow-detail-scraper').runs().list({ limit: 50 });

  const matchingRuns = runsList.items.filter(run => {
    const runTime = new Date(run.startedAt);
    const diff = Math.abs(runTime - startTime) / 1000 / 60; // diff in minutes
    return diff < 5;
  });

  if (matchingRuns.length > 0) {
    console.log(`  Found ${matchingRuns.length} matching Apify runs:`);
    for (const run of matchingRuns) {
      console.log(`    - ${run.id}: ${run.status} (started ${new Date(run.startedAt).toLocaleTimeString()})`);

      // Check if this run has attributionInfo
      if (run.defaultDatasetId) {
        const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
        if (items.length > 0) {
          console.log(`      Has attributionInfo: ${!!items[0].attributionInfo}`);
        }
      }
    }
  } else {
    console.log(`  ⚠️  NO MATCHING APIFY RUNS FOUND`);
  }
  console.log('');
}

process.exit(0);
