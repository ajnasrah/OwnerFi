#!/usr/bin/env tsx
/**
 * STAGGERED Late Queue Schedules - NO BRAND OVERLAP
 *
 * This configuration ensures ZERO overlap between sub-brands.
 * Each brand posts with 15-minute intervals to prevent queue conflicts.
 *
 * KEY PRINCIPLE: No two brands post at the same time - ever.
 *
 * Timing Strategy for 25-40 Demographic:
 * - Morning Window: 7:00 AM - 8:00 AM (4 brands × 15 min apart)
 * - Lunch Window: 12:00 PM - 1:15 PM (5 brands × 15 min apart)
 * - Afternoon Window: 3:00 PM - 4:00 PM (4 brands × 15 min apart)
 * - Evening Window: 5:00 PM - 6:15 PM (5 brands × 15 min apart)
 * - Night Window: 8:00 PM - 9:15 PM (5 brands × 15 min apart)
 * - Late Night Window: 10:30 PM - 11:30 PM (5 brands × 15 min apart)
 *
 * Usage:
 *   npx tsx scripts/setup-late-queues-staggered.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

console.log('🔍 Environment check:');
console.log('  LATE_API_KEY:', process.env.LATE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  LATE_OWNERFI_PROFILE_ID:', process.env.LATE_OWNERFI_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('  LATE_CARZ_PROFILE_ID:', process.env.LATE_CARZ_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('  LATE_PODCAST_PROFILE_ID:', process.env.LATE_PODCAST_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('  LATE_VASSDISTRO_PROFILE_ID:', process.env.LATE_VASSDISTRO_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('  LATE_ABDULLAH_PROFILE_ID:', process.env.LATE_ABDULLAH_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('');

import { setQueueSchedule, getQueueSchedule } from '../src/lib/late-api';

// ============================================================================
// STAGGERED SCHEDULE - ZERO OVERLAP GUARANTEED
// ============================================================================
// All times use 15-minute intervals between brands
// Format: "HH:MM" in 24-hour format
// dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday

/**
 * CARZ INC - Slot 1 (First in each window)
 * Audience: Car enthusiasts, buyers (25-45)
 * Posts at: :00 minutes (7:00, 12:00, 5:00, 8:00, 10:30)
 */
const CARZ_QUEUE_STAGGERED = {
  timezone: 'America/New_York',
  slots: [
    // WEEKDAYS: 5 posts/day - First in each window
    // Monday
    { dayOfWeek: 1, time: '07:00' }, // Morning coffee - SLOT 1
    { dayOfWeek: 1, time: '12:00' }, // Lunch break - SLOT 1
    { dayOfWeek: 1, time: '17:00' }, // Evening commute - SLOT 1
    { dayOfWeek: 1, time: '20:00' }, // Prime time - SLOT 1
    { dayOfWeek: 1, time: '22:30' }, // Late night - SLOT 1

    // Tuesday
    { dayOfWeek: 2, time: '07:00' },
    { dayOfWeek: 2, time: '12:00' },
    { dayOfWeek: 2, time: '17:00' },
    { dayOfWeek: 2, time: '20:00' },
    { dayOfWeek: 2, time: '22:30' },

    // Wednesday
    { dayOfWeek: 3, time: '07:00' },
    { dayOfWeek: 3, time: '12:00' },
    { dayOfWeek: 3, time: '17:00' },
    { dayOfWeek: 3, time: '20:00' },
    { dayOfWeek: 3, time: '22:30' },

    // Thursday
    { dayOfWeek: 4, time: '07:00' },
    { dayOfWeek: 4, time: '12:00' },
    { dayOfWeek: 4, time: '17:00' },
    { dayOfWeek: 4, time: '20:00' },
    { dayOfWeek: 4, time: '22:30' },

    // Friday
    { dayOfWeek: 5, time: '07:00' },
    { dayOfWeek: 5, time: '12:00' },
    { dayOfWeek: 5, time: '17:00' },
    { dayOfWeek: 5, time: '20:00' },
    { dayOfWeek: 5, time: '22:30' },

    // WEEKEND
    // Saturday
    { dayOfWeek: 6, time: '09:00' },
    { dayOfWeek: 6, time: '12:00' },
    { dayOfWeek: 6, time: '15:00' },
    { dayOfWeek: 6, time: '19:00' },
    { dayOfWeek: 6, time: '22:00' },

    // Sunday
    { dayOfWeek: 0, time: '09:00' },
    { dayOfWeek: 0, time: '12:00' },
    { dayOfWeek: 0, time: '15:00' },
    { dayOfWeek: 0, time: '19:00' },
    { dayOfWeek: 0, time: '22:00' },
  ]
};

