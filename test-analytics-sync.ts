/**
 * Test analytics sync functionality
 */

import { syncAllBrandAnalytics } from './src/lib/late-analytics';

async function testSync() {
  console.log('🧪 Testing analytics sync...\n');

  try {
    await syncAllBrandAnalytics(7);
    console.log('\n✅ Analytics sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Analytics sync failed:', error);
    process.exit(1);
  }
}

testSync();
