/**
 * One-Time Synthesia Webhook Registration Script
 *
 * Synthesia requires webhooks to be registered GLOBALLY via their API.
 * This script registers our webhook URL for video.completed and video.failed events.
 *
 * Usage:
 *   npx tsx scripts/setup-synthesia-webhook.ts
 *
 * Required env vars:
 *   SYNTHESIA_API_KEY
 *   NEXT_PUBLIC_BASE_URL (optional, defaults to https://ownerfi.ai)
 *
 * API Notes (confirmed via live testing):
 * - Auth: Authorization: {API_KEY} (NO "Bearer" prefix)
 * - Events: "video.completed", "video.failed"
 * - No /v2/avatars or /v2/voices endpoints exist
 */

const SYNTHESIA_API_BASE = 'https://api.synthesia.io/v2';

async function main() {
  const apiKey = process.env.SYNTHESIA_API_KEY;
  if (!apiKey) {
    console.error('ERROR: SYNTHESIA_API_KEY environment variable is required');
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  const webhookUrl = `${baseUrl}/api/webhooks/synthesia/ownerfi`;

  const headers = {
    'Authorization': apiKey.trim(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  console.log('='.repeat(60));
  console.log('Synthesia Webhook Setup');
  console.log('='.repeat(60));
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log();

  // Step 1: List existing webhooks
  console.log('Step 1: Checking existing webhooks...');
  const listRes = await fetch(`${SYNTHESIA_API_BASE}/webhooks`, {
    method: 'GET',
    headers,
  });

  if (listRes.ok) {
    const existing = await listRes.json();
    const webhooks = existing.webhooks || [];
    console.log(`  Found ${webhooks.length} existing webhook(s)`);
    webhooks.forEach((wh: any, i: number) => {
      console.log(`  [${i + 1}] ID: ${wh.id}, URL: ${wh.url}, Status: ${wh.status}`);
    });

    // Check if our URL is already registered
    const alreadyRegistered = webhooks.find((wh: any) => wh.url === webhookUrl);
    if (alreadyRegistered) {
      console.log(`\n  Webhook already registered (ID: ${alreadyRegistered.id})`);
      console.log('  No action needed.');
      return;
    }
  } else {
    console.error(`  List failed: ${listRes.status} - ${await listRes.text()}`);
  }

  console.log();

  // Step 2: Register webhook
  console.log('Step 2: Registering webhook...');
  const registerRes = await fetch(`${SYNTHESIA_API_BASE}/webhooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: webhookUrl,
      events: ['video.completed', 'video.failed'],
    }),
  });

  if (registerRes.ok) {
    const result = await registerRes.json();
    console.log('  Webhook registered!');
    console.log(`  ID: ${result.id}`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Secret: ${result.secret}`);
    console.log(`  Status: ${result.status}`);
  } else {
    const errText = await registerRes.text();
    console.error(`  Registration failed: ${registerRes.status} - ${errText}`);
    process.exit(1);
  }

  console.log();

  // Step 3: Verify API connectivity
  console.log('Step 3: Verifying API connectivity...');
  const videosRes = await fetch(`${SYNTHESIA_API_BASE}/videos?limit=1`, {
    method: 'GET',
    headers,
  });

  if (videosRes.ok) {
    const data = await videosRes.json();
    console.log(`  API connected. ${data.videos?.length || 0} videos found.`);
  } else {
    console.error(`  API check failed: ${videosRes.status}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Done! Add SYNTHESIA_API_KEY to Vercel env vars.');
  console.log('Set VIDEO_PROVIDER=synthesia to activate.');
  console.log('='.repeat(60));
}

main().catch(console.error);
