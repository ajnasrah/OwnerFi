import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GHL_BUYER_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/e09f3559-f4df-49c0-af1c-7b1721a96b24';

async function testBuyerWebhook() {
  console.log('🧪 Testing GHL Buyer Webhook with sample buyer data\n');

  // Sample buyer with ALL fields populated
  const sampleBuyer = {
    buyer_id: 'test-buyer-12345',
    user_id: 'test-user-67890',
    first_name: 'John',
    last_name: 'Smith',
    full_name: 'John Smith',
    email: 'john.smith.test@example.com',
    phone: '9015551234',
    city: 'Memphis',
    state: 'TN',
    max_monthly_payment: 2000,
    max_down_payment: 15000,
    search_radius: 25,
    languages: 'English',
    source: 'ownerfi_platform',
    created_at: new Date().toISOString()
  };

  console.log('📤 Sending test buyer to GHL webhook:\n');
  console.log(JSON.stringify(sampleBuyer, null, 2));
  console.log('\n🔗 Webhook URL:', GHL_BUYER_WEBHOOK_URL);
  console.log('\n⏳ Sending...\n');

  try {
    const response = await fetch(GHL_BUYER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleBuyer),
    });

    console.log(`✅ Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    if (responseText) {
      console.log(`📥 Response Body: ${responseText}`);
    } else {
      console.log(`📥 Response Body: (empty)`);
    }

    if (response.ok) {
      console.log('\n🎉 SUCCESS! Test buyer sent to GHL webhook!');
      console.log('Check your GHL account to see if the contact was created.');
    } else {
      console.log('\n⚠️  Webhook returned non-OK status. Check the response above.');
    }
  } catch (error: any) {
    console.error('\n❌ ERROR sending to webhook:', error.message);
  }
}

testBuyerWebhook()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
