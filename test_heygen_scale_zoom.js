// Test script for HeyGen video with CORRECT zoom using scale parameter
const HEYGEN_API_KEY = 'MzQxYjQyYzZlOTk1NGQ3OWJiZjhlNWMxODMxOGE5YzItMTc1OTc5OTgyMA==';

async function testVideoWithScaleZoom() {
  const requestBody = {
    "video_inputs": [
      {
        "character": {
          "type": "talking_photo",
          "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
          // Use scale parameter for zoom effect (0 to 2.0 for talking photos)
          "scale": 1.5,  // 1.5 = 150% zoom (zoomed in)
          // You can also use avatar_style for different framing
          "talking_photo_style": "square"
        },
        "voice": {
          "type": "text",
          "input_text": "This video uses the scale parameter to zoom in on the avatar. This is the correct way to zoom in HeyGen videos.",
          "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
          "speed": 1.1
        }
      }
    ],
    "dimension": {
      "width": 1080,
      "height": 1920
    },
    "title": "Scale Zoom Test (Correct Method)"
  };

  console.log('🎬 Creating video with SCALE zoom effect (correct method)...\n');
  console.log('Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('\nMaking request to HeyGen API...\n');

  try {
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));

    if (data.data && data.data.video_id) {
      console.log('\n✅ Video generation started!');
      console.log('Video ID:', data.data.video_id);
      console.log('\n📊 Scale/Zoom Settings:');
      console.log('   Scale: 1.5 (150% - zoomed in)');
      console.log('   Normal scale: 1.0 (100%)');
      console.log('   Max scale for talking photos: 2.0 (200%)');
      console.log('\nTo check the video status, run:');
      console.log(`curl -H "x-api-key: ${HEYGEN_API_KEY}" https://api.heygen.com/v1/video_status.get?video_id=${data.data.video_id}`);
    } else if (data.error) {
      console.error('\n❌ Error:', data.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVideoWithScaleZoom();
