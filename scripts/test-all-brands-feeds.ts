/**
 * Test ALL feeds across all brands to ensure they work
 */

import Parser from 'rss-parser';
import { CARZ_FEEDS, OWNERFI_FEEDS, VASSDISTRO_FEEDS } from '../src/config/feed-sources';

const parser = new Parser();

async function testFeed(feed: any) {
  console.log(`\n🔍 Testing: ${feed.name}`);

  try {
    const rss = await parser.parseURL(feed.url);
    const content = rss.items[0]?.content || rss.items[0]?.['content:encoded'] || rss.items[0]?.contentSnippet || '';
    const contentLength = content.length;

    let quality = 'POOR';
    if (contentLength >= 2000) quality = 'EXCELLENT';
    else if (contentLength >= 1000) quality = 'GOOD';
    else if (contentLength >= 500) quality = 'ADEQUATE';

    console.log(`   ✅ SUCCESS - ${rss.items.length} articles`);
    console.log(`   📊 Sample content: ${contentLength} chars (${quality})`);

    return { success: true, feed: feed.name, articles: rss.items.length, quality };
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    return { success: false, feed: feed.name, error: error.message };
  }
}

async function testAllFeeds() {
  console.log('🚀 Testing ALL RSS feeds across all brands\n');
  console.log('═══════════════════════════════════════════\n');

  const results: any[] = [];

  // Test Carz feeds
  console.log('📱 CARZ FEEDS:\n');
  for (const feed of CARZ_FEEDS) {
    const result = await testFeed(feed);
    results.push({ brand: 'carz', ...result });
    await new Promise(r => setTimeout(r, 500));
  }

  // Test OwnerFi feeds
  console.log('\n\n🏠 OWNERFI FEEDS:\n');
  for (const feed of OWNERFI_FEEDS) {
    const result = await testFeed(feed);
    results.push({ brand: 'ownerfi', ...result });
    await new Promise(r => setTimeout(r, 500));
  }

  // Test VassDistro feeds
  console.log('\n\n💨 VASSDISTRO FEEDS:\n');
  for (const feed of VASSDISTRO_FEEDS) {
    const result = await testFeed(feed);
    results.push({ brand: 'vassdistro', ...result });
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📊 FINAL SUMMARY\n');

  const byBrand = {
    carz: results.filter(r => r.brand === 'carz'),
    ownerfi: results.filter(r => r.brand === 'ownerfi'),
    vassdistro: results.filter(r => r.brand === 'vassdistro'),
  };

  Object.entries(byBrand).forEach(([brand, brandResults]) => {
    const passed = brandResults.filter((r: any) => r.success).length;
    const total = brandResults.length;
    const status = passed === total ? '✅' : passed >= total * 0.75 ? '⚠️' : '❌';

    console.log(`${status} ${brand.toUpperCase()}: ${passed}/${total} working`);
  });

  const totalPassed = results.filter(r => r.success).length;
  const totalFeeds = results.length;

  console.log(`\n📊 OVERALL: ${totalPassed}/${totalFeeds} feeds working`);

  if (totalPassed === totalFeeds) {
    console.log('\n🎉 ALL FEEDS WORKING! Ready to deploy.');
  } else if (totalPassed >= totalFeeds * 0.9) {
    console.log('\n✅ 90%+ working. Safe to deploy.');
  } else {
    console.log('\n⚠️  Some feeds failing. Review before deploy.');
  }

  console.log('═══════════════════════════════════════════\n');

  process.exit(totalPassed >= totalFeeds * 0.9 ? 0 : 1);
}

testAllFeeds().catch(console.error);
