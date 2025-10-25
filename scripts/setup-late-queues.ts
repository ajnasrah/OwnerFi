#!/usr/bin/env tsx
/**
 * Setup Late Queue Schedules
 *
 * This script configures posting queue schedules for each brand profile in Late.
 * You can customize the time slots for each brand to control when posts are published.
 *
 * Usage:
 *   npm run setup-queues
 *
 * Or to run directly:
 *   npx tsx scripts/setup-late-queues.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Debug: Check if env vars are loaded
console.log('🔍 Environment check:');
console.log('  LATE_API_KEY:', process.env.LATE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  LATE_OWNERFI_PROFILE_ID:', process.env.LATE_OWNERFI_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('  LATE_CARZ_PROFILE_ID:', process.env.LATE_CARZ_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('  LATE_PODCAST_PROFILE_ID:', process.env.LATE_PODCAST_PROFILE_ID ? '✅ Set' : '❌ Missing');
console.log('');

import { setQueueSchedule, getQueueSchedule } from '../src/lib/late-api';

// Queue configurations for each brand
// dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
// time: 24-hour format "HH:MM"

// 5 TIMES PER DAY - DAILY POSTING
const OWNERFI_QUEUE = {
  timezone: 'America/New_York',
  slots: [
    // Monday
    { dayOfWeek: 1, time: '09:00' }, // 9 AM
    { dayOfWeek: 1, time: '12:00' }, // 12 PM
    { dayOfWeek: 1, time: '15:00' }, // 3 PM
    { dayOfWeek: 1, time: '18:00' }, // 6 PM
    { dayOfWeek: 1, time: '21:00' }, // 9 PM
    // Tuesday
    { dayOfWeek: 2, time: '09:00' },
    { dayOfWeek: 2, time: '12:00' },
    { dayOfWeek: 2, time: '15:00' },
    { dayOfWeek: 2, time: '18:00' },
    { dayOfWeek: 2, time: '21:00' },
    // Wednesday
    { dayOfWeek: 3, time: '09:00' },
    { dayOfWeek: 3, time: '12:00' },
    { dayOfWeek: 3, time: '15:00' },
    { dayOfWeek: 3, time: '18:00' },
    { dayOfWeek: 3, time: '21:00' },
    // Thursday
    { dayOfWeek: 4, time: '09:00' },
    { dayOfWeek: 4, time: '12:00' },
    { dayOfWeek: 4, time: '15:00' },
    { dayOfWeek: 4, time: '18:00' },
    { dayOfWeek: 4, time: '21:00' },
    // Friday
    { dayOfWeek: 5, time: '09:00' },
    { dayOfWeek: 5, time: '12:00' },
    { dayOfWeek: 5, time: '15:00' },
    { dayOfWeek: 5, time: '18:00' },
    { dayOfWeek: 5, time: '21:00' },
    // Saturday
    { dayOfWeek: 6, time: '10:00' }, // 10 AM (weekend)
    { dayOfWeek: 6, time: '13:00' }, // 1 PM
    { dayOfWeek: 6, time: '16:00' }, // 4 PM
    { dayOfWeek: 6, time: '19:00' }, // 7 PM
    { dayOfWeek: 6, time: '21:00' }, // 9 PM
    // Sunday
    { dayOfWeek: 0, time: '10:00' },
    { dayOfWeek: 0, time: '13:00' },
    { dayOfWeek: 0, time: '16:00' },
    { dayOfWeek: 0, time: '19:00' },
    { dayOfWeek: 0, time: '21:00' },
  ]
};

const CARZ_QUEUE = {
  timezone: 'America/New_York',
  slots: [
    // Monday
    { dayOfWeek: 1, time: '09:00' }, // 9 AM (same as OwnerFi)
    { dayOfWeek: 1, time: '12:00' }, // 12 PM
    { dayOfWeek: 1, time: '15:00' }, // 3 PM
    { dayOfWeek: 1, time: '18:00' }, // 6 PM
    { dayOfWeek: 1, time: '21:00' }, // 9 PM
    // Tuesday
    { dayOfWeek: 2, time: '09:00' },
    { dayOfWeek: 2, time: '12:00' },
    { dayOfWeek: 2, time: '15:00' },
    { dayOfWeek: 2, time: '18:00' },
    { dayOfWeek: 2, time: '21:00' },
    // Wednesday
    { dayOfWeek: 3, time: '09:00' },
    { dayOfWeek: 3, time: '12:00' },
    { dayOfWeek: 3, time: '15:00' },
    { dayOfWeek: 3, time: '18:00' },
    { dayOfWeek: 3, time: '21:00' },
    // Thursday
    { dayOfWeek: 4, time: '09:00' },
    { dayOfWeek: 4, time: '12:00' },
    { dayOfWeek: 4, time: '15:00' },
    { dayOfWeek: 4, time: '18:00' },
    { dayOfWeek: 4, time: '21:00' },
    // Friday
    { dayOfWeek: 5, time: '09:00' },
    { dayOfWeek: 5, time: '12:00' },
    { dayOfWeek: 5, time: '15:00' },
    { dayOfWeek: 5, time: '18:00' },
    { dayOfWeek: 5, time: '21:00' },
    // Saturday
    { dayOfWeek: 6, time: '10:00' }, // 10 AM (weekend)
    { dayOfWeek: 6, time: '13:00' }, // 1 PM
    { dayOfWeek: 6, time: '16:00' }, // 4 PM
    { dayOfWeek: 6, time: '19:00' }, // 7 PM
    { dayOfWeek: 6, time: '21:00' }, // 9 PM
    // Sunday
    { dayOfWeek: 0, time: '10:00' },
    { dayOfWeek: 0, time: '13:00' },
    { dayOfWeek: 0, time: '16:00' },
    { dayOfWeek: 0, time: '19:00' },
    { dayOfWeek: 0, time: '21:00' },
  ]
};

const PODCAST_QUEUE = {
  timezone: 'America/Chicago', // Central Time (CDT) for podcasts
  slots: [
    // Monday - Offset by 1 hour from Carz/OwnerFi (10 AM, 1 PM, 4 PM, 7 PM, 10 PM CST)
    { dayOfWeek: 1, time: '10:00' }, // 10 AM CST = 11 AM EST
    { dayOfWeek: 1, time: '13:00' }, // 1 PM CST = 2 PM EST
    { dayOfWeek: 1, time: '16:00' }, // 4 PM CST = 5 PM EST
    { dayOfWeek: 1, time: '19:00' }, // 7 PM CST = 8 PM EST
    { dayOfWeek: 1, time: '22:00' }, // 10 PM CST = 11 PM EST
    // Tuesday
    { dayOfWeek: 2, time: '10:00' },
    { dayOfWeek: 2, time: '13:00' },
    { dayOfWeek: 2, time: '16:00' },
    { dayOfWeek: 2, time: '19:00' },
    { dayOfWeek: 2, time: '22:00' },
    // Wednesday
    { dayOfWeek: 3, time: '10:00' },
    { dayOfWeek: 3, time: '13:00' },
    { dayOfWeek: 3, time: '16:00' },
    { dayOfWeek: 3, time: '19:00' },
    { dayOfWeek: 3, time: '22:00' },
    // Thursday
    { dayOfWeek: 4, time: '10:00' },
    { dayOfWeek: 4, time: '13:00' },
    { dayOfWeek: 4, time: '16:00' },
    { dayOfWeek: 4, time: '19:00' },
    { dayOfWeek: 4, time: '22:00' },
    // Friday
    { dayOfWeek: 5, time: '10:00' },
    { dayOfWeek: 5, time: '13:00' },
    { dayOfWeek: 5, time: '16:00' },
    { dayOfWeek: 5, time: '19:00' },
    { dayOfWeek: 5, time: '22:00' },
    // Saturday
    { dayOfWeek: 6, time: '11:00' }, // 11 AM (weekend)
    { dayOfWeek: 6, time: '14:00' }, // 2 PM
    { dayOfWeek: 6, time: '17:00' }, // 5 PM
    { dayOfWeek: 6, time: '20:00' }, // 8 PM
    { dayOfWeek: 6, time: '22:00' }, // 10 PM
    // Sunday
    { dayOfWeek: 0, time: '11:00' },
    { dayOfWeek: 0, time: '14:00' },
    { dayOfWeek: 0, time: '17:00' },
    { dayOfWeek: 0, time: '20:00' },
    { dayOfWeek: 0, time: '22:00' },
  ]
};

async function setupQueue(brand: 'carz' | 'ownerfi' | 'podcast', config: typeof OWNERFI_QUEUE) {
  console.log(`\n📅 Setting up queue for ${brand.toUpperCase()}...`);
  console.log(`   Timezone: ${config.timezone}`);
  console.log(`   Slots: ${config.slots.length} per week`);

  config.slots.forEach(slot => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    console.log(`   - ${days[slot.dayOfWeek]} at ${slot.time}`);
  });

  try {
    const result = await setQueueSchedule(
      brand,
      config.slots,
      config.timezone,
      false // Set to true if you want to reshuffle existing queued posts
    );

    console.log(`✅ Queue configured successfully!`);

    if (result.nextSlots && result.nextSlots.length > 0) {
      console.log(`   Next 3 slots:`);
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

async function viewCurrentQueues() {
  console.log('\n📋 Current Queue Configurations:\n');

  for (const brand of ['ownerfi', 'carz', 'podcast'] as const) {
    try {
      const schedule = await getQueueSchedule(brand);

      if (schedule.exists) {
        console.log(`${brand.toUpperCase()}:`);
        console.log(`  Status: ${schedule.schedule.active ? '✅ Active' : '⏸️  Inactive'}`);
        console.log(`  Timezone: ${schedule.schedule.timezone}`);
        console.log(`  Slots: ${schedule.schedule.slots.length} per week`);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        schedule.schedule.slots.forEach((slot: any) => {
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

async function main() {
  console.log('🚀 Late Queue Setup Script\n');

  const args = process.argv.slice(2);

  if (args.includes('--view') || args.includes('-v')) {
    await viewCurrentQueues();
    return;
  }

  console.log('This script will configure posting queues for all brands.');
  console.log('You can customize the schedule by editing this file.\n');

  // Set up queues for each brand (Benefits uses OwnerFi profile)
  const results = await Promise.all([
    setupQueue('ownerfi', OWNERFI_QUEUE),
    setupQueue('carz', CARZ_QUEUE),
    setupQueue('podcast', PODCAST_QUEUE)
  ]);

  const successCount = results.filter(r => r).length;

  console.log('\n' + '='.repeat(60));
  if (successCount === 3) {
    console.log('✅ All 3 queues configured successfully!');
    console.log('   Note: OwnerFi queue handles both viral videos AND benefit videos');
  } else {
    console.log(`⚠️  ${successCount}/3 queues configured successfully`);
  }
  console.log('='.repeat(60));

  console.log('\n💡 Tips:');
  console.log('  - View current queues: npm run setup-queues -- --view');
  console.log('  - Manage queues visually: https://getlate.dev/dashboard');
  console.log('  - Posts will automatically use the next available slot');
  console.log('  - You can change schedules anytime without affecting existing posts\n');
}

main().catch(console.error);
