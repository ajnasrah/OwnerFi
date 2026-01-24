/**
 * Test script for agent-response webhook
 *
 * This simulates what GHL should send when stage changes
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/gohighlevel/agent-response`
  : 'http://localhost:3000/api/webhooks/gohighlevel/agent-response';

const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

// Sample firebase_id from agent_outreach_queue (use a real one for testing)
const TEST_FIREBASE_ID = process.argv[2] || '88zqMqibCHlAgrH5GazC';
const TEST_RESPONSE = (process.argv[3] || 'yes') as 'yes' | 'no';

async function testWebhook() {
  console.log('========================================');
  console.log('TESTING AGENT RESPONSE WEBHOOK');
  console.log('========================================\n');

  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Firebase ID: ${TEST_FIREBASE_ID}`);
  console.log(`Response: ${TEST_RESPONSE}`);
  console.log(`Secret configured: ${GHL_WEBHOOK_SECRET ? 'YES' : 'NO'}`);
  console.log('');

  const payload = {
    firebaseId: TEST_FIREBASE_ID,
    response: TEST_RESPONSE,
    agentNote: 'Test from script'
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': GHL_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`Response Status: ${response.status}`);
    console.log('Response Body:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook call successful!');
      console.log('\nThis means GHL just needs to be configured to send this same payload.');
    } else {
      console.log('\n❌ Webhook call failed');
      console.log('\nCheck:');
      console.log('1. GHL_WEBHOOK_SECRET is correct');
      console.log('2. The firebase_id exists in agent_outreach_queue');
    }

  } catch (error) {
    console.error('Error calling webhook:', error);
  }
}

// Also show what GHL workflow should look like
console.log('\n========================================');
console.log('GHL WORKFLOW CONFIGURATION');
console.log('========================================\n');

console.log(`
In GoHighLevel, create this workflow:

TRIGGER: Opportunity Stage Changed
PIPELINE: MLS Active/non seller finance

CONDITION 1: New Stage = "Interested"
ACTION: Webhook
  URL: https://ownerfi.ai/api/webhooks/gohighlevel/agent-response
  Method: POST
  Headers:
    Content-Type: application/json
    x-webhook-signature: ${GHL_WEBHOOK_SECRET || '[YOUR_SECRET]'}
  Body:
    {
      "firebaseId": "{{opportunity.firebase_id}}",
      "response": "yes"
    }

CONDITION 2: New Stage = "not interested"
ACTION: Webhook (same URL)
  Body:
    {
      "firebaseId": "{{opportunity.firebase_id}}",
      "response": "no"
    }
`);

testWebhook();
