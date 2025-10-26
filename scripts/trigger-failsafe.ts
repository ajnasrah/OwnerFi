/**
 * Trigger failsafe cron to fix stuck workflows
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET?.replace(/^"|"$/g, '');

async function triggerFailsafe() {
  console.log('🔧 Triggering Failsafe Cron to Fix Stuck Workflows\n');

  const response = await fetch(`${baseUrl}/api/cron/check-stuck-submagic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cronSecret}`
    }
  });

  const data = await response.json();

  console.log('📊 Failsafe Cron Response:');
  console.log(JSON.stringify(data, null, 2));

  if (data.recoveredWorkflows && data.recoveredWorkflows.length > 0) {
    console.log(`\n✅ Recovered ${data.recoveredWorkflows.length} workflows:`);
    data.recoveredWorkflows.forEach((w: any) => {
      console.log(`   - ${w.workflowId} (${w.brand})`);
    });
  }

  if (data.propertyVideos?.fixed) {
    console.log(`\n✅ Fixed ${data.propertyVideos.fixed} property videos`);
  }
}

triggerFailsafe().catch(console.error);
