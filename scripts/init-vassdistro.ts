// Initialize VassDistro feeds directly
import { VASSDISTRO_FEEDS } from '../src/config/feed-sources';
import { addFeedSource } from '../src/lib/feed-store-firestore';

async function initVassDistro() {
  console.log('🚀 Initializing VassDistro feeds...\n');

  for (const feed of VASSDISTRO_FEEDS) {
    try {
      await addFeedSource(feed);
      console.log(`✅ Added: ${feed.name}`);
    } catch (error) {
      console.error(`❌ Failed to add ${feed.name}:`, error);
    }
  }

  console.log(`\n✅ Initialized ${VASSDISTRO_FEEDS.length} VassDistro feeds`);
}

initVassDistro()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
