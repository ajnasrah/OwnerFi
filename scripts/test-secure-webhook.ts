import crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/gohighlevel/property`;

interface TestResult {
  name: string;
  passed: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
}

function generateSignature(payload: string): string {
  if (!WEBHOOK_SECRET) {
    throw new Error('GHL_WEBHOOK_SECRET not set in environment');
  }

  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

async function testWebhook(testName: string, payload: any, options: {
  includeSignature?: boolean;
  invalidSignature?: boolean;
  customHeaders?: Record<string, string>;
} = {}): Promise<TestResult> {
  const bodyString = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.customHeaders
  };

  if (options.includeSignature !== false) {
    if (options.invalidSignature) {
      headers['X-GHL-Signature'] = 'invalid-signature-12345';
    } else {
      headers['X-GHL-Signature'] = generateSignature(bodyString);
    }
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: bodyString
    });

    const data = await response.json();

    return {
      name: testName,
      passed: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      response: data
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTests() {
  console.log('\n🔒 SECURE WEBHOOK TESTING SUITE');
  console.log('='.repeat(80));
  console.log(`\nWebhook URL: ${WEBHOOK_URL}`);
  console.log(`Secret configured: ${!!WEBHOOK_SECRET ? '✅ Yes' : '❌ No'}`);

  if (!WEBHOOK_SECRET) {
    console.log('\n❌ ERROR: GHL_WEBHOOK_SECRET not set in .env.local');
    console.log('Please set it before running tests.');
    process.exit(1);
  }

  const results: TestResult[] = [];

  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Valid Request with Signature');
  console.log('='.repeat(80));

  const validPayload = {
    opportunityId: 'test_' + Date.now(),
    propertyAddress: '123 Test St',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 250000,
    bedrooms: 3,
    bathrooms: 2,
    livingArea: 1500,
    yearBuilt: 2020,
    description: 'Test property for webhook validation',
    downPaymentAmount: 25000,
    interestRate: 5.5,
    monthlyPayment: 1500,
    termYears: 30
  };

  const test1 = await testWebhook('Valid request with signature', validPayload);
  results.push(test1);

  console.log(`Status: ${test1.statusCode}`);
  console.log(`Result: ${test1.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Response:`, JSON.stringify(test1.response, null, 2).substring(0, 300));

  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Request WITHOUT Signature (Should Fail)');
  console.log('='.repeat(80));

  const test2 = await testWebhook('Request without signature', validPayload, {
    includeSignature: false
  });
  results.push(test2);

  console.log(`Status: ${test2.statusCode}`);
  console.log(`Expected: 401 (Unauthorized)`);
  console.log(`Result: ${test2.statusCode === 401 ? '✅ PASS - Correctly rejected' : '❌ FAIL - Should reject'}`);
  console.log(`Response:`, JSON.stringify(test2.response, null, 2).substring(0, 200));

  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Request with INVALID Signature (Should Fail)');
  console.log('='.repeat(80));

  const test3 = await testWebhook('Request with invalid signature', validPayload, {
    invalidSignature: true
  });
  results.push(test3);

  console.log(`Status: ${test3.statusCode}`);
  console.log(`Expected: 401 (Unauthorized)`);
  console.log(`Result: ${test3.statusCode === 401 ? '✅ PASS - Correctly rejected' : '❌ FAIL - Should reject'}`);
  console.log(`Response:`, JSON.stringify(test3.response, null, 2).substring(0, 200));

  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Request with Missing Required Fields (Should Fail)');
  console.log('='.repeat(80));

  const invalidPayload = {
    opportunityId: 'test_' + Date.now(),
    // Missing propertyAddress, propertyCity, state, price
  };

  const test4 = await testWebhook('Missing required fields', invalidPayload);
  results.push(test4);

  console.log(`Status: ${test4.statusCode}`);
  console.log(`Expected: 400 (Bad Request)`);
  console.log(`Result: ${test4.statusCode === 400 ? '✅ PASS - Correctly rejected' : '❌ FAIL - Should reject'}`);
  console.log(`Response:`, JSON.stringify(test4.response, null, 2).substring(0, 300));

  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Rate Limiting Test (Should Eventually Fail)');
  console.log('='.repeat(80));

  console.log('Sending 10 rapid requests to test rate limiting...');
  let rateLimitHit = false;

  for (let i = 0; i < 10; i++) {
    const payload = {
      ...validPayload,
      opportunityId: 'rate_test_' + Date.now() + '_' + i
    };

    const result = await testWebhook(`Rate limit test ${i + 1}`, payload);

    if (result.statusCode === 429) {
      console.log(`\n✅ Rate limit hit after ${i + 1} requests`);
      rateLimitHit = true;
      break;
    }

    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
  }

  if (!rateLimitHit) {
    console.log(`\n⚠️  Rate limit not hit in 10 requests (limit may be higher)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: GET Request (Should Fail - Method Not Allowed)');
  console.log('='.repeat(80));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET'
    });

    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log(`Expected: 405 (Method Not Allowed)`);
    console.log(`Result: ${response.status === 405 ? '✅ PASS - Correctly rejected' : '❌ FAIL - Should reject'}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`❌ FAIL - Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const totalTests = results.length;
  const passedTests = results.filter(r => {
    // For security tests, we want failures (rejection)
    if (r.name.includes('without signature') || r.name.includes('invalid signature')) {
      return r.statusCode === 401;
    }
    if (r.name.includes('Missing required')) {
      return r.statusCode === 400;
    }
    return r.passed;
  }).length;

  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);

  results.forEach((result, i) => {
    let expectedResult = 'Should succeed';
    let actualPassed = result.passed;

    if (result.name.includes('without signature') || result.name.includes('invalid signature')) {
      expectedResult = 'Should reject (401)';
      actualPassed = result.statusCode === 401;
    } else if (result.name.includes('Missing required')) {
      expectedResult = 'Should reject (400)';
      actualPassed = result.statusCode === 400;
    }

    const status = actualPassed ? '✅' : '❌';
    console.log(`\n${status} ${i + 1}. ${result.name}`);
    console.log(`   ${expectedResult}`);
    console.log(`   Status: ${result.statusCode || 'Error'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('🎯 SECURITY VERIFICATION');
  console.log('='.repeat(80));

  const securityChecks = [
    {
      name: 'Signature verification enabled',
      passed: results.find(r => r.name.includes('without signature'))?.statusCode === 401
    },
    {
      name: 'Invalid signatures rejected',
      passed: results.find(r => r.name.includes('invalid signature'))?.statusCode === 401
    },
    {
      name: 'Input validation working',
      passed: results.find(r => r.name.includes('Missing required'))?.statusCode === 400
    },
    {
      name: 'Valid requests accepted',
      passed: results.find(r => r.name === 'Valid request with signature')?.passed === true
    }
  ];

  securityChecks.forEach(check => {
    console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
  });

  const allSecurityChecksPassed = securityChecks.every(c => c.passed);

  if (allSecurityChecksPassed) {
    console.log('\n\n🎉 ALL SECURITY CHECKS PASSED!');
    console.log('The webhook is properly secured and ready for production.');
  } else {
    console.log('\n\n⚠️  SOME SECURITY CHECKS FAILED!');
    console.log('Please review the results and fix any issues before deploying.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Next Steps:');
  console.log('1. Review the test results above');
  console.log('2. Configure GoHighLevel to use the new webhook URL');
  console.log('3. Set the webhook secret in GoHighLevel (same as GHL_WEBHOOK_SECRET)');
  console.log('4. Monitor logs for any authentication failures');
  console.log('5. Deploy to production when ready');
  console.log('='.repeat(80) + '\n');
}

runTests().catch(console.error);
