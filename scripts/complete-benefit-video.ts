/**
 * Manually complete a benefit video workflow
 * Simulates the webhook flow: HeyGen → R2 → Submagic → R2 → GetLate
 */

const workflowId = process.argv[2];
const heygenVideoId = process.argv[3];

if (!workflowId || !heygenVideoId) {
  console.error('Usage: npx tsx scripts/complete-benefit-video.ts <workflowId> <heygenVideoId>');
  console.error('Example: npx tsx scripts/complete-benefit-video.ts benefit_123 16a81a75...');
  process.exit(1);
}

async function completeWorkflow() {
  console.log(`🔄 Completing benefit video workflow: ${workflowId}`);
  console.log(`📹 HeyGen Video ID: ${heygenVideoId}\n`);

  // Step 1: Get HeyGen video URL
  console.log('Step 1: Fetching HeyGen video URL...');
  const heygenStatus = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`, {
    headers: { 'x-api-key': process.env.HEYGEN_API_KEY! }
  }).then(r => r.json());

  if (heygenStatus.data.status !== 'completed') {
    console.error(`❌ HeyGen video not completed yet. Status: ${heygenStatus.data.status}`);
    process.exit(1);
  }

  const heygenVideoUrl = heygenStatus.data.video_url;
  console.log(`✅ HeyGen URL: ${heygenVideoUrl.substring(0, 80)}...`);

  // Step 2: Trigger HeyGen webhook manually
  console.log('\nStep 2: Triggering HeyGen webhook...');
  const webhookResponse = await fetch('http://localhost:3000/api/webhooks/heygen/benefit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'avatar_video.success',
      event_data: {
        callback_id: workflowId,
        video_id: heygenVideoId,
        url: heygenVideoUrl, // HeyGen webhook uses 'url' not 'video_url'
        duration: heygenStatus.data.duration
      }
    })
  });

  const webhookData = await webhookResponse.json();
  console.log('Webhook response:', JSON.stringify(webhookData, null, 2));

  if (!webhookData.success) {
    console.error('❌ Webhook failed');
    process.exit(1);
  }

  console.log('\n✅ Workflow processing started! Monitor at /admin/social-dashboard');
  console.log('   Next steps: Submagic → GetLate (automatic via webhooks)');
}

completeWorkflow().catch(console.error);
