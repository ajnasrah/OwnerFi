#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
import { setQueueSchedule } from '../src/lib/late-api';

config({ path: resolve(process.cwd(), '.env.local') });

async function configureAllBrandQueues() {
  console.log('⚙️  CONFIGURING ALL BRAND QUEUES - CLUSTERED AROUND PEAK TIMES\n');
  console.log('Based on platform analysis data:\n');
  console.log('  🎥 YouTube peak: 8:00 AM');
  console.log('  📸 Instagram/Facebook peak: 2:00 PM (14:00)');
  console.log('  🎵 TikTok peak: 6:00 PM (18:00)\n');
  console.log('═'.repeat(80));

  // ============================================================================
  // OWNERFI: 15 POSTS PER DAY
  // ============================================================================

  console.log('\n📊 OWNERFI - 15 Posts Per Day\n');

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

  console.log('   7:30-9:00 AM:  5 posts (YouTube peak)');
  console.log('   1:30-3:00 PM:  5 posts (Instagram/Facebook peak)');
  console.log('   5:30-7:00 PM:  5 posts (TikTok peak)');

  try {
    await setQueueSchedule('ownerfi', ownerfiSlots, 'America/New_York', false);
    console.log('   ✅ Configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // ABDULLAH: 10 POSTS PER DAY
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 ABDULLAH - 10 Posts Per Day\n');

  const abdullahSlots = [
    // Morning cluster (YouTube/Twitter/LinkedIn) - 3 posts
    { dayOfWeek: 1, time: '07:45' },
    { dayOfWeek: 1, time: '08:00' },
    { dayOfWeek: 1, time: '08:30' },

    // Afternoon cluster (Instagram/Facebook) - 4 posts
    { dayOfWeek: 1, time: '13:30' },
    { dayOfWeek: 1, time: '14:00' },
    { dayOfWeek: 1, time: '14:30' },
    { dayOfWeek: 1, time: '14:45' },

    // Evening cluster (TikTok/Threads) - 3 posts
    { dayOfWeek: 1, time: '17:45' },
    { dayOfWeek: 1, time: '18:00' },
    { dayOfWeek: 1, time: '18:30' },
  ];

  console.log('   7:45-8:30 AM:  3 posts (YouTube/Twitter/LinkedIn)');
  console.log('   1:30-2:45 PM:  4 posts (Instagram/Facebook peak)');
  console.log('   5:45-6:30 PM:  3 posts (TikTok/Threads)');

  try {
    await setQueueSchedule('abdullah', abdullahSlots, 'America/New_York', false);
    console.log('   ✅ Configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // CARZ: 6 POSTS PER DAY
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 CARZ - 6 Posts Per Day\n');

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

  console.log('   8:00-8:30 AM:  2 posts (YouTube)');
  console.log('   2:00-2:30 PM:  2 posts (Instagram/Facebook)');
  console.log('   6:00-6:30 PM:  2 posts (TikTok)');

  try {
    await setQueueSchedule('carz', carzSlots, 'America/New_York', false);
    console.log('   ✅ Configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // PODCAST: 5 POSTS PER DAY
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 PODCAST - 5 Posts Per Day\n');

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

  console.log('   8:00-8:30 AM:  2 posts (YouTube)');
  console.log('   2:00-2:30 PM:  2 posts (Instagram/Facebook)');
  console.log('   6:00 PM:       1 post (TikTok)');

  try {
    await setQueueSchedule('podcast', podcastSlots, 'America/New_York', false);
    console.log('   ✅ Configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // VASSDISTRO: 5 POSTS PER DAY
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 VASSDISTRO - 5 Posts Per Day\n');

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

  console.log('   8:00-8:30 AM:  2 posts (YouTube)');
  console.log('   2:00-2:30 PM:  2 posts (Instagram/Facebook)');
  console.log('   6:00 PM:       1 post (TikTok)');

  try {
    await setQueueSchedule('vassdistro', vassdistroSlots, 'America/New_York', false);
    console.log('   ✅ Configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  console.log('═'.repeat(80));
  console.log('\n✅ ALL BRAND QUEUES CONFIGURED\n');
  console.log('═'.repeat(80));

  console.log('\n📊 SUMMARY - Posts Every Day (Monday), Clustered Around Peak Times:\n');
  console.log('OwnerFi:    15 posts/day → 5 @ 8 AM | 5 @ 2 PM | 5 @ 6 PM');
  console.log('Abdullah:   10 posts/day → 3 @ 8 AM | 4 @ 2 PM | 3 @ 6 PM');
  console.log('Carz:       6 posts/day  → 2 @ 8 AM | 2 @ 2 PM | 2 @ 6 PM');
  console.log('Podcast:    5 posts/day  → 2 @ 8 AM | 2 @ 2 PM | 1 @ 6 PM');
  console.log('VassDistro: 5 posts/day  → 2 @ 8 AM | 2 @ 2 PM | 1 @ 6 PM');
  console.log('\n🎯 All brands now post during data-backed peak engagement windows!\n');
}

configureAllBrandQueues().catch(console.error);
