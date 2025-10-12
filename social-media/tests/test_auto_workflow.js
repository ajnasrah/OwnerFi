// Test the automated video workflow that replaces Make.com

async function testAutoWorkflow() {
  console.log('🎬 Testing Automated Video Workflow (Make.com Replacement)\n');
  console.log('This single API call will:');
  console.log('  1. ✅ Take your content');
  console.log('  2. ✅ Generate script with OpenAI');
  console.log('  3. ✅ Create video with HeyGen (with zoom)');
  console.log('  4. ✅ Wait for completion');
  console.log('  5. ✅ Return video URL\n');

  const requestBody = {
    article_content: 'Breaking news: Scientists have discovered a new method to increase productivity by 40%. The research shows that taking regular breaks and using AI tools can dramatically improve work efficiency.',
    auto_generate_script: true, // Let OpenAI create a video script
    talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
    voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
    scale: 1.4,
    width: 720,
    height: 1280
  };

  console.log('📤 Request:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n🚀 Sending to: http://localhost:3000/api/workflow/auto-video\n');
  console.log('⏳ This will take ~60-90 seconds (automatic waiting included)...\n');

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3000/api/workflow/auto-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    const result = await response.json();

    console.log(`\n📥 Response (took ${duration}s):\n`);
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.video_url) {
      console.log('\n🎉 SUCCESS! Video generated automatically!\n');
      console.log('📊 Results:');
      console.log('   ✅ Video ID:', result.video_id);
      console.log('   ✅ Video URL:', result.video_url);
      console.log('   ✅ Generated Script:', result.script);
      console.log('   ✅ Total Time:', duration, 'seconds');

      console.log('\n📥 Download the video:');
      console.log(`   curl -o "automated_video.mp4" "${result.video_url}"`);

      console.log('\n💡 Next Steps:');
      console.log('   1. Download and check the video');
      console.log('   2. You can now DELETE your Make.com scenario');
      console.log('   3. Use this API endpoint instead');

      console.log('\n🎯 Make.com Replacement Complete!');
      console.log('   - No more 8-module workflow');
      console.log('   - No more Make.com subscription');
      console.log('   - Just one simple API call');

    } else if (result.video_id && !result.success) {
      console.log('\n⏳ Video is still processing');
      console.log('   Video ID:', result.video_id);
      console.log('   Check status at:', result.check_status_url);
      console.log('\n   Wait a bit and check manually:');
      console.log(`   curl "http://localhost:3000${result.check_status_url}"`);

    } else {
      console.log('\n❌ Error:', result.error);
      if (result.details) {
        console.log('   Details:', result.details);
      }

      console.log('\n🔍 Troubleshooting:');
      console.log('   1. Check if dev server is running: npm run dev');
      console.log('   2. Verify HEYGEN_API_KEY in .env');
      console.log('   3. Verify OPENAI_API_KEY in .env (optional)');
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);

    console.log('\n🔍 Make sure:');
    console.log('   1. Dev server is running: npm run dev');
    console.log('   2. Endpoint exists at: src/app/api/workflow/auto-video/route.ts');
    console.log('   3. Environment variables are set in .env');
  }
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                                                                ║');
console.log('║       AUTOMATED VIDEO WORKFLOW - MAKE.COM REPLACEMENT         ║');
console.log('║                                                                ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

testAutoWorkflow();
