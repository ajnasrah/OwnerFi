import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const APIFY_TOKEN = process.env.APIFY_API_KEY!;

async function findBigRuns() {
  console.log('=== FINDING BIG APIFY RUNS ===\n');

  // Get all runs (most recent first)
  const res = await fetch(
    `https://api.apify.com/v2/actor-runs?token=${APIFY_TOKEN}&limit=100&desc=true`
  );
  const data = await res.json();

  console.log(`Total runs available: ${data.data.total}`);
  console.log(`Checking ${data.data.items.length} most recent runs...\n`);

  // Check each run's dataset size
  for (const run of data.data.items) {
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${run.defaultDatasetId}?token=${APIFY_TOKEN}`
    );
    const dataset = await datasetRes.json();
    const itemCount = dataset.data?.itemCount || 0;

    if (itemCount > 100) {
      console.log(`Run ID: ${run.id}`);
      console.log(`Started: ${run.startedAt}`);
      console.log(`Dataset: ${run.defaultDatasetId}`);
      console.log(`Items: ${itemCount.toLocaleString()}`);
      console.log(`Status: ${run.status}`);
      console.log('---');
    }
  }
}

findBigRuns().catch(console.error);
