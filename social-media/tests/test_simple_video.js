// Simple test - create HeyGen video directly (no webhooks, no OpenAI)

require('dotenv').config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function createSimpleVideo() {
  console.log('🎬 Creating simple HeyGen video...\n');

  const videoRequest = {
    video_inputs: [
      {
        character: {
          type: 'talking_photo',
          talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
          scale: 1.4,
          talking_photo_style: 'square',
          talking_style: 'expressive'
        },
        voice: {
          type: 'text',
          input_text: 'Hello! This is a test video. Just checking if everything works correctly. Thank you!',
          voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
          speed: 1.1
        }
      }
    ],
    caption: false,
    dimension: {
      width: 1080,
      height: 1920
    },
    test: false
  };

  console.log('Request:', JSON.stringify(videoRequest, null, 2));
  console.log('\n📤 Sending to HeyGen...\n');

  try {
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      },
      body: JSON.stringify(videoRequest)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Video generation started!');
      console.log('   Video ID:', data.data?.video_id || data.video_id);
      console.log('\n📊 Check status in HeyGen dashboard or run:');
      console.log(`   node -e "fetch('https://api.heygen.com/v1/video_status.get?video_id=${data.data?.video_id || data.video_id}', {headers: {'x-api-key': process.env.HEYGEN_API_KEY}}).then(r=>r.json()).then(d=>console.log(d))"`);
    } else {
      console.log('❌ Failed:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

createSimpleVideo();
