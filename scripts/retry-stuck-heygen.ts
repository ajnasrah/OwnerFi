/**
 * Retry stuck HeyGen workflows using admin endpoint
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

interface StuckVideo {
  workflow_id: string;
  brand: string;
  heygenVideoId: string;
  articleTitle: string;
}

async function retryStuckWorkflows() {
  console.log('\n🔄 Fetching stuck HeyGen workflows...\n');

  // Get all workflows
  const response = await fetch(`${BASE_URL}/api/workflow/logs?limit=50`);
  const data = await response.json();

  const stuckVideos: StuckVideo[] = [];

  // Find stuck heygen_processing workflows
  for (const [brand, workflows] of Object.entries(data.workflows)) {
    if (Array.isArray(workflows)) {
      for (const workflow of workflows) {
        if (workflow.status === 'heygen_processing' && workflow.heygenVideoId) {
          stuckVideos.push({
            workflow_id: workflow.id,
            brand: brand,
            heygenVideoId: workflow.heygenVideoId,
            articleTitle: workflow.articleTitle || workflow.title || 'Unknown'
          });
        }
      }
    }
  }

  console.log(`Found ${stuckVideos.length} stuck HeyGen workflows\n`);

  let retried = 0;
  let failed = 0;

  for (const video of stuckVideos) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📹 ${video.brand.toUpperCase()}: ${video.workflow_id}`);
    console.log(`   Title: ${video.articleTitle}`);

    try {
      // Call admin retry endpoint  - reset to heygen_processing so cron picks it up
      const retryResponse = await fetch(`${BASE_URL}/api/admin/retry-workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: video.workflow_id,
          brand: video.brand,
          stage: 'submagic' // This will reset to heygen_processing and let cron advance it
        })
      });

      if (retryResponse.ok) {
        const result = await retryResponse.json();
        console.log(`   ✅ Retry triggered: ${result.message}`);
        retried++;
      } else {
        const errorText = await retryResponse.text();
        console.log(`   ⚠️  Retry failed: ${retryResponse.status}`);
        console.log(`   Error: ${errorText.substring(0, 200)}`);
        failed++;
      }

    } catch (error) {
      console.log(`   ❌ Error:`, error);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total checked: ${stuckVideos.length}`);
  console.log(`   Retried: ${retried}`);
  console.log(`   Failed: ${failed}`);
  console.log('');
  console.log('✅ Now trigger the cron: curl -X POST "https://ownerfi.ai/api/cron/check-stuck-workflows" -H "Authorization: Bearer YOUR_CRON_SECRET"');
  console.log('');
}

retryStuckWorkflows().catch(console.error);
