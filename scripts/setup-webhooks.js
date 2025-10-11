// Setup script to register webhook endpoints with HeyGen
// Run this once to configure webhooks

require('dotenv').config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-change-this';

async function registerHeyGenWebhook() {
  console.log('🔧 Registering HeyGen Webhook Endpoint...\n');

  const webhookUrl = `${BASE_URL}/api/webhooks/heygen`;

  console.log('Webhook URL:', webhookUrl);
  console.log('Events: avatar_video.success, avatar_video.fail\n');

  if (!HEYGEN_API_KEY) {
    console.error('❌ Error: HEYGEN_API_KEY not found in .env.local');
    return;
  }

  if (BASE_URL === 'http://localhost:3000') {
    console.log('⚠️  Warning: Using localhost URL');
    console.log('   For HeyGen to reach your webhook, you need a public URL.');
    console.log('   Options:');
    console.log('   1. Use ngrok: ngrok http 3000');
    console.log('   2. Deploy to production');
    console.log('   3. Use a tunnel service\n');
  }

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.add', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY,
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret: WEBHOOK_SECRET,
        events: ['avatar_video.success', 'avatar_video.fail']
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Failed to register webhook:', JSON.stringify(error, null, 2));

      if (response.status === 400 && error.message?.includes('OPTIONS')) {
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Make sure your server is running: npm run dev');
        console.log('   2. Ensure the URL is publicly accessible');
        console.log('   3. OPTIONS request must respond within 1 second');
      }
      return;
    }

    const data = await response.json();

    console.log('✅ HeyGen webhook registered successfully!\n');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\n📝 Save this endpoint_id for later:');
    console.log('   Endpoint ID:', data.data?.endpoint_id || data.endpoint_id);
    console.log('\n✅ Setup complete! HeyGen will now send webhooks to your endpoint.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function listHeyGenWebhooks() {
  console.log('📋 Listing HeyGen Webhook Endpoints...\n');

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.list', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY,
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to list webhooks');
      return;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      console.log('Registered webhook endpoints:');
      data.data.forEach((endpoint, i) => {
        console.log(`\n${i + 1}. Endpoint ID: ${endpoint.endpoint_id}`);
        console.log(`   URL: ${endpoint.url}`);
        console.log(`   Status: ${endpoint.status}`);
        console.log(`   Events: ${endpoint.events.join(', ')}`);
      });
    } else {
      console.log('No webhook endpoints registered yet.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main
const command = process.argv[2];

if (command === 'list') {
  listHeyGenWebhooks();
} else {
  console.log('═══════════════════════════════════════════════════');
  console.log('        WEBHOOK SETUP - HeyGen & Submagic');
  console.log('═══════════════════════════════════════════════════\n');

  registerHeyGenWebhook().then(() => {
    console.log('\n════════════════════════════════════════════════════');
    console.log('                 NEXT STEPS');
    console.log('════════════════════════════════════════════════════\n');
    console.log('1. ✅ HeyGen webhook is registered');
    console.log('2. ✅ Submagic webhook works automatically (no registration needed)');
    console.log('3. 🚀 You can now use the webhook-based workflow:\n');
    console.log('   node test_viral_video_webhook.js\n');
    console.log('4. 📊 To list all registered webhooks:');
    console.log('   node scripts/setup-webhooks.js list\n');
  });
}
