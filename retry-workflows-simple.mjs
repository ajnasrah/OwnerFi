#!/usr/bin/env node

/**
 * Simple script to retry failed workflows using the retry-submagic API
 * This will update the database status properly
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

// Hardcoded list of the 4 workflows you mentioned
const failedWorkflows = [
  { id: 'wf_1761055250789_n42mlxe54', brand: 'carz', title: 'Chevy Is Planning a Whole Lineup of Low-Cost EVs Related to the Bolt' },
  { id: 'wf_1761012050828_7cf9xeziq', brand: 'carz', title: 'View Interior Photos of the 2026 Maserati MCPura Cielo' },
  { id: 'wf_1761001203838_9n6vled53', brand: 'carz', title: 'Roll Like Rat Pack Royality in This 1958 Dual-Ghia on Bring a Trailer' },
  { id: 'wf_1760993732356_6ina3j47h', brand: 'carz', title: 'View Photos of the 2002 Jeep Liberty vs Land Rover Freelander' }
];

async function retryWorkflow(workflow) {
  console.log(`\n🔄 Retrying: ${workflow.title.substring(0, 50)}...`);
  console.log(`   Workflow ID: ${workflow.id}`);
  console.log(`   Brand: ${workflow.brand}`);

  try {
    const response = await fetch(`${BASE_URL}/api/workflow/retry-submagic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflowId: workflow.id,
        brand: workflow.brand
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`   ✅ SUCCESS! Submagic project ID: ${data.projectId}`);
      console.log(`   📊 Status updated in database`);
      return true;
    } else {
      console.log(`   ❌ Failed: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 RETRY FAILED WORKFLOWS\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Workflows to retry: ${failedWorkflows.length}\n`);
  console.log('=' .repeat(70));

  let successCount = 0;
  let failCount = 0;

  for (const workflow of failedWorkflows) {
    const success = await retryWorkflow(workflow);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Wait 2 seconds between retries
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total workflows: ${failedWorkflows.length}`);
  console.log(`   Successfully retried: ${successCount}`);
  console.log(`   Failed: ${failCount}\n`);

  if (successCount > 0) {
    console.log('✅ Workflows are now processing in Submagic!');
    console.log(`📊 Check dashboard: ${BASE_URL}/admin/social-dashboard\n`);
  }
}

main().catch(console.error);
