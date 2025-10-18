/**
 * Cleanup Old HeyGen Webhooks
 *
 * This script helps you delete old webhook endpoints from HeyGen.
 * Useful before registering new brand-specific webhooks.
 *
 * Usage: node scripts/cleanup-heygen-webhooks.mjs
 */

import 'dotenv/config';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found in environment variables');
  process.exit(1);
}

/**
 * List all registered webhooks
 */
async function listWebhooks() {
  const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.list', {
    method: 'GET',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.endpoints || [];
}

/**
 * Delete a webhook endpoint by ID
 */
async function deleteWebhook(endpointId) {
  const response = await fetch('https://api.heygen.com/v1/webhook/endpoint.delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': HEYGEN_API_KEY
    },
    body: JSON.stringify({
      endpoint_id: endpointId
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to delete webhook: ${response.status}`);
  }

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🗑️  HeyGen Webhook Cleanup Tool\n');

  // List all webhooks
  console.log('📋 Fetching registered webhooks...\n');
  const webhooks = await listWebhooks();

  if (webhooks.length === 0) {
    console.log('✅ No webhooks found. Nothing to clean up.');
    return;
  }

  console.log(`Found ${webhooks.length} registered webhook(s):\n`);

  // Display webhooks
  webhooks.forEach((webhook, index) => {
    console.log(`${index + 1}. ${webhook.url}`);
    console.log(`   ID: ${webhook.endpoint_id}`);
    console.log(`   Events: ${webhook.events?.join(', ') || 'N/A'}`);
    console.log(`   Status: ${webhook.status || 'N/A'}`);
    console.log('');
  });

  // Identify old shared webhook
  const oldSharedWebhook = webhooks.find(w =>
    w.url && !w.url.includes('/carz') && !w.url.includes('/ownerfi') && !w.url.includes('/podcast')
    && w.url.includes('/api/webhooks/heygen')
  );

  if (oldSharedWebhook) {
    console.log('⚠️  Old shared webhook detected:');
    console.log(`   ${oldSharedWebhook.url}`);
    console.log(`   ID: ${oldSharedWebhook.endpoint_id}\n`);
    console.log('This is the old shared webhook that should be replaced with brand-specific ones.\n');
  }

  // Interactive mode - ask which to delete
  console.log('Options:');
  console.log('1. Delete old shared webhook only (recommended)');
  console.log('2. Delete all webhooks');
  console.log('3. Delete specific webhook by ID');
  console.log('4. Cancel\n');

  // For automated scripts, you can pass a command line argument
  const arg = process.argv[2];

  if (arg === '--delete-shared' && oldSharedWebhook) {
    console.log('🗑️  Deleting old shared webhook...');
    await deleteWebhook(oldSharedWebhook.endpoint_id);
    console.log('✅ Old shared webhook deleted successfully!');
    return;
  }

  if (arg === '--delete-all') {
    console.log('🗑️  Deleting all webhooks...');
    for (const webhook of webhooks) {
      console.log(`   Deleting: ${webhook.url}`);
      await deleteWebhook(webhook.endpoint_id);
    }
    console.log('✅ All webhooks deleted successfully!');
    return;
  }

  if (arg && arg.startsWith('--delete-id=')) {
    const endpointId = arg.split('=')[1];
    console.log(`🗑️  Deleting webhook: ${endpointId}`);
    await deleteWebhook(endpointId);
    console.log('✅ Webhook deleted successfully!');
    return;
  }

  // Interactive mode instructions
  console.log('Run this script with one of these options:');
  console.log('');
  console.log('  node scripts/cleanup-heygen-webhooks.mjs --delete-shared');
  console.log('  node scripts/cleanup-heygen-webhooks.mjs --delete-all');
  console.log(`  node scripts/cleanup-heygen-webhooks.mjs --delete-id=<endpoint_id>`);
  console.log('');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { listWebhooks, deleteWebhook };
