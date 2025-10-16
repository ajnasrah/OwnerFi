#!/usr/bin/env ts-node
/**
 * WORKFLOW FAILURE DIAGNOSTIC SCRIPT
 *
 * This script checks all critical APIs and system components to diagnose
 * the 51.6% Carz workflow failure rate (15 failed workflows).
 *
 * Checks:
 * 1. HeyGen API - Credits, rate limits, authentication
 * 2. Submagic API - Authentication, project status
 * 3. Webhook configuration - URLs, accessibility
 * 4. Firebase/Firestore - Stuck workflows, error patterns
 * 5. Environment variables - Missing or invalid keys
 *
 * Run: npx ts-node scripts/diagnose-workflow-failures.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

interface DiagnosticResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  action?: string;
}

const results: DiagnosticResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function addResult(result: DiagnosticResult) {
  results.push(result);

  const emoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  log(emoji, `${result.component}: ${result.message}`);

  if (result.details) {
    console.log('   Details:', JSON.stringify(result.details, null, 2));
  }

  if (result.action) {
    console.log(`   Action: ${result.action}`);
  }

  console.log('');
}

/**
 * 1. Check Environment Variables
 */
async function checkEnvironment() {
  log('🔍', '=== CHECKING ENVIRONMENT VARIABLES ===\n');

  const requiredVars = [
    'HEYGEN_API_KEY',
    'SUBMAGIC_API_KEY',
    'OPENAI_API_KEY',
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'NEXT_PUBLIC_BASE_URL'
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];

    if (!value) {
      addResult({
        component: `ENV: ${varName}`,
        status: 'fail',
        message: 'Missing environment variable',
        action: `Add ${varName} to .env.local file`
      });
    } else if (value.length < 10) {
      addResult({
        component: `ENV: ${varName}`,
        status: 'warning',
        message: 'Environment variable seems too short',
        details: { length: value.length },
        action: `Verify ${varName} is correct`
      });
    } else {
      addResult({
        component: `ENV: ${varName}`,
        status: 'pass',
        message: 'Present and valid length',
        details: { length: value.length, preview: value.substring(0, 10) + '...' }
      });
    }
  }
}

/**
 * 2. Check HeyGen API
 */
