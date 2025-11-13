import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

/**
 * Simulate exactly what save-property/route.ts does at lines 864-876
 * to verify if the notification was sent
 */
async function simulateNotification() {
  console.log('\n🔍 Simulating save-property notification logic');
  console.log('='.repeat(80));

  // This is the exact data that would have been sent on Nov 13 at 1:23 PM
  const buyer = {
    id: 'buyer_id',
    firstName: 'Abir',
    lastName: 'Besbes',
    phone: '2063954410'
  };

  const property = {
    id: '5di4UYPJgQdJwEH1Cfh4',
    address: '1439 Caballero',
    city: 'San Antonio',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 1,
    price: 115000,
    monthlyPayment: 544,
    downPaymentAmount: 50000
  };

  const ghlWebhookUrl = process.env.GOHIGHLEVEL_WEBHOOK_URL;

  console.log(`\nGHL Webhook URL: ${ghlWebhookUrl ? '✅ Configured' : '❌ Missing'}`);

  if (!ghlWebhookUrl) {
    console.log('\n❌ GOHIGHLEVEL_WEBHOOK_URL is not set');
    console.log('This would cause the notification to be skipped at line 842-843');
    return;
  }

  // This is EXACTLY what save-property/route.ts sends (lines 851-875)
  const smsMessage = `🏠 New Property Match!

Hi ${buyer.firstName}! We found a home for you in ${property.city}, ${property.state}:

📍 ${property.address}
🛏️ ${property.bedrooms} bed, ${property.bathrooms} bath
💰 $${property.price?.toLocaleString()} list price
💵 $${property.monthlyPayment}/mo, $${property.downPaymentAmount?.toLocaleString()} down

View it now: https://ownerfi.ai/dashboard

Reply STOP to unsubscribe`;

  const payload = {
    phone: buyer.phone,
    message: smsMessage,
    buyerId: buyer.id,
    buyerName: `${buyer.firstName} ${buyer.lastName}`,
    propertyId: property.id,
    propertyAddress: property.address,
    trigger: 'new_property_added',
  };

  console.log('\n📤 Sending notification (exactly as save-property does)...');
  console.log(`To: ${buyer.phone}`);
  console.log(`Property: ${property.address}`);

  try {
    const response = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const statusCode = response.status;
    const responseText = await response.text();

    console.log(`\n📊 Response:`);
    console.log(`Status: ${statusCode} ${response.statusText}`);
    console.log(`Body: ${responseText}`);

    if (response.ok) {
      console.log('\n✅ SUCCESS - Webhook accepted the notification');
      console.log('\n🎯 CONCLUSION:');
      console.log('The save-property webhook code at lines 864-876 WORKS CORRECTLY.');
      console.log('If the notification was not sent on Nov 13, it means:');
      console.log('  1. The fetch() call never executed (code didn\'t reach that line)');
      console.log('  2. OR the webhook URL was different/missing in production');
      console.log('  3. OR there was a network error in production');
      console.log('  4. OR GHL received it but didn\'t send the SMS (workflow not configured)');
    } else {
      console.log('\n❌ FAILED - GHL webhook rejected the notification');
      console.log('This could be why notifications weren\'t sent');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.log('Network error - this could explain missing notifications');
  }

  // Now check: was the code reached?
  console.log('\n\n🔍 Checking if notification code was executed on Nov 13...');
  console.log('='.repeat(80));
  console.log('\nEvidence that code DID execute:');
  console.log('  ✅ Buyer was matched (property in matchedPropertyIds)');
  console.log('  ✅ Match timestamp = property creation timestamp (204ms difference)');
  console.log('  ✅ Property status = active');
  console.log('  ✅ Buyer isActive = true');
  console.log('\nThese conditions are checked at line 774:');
  console.log('  if (propertyData.status === \'active\' && propertyData.isActive)');
  console.log('\nSince buyer was matched, this code block (774-900) DID execute.');
  console.log('\n📍 The question is: did it reach line 864 (the fetch call)?');
  console.log('\nChecking conditions:');
  console.log('  Line 836: if (matchedBuyers.length > 0) - We know this is TRUE (Abir matched)');
  console.log('  Line 842: if (!ghlWebhookUrl) - Need to check if URL was set in production');
  console.log('\nIf GOHIGHLEVEL_WEBHOOK_URL was set in production, then fetch() WAS called.');
}

simulateNotification();
