/**
 * Check HeyGen video status for stuck workflows
 * This will tell us if videos are actually completing but webhooks aren't being called
 */

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

// Video IDs from the screenshot you provided
const stuckVideoIds = [
  'c4bad0743533',  // Tesla Model Y (1h ago)
  '2e4c273195e6',  // Hydrogen farm tractor (4h ago)
];

async function checkHeyGenStatus() {
  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found');
    process.exit(1);
  }

  console.log('🔍 Checking HeyGen video status for stuck workflows...\n');

  for (const videoId of stuckVideoIds) {
    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        {
          headers: {
            'accept': 'application/json',
            'x-api-key': HEYGEN_API_KEY
          }
        }
      );

      if (!response.ok) {
        console.error(`❌ Failed to fetch status for ${videoId}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const videoData = data.data;

      console.log(`Video ID: ${videoId}`);
      console.log(`Status: ${videoData.status}`);
      console.log(`Duration: ${videoData.duration || 'N/A'}`);
      console.log(`Video URL: ${videoData.video_url || 'N/A'}`);
      console.log(`Callback ID: ${videoData.callback_id || 'N/A'}`);
      console.log(`Created: ${videoData.created_at ? new Date(videoData.created_at * 1000).toISOString() : 'N/A'}`);
      console.log(`Error: ${videoData.error || 'N/A'}`);
      console.log('---\n');

      // If video is completed but workflow is stuck, webhooks aren't working
      if (videoData.status === 'completed' && videoData.video_url) {
        console.log(`⚠️  VIDEO COMPLETED BUT WORKFLOW STUCK!`);
        console.log(`   Video URL: ${videoData.video_url}`);
        console.log(`   This means the HeyGen webhook is NOT being called!`);
        console.log(`   Callback ID: ${videoData.callback_id}`);
        console.log('---\n');
      }

      // If video failed, workflow should be marked as failed
      if (videoData.status === 'failed') {
        console.log(`❌ VIDEO FAILED`);
        console.log(`   Error: ${videoData.error || 'Unknown'}`);
        console.log(`   Callback ID: ${videoData.callback_id}`);
        console.log('---\n');
      }

    } catch (error) {
      console.error(`Error checking ${videoId}:`, error);
    }
  }
}

checkHeyGenStatus().catch(console.error).finally(() => process.exit(0));