async function checkHeyGenAPI() {
  log('🎥', '=== CHECKING HEYGEN API ===\n');

  const apiKey = process.env.HEYGEN_API_KEY;

  if (!apiKey) {
    addResult({
      component: 'HeyGen API',
      status: 'fail',
      message: 'API key not found',
      action: 'Add HEYGEN_API_KEY to .env.local'
    });
    return;
  }

  try {
    // Check HeyGen credit balance
    const response = await fetch('https://api.heygen.com/v1/user.remaining_quota', {
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      addResult({
        component: 'HeyGen API',
        status: 'fail',
        message: `Authentication failed (${response.status})`,
        details: { error: errorText },
        action: response.status === 401 ?
          'HEYGEN_API_KEY is invalid - get new key from https://app.heygen.com/settings/api' :
          'Check HeyGen API status at https://status.heygen.com'
      });
      return;
    }

    const data = await response.json();
    const credits = data.data?.remaining_quota || data.remaining_quota || 0;

    if (credits < 10) {
      addResult({
        component: 'HeyGen API',
        status: 'fail',
        message: `LOW CREDITS: Only ${credits} credits remaining`,
        details: { remaining: credits },
        action: 'Add credits at https://app.heygen.com/billing - CRITICAL for workflow success!'
      });
    } else if (credits < 50) {
      addResult({
        component: 'HeyGen API',
        status: 'warning',
        message: `Low credits: ${credits} remaining`,
        details: { remaining: credits },
        action: 'Consider adding more credits soon'
      });
    } else {
      addResult({
        component: 'HeyGen API',
        status: 'pass',
        message: `Authenticated successfully - ${credits} credits remaining`,
        details: { remaining: credits }
      });
    }
  } catch (error) {
    addResult({
      component: 'HeyGen API',
      status: 'fail',
      message: 'Failed to connect to HeyGen API',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      action: 'Check internet connection and HeyGen API status'
    });
  }
}

/**
 * 3. Check Submagic API
 */
async function checkSubmagicAPI() {
  log('✨', '=== CHECKING SUBMAGIC API ===\n');

  const apiKey = process.env.SUBMAGIC_API_KEY;

  if (!apiKey) {
    addResult({
      component: 'Submagic API',
      status: 'fail',
      message: 'API key not found',
      action: 'Add SUBMAGIC_API_KEY to .env.local'
    });
    return;
  }

  try {
    // Try to list projects to verify API key
    const response = await fetch('https://api.submagic.co/v1/projects?limit=1', {
      headers: {
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      addResult({
        component: 'Submagic API',
        status: 'fail',
        message: `Authentication failed (${response.status})`,
        details: { error: errorText },
        action: response.status === 401 || response.status === 403 ?
          'SUBMAGIC_API_KEY is invalid - get new key from Submagic dashboard' :
          'Check Submagic API status'
      });
      return;
    }

    const data = await response.json();

    addResult({
      component: 'Submagic API',
      status: 'pass',
      message: 'Authenticated successfully',
      details: {
        recentProjects: data.length || 0,
        sample: data[0] ? { id: data[0].id, status: data[0].status } : null
      }
    });
  } catch (error) {
    addResult({
      component: 'Submagic API',
      status: 'fail',
      message: 'Failed to connect to Submagic API',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      action: 'Check internet connection and Submagic API status'
    });
  }
}

/**
 * 4. Check Webhook URLs
 */
async function checkWebhooks() {
  log('📡', '=== CHECKING WEBHOOK CONFIGURATION ===\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!baseUrl) {
    addResult({
      component: 'Webhook Config',
      status: 'fail',
      message: 'No base URL configured',
      action: 'Set NEXT_PUBLIC_BASE_URL in .env.local (e.g., https://ownerfi.ai)'
    });
    return;
  }

  const webhooks = [
    { name: 'HeyGen Webhook', path: '/api/webhooks/heygen' },
    { name: 'Submagic Webhook', path: '/api/webhooks/submagic' }
  ];

  addResult({
    component: 'Webhook Base URL',
    status: 'pass',
    message: `Configured: ${baseUrl}`,
    details: { baseUrl }
  });

  for (const webhook of webhooks) {
    const url = `${baseUrl}${webhook.path}`;

    try {
      // Test webhook endpoint accessibility (OPTIONS for CORS)
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://api.heygen.com' }
      });

      if (response.ok || response.status === 404) {
        addResult({
          component: webhook.name,
          status: 'pass',
          message: `Endpoint accessible at ${url}`,
          details: { status: response.status }
        });
      } else {
        addResult({
          component: webhook.name,
          status: 'warning',
          message: `Endpoint returned ${response.status}`,
          details: { url, status: response.status },
          action: 'Verify webhook endpoint is deployed'
        });
      }
    } catch (error) {
      addResult({
        component: webhook.name,
        status: 'fail',
        message: 'Endpoint not accessible',
        details: { url, error: error instanceof Error ? error.message : 'Unknown' },
        action: 'Ensure application is deployed and accessible'
      });
    }
  }
}

/**
 * 5. Check Firebase/Firestore for stuck workflows
 */
async function checkFirestore() {
  log('🔥', '=== CHECKING FIREBASE/FIRESTORE ===\n');

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    addResult({
      component: 'Firebase',
      status: 'fail',
      message: 'Service account key not found',
      action: 'Add FIREBASE_SERVICE_ACCOUNT_KEY to .env.local'
    });
    return;
  }

  try {
    // Validate JSON format
    JSON.parse(serviceAccountKey);

    addResult({
      component: 'Firebase Config',
      status: 'pass',
      message: 'Service account key is valid JSON'
    });

    // Try to initialize Firebase and query workflows
    const { db } = await import('../src/lib/firebase');

    if (!db) {
      addResult({
        component: 'Firebase',
        status: 'fail',
        message: 'Firebase client failed to initialize',
        action: 'Check Firebase configuration in src/lib/firebase.ts'
      });
      return;
    }

    const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');

    // Check Carz workflows
    const carzFailedQuery = query(
      collection(db, 'carz_workflow_queue'),
      where('status', '==', 'failed'),
      orderBy('updatedAt', 'desc')
    );

    const carzFailedSnapshot = await getDocs(carzFailedQuery);
    const carzFailedWorkflows = carzFailedSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        error: data.error || 'No error message',
        status: data.status,
        updatedAt: data.updatedAt,
        age: Math.round((Date.now() - (data.updatedAt || 0)) / 60000) // minutes
      };
    });

    if (carzFailedWorkflows.length > 0) {
      const recentErrors = carzFailedWorkflows.slice(0, 5).map(w => ({
        id: w.id,
        error: w.error,
        ageMinutes: w.age,
        status: w.status
      }));

      addResult({
        component: 'Carz Workflows',
        status: 'fail',
        message: `${carzFailedWorkflows.length} FAILED workflows found`,
        details: {
          total: carzFailedWorkflows.length,
          recentErrors: recentErrors.slice(0, 3)
        },
        action: `Check dashboard at /admin/social-dashboard to see error details`
      });
    } else {
      addResult({
        component: 'Carz Workflows',
        status: 'pass',
        message: 'No failed workflows'
      });
    }

    // Check for stuck workflows
    const carzStuckQuery = query(
      collection(db, 'carz_workflow_queue'),
      where('status', 'in', ['heygen_processing', 'submagic_processing', 'posting'])
    );

    const carzStuckSnapshot = await getDocs(carzStuckQuery);
    const stuckWorkflows = carzStuckSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        stuckMinutes: Math.round((Date.now() - (data.updatedAt || 0)) / 60000)
      };
    }).filter(w => w.stuckMinutes > 30); // Stuck > 30 min

    if (stuckWorkflows.length > 0) {
      addResult({
        component: 'Carz Stuck Workflows',
        status: 'warning',
        message: `${stuckWorkflows.length} workflows stuck > 30 min`,
        details: { stuck: stuckWorkflows.slice(0, 3) },
        action: 'Run failsafe crons: /api/cron/check-stuck-heygen and /api/cron/check-stuck-submagic'
      });
    }

  } catch (error) {
    addResult({
      component: 'Firebase',
      status: 'fail',
      message: 'Failed to connect to Firestore',
      details: { error: error instanceof Error ? error.message : 'Unknown' },
      action: 'Verify Firebase credentials and project ID'
    });
  }
}