/**
 * OWNERFI - Slot 2 (+15 min from Carz)
 * Audience: First-time buyers, investors (27-40)
 * Posts at: :15 minutes (7:15, 12:15, 5:15, 8:15, 10:45)
 * Note: Handles Viral + Benefits + Properties (all use same profile)
 */
const OWNERFI_QUEUE_STAGGERED = {
  timezone: 'America/New_York',
  slots: [
    // WEEKDAYS: 5 posts/day - 15 min after Carz
    // Monday
    { dayOfWeek: 1, time: '07:15' }, // +15 min from Carz
    { dayOfWeek: 1, time: '12:15' },
    { dayOfWeek: 1, time: '17:15' },
    { dayOfWeek: 1, time: '20:15' },
    { dayOfWeek: 1, time: '22:45' },

    // Tuesday
    { dayOfWeek: 2, time: '07:15' },
    { dayOfWeek: 2, time: '12:15' },
    { dayOfWeek: 2, time: '17:15' },
    { dayOfWeek: 2, time: '20:15' },
    { dayOfWeek: 2, time: '22:45' },

    // Wednesday
    { dayOfWeek: 3, time: '07:15' },
    { dayOfWeek: 3, time: '12:15' },
    { dayOfWeek: 3, time: '17:15' },
    { dayOfWeek: 3, time: '20:15' },
    { dayOfWeek: 3, time: '22:45' },

    // Thursday
    { dayOfWeek: 4, time: '07:15' },
    { dayOfWeek: 4, time: '12:15' },
    { dayOfWeek: 4, time: '17:15' },
    { dayOfWeek: 4, time: '20:15' },
    { dayOfWeek: 4, time: '22:45' },

    // Friday
    { dayOfWeek: 5, time: '07:15' },
    { dayOfWeek: 5, time: '12:15' },
    { dayOfWeek: 5, time: '17:15' },
    { dayOfWeek: 5, time: '20:15' },
    { dayOfWeek: 5, time: '22:45' },

    // WEEKEND
    // Saturday
    { dayOfWeek: 6, time: '09:15' },
    { dayOfWeek: 6, time: '12:15' },
    { dayOfWeek: 6, time: '15:15' },
    { dayOfWeek: 6, time: '19:15' },
    { dayOfWeek: 6, time: '22:15' },

    // Sunday
    { dayOfWeek: 0, time: '09:15' },
    { dayOfWeek: 0, time: '12:15' },
    { dayOfWeek: 0, time: '15:15' },
    { dayOfWeek: 0, time: '19:15' },
    { dayOfWeek: 0, time: '22:15' },
  ]
};

/**
 * PODCAST - Slot 3 (+30 min from Carz)
 * Audience: Learners, professionals (28-40)
 * Posts at: :30 minutes (7:30, 12:30, 5:30, 8:30, 11:00)
 */
const PODCAST_QUEUE_STAGGERED = {
  timezone: 'America/New_York', // Using EST for clarity (was CST before)
  slots: [
    // WEEKDAYS: 5 posts/day - 30 min after Carz
    // Monday
    { dayOfWeek: 1, time: '07:30' }, // +30 min from Carz
    { dayOfWeek: 1, time: '12:30' },
    { dayOfWeek: 1, time: '17:30' },
    { dayOfWeek: 1, time: '20:30' },
    { dayOfWeek: 1, time: '23:00' },

    // Tuesday
    { dayOfWeek: 2, time: '07:30' },
    { dayOfWeek: 2, time: '12:30' },
    { dayOfWeek: 2, time: '17:30' },
    { dayOfWeek: 2, time: '20:30' },
    { dayOfWeek: 2, time: '23:00' },

    // Wednesday
    { dayOfWeek: 3, time: '07:30' },
    { dayOfWeek: 3, time: '12:30' },
    { dayOfWeek: 3, time: '17:30' },
    { dayOfWeek: 3, time: '20:30' },
    { dayOfWeek: 3, time: '23:00' },

    // Thursday
    { dayOfWeek: 4, time: '07:30' },
    { dayOfWeek: 4, time: '12:30' },
    { dayOfWeek: 4, time: '17:30' },
    { dayOfWeek: 4, time: '20:30' },
    { dayOfWeek: 4, time: '23:00' },

    // Friday
    { dayOfWeek: 5, time: '07:30' },
    { dayOfWeek: 5, time: '12:30' },
    { dayOfWeek: 5, time: '17:30' },
    { dayOfWeek: 5, time: '20:30' },
    { dayOfWeek: 5, time: '23:00' },

    // WEEKEND
    // Saturday
    { dayOfWeek: 6, time: '09:30' },
    { dayOfWeek: 6, time: '12:30' },
    { dayOfWeek: 6, time: '15:30' },
    { dayOfWeek: 6, time: '19:30' },
    { dayOfWeek: 6, time: '22:30' },

    // Sunday
    { dayOfWeek: 0, time: '09:30' },
    { dayOfWeek: 0, time: '12:30' },
    { dayOfWeek: 0, time: '15:30' },
    { dayOfWeek: 0, time: '19:30' },
    { dayOfWeek: 0, time: '22:30' },
  ]
};

