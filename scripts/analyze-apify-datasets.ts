import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

const APIFY_TOKEN = process.env.APIFY_API_KEY;

async function analyzeDatasets() {
  // Get all runs from this billing cycle (since Nov 22)
  const runsRes = await fetch(
    `https://api.apify.com/v2/actor-runs?token=${APIFY_TOKEN}&limit=200&desc=true`
  );
  const runsData = await runsRes.json();

  const runs = runsData.data.items.filter((r: any) =>
    r.defaultDatasetId && new Date(r.startedAt) >= new Date('2025-11-22')
  );

  console.log(`Found ${runs.length} runs since Nov 22 (billing cycle start)`);

  let totalItems = 0;
  let totalWithDescription = 0;
  let totalPassedFilter = 0;
  const keywordCounts: Record<string, number> = {};

  // Check all datasets
  for (const run of runs) {
    try {
      const datasetRes = await fetch(
        `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=1000`
      );
      const items = await datasetRes.json();

      if (!Array.isArray(items)) continue;

      totalItems += items.length;

      for (const item of items) {
        const description = item.description || item.homeDescription || '';
        if (description) {
          totalWithDescription++;

          const result = hasStrictOwnerFinancing(description);
          if (result.passes) {
            totalPassedFilter++;
            result.matchedKeywords.forEach(kw => {
              keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
            });
          }
        }
      }

      process.stdout.write('.');
    } catch (e) {
      // Skip failed datasets
    }
  }

  console.log('\n\n=== ANALYSIS OF SCRAPED DATA ===');
  console.log(`Total items scraped: ${totalItems}`);
  console.log(`Items with description: ${totalWithDescription}`);
  console.log(`PASSED owner finance filter: ${totalPassedFilter}`);
  console.log(`Pass rate: ${((totalPassedFilter / totalWithDescription) * 100).toFixed(1)}%`);
  console.log(`\nKeyword distribution:`);
  Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([kw, count]) => {
      console.log(`  ${kw}: ${count}`);
    });
}

analyzeDatasets();
