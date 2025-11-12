/**
 * Test script to trigger the save-property webhook with 5284 Flowering Peach
 * This will test if Memphis buyers get notified when this property is added
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testFloweringPeachWebhook() {
  console.log('🧪 Testing save-property webhook with 5284 Flowering Peach');
  console.log('================================================\n');

  // Get the base URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  console.log(`📡 Using base URL: ${baseUrl}\n`);

  // Prepare the property data for 5284 Flowering Peach, Memphis, TN
  const propertyPayload = {
    // Required fields
    opportunityId: 'test-flowering-peach-' + Date.now(),
    propertyAddress: '5284 Flowering Peach',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 189900,

    // Optional property details
    bedrooms: 3,
    bathrooms: 2,
    livingArea: 1850,
    yearBuilt: 2005,
    lotSizes: '0.25 acre',
    homeType: 'Single Family',
    zipCode: '38115',

    // Owner financing terms
    downPayment: 10, // 10% down payment
    interestRate: 7.5,
    termYears: 25,

    // Description
    description: 'Beautiful single family home in Memphis, TN. 3 bedrooms, 2 bathrooms with modern updates. Great opportunity for owner financing!',

    // Image (using Google Street View as fallback)
    imageLink: ''
  };

  console.log('📋 Property Details:');
  console.log(`   Address: ${propertyPayload.propertyAddress}`);
  console.log(`   City: ${propertyPayload.propertyCity}, ${propertyPayload.state}`);
  console.log(`   Price: $${propertyPayload.price.toLocaleString()}`);
  console.log(`   Beds/Baths: ${propertyPayload.bedrooms}/${propertyPayload.bathrooms}`);
  console.log(`   Down Payment: ${propertyPayload.downPayment}%`);
  console.log(`   Interest Rate: ${propertyPayload.interestRate}%`);
  console.log(`   Term: ${propertyPayload.termYears} years\n`);

  try {
    console.log('🚀 Sending webhook request...\n');

    const response = await fetch(`${baseUrl}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Skip signature check for testing
        'X-Test-Mode': 'true'
      },
      body: JSON.stringify(propertyPayload)
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}\n`);

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Property saved successfully!');
      console.log('\n📝 Response data:');
      console.log(JSON.stringify(result.data, null, 2));

      console.log('\n⏳ Waiting 5 seconds for buyer matching to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('\n🔍 Now check:');
      console.log('   1. Property was saved to Firestore: properties/' + result.data?.propertyId);
      console.log('   2. Buyer matching was triggered (check logs above)');
      console.log('   3. SMS notifications were sent to Memphis buyers');
      console.log('   4. Check webhookLogs collection for notification records');

    } else {
      console.error('❌ Failed to save property:');
      console.error(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Error during test:');
    console.error(error);
  }

  console.log('\n================================================');
  console.log('🏁 Test complete!');
}

// Run the test
testFloweringPeachWebhook().catch(console.error);
