// Manually fetch VassDistro RSS articles
import { getAllFeedSources } from '../src/lib/feed-store-firestore';
import { processFeedSource } from '../src/lib/rss-fetcher';

async function fetchVassDistro() {
  console.log('🚀 Fetching VassDistro articles...\n');

  const allFeeds = await getAllFeedSources();
  const vassdistroFeeds = allFeeds.filter(f => f.category === 'vassdistro' && f.enabled);

  console.log(`Found ${vassdistroFeeds.length} enabled VassDistro feeds\n`);

  for (const feed of vassdistroFeeds) {
    console.log(`📡 Fetching: ${feed.name}`);
    try {
      const result = await processFeedSource(feed);
      console.log(`✅ Processed ${feed.name}:`);
      console.log(`   New articles: ${result.newArticles}`);
      console.log(`   Total items: ${result.totalItems}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${feed.name}:`, error);
    }
    console.log('');
  }

  console.log('✅ VassDistro fetch complete!');
}

fetchVassDistro()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
