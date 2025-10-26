/**
 * Test VassDistro Motion-Enabled Avatar
 * Verifies that the new VassDistro motion avatar works correctly
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

// VassDistro motion-enabled avatar
const VASSDISTRO_AVATAR_ID = '6764a52c1b734750a0fba6ab6caa9cd9';
const VOICE_ID = '9070a6c2dbd54c10bb111dc8c655bff7';

async function testVassDistroMotion() {
  console.log('\n🎬 Testing VassDistro Motion-Enabled Avatar');
  console.log('==========================================');
  console.log(`Avatar ID: ${VASSDISTRO_AVATAR_ID}`);
  console.log(`Voice ID: ${VOICE_ID}`);
  console.log('');

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Test script for VassDistro (vape wholesale industry)
  const testScript = `Hey vape store owners! Looking to stock up on premium products at wholesale prices?
VassDistro has you covered with the latest vapes, disposables, and accessories.
We offer fast shipping, competitive pricing, and top-quality products that your customers love.
Check us out at VassDistro.com and take your inventory to the next level!`;

  const requestBody = {
    video_inputs: [{
      character: {
        type: 'talking_photo',
        talking_photo_id: VASSDISTRO_AVATAR_ID,
        scale: 1.4,
        talking_photo_style: 'square',
        talking_style: 'expressive'
      },
      voice: {
        type: 'text',
        input_text: testScript,
        voice_id: VOICE_ID,
        speed: 1.1
      },
      background: {
        type: 'color',
        value: '#1a1a1a' // Dark background for VassDistro
      }
    }],
    dimension: {
      width: 1080,
      height: 1920
    },
    title: 'VassDistro Motion Avatar Test',
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

    console.log('✅ SUCCESS! VassDistro video generation started');
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
    console.log('   - Expressive facial expressions (smiles, raised eyebrows)');
    console.log('   - Strong engaging eye contact');
    console.log('   - Dynamic presence with urgency and enthusiasm');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run test
testVassDistroMotion();
