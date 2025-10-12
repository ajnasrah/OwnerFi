// Test Posting Schedule (9 AM, 11 AM, 2 PM, 6 PM, 8 PM)
require('dotenv').config({ path: '.env.local' });

const POSTING_SCHEDULE = [9, 11, 14, 18, 20]; // 9 AM, 11 AM, 2 PM, 6 PM, 8 PM

function getScheduledTime(position) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Get the hour for this position (0-4 maps to schedule array)
  const scheduleIndex = position % POSTING_SCHEDULE.length;
  const scheduledHour = POSTING_SCHEDULE[scheduleIndex];

  // Calculate the scheduled date/time
  const scheduledTime = new Date(today);
  scheduledTime.setHours(scheduledHour, 0, 0, 0);

  // If this time has already passed today, schedule for tomorrow
  if (scheduledTime.getTime() < now.getTime()) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  return scheduledTime;
}

function testSchedule() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║           POSTING SCHEDULE TEST                               ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const now = new Date();
  console.log('🕐 Current Time:', now.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }));
  console.log('');

  console.log('📅 SCHEDULED POSTING TIMES:\n');
  console.log('═'.repeat(70) + '\n');

  // Test 5 videos for each category
  console.log('🚗 CARZ VIDEOS (5 per day):\n');
  for (let i = 0; i < 5; i++) {
    const scheduledTime = getScheduledTime(i);
    const isPast = scheduledTime.getTime() < now.getTime();
    const timeString = scheduledTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    console.log(`  Video #${i + 1}: ${timeString} ${isPast ? '(PAST - Tomorrow)' : '(Upcoming)'}`);
  }

  console.log('\n🏠 OWNERFI VIDEOS (5 per day):\n');
  for (let i = 0; i < 5; i++) {
    const scheduledTime = getScheduledTime(i);
    const timeString = scheduledTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    console.log(`  Video #${i + 1}: ${timeString}`);
  }

  console.log('\n' + '═'.repeat(70) + '\n');
  console.log('📊 SCHEDULE SUMMARY:\n');
  console.log('  • Total videos per day: 10 (5 Carz + 5 OwnerFi)');
  console.log('  • Posting times: 9 AM, 11 AM, 2 PM, 6 PM, 8 PM');
  console.log('  • Each category posts at the same times');
  console.log('  • Videos are queued with these scheduled times');
  console.log('  • System only processes videos at or after scheduled time\n');

  console.log('⏰ HOW IT WORKS:\n');
  console.log('  1. System evaluates articles and picks top 5 per category');
  console.log('  2. Each video is assigned a scheduled time:');
  console.log('     - Video #1 → 9:00 AM');
  console.log('     - Video #2 → 11:00 AM');
  console.log('     - Video #3 → 2:00 PM');
  console.log('     - Video #4 → 6:00 PM');
  console.log('     - Video #5 → 8:00 PM');
  console.log('  3. Scheduler checks every 5 minutes');
  console.log('  4. Only processes videos when scheduled time arrives');
  console.log('  5. If scheduled time has passed, schedules for next day\n');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                     ✅ Schedule Configured!                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

testSchedule();
