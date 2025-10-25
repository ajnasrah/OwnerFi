#!/usr/bin/env tsx
// Analyze RSS feeds to see which ones provide full content vs snippets
import { OWNERFI_FEEDS, CARZ_FEEDS, VASSDISTRO_FEEDS } from '../src/config/feed-sources';
import { fetchRSSFeed } from '../src/lib/rss-fetcher';

interface FeedAnalysis {
  feedId: string;
  feedName: string;
  category: string;
  totalArticles: number;
  avgContentLength: number;
  avgDescriptionLength: number;
  hasFullContent: boolean;
  contentLengths: number[];
}

async function analyzeFeed(feed: any): Promise<FeedAnalysis> {
  console.log(`\n🔍 Analyzing: ${feed.name}...`);

  try {
    const rssFeed = await fetchRSSFeed(feed.url);

    const contentLengths = rssFeed.items.map(item => (item.content || '').length);
    const descriptionLengths = rssFeed.items.map(item => (item.description || '').length);

    const avgContentLength = contentLengths.length > 0
      ? Math.round(contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length)
      : 0;

    const avgDescriptionLength = descriptionLengths.length > 0
      ? Math.round(descriptionLengths.reduce((a, b) => a + b, 0) / descriptionLengths.length)
      : 0;

    // Consider it "full content" if average content length > 500 chars
    const hasFullContent = avgContentLength > 500;

    return {
      feedId: feed.id,
      feedName: feed.name,
      category: feed.category,
      totalArticles: rssFeed.items.length,
      avgContentLength,
      avgDescriptionLength,
      hasFullContent,
      contentLengths
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      feedId: feed.id,
      feedName: feed.name,
      category: feed.category,
      totalArticles: 0,
      avgContentLength: 0,
      avgDescriptionLength: 0,
      hasFullContent: false,
      contentLengths: []
    };
  }
}

async function analyzeAllFeeds() {
  console.log('📊 RSS Feed Content Quality Analysis\n');
  console.log('=' .repeat(80));

  const allFeeds = [
    ...OWNERFI_FEEDS.filter(f => f.enabled),
    ...CARZ_FEEDS.filter(f => f.enabled),
    ...VASSDISTRO_FEEDS.filter(f => f.enabled)
  ];

  const results: FeedAnalysis[] = [];

  // Analyze feeds one at a time to avoid rate limiting
  for (const feed of allFeeds) {
    const analysis = await analyzeFeed(feed);
    results.push(analysis);

    // Wait 1 second between requests to be polite
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Group by category
  const ownerfiResults = results.filter(r => r.category === 'ownerfi');
  const carzResults = results.filter(r => r.category === 'carz');
  const vassdistroResults = results.filter(r => r.category === 'vassdistro');

  console.log('\n\n' + '='.repeat(80));
  console.log('📈 OWNERFI FEEDS SUMMARY');
  console.log('='.repeat(80));
  printResults(ownerfiResults);

  console.log('\n\n' + '='.repeat(80));
  console.log('🚗 CARZ FEEDS SUMMARY');
  console.log('='.repeat(80));
  printResults(carzResults);

  console.log('\n\n' + '='.repeat(80));
  console.log('💨 VASS DISTRO FEEDS SUMMARY');
  console.log('='.repeat(80));
  printResults(vassdistroResults);

  // Overall stats
  const goodFeeds = results.filter(r => r.hasFullContent);
  const poorFeeds = results.filter(r => !r.hasFullContent && r.totalArticles > 0);

  console.log('\n\n' + '='.repeat(80));
  console.log('🎯 OVERALL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total feeds analyzed: ${results.length}`);
  console.log(`✅ Feeds with FULL content (>500 chars avg): ${goodFeeds.length}`);
  console.log(`⚠️  Feeds with SNIPPETS only (<500 chars avg): ${poorFeeds.length}`);
  console.log(`❌ Feeds with errors: ${results.filter(r => r.totalArticles === 0).length}`);

  console.log('\n\n📝 RECOMMENDED ACTIONS:');
  console.log('='.repeat(80));

  if (poorFeeds.length > 0) {
    console.log('\n⚠️  Consider disabling these snippet-only feeds:');
    poorFeeds.forEach(feed => {
      console.log(`   - ${feed.feedName} (avg: ${feed.avgContentLength} chars)`);
    });
  }

  console.log('\n✅ Keep these feeds (they provide full content):');
  goodFeeds.slice(0, 10).forEach(feed => {
    console.log(`   - ${feed.feedName} (avg: ${feed.avgContentLength} chars)`);
  });
}

function printResults(results: FeedAnalysis[]) {
  const sorted = results.sort((a, b) => b.avgContentLength - a.avgContentLength);

  console.log('\nFeed Name'.padEnd(50) + 'Articles'.padEnd(12) + 'Avg Content'.padEnd(15) + 'Status');
  console.log('-'.repeat(80));

  sorted.forEach(result => {
    const status = result.hasFullContent ? '✅ Full' :
                   result.totalArticles === 0 ? '❌ Error' : '⚠️  Snippet';

    const name = result.feedName.length > 47
      ? result.feedName.substring(0, 44) + '...'
      : result.feedName;

    console.log(
      name.padEnd(50) +
      result.totalArticles.toString().padEnd(12) +
      `${result.avgContentLength} chars`.padEnd(15) +
      status
    );
  });

  const avgContent = sorted.length > 0
    ? Math.round(sorted.reduce((sum, r) => sum + r.avgContentLength, 0) / sorted.length)
    : 0;

  console.log('\n📊 Category Average: ' + avgContent + ' chars');
}

// Run analysis
analyzeAllFeeds().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
