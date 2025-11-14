#!/usr/bin/env tsx
/**
 * Trigger Property Queue Sync Cron
 *
 * Manually triggers the sync function to add new properties
 * and remove deleted properties from the queue
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { syncPropertyQueue, getPropertyQueueStats } from '../src/lib/property-workflow';

async function triggerSync() {
  console.log('🔄 Triggering Property Queue Sync\n');
  console.log('='.repeat(70));

  // Get stats before sync
  console.log('\n📊 BEFORE SYNC:');
  const statsBefore = await getPropertyQueueStats();
  console.log(`   Total: ${statsBefore.total}`);
  console.log(`   Queued: ${statsBefore.queued}`);
  console.log(`   Processing: ${statsBefore.processing}`);
  console.log(`   Completed: ${statsBefore.completed}`);

  // Run sync
  console.log('\n🔄 Running sync...');
  const result = await syncPropertyQueue();

  // Get stats after sync
  console.log('\n📊 AFTER SYNC:');
  const statsAfter = await getPropertyQueueStats();
  console.log(`   Total: ${statsAfter.total}`);
  console.log(`   Queued: ${statsAfter.queued}`);
  console.log(`   Processing: ${statsAfter.processing}`);
  console.log(`   Completed: ${statsAfter.completed}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Sync Complete!');
  console.log('='.repeat(70));
  console.log(`\n📈 Changes:`);
  console.log(`   Added: ${result.added} properties`);
  console.log(`   Removed: ${result.removed} properties`);
  console.log(`   Net Change: ${result.added - result.removed > 0 ? '+' : ''}${result.added - result.removed}`);

  if (statsAfter.nextProperty) {
    console.log(`\n🎬 Next property in queue:`);
    console.log(`   ${statsAfter.nextProperty.address}`);
    console.log(`   ${statsAfter.nextProperty.city}, ${statsAfter.nextProperty.state}`);
    console.log(`   Position: ${statsAfter.nextProperty.queuePosition}`);
  }

  console.log('');
}

triggerSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
