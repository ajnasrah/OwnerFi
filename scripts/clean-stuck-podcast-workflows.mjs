#!/usr/bin/env node

// Clean up stuck podcast workflows that have no HeyGen video ID

import fetch from 'node-fetch';

const baseUrl = 'https://ownerfi.ai';

async function cleanStuckWorkflows() {
  console.log('🧹 Fetching stuck podcast workflows...\n');

  // Get workflows
  const response = await fetch(`${baseUrl}/api/podcast/workflow/logs`);
  const data = await response.json();

  if (!data.success || !data.workflows) {
    console.log('❌ Failed to fetch workflows');
    return;
  }

  const stuckWorkflows = data.workflows.filter(w =>
    w.status === 'heygen_processing' && !w.heygenVideoId
  );

  if (stuckWorkflows.length === 0) {
    console.log('✅ No stuck workflows found');
    return;
  }

  console.log(`Found ${stuckWorkflows.length} stuck workflows without HeyGen video IDs:\n`);

  for (const workflow of stuckWorkflows) {
    console.log(`📄 Workflow: ${workflow.id}`);
    console.log(`   Episode: #${workflow.episodeNumber} - ${workflow.episodeTitle}`);
    console.log(`   Status: ${workflow.status}`);
    console.log(`   HeyGen Video ID: ${workflow.heygenVideoId || '❌ MISSING'}`);
    console.log(`   Created: ${new Date(workflow.createdAt).toLocaleString()}`);

    // Delete this workflow
    try {
      const deleteResponse = await fetch(`${baseUrl}/api/workflow/delete?workflowId=${workflow.id}&brand=podcast`, {
        method: 'DELETE'
      });

      const deleteResult = await deleteResponse.json();

      if (deleteResult.success) {
        console.log(`   ✅ Deleted\n`);
      } else {
        console.log(`   ❌ Failed to delete: ${deleteResult.error}\n`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log('✅ Cleanup complete!');
}

cleanStuckWorkflows()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
