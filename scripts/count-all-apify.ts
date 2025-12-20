#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

async function main() {
  console.log('Counting ALL properties across ALL detail scraper runs...\n');

  // Get ALL runs
  const allRuns = [];
  let offset = 0;
  while (true) {
    const batch = await client.actor('maxcopell/zillow-detail-scraper').runs().list({ limit: 100, offset, desc: true });
    allRuns.push(...batch.items);
    console.log(`Fetched ${allRuns.length} runs...`);
    if (batch.items.length < 100) break;
    offset += 100;
  }

  console.log(`\nTotal runs: ${allRuns.length}`);

  // Count properties in each run
  let totalProperties = 0;
  let runsWith50Plus = 0;
  let runsWithData = 0;
  let runsEmpty = 0;
  let maxPerRun = 0;

  for (let i = 0; i < allRuns.length; i++) {
    const run = allRuns[i];
    if (!run.defaultDatasetId) {
      runsEmpty++;
      continue;
    }

    try {
      // Just get count, not items
      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
      const count = dataset.total || 0;

      if (count > 0) {
        runsWithData++;
        totalProperties += count;
        if (count > maxPerRun) maxPerRun = count;
        if (count >= 50) runsWith50Plus++;
      } else {
        runsEmpty++;
      }

      if (i % 100 === 0) {
        console.log(`Processed ${i}/${allRuns.length} runs, ${totalProperties} properties so far...`);
      }
    } catch (e) {
      runsEmpty++;
    }
  }

  console.log('\n=== FINAL COUNTS ===');
  console.log(`Total runs: ${allRuns.length}`);
  console.log(`Runs with data: ${runsWithData}`);
  console.log(`Runs empty/deleted: ${runsEmpty}`);
  console.log(`Runs with 50+ properties: ${runsWith50Plus}`);
  console.log(`Max properties in a single run: ${maxPerRun}`);
  console.log(`\nTOTAL PROPERTIES: ${totalProperties}`);
}

main().catch(console.error);
