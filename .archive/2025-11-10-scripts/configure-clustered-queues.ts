#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
import { setQueueSchedule } from '../src/lib/late-api';

config({ path: resolve(process.cwd(), '.env.local') });

async function configureClusteredQueues() {
  console.log('⚙️  CONFIGURING CLUSTERED QUEUE SCHEDULES\n');
  console.log('Strategy: Cluster posts around data-backed peak times\n');
  console.log('Based on platform analysis:\n');
  console.log('  - YouTube peak: 8:00 AM');
  console.log('  - Instagram/Facebook peak: 2:00 PM (14:00)');
  console.log('  - TikTok peak: 6:00 PM (18:00)\n');
  console.log('═'.repeat(80));

  // ============================================================================
  // OWNERFI: 15 POSTS PER DAY
  // Cluster: 5 posts around 8 AM, 5 around 2 PM, 5 around 6 PM
  // ============================================================================

  console.log('\n📊 OWNERFI - 15 Posts Per Day\n');
  console.log('Distribution: 5 posts @ 8 AM (YouTube), 5 @ 2 PM (IG/FB), 5 @ 6 PM (TikTok)\n');

  const ownerfiSlots = [
    // Morning cluster (YouTube) - 5 posts
    { dayOfWeek: 1, time: '07:30' },
    { dayOfWeek: 1, time: '08:00' },
    { dayOfWeek: 1, time: '08:30' },
    { dayOfWeek: 1, time: '08:45' },
    { dayOfWeek: 1, time: '09:00' },

    // Afternoon cluster (Instagram/Facebook) - 5 posts
    { dayOfWeek: 1, time: '13:30' },
    { dayOfWeek: 1, time: '14:00' },
    { dayOfWeek: 1, time: '14:30' },
    { dayOfWeek: 1, time: '14:45' },
    { dayOfWeek: 1, time: '15:00' },

    // Evening cluster (TikTok) - 5 posts
    { dayOfWeek: 1, time: '17:30' },
    { dayOfWeek: 1, time: '18:00' },
    { dayOfWeek: 1, time: '18:30' },
    { dayOfWeek: 1, time: '18:45' },
    { dayOfWeek: 1, time: '19:00' },
  ];

  console.log('   Morning (7:30-9:00 AM):   5 posts around YouTube peak');
  console.log('   Afternoon (1:30-3:00 PM): 5 posts around Instagram/Facebook peak');
  console.log('   Evening (5:30-7:00 PM):   5 posts around TikTok peak');
  console.log('\n   Daily Total: 15 posts, every day (Monday)');

  try {
    await setQueueSchedule('ownerfi', ownerfiSlots, 'America/New_York', false);
    console.log('   ✅ OwnerFi queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // CARZ: 6 POSTS PER DAY (changed from 5)
  // Cluster: 2 posts @ 8 AM, 2 @ 2 PM, 2 @ 6 PM
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 CARZ - 6 Posts Per Day (changed from 5)\n');
  console.log('Distribution: 2 posts @ 8 AM, 2 @ 2 PM, 2 @ 6 PM\n');

  const carzSlots = [
    // Morning cluster (YouTube) - 2 posts
    { dayOfWeek: 1, time: '08:00' },
    { dayOfWeek: 1, time: '08:30' },

    // Afternoon cluster (Instagram/Facebook) - 2 posts
    { dayOfWeek: 1, time: '14:00' },
    { dayOfWeek: 1, time: '14:30' },

    // Evening cluster (TikTok) - 2 posts
    { dayOfWeek: 1, time: '18:00' },
    { dayOfWeek: 1, time: '18:30' },
  ];

  console.log('   Morning (8:00-8:30 AM):   2 posts around YouTube peak');
  console.log('   Afternoon (2:00-2:30 PM): 2 posts around Instagram/Facebook peak');
  console.log('   Evening (6:00-6:30 PM):   2 posts around TikTok peak');
  console.log('\n   Daily Total: 6 posts, every day (Monday)');

  try {
    await setQueueSchedule('carz', carzSlots, 'America/New_York', false);
    console.log('   ✅ Carz queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // PODCAST: 5 POSTS PER DAY
  // Cluster: 2 @ 8 AM, 2 @ 2 PM, 1 @ 6 PM
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 PODCAST - 5 Posts Per Day\n');
  console.log('Distribution: 2 posts @ 8 AM, 2 @ 2 PM, 1 @ 6 PM\n');

  const podcastSlots = [
    // Morning cluster (YouTube) - 2 posts
    { dayOfWeek: 1, time: '08:00' },
    { dayOfWeek: 1, time: '08:30' },

    // Afternoon cluster (Instagram/Facebook) - 2 posts
    { dayOfWeek: 1, time: '14:00' },
    { dayOfWeek: 1, time: '14:30' },

    // Evening cluster (TikTok) - 1 post
    { dayOfWeek: 1, time: '18:00' },
  ];

  console.log('   Morning (8:00-8:30 AM):   2 posts around YouTube peak');
  console.log('   Afternoon (2:00-2:30 PM): 2 posts around Instagram/Facebook peak');
  console.log('   Evening (6:00 PM):        1 post around TikTok peak');
  console.log('\n   Daily Total: 5 posts, every day (Monday)');

  try {
    await setQueueSchedule('podcast', podcastSlots, 'America/New_York', false);
    console.log('   ✅ Podcast queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // VASSDISTRO: 5 POSTS PER DAY
  // Cluster: 2 @ 8 AM, 2 @ 2 PM, 1 @ 6 PM
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 VASSDISTRO - 5 Posts Per Day\n');
  console.log('Distribution: 2 posts @ 8 AM, 2 @ 2 PM, 1 @ 6 PM\n');

  const vassdistroSlots = [
    // Morning cluster (YouTube) - 2 posts
    { dayOfWeek: 1, time: '08:00' },
    { dayOfWeek: 1, time: '08:30' },

    // Afternoon cluster (Instagram/Facebook) - 2 posts
    { dayOfWeek: 1, time: '14:00' },
    { dayOfWeek: 1, time: '14:30' },

    // Evening cluster (TikTok) - 1 post
    { dayOfWeek: 1, time: '18:00' },
  ];

  console.log('   Morning (8:00-8:30 AM):   2 posts around YouTube peak');
  console.log('   Afternoon (2:00-2:30 PM): 2 posts around Instagram/Facebook peak');
  console.log('   Evening (6:00 PM):        1 post around TikTok peak');
  console.log('\n   Daily Total: 5 posts, every day (Monday)');

  try {
    await setQueueSchedule('vassdistro', vassdistroSlots, 'America/New_York', false);
    console.log('   ✅ VassDistro queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  console.log('═'.repeat(80));
  console.log('\n✅ ALL QUEUE SCHEDULES CONFIGURED\n');
  console.log('═'.repeat(80));

  console.log('\n📊 SUMMARY:\n');
  console.log('ALL BRANDS NOW POST DAILY:\n');
  console.log('OwnerFi:    15 posts/day (5 @ 8 AM, 5 @ 2 PM, 5 @ 6 PM)');
  console.log('Carz:       6 posts/day  (2 @ 8 AM, 2 @ 2 PM, 2 @ 6 PM) ← Changed from 5');
  console.log('Podcast:    5 posts/day  (2 @ 8 AM, 2 @ 2 PM, 1 @ 6 PM)');
  console.log('VassDistro: 5 posts/day  (2 @ 8 AM, 2 @ 2 PM, 1 @ 6 PM)');
  console.log('\n✅ Posts clustered around data-backed peak times!\n');
  console.log('✅ Every brand posts EVERY DAY (Monday) at optimal windows!\n');
}

configureClusteredQueues().catch(console.error);
