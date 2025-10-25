#!/usr/bin/env node

/**
 * Retry Failed Podcast Workflows
 *
 * This script finds all failed podcast workflows where HeyGen succeeded
 * but Submagic failed, and retries the Submagic step.
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

// List of failed workflow IDs from the dashboard
const FAILED_WORKFLOWS = [
  'podcast_1729688481934_r3bkr',  // Episode #22: James Chen
  'podcast_1729688482057_5nbls',  // Episode #21: Coach Maria
  'podcast_1729654074746_6m7m9',  // Episode #20: Mike Thompson (Electric Vehicles)
  'podcast_1729654074847_r3zfm',  // Episode #20: Mike Thompson (Car Maintenance)
  'podcast_1729610435903_7f2kl',  // Episode #19: Mike Thompson (Car Insurance)
  'podcast_1729610436002_4nbkr',  // Episode #19: Mike Thompson (Car Maintenance)
  'podcast_1729587629289_9xz3l',  // Episode #18: Sarah Johnson
  'podcast_1729587629389_2kl3m',  // Episode #18: Alex Rivera
];

async function retryWorkflow(workflowId) {
  console.log(`\n🔄 Retrying workflow: ${workflowId}`);

  try {
    const response = await fetch(`${BASE_URL}/api/workflow/retry-submagic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_SECRET}`
      },
      body: JSON.stringify({
        workflowId,
        brand: 'podcast'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Success: ${data.message || 'Submagic retry started'}`);
      if (data.submagicProjectId) {
        console.log(`   Submagic Project ID: ${data.submagicProjectId}`);
      }
      return { success: true, workflowId };
    } else {
      console.log(`❌ Failed: ${data.error || 'Unknown error'}`);
      return { success: false, workflowId, error: data.error };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, workflowId, error: error.message };
  }
}

async function main() {
  console.log('🎙️ Retrying Failed Podcast Workflows');
  console.log('=====================================\n');
  console.log(`Total workflows to retry: ${FAILED_WORKFLOWS.length}\n`);

  const results = [];

  for (const workflowId of FAILED_WORKFLOWS) {
    const result = await retryWorkflow(workflowId);
    results.push(result);

    // Wait 2 seconds between retries to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=====================================');
  console.log('📊 Summary');
  console.log('=====================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed Workflows:');
    failed.forEach(f => {
      console.log(`   - ${f.workflowId}: ${f.error}`);
    });
  }

  console.log('\n✨ Done! Check the dashboard to monitor progress.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
