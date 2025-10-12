// Test automated workflow with Motor1.com RSS feed

async function testMotor1RSS() {
  console.log('🚗 Testing with Motor1.com RSS Feed\n');
  console.log('📰 RSS URL: https://www.motor1.com/rss/reviews/all/\n');
  console.log('This will:');
  console.log('  1. ✅ Fetch latest car review from RSS');
  console.log('  2. ✅ Generate video script with OpenAI');
  console.log('  3. ✅ Create HeyGen video with zoom');
  console.log('  4. ✅ Wait for completion');
  console.log('  5. ✅ Return video URL\n');

  const requestBody = {
    rss_url: 'https://www.motor1.com/rss/reviews/all/',
    auto_generate_script: true,
    talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
    voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
    scale: 1.4,
    width: 720,
    height: 1280
  };

  console.log('📤 Request:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n🚀 Sending to: http://localhost:3000/api/workflow/auto-video\n');
  console.log('⏳ This will take ~60-90 seconds...\n');

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
      console.log('\n🎉 SUCCESS! Motor1 Car Review Video Generated!\n');
      console.log('📊 Results:');
      console.log('   ✅ Video ID:', result.video_id);
      console.log('   ✅ Video URL:', result.video_url);
      console.log('\n📝 Generated Script:');
      console.log('   ' + result.script);
      console.log('\n⏱️  Total Time:', duration, 'seconds');

      console.log('\n📥 Download the video:');
      console.log(`   curl -o "motor1_review.mp4" "${result.video_url}"`);

      console.log('\n🎯 Perfect! This video can now be:');
      console.log('   - Posted on social media');
      console.log('   - Used in email campaigns');
      console.log('   - Embedded on your website');
      console.log('   - Shared on YouTube/TikTok');

      console.log('\n🔄 Want to automate this?');
      console.log('   - Set up a cron job to run daily');
      console.log('   - It will pull the latest Motor1 review');
      console.log('   - Generate a video automatically');
      console.log('   - Post to your social channels');

    } else if (result.video_id && !result.success) {
      console.log('\n⏳ Video is still processing');
      console.log('   Video ID:', result.video_id);
      console.log('   Check status at:', result.check_status_url);

    } else {
      console.log('\n❌ Error:', result.error);
      if (result.details) {
        console.log('   Details:', result.details);
      }
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                                                                ║');
console.log('║            MOTOR1.COM RSS FEED TO VIDEO TEST                  ║');
console.log('║                                                                ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

testMotor1RSS();
