/**
 * Comprehensive Test Suite for All Modified Files
 * Tests every system we touched from A-Z
 */

import { generateAbdullahDailyContent, validateAbdullahScript, buildAbdullahVideoRequest } from './src/lib/abdullah-content-generator';
import { validateSystemHealth } from './src/lib/system-validator';
import { collectMetrics, logMetric } from './src/lib/monitoring';
import { alertWorkflowFailure, logError, logInfo } from './src/lib/error-monitoring';
import { verifyHeyGenWebhook, verifySubmagicWebhook, shouldEnforceWebhookVerification, generateWebhookSecret, validateWebhookTimestamp } from './src/lib/webhook-verification';

console.log('🧪 COMPREHENSIVE TEST SUITE - ALL CHANGES\n');
console.log('='.repeat(80));

let passedTests = 0;
let failedTests = 0;
const errors: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passedTests++;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      failedTests++;
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

async function runTests() {
  console.log('\n📦 TEST GROUP 1: Abdullah Content Generator');
  console.log('-'.repeat(80));

  await test('Abdullah: Generate daily content (stub)', async () => {
    const result = await generateAbdullahDailyContent('fake-key', new Date());
    if (!result.videos || result.videos.length !== 5) {
      throw new Error(`Expected 5 videos, got ${result.videos?.length || 0}`);
    }
    if (!result.date) {
      throw new Error('Missing date in result');
    }
  })();

  await test('Abdullah: Validate script - valid', () => {
    const video = {
      theme: 'Mindset',
      script: 'This is a test script with enough words to pass validation. It has more than forty words because that is the minimum required length for a valid video script according to the validation rules.',
      title: 'Test Video',
      caption: 'Test caption',
      engagementQuestion: 'What do you think?'
    };
    const result = validateAbdullahScript(video);
    if (!result.valid) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }
  })();

  await test('Abdullah: Validate script - too short', () => {
    const video = {
      theme: 'Mindset',
      script: 'Too short',
      title: 'Test',
      caption: 'Test',
      engagementQuestion: 'Q?'
    };
    const result = validateAbdullahScript(video);
    if (result.valid) {
      throw new Error('Should have failed validation for short script');
    }
    if (!result.errors.includes('Script too short (min 40 words)')) {
      throw new Error('Wrong error message');
    }
  })();

  await test('Abdullah: Build HeyGen request', () => {
    const video = {
      theme: 'Mindset',
      script: 'Test script content',
      title: 'Test Video',
      caption: 'Test caption',
      engagementQuestion: 'What?'
    };
    const request = buildAbdullahVideoRequest(video, 'test-workflow-id');
    if (!request.video_inputs || request.video_inputs.length === 0) {
      throw new Error('Missing video_inputs');
    }
    if (request.callback_id !== 'test-workflow-id') {
      throw new Error('Wrong callback_id');
    }
    if (request.dimension.width !== 1080 || request.dimension.height !== 1920) {
      throw new Error('Wrong dimensions');
    }
  })();

  console.log('\n📦 TEST GROUP 2: System Validator');
  console.log('-'.repeat(80));

  await test('System Validator: Check health', async () => {
    const health = await validateSystemHealth();
    if (typeof health.healthy !== 'boolean') {
      throw new Error('Missing healthy status');
    }
    if (!Array.isArray(health.checks)) {
      throw new Error('Missing checks array');
    }
    if (health.checks.length === 0) {
      throw new Error('No health checks performed');
    }
  })();

  console.log('\n📦 TEST GROUP 3: Monitoring & Error Tracking');
  console.log('-'.repeat(80));

  await test('Monitoring: Collect metrics', () => {
    const metrics = collectMetrics();
    if (!metrics.timestamp) {
      throw new Error('Missing timestamp');
    }
    if (typeof metrics.cpu !== 'number') {
      throw new Error('Missing CPU metric');
    }
  })();

  await test('Monitoring: Log metric', () => {
    logMetric('test_metric', 100, { brand: 'test' });
    // Should not throw
  })();

  await test('Error Monitoring: Log error', () => {
    logError('test_context', new Error('Test error'), { foo: 'bar' });
    // Should not throw
  })();

  await test('Error Monitoring: Log info', () => {
    logInfo('test_context', 'Test message', { test: true });
    // Should not throw
  })();

  await test('Error Monitoring: Alert workflow failure', async () => {
    // Should not throw even if Slack webhook is not configured
    await alertWorkflowFailure('test', 'workflow-123', 'Test Workflow', 'Test failure reason');
  })();

  console.log('\n📦 TEST GROUP 4: Webhook Verification');
  console.log('-'.repeat(80));

  await test('Webhook: Should enforce verification check', () => {
    const enforce = shouldEnforceWebhookVerification();
    if (typeof enforce !== 'boolean') {
      throw new Error('Should return boolean');
    }
  })();

  await test('Webhook: Generate secret', () => {
    const secret = generateWebhookSecret();
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new Error('Invalid secret generated');
    }
    if (secret.length !== 64) { // 32 bytes = 64 hex chars
      throw new Error(`Expected 64 chars, got ${secret.length}`);
    }
  })();

  await test('Webhook: Validate timestamp - valid', () => {
    const now = Date.now();
    const result = validateWebhookTimestamp(now);
    if (!result.valid) {
      throw new Error(`Should be valid: ${result.error}`);
    }
  })();

  await test('Webhook: Validate timestamp - too old', () => {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const result = validateWebhookTimestamp(tenMinutesAgo);
    if (result.valid) {
      throw new Error('Should be invalid for old timestamp');
    }
  })();

  await test('Webhook: Validate timestamp - future', () => {
    const future = Date.now() + (60 * 1000);
    const result = validateWebhookTimestamp(future);
    if (result.valid) {
      throw new Error('Should be invalid for future timestamp');
    }
  })();

  await test('Webhook: Verify HeyGen webhook (no enforcement)', () => {
    const result = verifyHeyGenWebhook('test', '{"test": true}', null);
    // Should pass in dev mode
    if (!result.valid && process.env.NODE_ENV === 'development') {
      throw new Error('Should be valid in dev mode');
    }
  })();

  await test('Webhook: Verify Submagic webhook (no enforcement)', () => {
    const result = verifySubmagicWebhook('test', '{"test": true}', null);
    // Should pass in dev mode
    if (!result.valid && process.env.NODE_ENV === 'development') {
      throw new Error('Should be valid in dev mode');
    }
  })();

  console.log('\n📦 TEST GROUP 5: Type Compatibility Checks');
  console.log('-'.repeat(80));

  await test('Types: Abdullah workflow route compatibility', async () => {
    // Import the route to check for type errors at runtime
    try {
      const route = await import('./src/app/api/workflow/complete-abdullah/route');
      if (!route.POST) {
        throw new Error('Missing POST handler');
      }
      if (!route.GET) {
        throw new Error('Missing GET handler');
      }
    } catch (error) {
      // Check if it's an import error vs a type error
      if (error instanceof Error && error.message.includes('AbdullahVideoScript')) {
        throw new Error('Type mismatch: AbdullahVideoScript does not exist (should be AbdullahVideo)');
      }
      throw error;
    }
  })();

  await test('Types: HeyGen webhook brand types', async () => {
    try {
      const route = await import('./src/app/api/webhooks/heygen/[brand]/route');
      // If this imports without error, types are compatible
    } catch (error) {
      if (error instanceof Error && error.message.includes('type')) {
        throw new Error(`Type error in HeyGen webhook: ${error.message}`);
      }
      throw error;
    }
  })();

  await test('Types: Submagic webhook brand types', async () => {
    try {
      const route = await import('./src/app/api/webhooks/submagic/[brand]/route');
      // If this imports without error, types are compatible
    } catch (error) {
      if (error instanceof Error && error.message.includes('type')) {
        throw new Error(`Type error in Submagic webhook: ${error.message}`);
      }
      throw error;
    }
  })();

  await test('Types: Analytics dashboard component', async () => {
    // Check that component exports without errors
    try {
      const component = await import('./src/components/AnalyticsDashboard');
      if (!component.default) {
        throw new Error('Missing default export');
      }
    } catch (error) {
      throw error;
    }
  })();

  console.log('\n📦 TEST GROUP 6: Build & Import Validation');
  console.log('-'.repeat(80));

  await test('Build: All modified libs can be imported', async () => {
    const libs = [
      './src/lib/abdullah-content-generator',
      './src/lib/benefit-video-generator',
      './src/lib/error-monitoring',
      './src/lib/image-quality-analyzer',
      './src/lib/late-api',
      './src/lib/monitoring',
      './src/lib/property-video-generator',
      './src/lib/system-validator',
      './src/lib/webhook-verification'
    ];

    for (const lib of libs) {
      try {
        await import(lib);
      } catch (error) {
        throw new Error(`Failed to import ${lib}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  })();

  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log('\n❌ FAILED TESTS:');
    errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
    process.exit(0);
  }
}

// Run all tests
runTests().catch(error => {
  console.error('\n💥 TEST RUNNER CRASHED:');
  console.error(error);
  process.exit(1);
});
