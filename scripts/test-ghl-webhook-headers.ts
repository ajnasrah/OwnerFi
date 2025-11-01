import { config } from 'dotenv';

config({ path: '.env.local' });

const WEBHOOK_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/gohighlevel/webhook/save-property`
  : 'http://localhost:3000/api/gohighlevel/webhook/save-property';

async function testWebhookHeaders() {
  console.log('🧪 Testing GHL webhook header handling...\n');
  console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

  // Test 1: With description in various header formats
  const testCases = [
    {
      name: 'lowercase description header',
      headers: {
        'opportunityid': 'test-prop-123',
        'propertyaddress': '123 Test St',
        'propertycity': 'Dallas',
        'state': 'TX',
        'price': '250000',
        'bedrooms': '3',
        'bathrooms': '2',
        'description': 'Beautiful 3-bed home with modern kitchen and large backyard'
      }
    },
    {
      name: 'camelCase description header',
      headers: {
        'opportunityid': 'test-prop-456',
        'propertyaddress': '456 Sample Ave',
        'propertycity': 'Dallas',
        'state': 'TX',
        'price': '350000',
        'bedrooms': '4',
        'bathrooms': '3',
        'Description': 'Stunning 4-bedroom home in great location'
      }
    },
    {
      name: 'propertyDescription header',
      headers: {
        'opportunityid': 'test-prop-789',
        'propertyaddress': '789 Example Ln',
        'propertycity': 'Dallas',
        'state': 'TX',
        'price': '450000',
        'bedrooms': '5',
        'bathrooms': '4',
        'propertyDescription': 'Luxury 5-bedroom estate with pool'
      }
    },
    {
      name: 'NO description (simulating GHL issue)',
      headers: {
        'opportunityid': 'test-prop-000',
        'propertyaddress': '000 Missing Desc Rd',
        'propertycity': 'Dallas',
        'state': 'TX',
        'price': '200000',
        'bedrooms': '3',
        'bathrooms': '2'
        // No description header at all
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log('='.repeat(60));

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...testCase.headers
        },
        body: JSON.stringify({
          opportunityId: testCase.headers.opportunityid
        })
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(responseData, null, 2));

      if (response.ok) {
        console.log('✅ SUCCESS');
      } else {
        console.log('❌ FAILED');
      }

    } catch (error) {
      console.log('❌ ERROR:', error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete!');
  console.log('='.repeat(60));
}

testWebhookHeaders();
