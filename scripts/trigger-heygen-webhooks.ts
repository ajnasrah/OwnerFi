/**
 * Manually trigger HeyGen webhooks for completed videos
 *
 * This simulates what HeyGen would send when a video completes
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY!;

interface StuckVideo {
  workflow_id: string;
  brand: string;
  heygenVideoId: string;
  articleTitle: string;
}

async function triggerWebhooks() {
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
        console.log(`   ✅ Video is completed! Triggering webhook...`);

        // Trigger HeyGen webhook
        const webhookUrl = `${BASE_URL}/api/webhooks/heygen/${video.brand}`;
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'avatar_video.success',
            event_data: {
              video_id: video.heygenVideoId,
              status: 'completed',
              video_url: videoUrl,
              callback_id: video.workflow_id
            }
          })
        });

        if (webhookResponse.ok) {
          const result = await webhookResponse.text();
          console.log(`   ✅ Webhook triggered successfully`);
          console.log(`   Response: ${result.substring(0, 100)}`);
          advanced++;
        } else {
          const errorText = await webhookResponse.text();
          console.log(`   ⚠️  Webhook failed: ${webhookResponse.status}`);
          console.log(`   Error: ${errorText.substring(0, 200)}`);
          failed++;
        }
      } else if (status === 'failed' || status === 'error') {
        console.log(`   ❌ HeyGen video failed`);
        failed++;
      } else {
        console.log(`   ⏳ Still processing (status: ${status})`);
      }

    } catch (error) {
      console.log(`   ❌ Error:`, error);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total checked: ${stuckVideos.length}`);
  console.log(`   Advanced: ${advanced}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Still processing: ${stuckVideos.length - advanced - failed}`);
  console.log('');
}

triggerWebhooks().catch(console.error);
