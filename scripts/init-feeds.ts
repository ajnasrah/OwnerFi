// Initialize RSS feeds in Firestore
import { initializeFeedSources } from '../src/config/feed-sources';

async function init() {
  console.log('🚀 Initializing RSS feeds...\n');
  await initializeFeedSources();
  console.log('\n✅ Done!');
}

init()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
