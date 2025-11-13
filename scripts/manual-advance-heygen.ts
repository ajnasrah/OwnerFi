/**
 * Manually advance completed HeyGen videos
 */

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

interface StuckVideo {
  workflow_id: string;
  brand: string;
  heygenVideoId: string;
  articleTitle: string;
}

async function advanceCompletedHeyGenVideos() {
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

  let advanced = 0;
  let failed = 0;

  for (const video of stuckVideos) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📹 ${video.brand.toUpperCase()}: ${video.workflow_id}`);
    console.log(`   Title: ${video.articleTitle}`);
    console.log(`   HeyGen ID: ${video.heygenVideoId}`);

    try {
      // Check HeyGen status
      const heygenResponse = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${video.heygenVideoId}`,
        { headers: { 'x-api-key': HEYGEN_API_KEY } }
      );

      if (!heygenResponse.ok) {
        console.log(`   ❌ HeyGen API error: ${heygenResponse.status}`);
        failed++;
        continue;
      }

      const heygenData = await heygenResponse.json();
      const status = heygenData.data?.status;
      const videoUrl = heygenData.data?.video_url;

      console.log(`   Status: ${status}`);

      if (status === 'completed' && videoUrl) {
        console.log(`   ✅ Video is completed! Advancing to SubMagic...`);

        // Trigger the workers/process-video endpoint to continue the workflow
        const processResponse = await fetch(`${BASE_URL}/api/workers/process-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cloud-Tasks-Worker': CRON_SECRET
          },
          body: JSON.stringify({
            brand: video.brand,
            workflowId: video.workflow_id,
            videoUrl: videoUrl
          })
        });

        if (processResponse.ok) {
          console.log(`   ✅ Successfully advanced to next stage`);
          advanced++;
        } else {
          const errorText = await processResponse.text();
          console.log(`   ⚠️  Process endpoint failed: ${processResponse.status}`);
          console.log(`   Error: ${errorText.substring(0, 200)}`);
          failed++;
        }
      } else if (status === 'failed' || status === 'error') {
        console.log(`   ❌ HeyGen video failed - marking workflow as failed`);
        failed++;
      } else {
        console.log(`   ⏳ Still processing (status: ${status})`);
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
  console.log(`   Advanced: ${advanced}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Still processing: ${stuckVideos.length - advanced - failed}`);
  console.log('');
}

advanceCompletedHeyGenVideos().catch(console.error);
