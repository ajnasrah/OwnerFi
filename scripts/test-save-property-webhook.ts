import { config } from 'dotenv';

config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testSavePropertyWebhook() {
  console.log('🧪 Testing GHL Save Property Webhook\n');
  console.log(`Endpoint: ${BASE_URL}/api/gohighlevel/webhook/save-property\n`);

  // Sample property data - THIS IS WHAT GHL SHOULD BE SENDING
  const testProperty = {
    opportunityId: 'test_opp_' + Date.now(),
    opportunityName: '123 Test Street',
    propertyAddress: '123 Test Street',
    propertyCity: 'Memphis',
    state: 'TN',
    zipCode: '38103',
    price: '150000',
    bedrooms: '3',
    bathrooms: '2',
    livingArea: '1500',
    yearBuilt: '2000',
    lotSizes: '0.25 acres',
    homeType: 'Single Family',
    description: 'Beautiful test property',
    downPaymentAmount: '15000',
    downPayment: '10',
    interestRate: '6.5',
    monthlyPayment: '850',
    balloon: '5'
  };

  console.log('📤 Sending test property data:');
  console.log(JSON.stringify(testProperty, null, 2));
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    // Test 1: Send in BODY (like a normal REST API)
    console.log('TEST 1: Sending data in request BODY');
    console.log('-'.repeat(80));

    const response1 = await fetch(`${BASE_URL}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testProperty)
    });

    const result1 = await response1.json();

    console.log(`Status: ${response1.status}`);
    console.log('Response:', JSON.stringify(result1, null, 2));

    if (response1.ok) {
      console.log('✅ TEST 1 PASSED: Property saved with body data\n');
    } else {
      console.log('❌ TEST 1 FAILED:', result1.error);
      if (result1.details) {
        console.log('   Validation errors:', result1.details);
      }
      console.log('');
    }

    console.log('='.repeat(80) + '\n');

    // Test 2: Send in HEADERS (like GHL actually does)
    console.log('TEST 2: Sending data in request HEADERS (GHL style)');
    console.log('-'.repeat(80));

    const headersWithData = {
      'Content-Type': 'application/json',
      'opportunityid': testProperty.opportunityId,
      'opportunityname': testProperty.opportunityName,
      'propertyaddress': testProperty.propertyAddress,
      'propertycity': testProperty.propertyCity,
      'state': testProperty.state,
      'zipcode': testProperty.zipCode,
      'price': testProperty.price,
      'bedrooms': testProperty.bedrooms,
      'bathrooms': testProperty.bathrooms,
      'livingarea': testProperty.livingArea,
      'yearbuilt': testProperty.yearBuilt,
      'lotsizes': testProperty.lotSizes,
      'hometype': testProperty.homeType,
      'description': testProperty.description,
      'downpaymentamount': testProperty.downPaymentAmount,
      'downpayment': testProperty.downPayment,
      'interestrate': testProperty.interestRate,
      'monthlypayment': testProperty.monthlyPayment,
      'balloon': testProperty.balloon
    };

    const response2 = await fetch(`${BASE_URL}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: headersWithData,
      body: JSON.stringify({ opportunityId: testProperty.opportunityId })
    });

    const result2 = await response2.json();

    console.log(`Status: ${response2.status}`);
    console.log('Response:', JSON.stringify(result2, null, 2));

    if (response2.ok) {
      console.log('✅ TEST 2 PASSED: Property saved with header data\n');
    } else {
      console.log('❌ TEST 2 FAILED:', result2.error);
      if (result2.details) {
        console.log('   Validation errors:', result2.details);
      }
      console.log('');
    }

    console.log('='.repeat(80) + '\n');
    console.log('📋 SUMMARY:');
    console.log('-'.repeat(80));
    console.log(`Test 1 (Body): ${response1.ok ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 2 (Headers): ${response2.ok ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (!response1.ok && !response2.ok) {
      console.log('⚠️  BOTH TESTS FAILED');
      console.log('This means the webhook is NOT working with either format.');
      console.log('\nCheck:');
      console.log('1. Is your dev server running? (npm run dev)');
      console.log('2. Are you testing against the right URL?');
      console.log('3. Check the terminal logs for detailed error messages');
    }

  } catch (error) {
    console.error('❌ Network Error:', error);
    console.error('\nMake sure your development server is running:');
    console.error('  npm run dev');
  }
}

testSavePropertyWebhook()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
