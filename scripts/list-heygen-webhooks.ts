import { config } from 'dotenv';

config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function listHeyGenWebhooks() {
  console.log('🔍 Fetching registered HeyGen webhooks...\n');

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in environment');
    process.exit(1);
  }

  try {
    const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.list', {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} - ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();

    console.log('📋 Registered Webhook Endpoints:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.data?.endpoints) {
      console.log('='.repeat(80));
      console.log('ENDPOINT DETAILS');
      console.log('='.repeat(80));

      data.data.endpoints.forEach((endpoint: any, index: number) => {
        console.log(`\n${index + 1}. Endpoint ID: ${endpoint.endpoint_id}`);
        console.log(`   URL: ${endpoint.url}`);
        console.log(`   Status: ${endpoint.status}`);
        console.log(`   Events: ${endpoint.events?.join(', ') || 'None'}`);
        console.log(`   Secret: ${endpoint.secret ? '***' + endpoint.secret.slice(-4) : 'None'}`);
        console.log(`   Created: ${endpoint.created_at || 'Unknown'}`);
      });

      console.log('\n' + '='.repeat(80));
      console.log(`Total endpoints: ${data.data.endpoints.length}`);
    } else {
      console.log('⚠️  No webhook endpoints registered');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listHeyGenWebhooks()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