/**
 * Main diagnostic function
 */
async function runDiagnostics() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   WORKFLOW FAILURE DIAGNOSTIC - Carz Inc                 ║');
  console.log('║   Success Rate: 51.6% | Failed: 15 workflows             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  await checkEnvironment();
  await checkHeyGenAPI();
  await checkSubmagicAPI();
  await checkWebhooks();
  await checkFirestore();

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    DIAGNOSTIC SUMMARY                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}\n`);

  // Critical failures
  const criticalFailures = results.filter(r =>
    r.status === 'fail' &&
    (r.component.includes('HeyGen') || r.component.includes('Submagic') || r.component.includes('Webhook'))
  );

  if (criticalFailures.length > 0) {
    console.log('🚨 CRITICAL ISSUES FOUND:\n');
    criticalFailures.forEach((failure, i) => {
      console.log(`${i + 1}. ${failure.component}`);
      console.log(`   Problem: ${failure.message}`);
      if (failure.action) {
        console.log(`   Fix: ${failure.action}`);
      }
      console.log('');
    });
  }

  // Next steps
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      NEXT STEPS                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('1. Fix all FAILED items above (critical for workflow success)');
    console.log('2. Verify API keys are correct and have sufficient credits');
    console.log('3. Test webhook delivery using /api/debug/test-webhooks');
    console.log('4. Run failsafe crons to unstick workflows:');
    console.log('   - curl http://localhost:3000/api/cron/check-stuck-heygen');
    console.log('   - curl http://localhost:3000/api/cron/check-stuck-submagic');
    console.log('5. Monitor /admin/social-dashboard for new workflow status\n');
  } else if (warnings > 0) {
    console.log('1. Review warnings above');
    console.log('2. Run failsafe crons to complete stuck workflows');
    console.log('3. Monitor dashboard for 24 hours\n');
  } else {
    console.log('✅ All checks passed!');
    console.log('System appears healthy. If failures persist:');
    console.log('1. Check recent error logs in /admin/social-dashboard');
    console.log('2. Verify external API status (HeyGen, Submagic)');
    console.log('3. Review webhook delivery logs\n');
  }

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Fatal error running diagnostics:', error);
  process.exit(1);
});
