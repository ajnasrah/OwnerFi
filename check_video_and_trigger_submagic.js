// Check HeyGen video status and manually trigger Submagic processing
require('dotenv').config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const VIDEO_ID = '5f77a8887b254b459e14984cc23610d8'; // From your test
const WORKFLOW_ID = '3ec64253-24db-4822-a1e0-98aef7411dc8'; // From your test

async function checkVideoStatus() {
  console.log('🔍 Checking HeyGen video status...\n');

  try {
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${VIDEO_ID}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to get video status:', response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('📊 Video Status:', JSON.stringify(data, null, 2));

    if (data.data?.status === 'completed' && data.data?.video_url) {
      console.log('\n✅ Video is complete!');
      console.log('🎥 Video URL:', data.data.video_url);
      return data.data.video_url;
    } else {
      console.log('\n⏳ Video not ready yet. Status:', data.data?.status || 'unknown');
      return null;
    }
  } catch (error) {
    console.error('❌ Error checking video:', error.message);
    return null;
  }
}

async function triggerWebhook(videoUrl) {
  console.log('\n🔔 Manually triggering HeyGen webhook handler...\n');

  try {
    const response = await fetch('http://localhost:3000/api/webhooks/heygen', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: 'avatar_video.success',
        event_data: {
          video_id: VIDEO_ID,
          callback_id: WORKFLOW_ID,
          url: videoUrl,
          duration: 60,
          thumbnail_url: videoUrl.replace('.mp4', '_thumbnail.jpg')
        }
      })
    });

    if (!response.ok) {
      console.error('❌ Webhook failed:', response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return false;
    }

    const data = await response.json();
    console.log('✅ Webhook processed successfully!');
    console.log('📊 Response:', JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error triggering webhook:', error.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║     MANUAL WEBHOOK TRIGGER - HEYGEN → SUBMAGIC               ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Check video status
  const videoUrl = await checkVideoStatus();

  if (!videoUrl) {
    console.log('\n⚠️  Video not ready yet. Please try again later.');
    process.exit(0);
  }

  // Step 2: Trigger webhook
  const success = await triggerWebhook(videoUrl);

  if (success) {
    console.log('\n✨ Video should now be processing in Submagic!');
    console.log('🔍 Check status at: http://localhost:3000/api/workflow/viral-video-webhook/status?id=' + WORKFLOW_ID);
  }
}

main();
