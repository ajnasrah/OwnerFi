#!/usr/bin/env tsx
// Remove broken feeds from feed-sources.ts

import * as fs from 'fs';
import * as path from 'path';

// List of broken feed IDs from audit
const BROKEN_FEED_IDS = [
  // OwnerFi broken feeds
  'ownerfi-biggerpockets',
  'ownerfi-rismedia',
  'ownerfi-mortgage-reports',
  'ownerfi-houselogic',
  'ownerfi-inman-news',
  'ownerfi-nar-newsroom',
  'ownerfi-realestate-us-news',
  'ownerfi-mortgage-news-daily',
  'ownerfi-bankrate-mortgages',
  'ownerfi-mba-news',
  'ownerfi-forbes-mortgages',
  'ownerfi-lendingtree-mortgages',
  'ownerfi-freddiemac-news',
  'ownerfi-nerdwallet-mortgages',
  'ownerfi-bob-vila',
  'ownerfi-thebalancemoney-homebuying',
  'ownerfi-moneywise-homeownership',
  'ownerfi-realestatetechnology',
  'ownerfi-geekestatelady',
];

function removeBrokenFeeds() {
  const feedSourcesPath = path.join(__dirname, '../src/config/feed-sources.ts');

  console.log('🗑️  Removing broken RSS feeds from configuration...\n');

  let content = fs.readFileSync(feedSourcesPath, 'utf-8');

  let removedCount = 0;

  BROKEN_FEED_IDS.forEach(feedId => {
    // Find and remove the entire feed object
    const feedRegex = new RegExp(
      `  {\\s*id:\\s*'${feedId}',[\\s\\S]*?\\s*fetchInterval:\\s*\\d+\\s*}(?:,)?\\s*`,
      'g'
    );

    if (content.match(feedRegex)) {
      console.log(`  ❌ Removing: ${feedId}`);
      content = content.replace(feedRegex, '');
      removedCount++;
    }
  });

  // Clean up any double commas or trailing commas before closing brackets
  content = content.replace(/,(\s*,)+/g, ',');
  content = content.replace(/,(\s*)\]/g, '$1]');

  // Write back to file
  fs.writeFileSync(feedSourcesPath, content, 'utf-8');

  console.log(`\n✅ Removed ${removedCount} broken feeds from feed-sources.ts`);
  console.log(`\n📝 NEXT STEPS:`);
  console.log(`   1. Review changes: git diff src/config/feed-sources.ts`);
  console.log(`   2. Clean up articles: npx tsx scripts/cleanup-empty-articles.ts`);
  console.log(`   3. Fetch fresh: curl https://ownerfi.ai/api/cron/fetch-feeds`);
  console.log(`   4. Rate articles: curl https://ownerfi.ai/api/cron/rate-articles\n`);
}

removeBrokenFeeds();
