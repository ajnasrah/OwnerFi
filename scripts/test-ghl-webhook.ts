// Test GHL webhook with rental estimate data
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testWebhook() {
  console.log('🔗 Testing GHL Webhook with Rental Estimate Data\n');
  console.log('='.repeat(60));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const webhookUrl = `${baseUrl}/api/gohighlevel/webhook/save-property`;

  const testPayload = {
    id: 'test_rental_estimate_' + Date.now(),
    opportunityId: 'test_rental_estimate_' + Date.now(),
    address: '789 Rental Investment Blvd',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    price: 425000,
    bedrooms: 4,
    bathrooms: 3.5,
    sqft: 2500,
    zestimate: 430000,
    rentZestimate: 3200,
    monthlyPayment: 2400,
    downPayment: 85000,
    interestRate: 6.5,
    imageUrl: 'https://placehold.co/600x400',
  };

  console.log('\n📤 Sending test payload to webhook:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log(`\n📍 Webhook URL: ${webhookUrl}\n`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log('\n✅ Response Body:');
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.log('\n📄 Response Text:');
      console.log(responseText);
    }

    if (response.ok) {
      console.log('\n✅ Webhook test PASSED!');
      console.log('\n📋 Next Steps:');
      console.log('1. Check the database for the new property');
      console.log('2. Verify rentZestimate field is populated');
      console.log('3. View on website to see Investment Potential section');
    } else {
      console.log('\n❌ Webhook test FAILED!');
      console.log(`Status: ${response.status}`);
    }

  } catch (error) {
    console.error('\n❌ Error testing webhook:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
}

testWebhook()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
