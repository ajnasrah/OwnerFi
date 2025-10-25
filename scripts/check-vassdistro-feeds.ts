// Check VassDistro feed status
import { getAllFeedSources } from '../src/lib/feed-store-firestore';

async function checkVassDistroFeeds() {
  console.log('🔍 Checking VassDistro feeds...\n');

  const allFeeds = await getAllFeedSources();
  const vassdistroFeeds = allFeeds.filter(f => f.category === 'vassdistro');

  console.log(`Total feeds in system: ${allFeeds.length}`);
  console.log(`VassDistro feeds: ${vassdistroFeeds.length}\n`);

  if (vassdistroFeeds.length === 0) {
    console.log('❌ No VassDistro feeds found in Firestore!');
    console.log('   Need to initialize feeds from feed-sources.ts');
    return;
  }

  console.log('VassDistro Feeds:');
  vassdistroFeeds.forEach(feed => {
    const lastFetched = feed.lastFetched
      ? new Date(feed.lastFetched).toLocaleString()
      : 'Never';
    console.log(`  - ${feed.name}`);
    console.log(`    URL: ${feed.url}`);
    console.log(`    Enabled: ${feed.enabled}`);
    console.log(`    Last Fetched: ${lastFetched}`);
    console.log(`    Interval: ${feed.fetchInterval} minutes`);
    console.log(`    Articles Processed: ${feed.articlesProcessed || 0}`);
    console.log('');
  });
}

checkVassDistroFeeds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
