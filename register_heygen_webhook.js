// Register HeyGen Webhook Endpoint
require('dotenv').config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/heygen`;

async function registerWebhook() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         REGISTERING HEYGEN WEBHOOK                            ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('📝 Webhook URL:', WEBHOOK_URL);
  console.log('🔑 Using API Key:', HEYGEN_API_KEY.substring(0, 20) + '...\n');

  try {
    console.log('📡 Sending registration request...\n');

    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        events: [
          'avatar_video.success',
          'avatar_video.fail'
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Registration failed!');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(data, null, 2));

      if (response.status === 400 && data.message?.includes('OPTIONS')) {
        console.log('\n⚠️  Your server must respond to OPTIONS requests within 1 second.');
        console.log('   Make sure your server is running: npm run dev');
        console.log('   And accessible at:', WEBHOOK_URL);
      }

      process.exit(1);
    }

    console.log('✅ Webhook registered successfully!\n');
    console.log('📊 Response:', JSON.stringify(data, null, 2));
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║              WEBHOOK REGISTRATION COMPLETE!                   ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    if (data.data) {
      console.log('🆔 Endpoint ID:', data.data.endpoint_id || data.data.id);
      console.log('🔐 Secret:', data.data.secret);
      console.log('🎯 Events:', data.data.events?.join(', '));
      console.log('\n💡 Save the endpoint_id and secret for future reference!');
    }

    console.log('\n✅ HeyGen will now send webhooks to:', WEBHOOK_URL);
    console.log('   Events: avatar_video.success, avatar_video.fail');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function listExistingWebhooks() {
  console.log('\n📋 Checking for existing webhooks...\n');

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook.list', {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY
      }
    });

    const data = await response.json();

    if (response.ok && data.data?.webhooks) {
      console.log('📊 Existing webhooks:', data.data.webhooks.length);
      data.data.webhooks.forEach((webhook, i) => {
        console.log(`\n${i + 1}. Endpoint ID: ${webhook.endpoint_id || webhook.id}`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Events: ${webhook.events?.join(', ')}`);
      });
      console.log('\n');
    }
  } catch (error) {
    console.log('⚠️  Could not list existing webhooks:', error.message);
  }
}

async function main() {
  await listExistingWebhooks();
  await registerWebhook();
}

main();