/**
 * VASSDISTRO - Slot 4 (+45 min from Carz)
 * Audience: Vape shop owners (25-35, B2B)
 * Posts at: :45 minutes (7:45, 12:45, 5:45, 8:45, 11:15)
 */
const VASSDISTRO_QUEUE_STAGGERED = {
  timezone: 'America/New_York',
  slots: [
    // WEEKDAYS: 5 posts/day - 45 min after Carz
    // Monday
    { dayOfWeek: 1, time: '07:45' }, // +45 min from Carz
    { dayOfWeek: 1, time: '12:45' },
    { dayOfWeek: 1, time: '17:45' },
    { dayOfWeek: 1, time: '20:45' },
    { dayOfWeek: 1, time: '23:15' },

    // Tuesday
    { dayOfWeek: 2, time: '07:45' },
    { dayOfWeek: 2, time: '12:45' },
    { dayOfWeek: 2, time: '17:45' },
    { dayOfWeek: 2, time: '20:45' },
    { dayOfWeek: 2, time: '23:15' },

    // Wednesday
    { dayOfWeek: 3, time: '07:45' },
    { dayOfWeek: 3, time: '12:45' },
    { dayOfWeek: 3, time: '17:45' },
    { dayOfWeek: 3, time: '20:45' },
    { dayOfWeek: 3, time: '23:15' },

    // Thursday
    { dayOfWeek: 4, time: '07:45' },
    { dayOfWeek: 4, time: '12:45' },
    { dayOfWeek: 4, time: '17:45' },
    { dayOfWeek: 4, time: '20:45' },
    { dayOfWeek: 4, time: '23:15' },

    // Friday
    { dayOfWeek: 5, time: '07:45' },
    { dayOfWeek: 5, time: '12:45' },
    { dayOfWeek: 5, time: '17:45' },
    { dayOfWeek: 5, time: '20:45' },
    { dayOfWeek: 5, time: '23:15' },

    // WEEKEND (Reduced B2B activity)
    // Saturday
    { dayOfWeek: 6, time: '09:45' },
    { dayOfWeek: 6, time: '12:45' },
    { dayOfWeek: 6, time: '15:45' },
    { dayOfWeek: 6, time: '19:45' },
    { dayOfWeek: 6, time: '22:45' },

    // Sunday
    { dayOfWeek: 0, time: '09:45' },
    { dayOfWeek: 0, time: '12:45' },
    { dayOfWeek: 0, time: '15:45' },
    { dayOfWeek: 0, time: '19:45' },
    { dayOfWeek: 0, time: '22:45' },
  ]
};

/**
 * ABDULLAH - Slot 5 (+60 min = 1 hour from Carz)
 * Audience: Aspiring entrepreneurs (23-35)
 * Posts at: :00 next hour (8:00, 1:00 PM, 6:00, 9:00, 11:30)
 */
