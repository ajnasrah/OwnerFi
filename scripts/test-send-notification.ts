import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function testNotificationSending() {
  console.log('\n🧪 Testing Notification Sending to GHL');
  console.log('='.repeat(80));

  const ghlWebhookUrl = process.env.GOHIGHLEVEL_WEBHOOK_URL;

  console.log(`\nGOHIGHLEVEL_WEBHOOK_URL: ${ghlWebhookUrl ? 'Configured ✅' : 'Missing ❌'}`);

  if (!ghlWebhookUrl) {
    console.log('\n❌ GOHIGHLEVEL_WEBHOOK_URL is not set in environment');
    console.log('This is why notifications are not being sent!\n');
    return;
  }

  console.log(`URL: ${ghlWebhookUrl}`);

  // Test notification data
  const testData = {
    phone: '2063954410', // Abir Besbes
    message: `🏠 New Property Match!

Hi Abir! We found a home for you in San Antonio, TX:

📍 1439 Caballero
🛏️ 3 bed, 1 bath
💰 $115,000 list price
💵 $544/mo, $50,000 down

View it now: https://ownerfi.ai/dashboard

Reply STOP to unsubscribe`,
    buyerId: 'test-buyer-id',
    buyerName: 'Abir Besbes',
    propertyId: '5di4UYPJgQdJwEH1Cfh4',
    propertyAddress: '1439 Caballero',
    trigger: 'new_property_added'
  };

  console.log('\n\n📤 Sending Test Notification...');
  console.log('='.repeat(80));
  console.log(`To: ${testData.phone}`);
  console.log(`Property: ${testData.propertyAddress}`);

  try {
    const response = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`Response Body: ${responseText.substring(0, 500)}`);

    if (response.ok) {
      console.log('\n✅ SUCCESS! Notification was sent to GHL webhook');
    } else {
      console.log('\n❌ FAILED! GHL webhook returned an error');
      console.log('This could mean:');
      console.log('1. The webhook URL is incorrect');
      console.log('2. The phone number format is wrong');
      console.log('3. GHL webhook expects different data format');
      console.log('4. GHL webhook is not configured to send SMS');
    }

  } catch (error) {
    console.error('\n❌ ERROR sending to GHL webhook:', error);
    console.log('\nThis could mean:');
    console.log('1. Network error');
    console.log('2. Invalid webhook URL');
    console.log('3. Webhook endpoint is down');
  }
}

testNotificationSending();
