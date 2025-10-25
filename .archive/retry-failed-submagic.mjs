#!/usr/bin/env node

/**
 * Fix ALL stuck workflows (HeyGen stuck + Submagic failures)
 *
 * This script:
 * 1. Checks and advances stuck HeyGen workflows
 * 2. Fetches all workflows with failed Submagic status
 * 3. Retries the Submagic step using saved HeyGen videos (now that credits are added)
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

async function checkStuckHeyGen() {
  console.log('🔍 STEP 1: Checking stuck HeyGen workflows...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/cron/check-stuck-heygen`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vercel-cron/1.0'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to check stuck HeyGen workflows:', data);
      return;
    }

    console.log(`✅ Checked ${data.totalWorkflows} stuck HeyGen workflows`);
    console.log(`   Advanced to Submagic: ${data.advanced}`);
    console.log(`   Marked as failed: ${data.failed}`);
    console.log(`   Still processing: ${data.stillProcessing}\n`);

    if (data.results && data.results.length > 0) {
      console.log('📋 Results:');
      data.results.forEach(r => {
        console.log(`   - Workflow ${r.workflowId}: ${r.action}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error checking stuck HeyGen:', error.message);
  }
}

async function retryFailedSubmagicWorkflows() {
  console.log('🔍 STEP 2: Retrying failed Submagic workflows...\n');

  try {
    // Fetch workflow logs for both brands (viral videos)
    const viralResponse = await fetch(`${BASE_URL}/api/workflow/logs?history=true`);
    const viralData = await viralResponse.json();

    if (!viralData.success) {
      console.error('❌ Failed to fetch viral workflows');
      return;
    }

    // Fetch podcast workflows
    const podcastResponse = await fetch(`${BASE_URL}/api/podcast/workflow/logs?history=true`);
    const podcastData = await podcastResponse.json();

    if (!podcastData.success) {
      console.error('❌ Failed to fetch podcast workflows');
    }

    // Get all failed workflows with Submagic errors
    const carzFailedWorkflows = viralData.workflows?.carz?.filter(w =>
      w.status === 'failed' &&
      w.error &&
      (w.error.includes('INSUFFICIENT_CREDITS') || w.error.includes('Submagic'))
    ) || [];

    const ownerfiFailedWorkflows = viralData.workflows?.ownerfi?.filter(w =>
      w.status === 'failed' &&
      w.error &&
      (w.error.includes('INSUFFICIENT_CREDITS') || w.error.includes('Submagic'))
    ) || [];

    const podcastFailedWorkflows = podcastData.workflows?.filter(w =>
      w.status === 'failed' &&
      w.error &&
      (w.error.includes('INSUFFICIENT_CREDITS') || w.error.includes('Submagic'))
    ) || [];

    const allFailedWorkflows = [
      ...carzFailedWorkflows.map(w => ({ ...w, brand: 'carz', type: 'viral' })),
      ...ownerfiFailedWorkflows.map(w => ({ ...w, brand: 'ownerfi', type: 'viral' })),
      ...podcastFailedWorkflows.map(w => ({ ...w, brand: 'podcast', type: 'podcast' }))
    ];

    if (allFailedWorkflows.length === 0) {
      console.log('✅ No failed Submagic workflows found!\n');
      return;
    }

    console.log(`📋 Found ${allFailedWorkflows.length} failed workflows:\n`);

    // Display workflows
    allFailedWorkflows.forEach((workflow, index) => {
      const title = workflow.articleTitle || workflow.episodeTitle || `Workflow ${workflow.id}`;
      console.log(`${index + 1}. [${workflow.brand.toUpperCase()}${workflow.type === 'podcast' ? ' PODCAST' : ''}] ${title}`);
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Error: ${workflow.error.substring(0, 80)}...`);
      console.log(`   HeyGen Video: ${workflow.heygenVideoId || 'N/A'}`);
      console.log('');
    });

    // Retry each workflow
    console.log('🔄 Retrying Submagic for all failed workflows...\n');

    let successCount = 0;
    let failCount = 0;

    for (const workflow of allFailedWorkflows) {
      const title = workflow.articleTitle || workflow.episodeTitle || `Workflow ${workflow.id}`;
      console.log(`🔄 Retrying [${workflow.type === 'podcast' ? 'PODCAST' : 'VIRAL'}]: ${title.substring(0, 50)}...`);

      try {
        const retryResponse = await fetch(`${BASE_URL}/api/workflow/retry-submagic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workflowId: workflow.id,
            brand: workflow.brand
          })
        });

        const retryData = await retryResponse.json();

        if (retryData.success) {
          console.log(`   ✅ Success! Submagic project ID: ${retryData.projectId}`);
          successCount++;
        } else {
          console.log(`   ❌ Failed: ${retryData.error}`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failCount++;
      }

      console.log('');

      // Wait 1 second between retries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('📊 SUMMARY:');
    console.log(`   Total workflows: ${allFailedWorkflows.length}`);
    console.log(`   Successfully retried: ${successCount}`);
    console.log(`   Failed to retry: ${failCount}\n`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

async function main() {
  console.log('🚀 FIX ALL STUCK WORKFLOWS\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`CRON_SECRET: ${CRON_SECRET ? '✅ Set' : '⚠️  Not set (HeyGen check will be skipped)'}\n`);
  console.log('=' .repeat(70));
  console.log('');

  // Step 1: Check and advance stuck HeyGen workflows
  if (CRON_SECRET) {
    await checkStuckHeyGen();

    // Wait 3 seconds for HeyGen check to complete
    console.log('⏳ Waiting 3 seconds for HeyGen workflows to advance...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else {
    console.log('⚠️  Skipping stuck HeyGen check (CRON_SECRET not set)\n');
  }

  // Step 2: Retry all failed Submagic workflows
  await retryFailedSubmagicWorkflows();

  console.log('=' .repeat(70));
  console.log('\n✅ All done! Check the admin dashboard to monitor progress.');
  console.log(`📊 Dashboard: ${BASE_URL}/admin/social-dashboard\n`);
}

// Run the script
main().catch(console.error);
