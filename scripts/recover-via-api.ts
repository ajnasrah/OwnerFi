#!/usr/bin/env npx tsx

/**
 * EMERGENCY: Recover stuck workflows via API
 * Triggers the stuck-posting and stuck-submagic crons multiple times
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = 'https://ownerfi.ai';

async function triggerCron(path: string, description: string) {
  console.log(`\n🔧 Triggering ${description}...`);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      },
      signal: AbortSignal.timeout(300000) // 5 minute timeout
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed: ${response.status} - ${text}`);
      return false;
    }

    const result = await response.json();
    console.log(`   ✅ Success:`, result);
    return true;
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error(`   ❌ Timeout after 5 minutes - cron likely hit maxDuration limit`);
    } else {
      console.error(`   ❌ Error:`, err.message);
    }
    return false;
  }
}

async function recoverWorkflows() {
  console.log('🚨 EMERGENCY RECOVERY: Triggering recovery crons...\n');

  // Trigger stuck-submagic cron (handles submagic_processing status)
  await triggerCron('/api/cron/check-stuck-submagic', 'Stuck Submagic Recovery');

  // Wait a bit
  console.log('\n⏳ Waiting 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Trigger stuck-posting cron (handles posting status)
  await triggerCron('/api/cron/check-stuck-posting', 'Stuck Posting Recovery');

  // Wait a bit
  console.log('\n⏳ Waiting 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Now manually trigger pending workflows
  console.log('\n🚀 Starting pending workflows...');

  const brands = ['ownerfi']; // You showed ownerfi workflows stuck

  for (const brand of brands) {
    console.log(`\n📱 Triggering ${brand} workflow...`);

    try {
      const response = await fetch(`${BASE_URL}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand,
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'immediate'
        }),
        signal: AbortSignal.timeout(60000) // 1 minute timeout
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`   ❌ Failed: ${response.status} - ${text}`);
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Workflow started:`, result);
    } catch (err: any) {
      console.error(`   ❌ Error:`, err.message);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Recovery script completed');
  console.log('\n⚠️  Check your dashboard to see if workflows are progressing');
  console.log('   If workflows are still stuck in "posting" after 5 minutes, the cron is still timing out');
}

recoverWorkflows()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Recovery failed:', err);
    process.exit(1);
  });
