/**
 * Test script for new Carz RSS feeds
 * Tests all 4 new feeds to verify quality and content length
 */

import Parser from 'rss-parser';

const parser = new Parser();

interface FeedTest {
  id: string;
  name: string;
  url: string;
  minContentLength: number; // Minimum acceptable content length
}

const NEW_FEEDS: FeedTest[] = [
  {
    id: 'carz-evannex',
    name: 'EVANNEX Blog',
    url: 'https://evannex.com/blogs/news.atom',
    minContentLength: 1000,
  },
  {
    id: 'carz-insideevs',
    name: 'InsideEVs',
    url: 'https://insideevs.com/feed/',
    minContentLength: 100, // Lower threshold - good for headlines, volume compensates
  },
  {
    id: 'carz-teslarati',
    name: 'Teslarati',
    url: 'https://www.teslarati.com/feed/',
    minContentLength: 1000,
  },
  {
    id: 'carz-notateslaapp',
    name: 'Not a Tesla App',
    url: 'https://www.notateslaapp.com/feed/',
    minContentLength: 1000,
  },
];

interface TestResult {
  feedName: string;
  success: boolean;
  articlesFound: number;
  avgContentLength: number;
  sampleTitles: string[];
  quality: 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR' | 'FAILED';
  error?: string;
}

async function testFeed(feed: FeedTest): Promise<TestResult> {
  console.log(`\n🔍 Testing: ${feed.name}`);
  console.log(`   URL: ${feed.url}`);

  try {
    const rss = await parser.parseURL(feed.url);

    if (!rss.items || rss.items.length === 0) {
      return {
        feedName: feed.name,
        success: false,
        articlesFound: 0,
        avgContentLength: 0,
        sampleTitles: [],
        quality: 'FAILED',
        error: 'No articles found',
      };
    }

    // Calculate content lengths
    const contentLengths = rss.items.slice(0, 10).map(item => {
      const content = item.content || item['content:encoded'] || item.contentSnippet || item.summary || '';
      return content.length;
    });

    const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
    const sampleTitles = rss.items.slice(0, 3).map(item => item.title || 'Untitled');

    // Determine quality
    let quality: 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR' = 'POOR';
    if (avgLength >= 2000) quality = 'EXCELLENT';
    else if (avgLength >= 1000) quality = 'GOOD';
    else if (avgLength >= 500) quality = 'ADEQUATE';

    const success = avgLength >= feed.minContentLength;

    console.log(`   ✅ Articles found: ${rss.items.length}`);
    console.log(`   📊 Avg content length: ${Math.round(avgLength)} chars`);
    console.log(`   🎯 Quality: ${quality}`);
    console.log(`   📝 Sample titles:`);
    sampleTitles.forEach(title => console.log(`      - ${title}`));

    return {
      feedName: feed.name,
      success,
      articlesFound: rss.items.length,
      avgContentLength: Math.round(avgLength),
      sampleTitles,
      quality,
    };

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      feedName: feed.name,
      success: false,
      articlesFound: 0,
      avgContentLength: 0,
      sampleTitles: [],
      quality: 'FAILED',
      error: error.message,
    };
  }
}

async function testAllFeeds() {
  console.log('🚀 Testing new Carz RSS feeds\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: TestResult[] = [];

  for (const feed of NEW_FEEDS) {
    const result = await testFeed(feed);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST SUMMARY\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total feeds tested: ${results.length}`);
  console.log(`✅ Passed: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('✅ PASSED FEEDS:\n');
    successful.forEach(r => {
      console.log(`   ${r.feedName}`);
      console.log(`   - Quality: ${r.quality}`);
      console.log(`   - Articles: ${r.articlesFound}`);
      console.log(`   - Avg length: ${r.avgContentLength} chars\n`);
    });
  }

  if (failed.length > 0) {
    console.log('❌ FAILED FEEDS:\n');
    failed.forEach(r => {
      console.log(`   ${r.feedName}`);
      console.log(`   - Error: ${r.error || 'Below minimum quality threshold'}`);
      console.log(`   - Avg length: ${r.avgContentLength} chars\n`);
    });
  }

  // Overall assessment
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (successful.length === results.length) {
    console.log('🎉 ALL FEEDS PASSED! Safe to deploy.');
  } else if (successful.length >= results.length * 0.75) {
    console.log('⚠️  MOSTLY PASSED. Consider deploying successful feeds only.');
  } else {
    console.log('❌ TOO MANY FAILURES. Do not deploy until fixed.');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Exit with appropriate code
  process.exit(failed.length === 0 ? 0 : 1);
}

testAllFeeds().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
