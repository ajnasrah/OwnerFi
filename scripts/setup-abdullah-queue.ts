import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function setupAbdullahQueue() {
  console.log('='.repeat(60));
  console.log('⚙️  SETTING UP ABDULLAH LATE.SO QUEUE');
  console.log('='.repeat(60));
  console.log('');

  const LATE_ABDULLAH_PROFILE_ID = process.env.LATE_ABDULLAH_PROFILE_ID;
  const LATE_API_KEY = process.env.LATE_API_KEY;

  if (!LATE_API_KEY || !LATE_ABDULLAH_PROFILE_ID) {
    console.error('❌ Missing required environment variables!');
    return;
  }

  // Define queue slots - 5 times daily matching the cron schedule
  // 9 AM, 12 PM, 3 PM, 6 PM, 9 PM (CST/CDT)
  const slots = [
    // Monday - Friday
    { dayOfWeek: 1, time: '09:00' }, // Monday 9 AM
    { dayOfWeek: 1, time: '12:00' }, // Monday 12 PM
    { dayOfWeek: 1, time: '15:00' }, // Monday 3 PM
    { dayOfWeek: 1, time: '18:00' }, // Monday 6 PM
    { dayOfWeek: 1, time: '21:00' }, // Monday 9 PM

    { dayOfWeek: 2, time: '09:00' }, // Tuesday 9 AM
    { dayOfWeek: 2, time: '12:00' },
    { dayOfWeek: 2, time: '15:00' },
    { dayOfWeek: 2, time: '18:00' },
    { dayOfWeek: 2, time: '21:00' },

    { dayOfWeek: 3, time: '09:00' }, // Wednesday 9 AM
    { dayOfWeek: 3, time: '12:00' },
    { dayOfWeek: 3, time: '15:00' },
    { dayOfWeek: 3, time: '18:00' },
    { dayOfWeek: 3, time: '21:00' },

    { dayOfWeek: 4, time: '09:00' }, // Thursday 9 AM
    { dayOfWeek: 4, time: '12:00' },
    { dayOfWeek: 4, time: '15:00' },
    { dayOfWeek: 4, time: '18:00' },
    { dayOfWeek: 4, time: '21:00' },

    { dayOfWeek: 5, time: '09:00' }, // Friday 9 AM
    { dayOfWeek: 5, time: '12:00' },
    { dayOfWeek: 5, time: '15:00' },
    { dayOfWeek: 5, time: '18:00' },
    { dayOfWeek: 5, time: '21:00' },

    // Weekend (Saturday & Sunday) - lighter schedule
    { dayOfWeek: 6, time: '09:00' }, // Saturday 9 AM
    { dayOfWeek: 6, time: '15:00' }, // Saturday 3 PM
    { dayOfWeek: 6, time: '21:00' }, // Saturday 9 PM

    { dayOfWeek: 0, time: '09:00' }, // Sunday 9 AM
    { dayOfWeek: 0, time: '15:00' }, // Sunday 3 PM
    { dayOfWeek: 0, time: '21:00' }, // Sunday 9 PM
  ];

  console.log('📅 Queue Configuration:');
  console.log('  Timezone: America/Chicago (CST/CDT)');
  console.log('  Weekday slots: 5 per day (9 AM, 12 PM, 3 PM, 6 PM, 9 PM)');
  console.log('  Weekend slots: 3 per day (9 AM, 3 PM, 9 PM)');
  console.log('  Total slots per week:', slots.length);
  console.log('');

  try {
    console.log('📡 Configuring queue...');

    const response = await fetch('https://getlate.dev/api/v1/queue/slots', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: LATE_ABDULLAH_PROFILE_ID,
        timezone: 'America/Chicago',
        slots: slots,
        active: true,
        reshuffleExisting: false // Don't reshuffle existing queued posts
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to configure queue:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Queue configured successfully!');
    console.log('');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. ✅ Environment variable updated (LATE_ABDULLAH_PROFILE_ID)');
    console.log('   2. ✅ Production deployed with new variable');
    console.log('   3. ✅ Queue configured with posting schedule');
    console.log('   4. ⏳ Wait for next cron run to generate new content');
    console.log('   5. ⏳ Posts will automatically schedule to next available slot');
    console.log('');
    console.log('Abdullah\'s content will now post to his PERSONAL accounts!');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('');
  console.log('='.repeat(60));
}

setupAbdullahQueue().catch(console.error);
