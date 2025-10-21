import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/2be65188-9b2e-43f1-a9d8-33d9907b375c';

async function testGHLWebhook() {
  console.log('🧪 Testing GHL Webhook with sample property data\n');

  // Sample property with ALL fields populated
  const sampleProperty = {
    property_id: '44822781',
    full_address: '6515 Mayhill Ct, Spring Hill, FL 34606',
    street_address: '6515 Mayhill Ct',
    city: 'Spring Hill',
    state: 'FL',
    zip: '34606',
    bedrooms: 3,
    bathrooms: 2,
    square_foot: 1456,
    building_type: 'Single Family',
    year_built: 1998,
    lot_square_foot: 7840,
    estimate: 285000,
    hoa: 0,
    description: 'Beautiful 3 bedroom 2 bath home in Spring Hill with large backyard and updated kitchen.',
    agent_name: 'Property Owner',
    agent_phone_number: '727-857-2528',
    annual_tax_amount: 3200,
    price: 295000,
    zillow_url: 'https://www.zillow.com/homedetails/6515-Mayhill-Ct-Spring-Hill-FL-34606/44822781_zpid/',
    property_image: 'https://photos.zillowstatic.com/fp/example-property-image.jpg',
    broker_name: '',
    broker_phone: '',
  };

  console.log('📤 Sending test property to GHL webhook:\n');
  console.log(JSON.stringify(sampleProperty, null, 2));
  console.log('\n🔗 Webhook URL:', GHL_WEBHOOK_URL);
  console.log('\n⏳ Sending...\n');

  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleProperty),
    });

    console.log(`✅ Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    if (responseText) {
      console.log(`📥 Response Body: ${responseText}`);
    } else {
      console.log(`📥 Response Body: (empty)`);
    }

    if (response.ok) {
      console.log('\n🎉 SUCCESS! Test property sent to GHL webhook!');
      console.log('Check your GHL account to see if the contact/opportunity was created.');
    } else {
      console.log('\n⚠️  Webhook returned non-OK status. Check the response above.');
    }
  } catch (error: any) {
    console.error('\n❌ ERROR sending to webhook:', error.message);
  }
}

testGHLWebhook()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
