// Test script for HeyGen video with zoom-in effect
const HEYGEN_API_KEY = 'MzQxYjQyYzZlOTk1NGQ3OWJiZjhlNWMxODMxOGE5YzItMTc1OTc5OTgyMA==';

async function testVideoWithZoom() {
  const requestBody = {
    "video_inputs": [
      {
        "character": {
          "type": "talking_photo",
          "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
          // Add avatar_style for zoom effect
          "avatar_style": {
            "camera_zoom": {
              "start_zoom": 1.0,  // Starting zoom level (1.0 = 100%, normal)
              "end_zoom": 1.3,    // Ending zoom level (1.3 = 130%, zoomed in)
              "zoom_speed": "slow" // Options: "slow", "medium", "fast"
            }
          }
        },
        "voice": {
          "type": "text",
          "input_text": "This is a test video with zoom-in effect. Watch as the camera slowly zooms in.",
          "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
          "speed": 1.1
        }
      }
    ],
    "dimension": {
      "width": 1080,
      "height": 1920
    },
    "title": "Zoom-In Effect Test"
  };

  console.log('🎬 Creating video with zoom-in effect...\n');
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
      console.log('\n📊 Camera Zoom Settings:');
      console.log('   Start Zoom: 1.0 (100%)');
      console.log('   End Zoom: 1.3 (130%)');
      console.log('   Speed: slow');
      console.log('\nTo check the video status, run:');
      console.log(`node check_video_dimensions.js`);
      console.log('\nOr manually check:');
      console.log(`curl -H "x-api-key: ${HEYGEN_API_KEY}" https://api.heygen.com/v1/video_status.get?video_id=${data.data.video_id}`);
    } else if (data.error) {
      console.error('\n❌ Error:', data.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVideoWithZoom();
