#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
import { setQueueSchedule } from '../src/lib/late-api';

config({ path: resolve(process.cwd(), '.env.local') });

async function configureOptimalQueues() {
  console.log('⚙️  CONFIGURING OPTIMAL QUEUE SCHEDULES\n');
  console.log('Based on platform analysis data:\n');
  console.log('  - Instagram peak: Tuesday 10:00 AM (7/20 top posts)');
  console.log('  - YouTube peak: Wednesday/Thursday 8:00 AM\n');
  console.log('═'.repeat(80));

  // ============================================================================
  // OWNERFI: 15 SLOTS PER DAY (clustered around peak times)
  // ============================================================================

  console.log('\n📊 OWNERFI - 15 Slots Per Day\n');
  console.log('Strategy: Cluster around Tuesday 10 AM (Instagram peak)\n');

  const ownerfiSlots = [
    // Tuesday - MAIN DAY (5 slots around 10 AM peak)
    { dayOfWeek: 2, time: '09:30' },
    { dayOfWeek: 2, time: '09:45' },
    { dayOfWeek: 2, time: '10:00' }, // PEAK
    { dayOfWeek: 2, time: '10:15' },
    { dayOfWeek: 2, time: '10:30' },

    // Friday - SECONDARY DAY (5 slots around 2 PM - also good for Instagram)
    { dayOfWeek: 5, time: '13:45' },
    { dayOfWeek: 5, time: '14:00' },
    { dayOfWeek: 5, time: '14:15' },
    { dayOfWeek: 5, time: '14:30' },
    { dayOfWeek: 5, time: '14:45' },

    // Sunday - TERTIARY DAY (5 slots around 6 AM - OwnerFi data showed this works)
    { dayOfWeek: 0, time: '05:45' },
    { dayOfWeek: 0, time: '06:00' },
    { dayOfWeek: 0, time: '06:15' },
    { dayOfWeek: 0, time: '06:30' },
    { dayOfWeek: 0, time: '06:45' },
  ];

  console.log('   Tuesday (5 slots):  9:30 AM - 10:30 AM (clustered around peak)');
  console.log('   Friday (5 slots):   1:45 PM - 2:45 PM (secondary peak)');
  console.log('   Sunday (5 slots):   5:45 AM - 6:45 AM (early birds)');

  try {
    await setQueueSchedule('ownerfi', ownerfiSlots, 'America/New_York', false);
    console.log('   ✅ OwnerFi queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // CARZ: 5 SLOTS PER DAY (YouTube focused - Wednesday/Thursday 8 AM)
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 CARZ - 5 Slots Per Day\n');
  console.log('Strategy: Wednesday/Thursday 8 AM (YouTube peak for cars)\n');

  const carzSlots = [
    // Wednesday (3 slots around 8 AM - YouTube peak)
    { dayOfWeek: 3, time: '07:45' },
    { dayOfWeek: 3, time: '08:00' }, // PEAK
    { dayOfWeek: 3, time: '08:15' },

    // Thursday (2 slots around 8 AM)
    { dayOfWeek: 4, time: '08:00' },
    { dayOfWeek: 4, time: '08:15' },
  ];

  console.log('   Wednesday (3 slots): 7:45 AM - 8:15 AM (YouTube peak)');
  console.log('   Thursday (2 slots):  8:00 AM - 8:15 AM');

  try {
    await setQueueSchedule('carz', carzSlots, 'America/New_York', false);
    console.log('   ✅ Carz queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // PODCAST: 5 SLOTS PER DAY (Saturday evening - 7 PM)
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 PODCAST - 5 Slots Per Day\n');
  console.log('Strategy: Saturday evening (data showed 7 PM works)\n');

  const podcastSlots = [
    // Saturday (5 slots around 7 PM)
    { dayOfWeek: 6, time: '18:45' },
    { dayOfWeek: 6, time: '19:00' }, // PEAK
    { dayOfWeek: 6, time: '19:15' },
    { dayOfWeek: 6, time: '19:30' },
    { dayOfWeek: 6, time: '19:45' },
  ];

  console.log('   Saturday (5 slots): 6:45 PM - 7:45 PM (evening cluster)');

  try {
    await setQueueSchedule('podcast', podcastSlots, 'America/New_York', false);
    console.log('   ✅ Podcast queue configured!\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`);
  }

  // ============================================================================
  // VASSDISTRO: 5 SLOTS PER DAY (Business hours - Tuesday/Thursday)
  // ============================================================================

  console.log('─'.repeat(80));
  console.log('\n📊 VASSDISTRO - 5 Slots Per Day\n');
  console.log('Strategy: Business hours Tuesday/Thursday (B2B timing)\n');

  const vassdistroSlots = [
    // Tuesday (3 slots around 10 AM)
    { dayOfWeek: 2, time: '09:45' },
    { dayOfWeek: 2, time: '10:00' },
    { dayOfWeek: 2, time: '10:15' },

    // Thursday (2 slots around 10 AM)
    { dayOfWeek: 4, time: '10:00' },
    { dayOfWeek: 4, time: '10:15' },
  ];

  console.log('   Tuesday (3 slots):  9:45 AM - 10:15 AM');
  console.log('   Thursday (2 slots): 10:00 AM - 10:15 AM');

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
  console.log('OwnerFi:    15 slots/day (Tue/Fri/Sun clustered)');
  console.log('Carz:       5 slots/day  (Wed/Thu mornings - YouTube peak)');
  console.log('Podcast:    5 slots/day  (Sat evenings)');
  console.log('VassDistro: 5 slots/day  (Tue/Thu mornings - B2B hours)');
  console.log('\n✅ All queues now post during data-backed optimal times!\n');
}

configureOptimalQueues().catch(console.error);
