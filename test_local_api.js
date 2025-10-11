// Test the new local API endpoint
async function testLocalAPI() {
  console.log('🧪 Testing local HeyGen video generation API...\n');

  const requestBody = {
    talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
    input_text: 'This is a test of our new API endpoint with automatic scale zoom at 1.4. The video should appear nicely zoomed in.',
    voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
    scale: 1.4,
    width: 720,
    height: 1280,
    speed: 1.1,
    caption: false,
    talking_style: 'expressive'
  };

  console.log('📤 Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n🔄 Sending request to http://localhost:3000/api/heygen/generate-video...\n');

  try {
    const response = await fetch('http://localhost:3000/api/heygen/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Data:', JSON.stringify(data, null, 2));

    if (data.success && data.video_id) {
      console.log('\n✅ SUCCESS! Video generation started!');
      console.log('\n📊 Video Details:');
      console.log('   Video ID:', data.video_id);
      console.log('   Scale:', requestBody.scale);
      console.log('   Dimensions:', `${requestBody.width}x${requestBody.height}`);
      console.log('   Voice Speed:', requestBody.speed);

      console.log('\n⏳ Waiting 45 seconds for video to complete...');

      // Wait and then check status
      await new Promise(resolve => setTimeout(resolve, 45000));

      console.log('\n🔍 Checking video status...\n');

      const statusResponse = await fetch(`http://localhost:3000/api/heygen/generate-video?video_id=${data.video_id}`);
      const statusData = await statusResponse.json();

      console.log('📥 Status Response:', JSON.stringify(statusData, null, 2));

      if (statusData.status === 'completed' && statusData.video_url) {
        console.log('\n🎉 VIDEO COMPLETED!');
        console.log('   Status:', statusData.status);
        console.log('   Video URL:', statusData.video_url);
        console.log('\n📥 Download the video:');
        console.log(`   curl -o "test_api_video.mp4" "${statusData.video_url}"`);
      } else {
        console.log('\n⏳ Video still processing. Current status:', statusData.status);
        console.log('   Check again in a few seconds with:');
        console.log(`   curl "http://localhost:3000/api/heygen/generate-video?video_id=${data.video_id}"`);
      }
    } else {
      console.log('\n❌ ERROR:', data.error || 'Unknown error');
      if (data.details) {
        console.log('   Details:', JSON.stringify(data.details, null, 2));
      }
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.log('\n🔍 Make sure:');
    console.log('   1. Dev server is running: npm run dev');
    console.log('   2. API endpoint exists at: src/app/api/heygen/generate-video/route.ts');
    console.log('   3. HEYGEN_API_KEY is set in .env');
  }
}

testLocalAPI();
