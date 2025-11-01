#!/usr/bin/env tsx
/**
 * Delete all existing queues and create new optimized schedules
 * Based on actual content production capacity and analytics
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const LATE_API_KEY = process.env.LATE_API_KEY;

const profiles = {
  carz: {
    id: process.env.LATE_CARZ_PROFILE_ID!,
    slotsPerDay: 5,  // Producing 4.9/day
    timezone: 'America/New_York'
  },
  podcast: {
    id: process.env.LATE_PODCAST_PROFILE_ID!,
    slotsPerDay: 3,  // Producing 2.2/day
    timezone: 'America/New_York'
  },
  abdullah: {
    id: process.env.LATE_ABDULLAH_PROFILE_ID!,
    slotsPerDay: 5,  // Producing 4.2/day
    timezone: 'America/New_York'
  }
};

// Optimized schedules from analytics (UTC hours)
const optimalSchedules = {
  carz: [6, 11, 16, 18, 19],      // Best for Instagram, YouTube, TikTok
  podcast: [12, 15, 18],          // Best for Instagram, YouTube
  abdullah: [0, 9, 15, 18, 21]    // Best for Instagram, YouTube, TikTok
};

async function deleteQueueSlots(profileId: string, profileName: string) {
  console.log(`\n🗑️  Deleting existing queue for ${profileName}...`);

  const response = await fetch(`https://getlate.dev/api/v1/queue/slots?profileId=${profileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete queue slots: ${response.status}`);
  }

  console.log(`   ✅ Deleted existing queue for ${profileName}`);
  return await response.json();
}

async function createQueueSlots(profileId: string, profileName: string, hours: number[], timezone: string) {
  console.log(`\n📅 Creating new queue for ${profileName}...`);
  console.log(`   Setting up ${hours.length} time slots:`);

  hours.forEach(hour => {
    console.log(`      - ${hour.toString().padStart(2, '0')}:00 UTC`);
  });

  // Create slots for each day of the week (0-6)
  // Each slot needs: dayOfWeek (0-6), time (HH:mm)
  const slots = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    for (const hour of hours) {
      slots.push({
        dayOfWeek,
        time: `${hour.toString().padStart(2, '0')}:00`
      });
    }
  }

  console.log(`   Total slots to create: ${slots.length} (${hours.length} times x 7 days)`);

  const payload = {
    profileId: profileId,
    timezone: 'UTC',
    slots: slots,
    reshuffleExisting: false
  };

  console.log(`   Sending payload:`, JSON.stringify(payload, null, 2).substring(0, 500));

  const response = await fetch(`https://getlate.dev/api/v1/queue/slots`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create queue slots: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`   ✅ Created ${hours.length} daily time slots for ${profileName}`);
  return result;
}

async function main() {
  console.log('═'.repeat(100));
  console.log('🔄 RESET & CONFIGURE LATE.DEV QUEUES');
  console.log('═'.repeat(100));
  console.log('\nThis will:');
  console.log('1. Delete all existing queue configurations');
  console.log('2. Create new optimized schedules based on:');
  console.log('   - Your actual content production rate');
  console.log('   - Analytics showing best posting times');
  console.log('   - Multi-platform optimization\n');

  console.log('═'.repeat(100));
  console.log('📊 CONTENT PRODUCTION CAPACITY');
  console.log('═'.repeat(100));
  console.log('\n   CARZ:     4.9 posts/day → Creating 5 slots/day');
  console.log('   PODCAST:  2.2 posts/day → Creating 3 slots/day');
  console.log('   ABDULLAH: 4.2 posts/day → Creating 5 slots/day\n');

  for (const [brand, config] of Object.entries(profiles)) {
    try {
      console.log('\n' + '═'.repeat(100));
      console.log(`📱 ${brand.toUpperCase()}`);
      console.log('═'.repeat(100));

      // Delete existing queue
      await deleteQueueSlots(config.id, brand);

      // Create new optimized queue
      const hours = optimalSchedules[brand as keyof typeof optimalSchedules];
      await createQueueSlots(config.id, brand, hours, config.timezone);

      console.log(`\n✅ ${brand.toUpperCase()} queue configured successfully!`);
      console.log(`   ${config.slotsPerDay} posts/day at optimal times for all platforms`);

    } catch (error) {
      console.error(`\n❌ Error configuring ${brand}:`, error);
    }
  }

  console.log('\n\n' + '═'.repeat(100));
  console.log('✅ QUEUE RESET COMPLETE');
  console.log('═'.repeat(100));
  console.log(`\n📋 SUMMARY:\n`);
  console.log(`   ✅ CARZ:     5 slots/day at 06:00, 11:00, 16:00, 18:00, 19:00 UTC`);
  console.log(`   ✅ PODCAST:  3 slots/day at 12:00, 15:00, 18:00 UTC`);
  console.log(`   ✅ ABDULLAH: 5 slots/day at 00:00, 09:00, 15:00, 18:00, 21:00 UTC`);
  console.log(`\n💡 NEXT STEPS:\n`);
  console.log(`   1. Verify queues at https://getlate.dev`);
  console.log(`   2. Ensure your content generation keeps up with queue capacity`);
  console.log(`   3. Monitor performance in admin/analytics dashboard`);
  console.log(`   4. Re-run scripts/compare-queues-to-recommendations.ts weekly to verify\n`);
}

main().catch(console.error);
