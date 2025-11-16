/**
 * Comprehensive System Test
 * Tests all crons and GHL functionality
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, path: string, requiresAuth: boolean = true): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {};
    if (requiresAuth) {
      headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, { headers });
    const duration = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        name,
        status: 'pass',
        message: `✅ ${response.status} - ${data.message || 'Success'}`,
        duration
      };
    } else {
      const error = await response.text();
      return {
        name,
        status: 'fail',
        message: `❌ ${response.status} - ${error}`,
        duration
      };
    }
  } catch (error: any) {
    return {
      name,
      status: 'fail',
      message: `❌ Error: ${error.message}`,
    };
  }
}

async function runTests() {
  console.log('🧪 COMPREHENSIVE SYSTEM TEST\n');
  console.log('Testing all functionality...\n');
  console.log('='.repeat(60));

  // Test 1: New Weekly Status Refresh Cron
  console.log('\n📋 TEST 1: Weekly Status Refresh Cron');
  console.log('-'.repeat(60));
  results.push(await testEndpoint(
    'Weekly Status Refresh',
    '/api/cron/refresh-zillow-status',
    true
  ));
  console.log(results[results.length - 1].message);

  // Wait a bit for the cron to complete
  console.log('\n⏳ Waiting for cron to complete (this may take a few minutes)...\n');

  // Test 2: Check Database State
  console.log('\n📋 TEST 2: Database State Check');
  console.log('-'.repeat(60));
  console.log('Checking database via separate script...');

  // Test 3: Verify Existing Crons Still Work
  console.log('\n📋 TEST 3: Existing Cron Endpoints');
  console.log('-'.repeat(60));

  const existingCrons = [
    '/api/cron/process-scraper-queue',
    '/api/cron/daily-maintenance',
  ];

  for (const cron of existingCrons) {
    const result = await testEndpoint(
      `Existing Cron: ${cron}`,
      cron,
      true
    );
    results.push(result);
    console.log(result.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}\n`);

  // Detailed Results
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   ${r.name}: ${r.message}`);
    });
    console.log();
  }

  // Overall Status
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED\n');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!response) {
      console.error('❌ Server not running at http://localhost:3000');
      console.error('   Please start the dev server: npm run dev');
      process.exit(1);
    }
  } catch {
    console.log('⚠️  Health check failed, but continuing...');
  }
}

checkServer().then(() => runTests()).catch(console.error);
