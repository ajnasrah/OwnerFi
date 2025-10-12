// Test with offset parameter to see if scale works better
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testScaleWithOffset() {
  console.log('\n🔬 Testing Scale with Offset Parameter\n');

  const configPath = join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  const host = config.host;
  const doctor = config.profiles.doctor;

  // Build scenes with offset parameter
  const videoScenes = [
    {
      character: {
        type: host.avatar_type,
        talking_photo_id: host.avatar_id,
        scale: 1.4,
        offset: { x: 0, y: -0.1 }  // Shift up slightly
      },
      voice: {
        type: 'text',
        voice_id: host.voice_id,
        input_text: 'Testing scale 1.4 with offset parameter',
        speed: 1.0
      },
      background: { type: 'color', value: '#ffffff' }
    }
  ];

  const request = {
    video_inputs: videoScenes,
    dimension: { width: 1080, height: 1920 },
    title: 'Scale Test with Offset',
    caption: false
  };

  console.log('📤 Request structure:');
  console.log(JSON.stringify(request, null, 2));
  console.log('\n💰 Sending to HeyGen... (will cost $0.54)\n');

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': process.env.HEYGEN_API_KEY
    },
    body: JSON.stringify(request)
  });

  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));

  if (result.error) {
    console.error('❌ Error:', result.error);
    return;
  }

  console.log(`\n✅ Video ID: ${result.data.video_id}`);
  console.log('\nCompare this video to the previous ones to see if offset helps the scale work better');
}

testScaleWithOffset();
