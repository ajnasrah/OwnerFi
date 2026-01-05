/**
 * Register Brand-Specific Webhooks with HeyGen
 *
 * This script registers all three brand-specific webhook endpoints with HeyGen API.
 * Run this once after deploying the new webhook endpoints.
 *
 * Usage: node scripts/register-heygen-webhooks.mjs
 */

import 'dotenv/config';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found in environment variables');
  process.exit(1);
}

const BRANDS = ['carz', 'ownerfi', 'benefit', 'abdullah', 'gaza'];

// Events to subscribe to
const EVENTS = [
  'avatar_video.success',
  'avatar_video.fail'
];

/**
 * Register a single webhook endpoint with HeyGen
 */
async function registerWebhook(brand, url) {
  console.log(`\n📝 Registering webhook for ${brand}...`);
  console.log(`   URL: ${url}`);
  console.log(`   Events: ${EVENTS.join(', ')}`);

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        url: url,
        events: EVENTS
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    console.log(`✅ Successfully registered webhook for ${brand}`);
    console.log(`   Endpoint ID: ${data.data?.endpoint_id || 'N/A'}`);
    console.log(`   Secret: ${data.data?.secret ? '***' + data.data.secret.slice(-4) : 'N/A'}`);

    return {
      success: true,
      brand,
      endpointId: data.data?.endpoint_id,
      secret: data.data?.secret,
    };

  } catch (error) {
    console.error(`❌ Failed to register webhook for ${brand}:`, error.message);
    return {
      success: false,
      brand,
      error: error.message,
    };
  }
}

/**
 * List all registered webhooks (for verification)
 */
async function listWebhooks() {
  console.log('\n📋 Listing all registered webhooks...\n');

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.list', {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list webhooks: ${response.status}`);
    }

    const data = await response.json();
    const endpoints = data.data?.endpoints || [];

    if (endpoints.length === 0) {
      console.log('No webhooks currently registered.');
      return [];
    }

    console.log(`Found ${endpoints.length} registered webhook(s):\n`);
    endpoints.forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.url}`);
      console.log(`   ID: ${endpoint.endpoint_id}`);
      console.log(`   Events: ${endpoint.events?.join(', ') || 'N/A'}`);
      console.log(`   Status: ${endpoint.status || 'N/A'}`);
      console.log('');
    });

    return endpoints;

  } catch (error) {
    console.error('❌ Failed to list webhooks:', error.message);
    return [];
  }
}

/**
 * Delete a webhook endpoint by ID (optional cleanup)
 */
async function deleteWebhook(endpointId) {
  console.log(`\n🗑️  Deleting webhook endpoint: ${endpointId}`);

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        endpoint_id: endpointId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to delete webhook: ${response.status}`);
    }

    console.log(`✅ Successfully deleted webhook endpoint`);
    return true;

  } catch (error) {
    console.error('❌ Failed to delete webhook:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 HeyGen Webhook Registration Tool\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Step 1: List existing webhooks
  console.log('═'.repeat(60));
  console.log('STEP 1: Checking existing webhooks');
  console.log('═'.repeat(60));

  const existingWebhooks = await listWebhooks();

  // Check if brand-specific webhooks already exist
  const brandWebhooks = BRANDS.map(brand => `${BASE_URL}/api/webhooks/heygen/${brand}`);
  const existingUrls = existingWebhooks.map(w => w.url);
  const alreadyRegistered = brandWebhooks.filter(url => existingUrls.includes(url));

  if (alreadyRegistered.length > 0) {
    console.log('\n⚠️  WARNING: Some brand-specific webhooks are already registered:');
    alreadyRegistered.forEach(url => console.log(`   - ${url}`));
    console.log('\nDo you want to continue? This may create duplicates.');
    console.log('If you want to delete old webhooks first, use: node scripts/cleanup-heygen-webhooks.mjs\n');
  }

  // Step 2: Register brand-specific webhooks
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 2: Registering brand-specific webhooks');
  console.log('═'.repeat(60));

  const results = [];
  for (const brand of BRANDS) {
    const webhookUrl = `${BASE_URL}/api/webhooks/heygen/${brand}`;
    const result = await registerWebhook(brand, webhookUrl);
    results.push(result);

    // Wait 1 second between registrations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 3: Summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successfully registered: ${successful.length}/${BRANDS.length}`);
  if (successful.length > 0) {
    successful.forEach(r => {
      console.log(`   - ${r.brand}: ${r.endpointId}`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${BRANDS.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.brand}: ${r.error}`);
    });
  }

  // Step 4: Save webhook secrets to file
  if (successful.length > 0) {
    console.log('\n📝 Saving webhook secrets...');

    const secretsData = {
      registeredAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      webhooks: successful.reduce((acc, r) => {
        acc[r.brand] = {
          endpointId: r.endpointId,
          secret: r.secret,
          url: `${BASE_URL}/api/webhooks/heygen/${r.brand}`
        };
        return acc;
      }, {})
    };

    const fs = await import('fs');
    fs.writeFileSync(
      './heygen-webhook-secrets.json',
      JSON.stringify(secretsData, null, 2)
    );

    console.log('✅ Secrets saved to: heygen-webhook-secrets.json');
    console.log('⚠️  IMPORTANT: Add these secrets to your .env.local file:');
    console.log('');
    successful.forEach(r => {
      const envVar = `HEYGEN_WEBHOOK_SECRET_${r.brand.toUpperCase()}`;
      console.log(`${envVar}=${r.secret}`);
    });
    console.log('');
  }

  // Final verification
  console.log('\n' + '═'.repeat(60));
  console.log('VERIFICATION');
  console.log('═'.repeat(60));
  await listWebhooks();

  console.log('\n✅ Done! Your brand-specific webhooks are now registered with HeyGen.\n');
  console.log('Next steps:');
  console.log('1. Add the webhook secrets to your .env.local file');
  console.log('2. Deploy your application');
  console.log('3. Test each brand\'s webhook by triggering a video generation');
  console.log('4. (Optional) Delete old shared webhook if no longer needed\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { registerWebhook, listWebhooks, deleteWebhook };
