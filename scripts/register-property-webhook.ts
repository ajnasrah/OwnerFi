import { config } from 'dotenv';

config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function registerPropertyWebhook() {
  console.log('📝 Registering Property Video webhook with HeyGen...\n');

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in environment');
    process.exit(1);
  }

  const webhookUrl = `${BASE_URL}/api/webhooks/heygen/property`;

  console.log(`Webhook URL: ${webhookUrl}`);
  console.log('Events: avatar_video.success, avatar_video.fail\n');

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.add', {
      method: 'POST',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['avatar_video.success', 'avatar_video.fail']
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status}`);
      console.error(responseText);
      process.exit(1);
    }

    const data = JSON.parse(responseText);

    console.log('✅ Webhook registered successfully!\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.data) {
      console.log('='.repeat(80));
      console.log('ENDPOINT DETAILS');
      console.log('='.repeat(80));
      console.log(`Endpoint ID: ${data.data.endpoint_id}`);
      console.log(`URL: ${data.data.url}`);
      console.log(`Status: ${data.data.status}`);
      console.log(`Secret: ${data.data.secret ? '***' + data.data.secret.slice(-4) : 'None'}`);
      console.log(`Events: ${data.data.events?.join(', ')}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Save the secret if needed for webhook validation');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

registerPropertyWebhook()
  .then(() => {
    console.log('\n✅ Done!');
    console.log('\n💡 Next steps:');
    console.log('1. Verify webhook endpoint exists: /api/webhooks/heygen/property');
    console.log('2. Test webhook with a new property video generation');
    console.log('3. Check webhook is receiving callbacks from HeyGen');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
