/**
 * One-Time Synthesia Webhook Registration Script
 *
 * Synthesia requires webhooks to be registered GLOBALLY via their API,
 * unlike HeyGen which accepts webhook_url per-request.
 *
 * This script:
 * 1. Lists any existing webhooks
 * 2. Registers our webhook URL for video completion events
 * 3. Verifies the registration
 *
 * Usage:
 *   npx tsx scripts/setup-synthesia-webhook.ts
 *
 * Required env vars:
 *   SYNTHESIA_API_KEY
 *   NEXT_PUBLIC_BASE_URL (e.g., https://ownerfi.ai)
 */

const SYNTHESIA_API_BASE = 'https://api.synthesia.io/v2';

async function main() {
  const apiKey = process.env.SYNTHESIA_API_KEY;
  if (!apiKey) {
    console.error('ERROR: SYNTHESIA_API_KEY environment variable is required');
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  // We use a generic webhook URL — the callbackId in the payload maps back to the brand workflow
  // Since Synthesia doesn't support per-request webhook URLs, we use a single endpoint
  // that routes based on the callbackId stored in the workflow document
  const webhookUrl = `${baseUrl}/api/webhooks/synthesia/ownerfi`;

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  console.log('='.repeat(60));
  console.log('Synthesia Webhook Setup');
  console.log('='.repeat(60));
  console.log(`API Base: ${SYNTHESIA_API_BASE}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log();

  // Step 1: List existing webhooks
  console.log('Step 1: Checking existing webhooks...');
  try {
    const listRes = await fetch(`${SYNTHESIA_API_BASE}/webhooks`, {
      method: 'GET',
      headers,
    });

    if (listRes.ok) {
      const existing = await listRes.json();
      const webhooks = existing.webhooks || existing || [];
      console.log(`  Found ${Array.isArray(webhooks) ? webhooks.length : 0} existing webhook(s)`);
      if (Array.isArray(webhooks) && webhooks.length > 0) {
        webhooks.forEach((wh: any, i: number) => {
          console.log(`  [${i + 1}] ID: ${wh.id}, URL: ${wh.url}, Events: ${JSON.stringify(wh.events || wh.triggers)}`);
        });
      }
    } else {
      const errText = await listRes.text();
      console.log(`  Could not list webhooks: ${listRes.status} - ${errText}`);
      console.log('  (This may be normal if the API version doesn\'t support listing)');
    }
  } catch (err) {
    console.log(`  Error listing webhooks: ${err}`);
  }

  console.log();

  // Step 2: Register webhook
  console.log('Step 2: Registering webhook...');
  try {
    const registerRes = await fetch(`${SYNTHESIA_API_BASE}/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: webhookUrl,
        events: ['video_updated'],
      }),
    });

    if (registerRes.ok) {
      const result = await registerRes.json();
      console.log('  Webhook registered successfully!');
      console.log(`  Response: ${JSON.stringify(result, null, 2)}`);
    } else {
      const errText = await registerRes.text();
      console.error(`  Registration failed: ${registerRes.status} - ${errText}`);

      if (registerRes.status === 409 || errText.includes('already exists')) {
        console.log('  Webhook may already be registered — this is OK');
      }
    }
  } catch (err) {
    console.error(`  Error registering webhook: ${err}`);
  }

  console.log();

  // Step 3: Verify by listing again
  console.log('Step 3: Verifying registration...');
  try {
    const verifyRes = await fetch(`${SYNTHESIA_API_BASE}/webhooks`, {
      method: 'GET',
      headers,
    });

    if (verifyRes.ok) {
      const data = await verifyRes.json();
      const webhooks = data.webhooks || data || [];
      console.log(`  Total webhooks: ${Array.isArray(webhooks) ? webhooks.length : 'unknown'}`);

      if (Array.isArray(webhooks)) {
        const ours = webhooks.find((wh: any) => wh.url === webhookUrl);
        if (ours) {
          console.log('  Our webhook is registered and active!');
          console.log(`  Webhook ID: ${ours.id}`);
        } else {
          console.log('  WARNING: Our webhook URL was not found in the list');
          console.log('  You may need to register it manually via the Synthesia dashboard');
        }
      }
    } else {
      console.log('  Could not verify (list endpoint may not be available)');
    }
  } catch (err) {
    console.log(`  Error verifying: ${err}`);
  }

  console.log();

  // Step 4: Also list avatars to confirm API connectivity
  console.log('Step 4: Testing API connectivity (listing avatars)...');
  try {
    const avatarRes = await fetch(`${SYNTHESIA_API_BASE}/avatars`, {
      method: 'GET',
      headers,
    });

    if (avatarRes.ok) {
      const data = await avatarRes.json();
      const avatars = data.avatars || data || [];
      console.log(`  API connectivity confirmed! Found ${Array.isArray(avatars) ? avatars.length : '?'} avatars`);

      // Show first 5 avatar IDs for config reference
      if (Array.isArray(avatars) && avatars.length > 0) {
        console.log('  Sample avatars (for synthesia-agents.ts config):');
        avatars.slice(0, 5).forEach((a: any) => {
          console.log(`    - ${a.id}: ${a.name || a.displayName || 'unnamed'} (${a.gender || 'unknown'})`);
        });
      }
    } else {
      const errText = await avatarRes.text();
      console.error(`  Avatar list failed: ${avatarRes.status} - ${errText}`);
    }
  } catch (err) {
    console.error(`  Error: ${err}`);
  }

  // Step 5: List voices too
  console.log();
  console.log('Step 5: Listing available voices...');
  try {
    const voiceRes = await fetch(`${SYNTHESIA_API_BASE}/voices`, {
      method: 'GET',
      headers,
    });

    if (voiceRes.ok) {
      const data = await voiceRes.json();
      const voices = data.voices || data || [];
      console.log(`  Found ${Array.isArray(voices) ? voices.length : '?'} voices`);

      // Show English voices for reference
      if (Array.isArray(voices)) {
        const englishVoices = voices.filter((v: any) =>
          (v.language || '').toLowerCase().includes('en') ||
          (v.locale || '').toLowerCase().startsWith('en')
        );
        console.log(`  English voices: ${englishVoices.length}`);
        englishVoices.slice(0, 5).forEach((v: any) => {
          console.log(`    - ${v.id}: ${v.name || v.displayName || 'unnamed'} (${v.gender || 'unknown'})`);
        });
      }
    } else {
      const errText = await voiceRes.text();
      console.error(`  Voice list failed: ${voiceRes.status} - ${errText}`);
    }
  } catch (err) {
    console.error(`  Error: ${err}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Setup complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Update avatar/voice IDs in src/config/synthesia-agents.ts');
  console.log('2. Add SYNTHESIA_API_KEY to your .env and Vercel env vars');
  console.log('3. Set VIDEO_PROVIDER=synthesia to activate (default: heygen)');
  console.log('='.repeat(60));
}

main().catch(console.error);
