#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
import { setQueueSchedule } from '../src/lib/late-api';

config({ path: resolve(process.cwd(), '.env.local') });

async function configureOwnerFiQueue() {
  console.log('⚙️  CONFIGURING OWNERFI LATE.DEV QUEUE\n');
  console.log('═'.repeat(80));

  // Based on platform analysis:
  // Instagram best time: Tuesday 10:00 AM (7/20 top posts on Tuesday)
  // YouTube best time: Thursday 8:00 AM (but we'll focus on Instagram for OwnerFi)

  // Strategy: 3 posts in 15-minute increments around peak time
  // 9:45 AM, 10:00 AM, 10:15 AM on Tuesday

  const slots = [
    { dayOfWeek: 2, time: '09:45' }, // Tuesday 9:45 AM
    { dayOfWeek: 2, time: '10:00' }, // Tuesday 10:00 AM (peak)
    { dayOfWeek: 2, time: '10:15' }, // Tuesday 10:15 AM
  ];

  console.log('\n📅 Queue Schedule:');
  console.log('   Tuesday 9:45 AM  - Post 1');
  console.log('   Tuesday 10:00 AM - Post 2 (Peak Time)');
  console.log('   Tuesday 10:15 AM - Post 3');

  console.log('\n🌎 Timezone: America/New_York');
  console.log('\n🔄 Reshuffle existing posts in queue: false');

  console.log('\n' + '═'.repeat(80));
  console.log('\nConfiguring Late.dev queue for OwnerFi...\n');

  try {
    const result = await setQueueSchedule(
      'ownerfi',
      slots,
      'America/New_York',
      false // Don't reshuffle existing posts
    );

    console.log('✅ SUCCESS! Queue configured.\n');
    console.log('Response:', JSON.stringify(result, null, 2));

    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 WHAT THIS MEANS:\n');
    console.log('Future OwnerFi posts will automatically schedule to these times:');
    console.log('   - Every Tuesday at 9:45 AM');
    console.log('   - Every Tuesday at 10:00 AM');
    console.log('   - Every Tuesday at 10:15 AM');
    console.log('\nThe queue will cycle through these 3 slots.');
    console.log('Posts will be spread across the peak engagement window.');

    console.log('\n' + '═'.repeat(80));
  } catch (error) {
    console.error('❌ ERROR:', error);
    throw error;
  }
}

configureOwnerFiQueue().catch(console.error);
