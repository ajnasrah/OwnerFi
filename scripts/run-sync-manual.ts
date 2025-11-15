#!/usr/bin/env tsx
/**
 * Manually run property queue sync
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function runSync() {
  console.log('\n🔄 RUNNING PROPERTY QUEUE SYNC');
  console.log('=' .repeat(60));

  try {
    // Import sync function
    const { syncPropertyQueue, getPropertyQueueStats } = await import('../src/lib/property-workflow');

    // Get stats before sync
    console.log('\n📊 Queue before sync:');
    const statsBefore = await getPropertyQueueStats();
    console.log(`   Total: ${statsBefore.total}`);
    console.log(`   Queued: ${statsBefore.queued}`);
    console.log(`   Processing: ${statsBefore.processing}`);
    console.log(`   Completed: ${statsBefore.completed}`);

    // Run sync
    console.log('\n🔄 Running sync...');
    const result = await syncPropertyQueue();

    // Get stats after sync
    console.log('\n📊 Queue after sync:');
    const statsAfter = await getPropertyQueueStats();
    console.log(`   Total: ${statsAfter.total}`);
    console.log(`   Queued: ${statsAfter.queued}`);
    console.log(`   Processing: ${statsAfter.processing}`);
    console.log(`   Completed: ${statsAfter.completed}`);

    console.log(`\n✅ Sync complete!`);
    console.log(`   Added: ${result.added} workflows`);
    console.log(`   Removed: ${result.removed} workflows`);
    console.log(`   Net change: ${result.added - result.removed}`);

    if (statsAfter.nextProperty) {
      console.log(`\n🎬 Next property in queue:`);
      console.log(`   ${statsAfter.nextProperty.address}`);
      console.log(`   ${statsAfter.nextProperty.city}, ${statsAfter.nextProperty.state}`);
      console.log(`   Language: ${statsAfter.nextProperty.language}`);
      console.log(`   Position: ${statsAfter.nextProperty.queuePosition}`);
    }

    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

runSync()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
