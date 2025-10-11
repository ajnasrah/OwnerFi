// Test script to debug HeyGen video dimension issue
const HEYGEN_API_KEY = 'MzQxYjQyYzZlOTk1NGQ3OWJiZjhlNWMxODMxOGE5YzItMTc1OTc5OTgyMA==';

async function testVideoDimension() {
  const requestBody = {
    "video_inputs": [
      {
        "character": {
          "type": "talking_photo",
          "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc"
        },
        "voice": {
          "type": "text",
          "input_text": "This is a test video to check if mobile dimensions work correctly.",
          "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
          "speed": 1.1
        }
      }
    ],
    "dimension": {
      "width": 1080,
      "height": 1920
    },
    "title": "Mobile Dimension Test"
  };

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

    if (data.video_id) {
      console.log('\n✅ Video generation started!');
      console.log('Video ID:', data.video_id);
      console.log('\nTo check the video status, run:');
      console.log(`curl -H "x-api-key: ${HEYGEN_API_KEY}" https://api.heygen.com/v1/video_status.get?video_id=${data.video_id}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVideoDimension();
