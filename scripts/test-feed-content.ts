#!/usr/bin/env tsx
// Quick test to see what content your RSS feeds actually provide

import { fetchRSSFeed } from '../src/lib/rss-fetcher';

async function testFeed(name: string, url: string) {
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   URL: ${url}\n`);

  try {
    const feed = await fetchRSSFeed(url);

    if (feed.items.length === 0) {
      console.log('   ❌ No items found in feed');
      return;
    }

    console.log(`   ✅ Found ${feed.items.length} items`);

    // Check first 3 items
    const itemsToCheck = feed.items.slice(0, 3);

    itemsToCheck.forEach((item, index) => {
      const contentLength = (item.content || '').length;
      const descLength = (item.description || '').length;
      const title = item.title.substring(0, 50);

      const wordCount = contentLength > 0 ? item.content!.split(/\s+/).length : 0;

      console.log(`\n   ${index + 1}. "${title}..."`);
      console.log(`      Content: ${contentLength} chars (~${wordCount} words) ${contentLength > 0 ? '✅' : '❌'}`);
      console.log(`      Description: ${descLength} chars`);

      if (contentLength > 0) {
        console.log(`      Preview: ${item.content!.substring(0, 100)}...`);
      } else if (descLength > 0) {
        console.log(`      Preview: ${item.description!.substring(0, 100)}...`);
      }
    });

    const avgContent = itemsToCheck.reduce((sum, item) => sum + (item.content || '').length, 0) / itemsToCheck.length;
    const status = avgContent > 500 ? '✅ GOOD (full content)' :
                   avgContent > 200 ? '⚠️  OK (medium content)' :
                   '❌ BAD (snippets only)';

    console.log(`\n   📊 Average content: ${Math.round(avgContent)} chars - ${status}`);

  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function main() {
  console.log('=' .repeat(80));
  console.log('RSS FEED CONTENT TEST');
  console.log('=' .repeat(80));

  // Test a few OwnerFi feeds
  await testFeed(
    'HousingWire - Housing Market News',
    'https://www.housingwire.com/feed/'
  );

  await testFeed(
    'Mortgage News Daily',
    'https://www.mortgagenewsdaily.com/rss'
  );

  await testFeed(
    'Realtor.com - News & Insights',
    'https://www.realtor.com/news/feed/'
  );

  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATION:');
  console.log('   - Keep feeds marked ✅ GOOD');
  console.log('   - Consider disabling feeds marked ❌ BAD');
  console.log('   - Feeds marked ⚠️  OK might work but may need manual review');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
