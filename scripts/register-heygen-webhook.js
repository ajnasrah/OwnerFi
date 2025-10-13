// Register HeyGen Webhook Endpoint
// Run this once to register the webhook with HeyGen

require('dotenv').config({ path: '.env' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function registerWebhook() {
  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env file');
    process.exit(1);
  }

  const webhookUrl = `${BASE_URL}/api/webhooks/heygen`;

  console.log('🔧 Registering HeyGen webhook...');
  console.log('   Webhook URL:', webhookUrl);
  console.log('   Events: avatar_video.success, avatar_video.fail');

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['avatar_video.success', 'avatar_video.fail']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to register webhook:', response.status, errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Webhook registered successfully!');
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('\n⚠️  IMPORTANT: Save the endpoint_id and secret from the response above!');

  } catch (error) {
    console.error('❌ Error registering webhook:', error);
    process.exit(1);
  }
}

// Also list existing webhooks
async function listWebhooks() {
  console.log('\n📋 Listing existing webhooks...');

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook.list', {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to list webhooks:', response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Existing webhooks:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error listing webhooks:', error);
  }
}

async function main() {
  await listWebhooks();
  console.log('\n');
  await registerWebhook();
}

main();
