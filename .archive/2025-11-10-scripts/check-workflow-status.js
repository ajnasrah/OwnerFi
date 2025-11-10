// Check workflow status and HeyGen video status
require('dotenv').config({ path: '.env' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

// Get workflow ID from command line
const workflowId = process.argv[2];
const heygenVideoId = process.argv[3];

if (!workflowId) {
  console.log('Usage: node scripts/check-workflow-status.js <workflowId> [heygenVideoId]');
  process.exit(1);
}

async function main() {
  console.log('🔍 Checking workflow:', workflowId);

  if (heygenVideoId && HEYGEN_API_KEY) {
    console.log('\n📹 Checking HeyGen video status...');

    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`,
        {
          headers: {
            'accept': 'application/json',
            'x-api-key': HEYGEN_API_KEY
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ HeyGen Status:', JSON.stringify(data, null, 2));
      } else {
        console.error('❌ Failed to fetch HeyGen status:', response.status);
      }
    } catch (error) {
      console.error('❌ Error checking HeyGen:', error.message);
    }
  } else if (!HEYGEN_API_KEY) {
    console.log('⚠️  HEYGEN_API_KEY not found - cannot check video status');
  } else {
    console.log('⚠️  No HeyGen video ID provided - use: node scripts/check-workflow-status.js <workflowId> <heygenVideoId>');
  }
}

main();
