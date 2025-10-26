/**
 * Test Motion-Enabled Avatar
 * Verifies that the new motion avatar (f40972493dd74bbe829f30daa09ea1a9) works
 * with the HeyGen API and displays motion.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

// Motion-enabled avatar
const MOTION_AVATAR_ID = 'f40972493dd74bbe829f30daa09ea1a9';
const VOICE_ID = '9070a6c2dbd54c10bb111dc8c655bff7';

async function testMotionAvatar() {
  console.log('\n🎬 Testing Motion-Enabled Avatar');
  console.log('=====================================');
  console.log(`Avatar ID: ${MOTION_AVATAR_ID}`);
  console.log(`Voice ID: ${VOICE_ID}`);
  console.log('');

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Test script that should show movement
  const testScript = `Hey everyone! This is a test of the new motion-enabled avatar.
I'm speaking with animated gestures and expressive movements.
You should see me moving naturally as I talk, with hand gestures and body language.
This is much more engaging than a static avatar!`;

  const requestBody = {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: MOTION_AVATAR_ID,
        scale: 1.4,
        talking_photo_style: 'circle',
        talking_style: 'expressive',
        offset: {
          x: 0,
          y: 0
        }
      },
      voice: {
        type: 'text',
        input_text: testScript,
        voice_id: VOICE_ID,
        speed: 1.0
      },
      background: {
        type: 'color',
        value: '#059669'
      }
    }],
    dimension: {
      width: 1080,
      height: 1920
    },
    title: 'Motion Avatar Test',
    caption: false
  };

  console.log('📤 Sending request to HeyGen API...\n');

  try {
    const response = await fetch(HEYGEN_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HeyGen API Error:', errorText);
      process.exit(1);
    }

    const result = await response.json();

    if (result.error) {
      console.error('❌ HeyGen Error:', JSON.stringify(result.error, null, 2));
      process.exit(1);
    }

    const videoId = result.data?.video_id;
    if (!videoId) {
      console.error('❌ No video ID returned');
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ SUCCESS! Video generation started');
    console.log('');
    console.log(`Video ID: ${videoId}`);
    console.log('');
    console.log('🎥 Next Steps:');
    console.log('1. Wait 2-5 minutes for HeyGen to process the video');
    console.log('2. Check the video status using:');
    console.log(`   npx tsx scripts/check-heygen-status.ts ${videoId}`);
    console.log('');
    console.log('3. Once completed, download and review the video to verify motion is present');
    console.log('');
    console.log('💡 What to look for:');
    console.log('   - Hand gestures synchronized with speech');
    console.log('   - Natural body movements');
    console.log('   - Expressive facial expressions');
    console.log('   - Dynamic presence (not static/frozen)');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run test
testMotionAvatar();
