#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkAllQueueSchedules() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('🔍 CHECKING ALL BRAND QUEUE SCHEDULES\n');
  console.log('═'.repeat(80));

  const profiles = [
    { brand: 'OwnerFi', profileId: process.env.LATE_OWNERFI_PROFILE_ID },
    { brand: 'Carz', profileId: process.env.LATE_CARZ_PROFILE_ID },
    { brand: 'Podcast', profileId: process.env.LATE_PODCAST_PROFILE_ID },
    { brand: 'VassDistro', profileId: process.env.LATE_VASSDISTRO_PROFILE_ID },
  ];

  for (const profile of profiles) {
    if (!profile.profileId) {
      console.log(`\n❌ ${profile.brand}: No profile ID configured\n`);
      continue;
    }

    console.log(`\n📊 ${profile.brand.toUpperCase()} (${profile.profileId})\n`);

    try {
      const response = await fetch(
        `https://getlate.dev/api/v1/queue/slots?profileId=${profile.profileId}`,
        {
          headers: {
            'Authorization': `Bearer ${LATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.log(`   ❌ Error fetching queue: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!data.slots || data.slots.length === 0) {
        console.log('   ⚠️  No queue schedule configured');
        continue;
      }

      console.log(`   Active: ${data.active ? '✅' : '❌'}`);
      console.log(`   Timezone: ${data.timezone}`);
      console.log(`   Total Slots: ${data.slots.length}`);
      console.log('\n   Schedule:');

      // Group by day
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const slotsByDay: Record<number, string[]> = {};

      data.slots.forEach((slot: any) => {
        if (!slotsByDay[slot.dayOfWeek]) {
          slotsByDay[slot.dayOfWeek] = [];
        }
        slotsByDay[slot.dayOfWeek].push(slot.time);
      });

      Object.keys(slotsByDay).sort().forEach(day => {
        const dayNum = parseInt(day);
        const times = slotsByDay[dayNum].sort();
        console.log(`   ${dayNames[dayNum].padEnd(10)} - ${times.join(', ')}`);
      });

    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }

    console.log('\n' + '─'.repeat(80));
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ QUEUE SCHEDULE CHECK COMPLETE\n');
}

checkAllQueueSchedules().catch(console.error);
