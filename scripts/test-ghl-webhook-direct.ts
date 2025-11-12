/**
 * Test the GoHighLevel webhook directly to see if it works
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testGHLWebhookDirect() {
  console.log('🧪 Testing GoHighLevel webhook directly');
  console.log('========================================\n');

  const ghlWebhookUrl = process.env.GOHIGHLEVEL_WEBHOOK_URL;

  if (!ghlWebhookUrl) {
    console.log('❌ GOHIGHLEVEL_WEBHOOK_URL not set!');
    return;
  }

  console.log(`📡 Webhook URL: ${ghlWebhookUrl}\n`);

  const testPayload = {
    // SMS Message
    phone: '9012828846', // Yanal's number
    message: `🏠 TEST NOTIFICATION from OwnerFi

Hi! This is a test message to verify GoHighLevel is receiving our webhooks.

If you receive this, the system is working! 🎉`,

    // Test data
    buyerId: 'test-buyer',
    buyerName: 'Test User',
    buyerFirstName: 'Test',
    buyerLastName: 'User',
    buyerEmail: 'test@test.com',
    buyerPhone: '9012828846',

    propertyId: 'test-property',
    propertyAddress: '1234 Test St',
    propertyCity: 'Memphis',
    propertyState: 'TN',
    monthlyPayment: 1000,
    downPaymentAmount: 10000,
    listPrice: 175000,
    bedrooms: 3,
    bathrooms: 2,

    dashboardUrl: 'https://ownerfi.ai/dashboard',
    trigger: 'manual_trigger',
    timestamp: new Date().toISOString(),
  };

  console.log('📤 Sending test payload to GoHighLevel...\n');

  try {
    const response = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}\n`);

    let responseData;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
      console.log('📋 Response data (JSON):');
      console.log(JSON.stringify(responseData, null, 2));
    } else {
      const text = await response.text();
      console.log('📋 Response data (Text):');
      console.log(text.substring(0, 500));
    }

    if (response.ok) {
      console.log('\n✅ GoHighLevel webhook accepted the request!');
      console.log('   Check Yanal\'s phone (9012828846) for the SMS.');
    } else {
      console.log('\n❌ GoHighLevel returned an error!');
      console.log('   The webhook URL may be incorrect or the payload format is wrong.');
    }

  } catch (error) {
    console.error('\n❌ Failed to call GoHighLevel webhook:');
    console.error(error);
    console.log('\n   Possible causes:');
    console.log('   - Network issue');
    console.log('   - Invalid webhook URL');
    console.log('   - GoHighLevel service is down');
  }

  console.log('\n========================================');
}

// Run the test
testGHLWebhookDirect().catch(console.error);