const ABDULLAH_QUEUE_STAGGERED = {
  timezone: 'America/New_York', // Using EST for clarity (was CST before)
  slots: [
    // WEEKDAYS: 5 posts/day - 1 hour after Carz
    // Monday
    { dayOfWeek: 1, time: '08:00' }, // +60 min from Carz
    { dayOfWeek: 1, time: '13:00' },
    { dayOfWeek: 1, time: '18:00' },
    { dayOfWeek: 1, time: '21:00' },
    { dayOfWeek: 1, time: '23:30' },

    // Tuesday
    { dayOfWeek: 2, time: '08:00' },
    { dayOfWeek: 2, time: '13:00' },
    { dayOfWeek: 2, time: '18:00' },
    { dayOfWeek: 2, time: '21:00' },
    { dayOfWeek: 2, time: '23:30' },

    // Wednesday
    { dayOfWeek: 3, time: '08:00' },
    { dayOfWeek: 3, time: '13:00' },
    { dayOfWeek: 3, time: '18:00' },
    { dayOfWeek: 3, time: '21:00' },
    { dayOfWeek: 3, time: '23:30' },

    // Thursday
    { dayOfWeek: 4, time: '08:00' },
    { dayOfWeek: 4, time: '13:00' },
    { dayOfWeek: 4, time: '18:00' },
    { dayOfWeek: 4, time: '21:00' },
    { dayOfWeek: 4, time: '23:30' },

    // Friday
    { dayOfWeek: 5, time: '08:00' },
    { dayOfWeek: 5, time: '13:00' },
    { dayOfWeek: 5, time: '18:00' },
    { dayOfWeek: 5, time: '21:00' },
    { dayOfWeek: 5, time: '23:30' },

    // WEEKEND
    // Saturday
    { dayOfWeek: 6, time: '10:00' },
    { dayOfWeek: 6, time: '13:00' },
    { dayOfWeek: 6, time: '16:00' },
    { dayOfWeek: 6, time: '20:00' },
    { dayOfWeek: 6, time: '23:00' },

    // Sunday
    { dayOfWeek: 0, time: '10:00' },
    { dayOfWeek: 0, time: '13:00' },
    { dayOfWeek: 0, time: '16:00' },
    { dayOfWeek: 0, time: '20:00' },
    { dayOfWeek: 0, time: '23:00' },
  ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function setupQueue(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah',
  config: typeof CARZ_QUEUE_STAGGERED
) {
  console.log(`\n📅 Setting up STAGGERED queue for ${brand.toUpperCase()}...`);
  console.log(`   Timezone: ${config.timezone}`);
  console.log(`   Slots: ${config.slots.length} per week`);
  console.log(`   Strategy: Zero overlap, 15-min intervals\n`);

  // Show first 5 slots as preview
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  console.log(`   Weekday schedule (Mon-Fri):`);
  config.slots.slice(0, 5).forEach(slot => {
    console.log(`   - ${days[slot.dayOfWeek]} at ${slot.time}`);
  });

  try {
    const result = await setQueueSchedule(
      brand,
      config.slots,
      config.timezone,
      false // Set to true if you want to reshuffle existing queued posts
    );

    console.log(`\n✅ Queue configured successfully!`);

    if (result.nextSlots && result.nextSlots.length > 0) {
      console.log(`   Next 3 posting slots:`);
      result.nextSlots.slice(0, 3).forEach((slot: string) => {
        const date = new Date(slot);
        console.log(`   - ${date.toLocaleString('en-US', {
          timeZone: config.timezone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`);
      });
    }

    return true;
  } catch (error) {
    console.error(`❌ Failed to set up queue for ${brand}:`, error);
    return false;
  }
}

async function showStaggeredSchedule() {
  console.log('\n📊 STAGGERED POSTING SCHEDULE - NO OVERLAPS\n');
  console.log('═'.repeat(70));
  console.log('\n🕐 WEEKDAY SCHEDULE (Monday-Friday):\n');

  const schedule = [
    { time: '7:00 AM', brand: 'Carz Inc', content: 'Morning commute motivation' },
    { time: '7:15 AM', brand: 'OwnerFi', content: 'Real estate morning tips' },
    { time: '7:30 AM', brand: 'Podcast', content: 'Morning learning content' },
    { time: '7:45 AM', brand: 'VassDistro', content: 'B2B vape industry news' },
    { time: '8:00 AM', brand: 'Abdullah', content: 'Personal brand motivation' },
    { time: '', brand: '', content: '' },
    { time: '12:00 PM', brand: 'Carz Inc', content: 'Lunch break car content' },
    { time: '12:15 PM', brand: 'OwnerFi', content: 'Property showcase' },
    { time: '12:30 PM', brand: 'Podcast', content: 'Midday education' },
    { time: '12:45 PM', brand: 'VassDistro', content: 'Industry insights' },
    { time: '1:00 PM', brand: 'Abdullah', content: 'Afternoon inspiration' },
    { time: '', brand: '', content: '' },
    { time: '5:00 PM', brand: 'Carz Inc', content: 'Evening commute content' },
    { time: '5:15 PM', brand: 'OwnerFi', content: 'After-work real estate' },
    { time: '5:30 PM', brand: 'Podcast', content: 'Commute listening' },
    { time: '5:45 PM', brand: 'VassDistro', content: 'End of day business' },
    { time: '6:00 PM', brand: 'Abdullah', content: 'Evening motivation' },
    { time: '', brand: '', content: '' },
    { time: '8:00 PM', brand: 'Carz Inc', content: 'Prime time YouTube' },
    { time: '8:15 PM', brand: 'OwnerFi', content: 'Evening research content' },
    { time: '8:30 PM', brand: 'Podcast', content: 'Evening wind-down' },
    { time: '8:45 PM', brand: 'VassDistro', content: 'Business planning' },
    { time: '9:00 PM', brand: 'Abdullah', content: 'Night reflection' },
    { time: '', brand: '', content: '' },
    { time: '10:30 PM', brand: 'Carz Inc', content: 'Late night browsing' },
    { time: '10:45 PM', brand: 'OwnerFi', content: 'Bedtime planning' },
    { time: '11:00 PM', brand: 'Podcast', content: 'Pre-sleep learning' },
    { time: '11:15 PM', brand: 'VassDistro', content: 'Late night business' },
    { time: '11:30 PM', brand: 'Abdullah', content: 'Bedtime mindset' },
  ];

  schedule.forEach(({ time, brand, content }) => {
    if (!time) {
      console.log('');
    } else {
      console.log(`${time.padEnd(10)} │ ${brand.padEnd(12)} │ ${content}`);
    }
  });

  console.log('\n═'.repeat(70));
  console.log('\n✨ KEY BENEFITS:\n');
  console.log('  ✅ ZERO overlap between brands');
  console.log('  ✅ 15-minute intervals = smooth queue flow');
  console.log('  ✅ Covers all peak engagement windows');
  console.log('  ✅ 25 posts/day total (5 brands × 5 posts)');
  console.log('  ✅ Optimized for 25-40 year old demographic');
  console.log('  ✅ No Late.dev API conflicts\n');
}

async function viewCurrentQueues() {
  console.log('\n📋 Current Queue Configurations:\n');

  for (const brand of ['carz', 'ownerfi', 'podcast', 'vassdistro', 'abdullah'] as const) {
    try {
      const schedule = await getQueueSchedule(brand);

      if (schedule.exists) {
        console.log(`${brand.toUpperCase()}:`);
        console.log(`  Status: ${schedule.schedule.active ? '✅ Active' : '⏸️  Inactive'}`);
        console.log(`  Timezone: ${schedule.schedule.timezone}`);
        console.log(`  Slots: ${schedule.schedule.slots.length} per week`);
        console.log(`  First 5 slots:`);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        schedule.schedule.slots.slice(0, 5).forEach((slot: any) => {
          console.log(`    - ${days[slot.dayOfWeek]} at ${slot.time}`);
        });
        console.log('');
      } else {
        console.log(`${brand.toUpperCase()}: ⚠️  No queue configured\n`);
      }
    } catch (error) {
      console.log(`${brand.toUpperCase()}: ❌ Error fetching queue\n`);
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Late Queue Setup - STAGGERED (ZERO OVERLAP)\n');
  console.log('═'.repeat(70));

  const args = process.argv.slice(2);

  if (args.includes('--view') || args.includes('-v')) {
    await viewCurrentQueues();
    return;
  }

  if (args.includes('--schedule') || args.includes('-s')) {
    await showStaggeredSchedule();
    return;
  }

  await showStaggeredSchedule();

  console.log('\n⚠️  IMPORTANT: This will REPLACE your current queue schedules.');
  console.log('   Existing queued posts will NOT be affected.\n');

  console.log('⏳ Setting up queues for all brands...\n');

  // Set up queues for each brand in sequence
  const results = await Promise.all([
    setupQueue('carz', CARZ_QUEUE_STAGGERED),
    setupQueue('ownerfi', OWNERFI_QUEUE_STAGGERED),
    setupQueue('podcast', PODCAST_QUEUE_STAGGERED),
    setupQueue('vassdistro', VASSDISTRO_QUEUE_STAGGERED),
    setupQueue('abdullah', ABDULLAH_QUEUE_STAGGERED),
  ]);

  const successCount = results.filter(r => r).length;

  console.log('\n' + '═'.repeat(70));
  if (successCount === 5) {
    console.log('✅ All 5 queues configured successfully!');
    console.log('   🎯 ZERO overlap - perfect 15-min staggering');
    console.log('   📱 Optimized for 25-40 year old engagement');
  } else {
    console.log(`⚠️  ${successCount}/5 queues configured successfully`);
  }
  console.log('═'.repeat(70));

  console.log('\n💡 Commands:');
  console.log('  • View schedule:  npx tsx scripts/setup-late-queues-staggered.ts --schedule');
  console.log('  • View queues:    npx tsx scripts/setup-late-queues-staggered.ts --view');
  console.log('  • Late dashboard: https://getlate.dev/dashboard\n');

  console.log('📈 What to Monitor:');
  console.log('  • No queue conflicts (check Late dashboard)');
  console.log('  • Engagement per time slot');
  console.log('  • Best performing brands by time');
  console.log('  • Adjust after 7 days of data\n');
}

main().catch(console.error);
