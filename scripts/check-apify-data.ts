#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

async function main() {
  console.log('Checking detail scraper runs...\n');

  // Get recent runs
  const runs = await client.actor('maxcopell/zillow-detail-scraper').runs().list({ limit: 10, desc: true });

  let totalProperties = 0;

  for (const run of runs.items) {
    if (!run.defaultDatasetId) continue;

    try {
      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
      const count = dataset.total || 0;
      totalProperties += count;

      console.log(`Run ${run.id}: ${count} properties`);

      if (dataset.items.length > 0) {
        const item = dataset.items[0] as Record<string, unknown>;
        console.log('  Sample keys:', Object.keys(item).join(', '));
        console.log('  imgSrc:', item.imgSrc ? 'YES' : 'NO');
        console.log('  hiResImageLink:', item.hiResImageLink ? 'YES' : 'NO');
        console.log('  photos:', Array.isArray(item.photos) ? `${(item.photos as unknown[]).length} photos` : 'NO');
        console.log('');
      }
    } catch (e) {
      console.log(`Run ${run.id}: Dataset unavailable`);
    }
  }

  console.log(`\nTotal from last 10 runs: ${totalProperties}`);

  // Now estimate total
  console.log('\n--- Estimating total from all 1535 runs ---');
  const avgPerRun = totalProperties / 10;
  console.log(`Average per run: ${avgPerRun}`);
  console.log(`Estimated total (1535 runs): ${Math.round(avgPerRun * 1535)}`);
}

main().catch(console.error);
