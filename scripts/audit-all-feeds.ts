#!/usr/bin/env tsx
// Test ALL RSS feeds and identify which ones to disable

import { OWNERFI_FEEDS, CARZ_FEEDS, VASSDISTRO_FEEDS } from '../src/config/feed-sources';
import { fetchRSSFeed } from '../src/lib/rss-fetcher';

interface FeedTestResult {
  id: string;
  name: string;
  url: string;
  status: 'GOOD' | 'MEDIUM' | 'BAD' | 'ERROR';
  itemCount: number;
  avgContentLength: number;
  error?: string;
  recommendation: 'KEEP' | 'REVIEW' | 'DISABLE';
}

async function testFeed(feed: any): Promise<FeedTestResult> {
  try {
    const rssFeed = await fetchRSSFeed(feed.url);

    if (rssFeed.items.length === 0) {
      return {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        status: 'ERROR',
        itemCount: 0,
        avgContentLength: 0,
        error: 'No items in feed',
        recommendation: 'DISABLE'
      };
    }

    const avgContentLength = Math.round(
      rssFeed.items.reduce((sum, item) => sum + (item.content || '').length, 0) / rssFeed.items.length
    );

    let status: 'GOOD' | 'MEDIUM' | 'BAD';
    let recommendation: 'KEEP' | 'REVIEW' | 'DISABLE';

    if (avgContentLength >= 1000) {
      status = 'GOOD';
      recommendation = 'KEEP';
    } else if (avgContentLength >= 300) {
      status = 'MEDIUM';
      recommendation = 'REVIEW';
    } else {
      status = 'BAD';
      recommendation = 'DISABLE';
    }

    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      status,
      itemCount: rssFeed.items.length,
      avgContentLength,
      recommendation
    };

  } catch (error) {
    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      status: 'ERROR',
      itemCount: 0,
      avgContentLength: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: 'DISABLE'
    };
  }
}

async function auditBrand(brandName: string, feeds: any[]) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${brandName.toUpperCase()} FEEDS AUDIT`);
  console.log(`${'='.repeat(80)}\n`);

  const results: FeedTestResult[] = [];

  for (const feed of feeds.filter(f => f.enabled)) {
    console.log(`Testing: ${feed.name}...`);
    const result = await testFeed(feed);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print results
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${brandName.toUpperCase()} RESULTS`);
  console.log(`${'='.repeat(80)}\n`);

  const good = results.filter(r => r.status === 'GOOD');
  const medium = results.filter(r => r.status === 'MEDIUM');
  const bad = results.filter(r => r.status === 'BAD');
  const errors = results.filter(r => r.status === 'ERROR');

  console.log(`✅ GOOD (KEEP): ${good.length} feeds`);
  good.forEach(r => {
    console.log(`   - ${r.name}`);
    console.log(`     Avg: ${r.avgContentLength} chars, Items: ${r.itemCount}`);
  });

  console.log(`\n⚠️  MEDIUM (REVIEW): ${medium.length} feeds`);
  medium.forEach(r => {
    console.log(`   - ${r.name}`);
    console.log(`     Avg: ${r.avgContentLength} chars, Items: ${r.itemCount}`);
  });

  console.log(`\n❌ BAD (DISABLE): ${bad.length} feeds`);
  bad.forEach(r => {
    console.log(`   - ${r.name}`);
    console.log(`     Avg: ${r.avgContentLength} chars (too short!)`);
  });

  console.log(`\n💥 ERROR (DISABLE): ${errors.length} feeds`);
  errors.forEach(r => {
    console.log(`   - ${r.name}`);
    console.log(`     Error: ${r.error}`);
  });

  // Print code to disable bad feeds
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CODE TO DISABLE BAD ${brandName.toUpperCase()} FEEDS`);
  console.log(`${'='.repeat(80)}\n`);

  const toDisable = [...bad, ...errors];

  if (toDisable.length > 0) {
    console.log(`Edit src/config/feed-sources.ts and set enabled: false for these feeds:\n`);
    toDisable.forEach(r => {
      console.log(`// ${r.name} - ${r.status === 'ERROR' ? r.error : `Only ${r.avgContentLength} chars avg`}`);
      console.log(`{ id: '${r.id}', enabled: false, ... }\n`);
    });
  } else {
    console.log(`✅ All feeds are good! No action needed.\n`);
  }

  return results;
}

async function main() {
  console.log('🔍 RSS FEED COMPREHENSIVE AUDIT');
  console.log('Testing all enabled feeds to identify which ones to disable...\n');

  const ownerfiResults = await auditBrand('OwnerFi', OWNERFI_FEEDS);
  const carzResults = await auditBrand('Carz', CARZ_FEEDS);
  const vassdistroResults = await auditBrand('Vass Distro', VASSDISTRO_FEEDS);

  // Overall summary
  const allResults = [...ownerfiResults, ...carzResults, ...vassdistroResults];

  console.log(`\n${'='.repeat(80)}`);
  console.log('OVERALL SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  const totalGood = allResults.filter(r => r.status === 'GOOD').length;
  const totalMedium = allResults.filter(r => r.status === 'MEDIUM').length;
  const totalBad = allResults.filter(r => r.status === 'BAD').length;
  const totalErrors = allResults.filter(r => r.status === 'ERROR').length;

  console.log(`Total feeds tested: ${allResults.length}`);
  console.log(`✅ GOOD (keep): ${totalGood}`);
  console.log(`⚠️  MEDIUM (review): ${totalMedium}`);
  console.log(`❌ BAD (disable): ${totalBad}`);
  console.log(`💥 ERROR (disable): ${totalErrors}`);

  console.log(`\n📊 Feed Quality: ${Math.round((totalGood / allResults.length) * 100)}% are GOOD`);

  console.log(`\n📝 NEXT STEPS:`);
  console.log(`1. Disable the bad feeds in src/config/feed-sources.ts`);
  console.log(`2. Run: npx tsx scripts/cleanup-empty-articles.ts`);
  console.log(`3. Run: curl https://ownerfi.ai/api/cron/fetch-feeds`);
  console.log(`4. Run: curl https://ownerfi.ai/api/cron/rate-articles`);
  console.log(`5. Try: POST /api/workflow/complete-viral\n`);
}

main().catch(console.error);
