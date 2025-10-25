#!/usr/bin/env node

/**
 * Delete the 10 failed workflows so their articles can be retried
 * Once deleted, the RSS articles will become available and can be processed normally
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

const failedWorkflows = [
  { id: 'wf_1761055250789_n42mlxe54', brand: 'carz' },
  { id: 'wf_1761012050828_7cf9xeziq', brand: 'carz' },
  { id: 'wf_1761001203838_9n6vled53', brand: 'carz' },
  { id: 'wf_1760993732356_6ina3j47h', brand: 'carz' },
  { id: 'wf_1761055255377_k1w6u77a4', brand: 'ownerfi' },
  { id: 'wf_1761012059592_l48q34205', brand: 'ownerfi' },
  { id: 'wf_1761001207557_n0p0zatrb', brand: 'ownerfi' },
  { id: 'wf_1760993735056_1doskoqqv', brand: 'ownerfi' },
  { id: 'podcast_1761055210316_3tprpe708', brand: 'podcast' },
  { id: 'podcast_1760993737581_xmeqaz0wj', brand: 'podcast' }
];

async function deleteWorkflow(workflow) {
  console.log(`\n🗑️  Deleting: ${workflow.id} (${workflow.brand})`);

  try {
    const response = await fetch(`${BASE_URL}/api/workflow/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: workflow.id,
        brand: workflow.brand
      })
    });

    if (response.ok) {
      console.log(`   ✅ Deleted`);
      return true;
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed: ${response.status} - ${error.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🗑️  DELETE FAILED WORKFLOWS\n');
  console.log('This will free up the RSS articles to be retried with working Submagic credits.\n');
  console.log('=' .repeat(70));

  let successCount = 0;

  for (const workflow of failedWorkflows) {
    const success = await deleteWorkflow(workflow);
    if (success) successCount++;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n📊 Deleted ${successCount} out of ${failedWorkflows.length} workflows`);
  console.log('\n✅ Next steps:');
  console.log('   1. The RSS articles are now available again');
  console.log('   2. Run your normal workflow pipeline');
  console.log('   3. Videos will process end-to-end with Submagic credits!\n');
}

main().catch(console.error);
