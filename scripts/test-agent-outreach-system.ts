/**
 * Test Script: Agent Outreach System
 *
 * Tests all components of the agent outreach system:
 * 1. Scraper cron
 * 2. Queue processor
 * 3. Webhook handler
 * 4. Admin stats
 *
 * Usage:
 *   npx tsx scripts/test-agent-outreach-system.ts
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

async function testScraper() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: Agent Outreach Scraper');
  console.log('='.repeat(60));

  if (!CRON_SECRET) {
    console.error('❌ CRON_SECRET not found in .env.local');
    return false;
  }

  try {
    console.log(`📡 Calling: ${BASE_URL}/api/cron/run-agent-outreach-scraper\n`);

    const response = await fetch(`${BASE_URL}/api/cron/run-agent-outreach-scraper`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Scraper completed successfully!\n');
      console.log('Results:');
      console.log(`   Properties found: ${data.propertiesFound}`);
      console.log(`   Added to queue: ${data.addedToQueue}`);
      console.log(`   Cash deals: ${data.stats?.cashDeals || 0}`);
      console.log(`   Potential owner finance: ${data.stats?.potentialOwnerFinance || 0}`);
      console.log(`   Skipped (has owner finance): ${data.skipped?.ownerFinance || 0}`);
      console.log(`   Duration: ${data.duration}`);
      return true;
    } else {
      console.error('❌ Scraper failed:\n');
      console.error(JSON.stringify(data, null, 2));
      return false;
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testQueueProcessor() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 2: Queue Processor');
  console.log('='.repeat(60));

  if (!CRON_SECRET) {
    console.error('❌ CRON_SECRET not found in .env.local');
    return false;
  }

  try {
    console.log(`📡 Calling: ${BASE_URL}/api/cron/process-agent-outreach-queue\n`);

    const response = await fetch(`${BASE_URL}/api/cron/process-agent-outreach-queue`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Queue processor completed successfully!\n');
      console.log('Results:');
      console.log(`   Batch size: ${data.batchSize}`);
      console.log(`   Sent to GHL: ${data.sent}`);
      console.log(`   Errors: ${data.errors}`);
      console.log(`   Duration: ${data.duration}`);

      if (data.errorDetails && data.errorDetails.length > 0) {
        console.log('\n❌ Errors:');
        data.errorDetails.forEach((err: any) => {
          console.log(`   ${err.address}: ${err.error}`);
        });
      }

      return true;
    } else {
      console.error('❌ Queue processor failed:\n');
      console.error(JSON.stringify(data, null, 2));
      return false;
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testWebhook() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 3: Webhook Handler');
  console.log('='.repeat(60));

  console.log('⚠️  NOTE: This test requires a valid firebaseId from the queue');
  console.log('⚠️  Skipping automated test - you can test manually with:');
  console.log('\ncurl -X POST "http://localhost:3000/api/webhooks/gohighlevel/agent-response" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "x-webhook-signature: YOUR_SIGNATURE" \\');
  console.log('  -d \'{"firebaseId": "YOUR_QUEUE_DOC_ID", "response": "yes"}\'');
  console.log('');

  return true;
}

async function testAdminStats() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 4: Admin Stats Endpoint');
  console.log('='.repeat(60));

  console.log('⚠️  NOTE: This test requires authentication');
  console.log('⚠️  You can test this endpoint after logging in as admin');
  console.log('\nURL: GET /api/admin/agent-outreach-queue/stats');
  console.log('');

  return true;
}

async function checkEnvironmentVariables() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Checking Environment Variables');
  console.log('='.repeat(60));

  const required = [
    'CRON_SECRET',
    'APIFY_API_KEY',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'GHL_WEBHOOK_SECRET',
  ];

  const optional = [
    'GHL_AGENT_OUTREACH_WEBHOOK_URL',
  ];

  let allPresent = true;

  console.log('\n✅ Required variables:');
  required.forEach(key => {
    const value = process.env[key];
    if (value) {
      console.log(`   ✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${key}: MISSING`);
      allPresent = false;
    }
  });

  console.log('\n⚠️  Optional variables (needed for production):');
  optional.forEach(key => {
    const value = process.env[key];
    if (value) {
      console.log(`   ✅ ${key}: ${value.substring(0, 40)}...`);
    } else {
      console.log(`   ⚠️  ${key}: Not set (will need this for GHL integration)`);
    }
  });

  return allPresent;
}

async function runAllTests() {
  console.log('🚀 Starting Agent Outreach System Tests\n');

  // Check environment
  const envCheck = await checkEnvironmentVariables();
  if (!envCheck) {
    console.error('\n❌ Missing required environment variables. Please check .env.local');
    process.exit(1);
  }

  // Run tests
  const results = {
    scraper: false,
    processor: false,
    webhook: true, // Manual test
    stats: true,   // Manual test
  };

  results.scraper = await testScraper();
  results.processor = await testQueueProcessor();
  await testWebhook();
  await testAdminStats();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  console.log('\n✅ Automated Tests:');
  console.log(`   Scraper: ${results.scraper ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Queue Processor: ${results.processor ? '✅ PASSED' : '❌ FAILED'}`);

  console.log('\n⚠️  Manual Tests Required:');
  console.log('   Webhook Handler: Test manually with curl command above');
  console.log('   Admin Stats: Test in browser after logging in');

  console.log('\n' + '='.repeat(60));

  const allPassed = results.scraper && results.processor;
  if (allPassed) {
    console.log('✅ All automated tests passed!');
    console.log('✅ System is ready for deployment');
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
  }

  console.log('='.repeat(60) + '\n');
}

runAllTests().catch(console.error);
