// Test RSS fetcher for all brands
import { fetchRSSFeed, processFeedSource } from '../src/lib/rss-fetcher';
import { getAllFeedSources } from '../src/lib/feed-store-firestore';

async function testRSSFetcher() {
  console.log('🧪 TESTING RSS FETCHER FOR ALL BRANDS\n');
  console.log('='.repeat(60));

  // Test each brand
  const brandsToTest = [
    { name: 'VassDistro', category: 'vassdistro' },
    { name: 'OwnerFi', category: 'ownerfi' },
    { name: 'Carz', category: 'carz' }
  ];

  for (const brand of brandsToTest) {
    console.log(`\n📊 TESTING ${brand.name.toUpperCase()}`);
    console.log('-'.repeat(60));

    try {
      // Get all feeds for this brand
      const allFeeds = await getAllFeedSources();
      const brandFeeds = allFeeds.filter(f => f.category === brand.category && f.enabled);

      if (brandFeeds.length === 0) {
        console.log(`❌ No enabled feeds found for ${brand.name}`);
        continue;
      }

      console.log(`Found ${brandFeeds.length} enabled feed(s)`);

      // Test the first feed
      const testFeed = brandFeeds[0];
      console.log(`\nTesting feed: ${testFeed.name}`);
      console.log(`URL: ${testFeed.url}`);

      // Fetch RSS
      console.log('\n📡 Fetching RSS feed...');
      const feed = await fetchRSSFeed(testFeed.url);

      console.log(`✅ RSS fetched successfully!`);
      console.log(`   Feed title: ${feed.title}`);
      console.log(`   Total items: ${feed.items.length}`);

      if (feed.items.length === 0) {
        console.log('⚠️  Feed has no items!');
        continue;
      }

      // Show first 3 articles
      console.log('\n📰 Sample Articles:');
      const sampleArticles = feed.items.slice(0, 3);

      sampleArticles.forEach((item, index) => {
        console.log(`\n   Article ${index + 1}:`);
        console.log(`   Title: ${item.title.substring(0, 70)}${item.title.length > 70 ? '...' : ''}`);
        console.log(`   Link: ${item.link}`);
        console.log(`   Pub Date: ${item.pubDate || 'N/A'}`);

        const content = item.content || item.description || '';
        const contentLength = content.length;
        console.log(`   Content length: ${contentLength} chars`);

        if (contentLength > 0) {
          const preview = content.substring(0, 150).replace(/\s+/g, ' ');
          console.log(`   Content preview: ${preview}...`);
        } else {
          console.log(`   ⚠️  NO CONTENT!`);
        }

        // Content quality assessment
        if (contentLength === 0) {
          console.log(`   ❌ Quality: FAIL - No content`);
        } else if (contentLength < 200) {
          console.log(`   ⚠️  Quality: POOR - Too short (< 200 chars)`);
        } else if (contentLength < 1000) {
          console.log(`   ✅ Quality: ADEQUATE - Sufficient content`);
        } else {
          console.log(`   ✅ Quality: EXCELLENT - Rich content`);
        }
      });

      // Test processing (saving to Firestore)
      console.log(`\n💾 Testing article processing...`);

      // Temporarily update lastFetched to 0 to force processing all articles
      const originalLastFetched = testFeed.lastFetched;
      testFeed.lastFetched = 0;

      const result = await processFeedSource(testFeed);

      if (result.success) {
        console.log(`✅ Processing successful!`);
        console.log(`   New articles saved: ${result.newArticles}`);
      } else {
        console.log(`❌ Processing failed: ${result.error}`);
      }

      // Restore original lastFetched
      testFeed.lastFetched = originalLastFetched;

    } catch (error) {
      console.log(`❌ Error testing ${brand.name}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ RSS FETCHER TEST COMPLETE\n');
}

testRSSFetcher()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
