#!/usr/bin/env npx tsx
// Direct test of HeyGen API with podcast format

import { config } from 'dotenv';

async function testHeyGenAPI() {
  console.log('🎥 Testing HeyGen API with Podcast Format\n');

  try {
    // Load environment variables
    config({ path: '.env.local' });

    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

    if (!HEYGEN_API_KEY) {
      console.error('❌ HEYGEN_API_KEY not found in environment');
      process.exit(1);
    }

    console.log(`HeyGen API Key: ${HEYGEN_API_KEY.substring(0, 15)}...\n`);

    // Test payload matching the fixed format
    const testPayload = {
      test: false,
      caption: false,
      callback_id: 'test-' + Date.now(),
      video_inputs: [
        // Scene 1: Host asks question
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc', // Abdullah (host)
            scale: 1.4,
            talking_photo_style: 'square',
            talking_style: 'expressive'
          },
          voice: {
            type: 'text',
            input_text: 'Hey everyone, today we are talking about the benefits of owner financing. What makes it such a great option for homebuyers?',
            voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
            speed: 1.0
          },
          background: {
            type: 'color',
            value: '#ffffff'
          }
        },
        // Scene 2: Guest answers
        {
          character: {
            type: 'avatar',
            avatar_id: 'Caroline_Business_Sitting_Front_public', // Zelena - Real Estate Agent
            scale: 1.68,
            avatar_style: 'normal'
          },
          voice: {
            type: 'text',
            input_text: 'Owner financing allows buyers to purchase homes without traditional bank loans, making homeownership accessible to more people. It is especially helpful for those with less-than-perfect credit or limited down payment funds.',
            voice_id: 'c4313f9f0b214a7a8189c134736ce897', // Zelena voice
            speed: 1.44
          },
          background: {
            type: 'color',
            value: '#f5f5f5'
          }
        }
      ],
      dimension: {
        width: 1080,
        height: 1920
      }
    };

    console.log('📤 Sending request to HeyGen API...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2), '\n');

    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.data?.video_id) {
      console.log('\n✅ SUCCESS! HeyGen video generation started!');
      console.log(`   Video ID: ${data.data.video_id}`);
      console.log('\n📝 This confirms the video_inputs format is now correct!');
      console.log('   The podcast workflow should now work end-to-end.');
    } else {
      console.error('\n❌ HeyGen API Error');
      if (data.error) {
        console.error('   Error:', JSON.stringify(data.error, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testHeyGenAPI();
