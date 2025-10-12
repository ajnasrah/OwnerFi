// Post HeyGen video directly to all 6 social media platforms
// Skipping Submagic captions for this test

const HEYGEN_VIDEO_URL = 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/2dcdb3a4c6a347988334fb8ef90ee7da.mp4';
const TITLE = "Tesla's $25,000 Electric Car: The Future of Driving!";
const CAPTION = "Tesla just dropped a jaw-dropping electric car for only $25,000! This could change everything for EV adoption. 🚗⚡";
const HASHTAGS = ['Tesla', 'ElectricCar', 'EV', 'CarNews', 'TeslaModel2', 'GreenEnergy'];

async function postToSocialMedia() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         POSTING TO ALL 6 SOCIAL MEDIA PLATFORMS                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const platforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'threads'];

  console.log('📹 Video: Tesla $25K Electric Car');
  console.log('📝 Caption: ' + CAPTION);
  console.log('🏷️  Hashtags: ' + HASHTAGS.join(', '));
  console.log('\n📱 Platforms:');
  platforms.forEach((p, i) => console.log(`   ${i + 1}. ${p.charAt(0).toUpperCase() + p.slice(1)}`));

  console.log('\n📤 Posting to Metricool...\n');

  try {
    const response = await fetch('https://api.metricool.com/v1/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mc-Auth': 'CWYJZYORLGMQRYGAJHAGICULMYKTNPEYBWHGDXICJQMHSAGMJUXFKEECTBURNSXZ'
      },
      body: JSON.stringify({
        userId: '2946453',
        videoUrl: HEYGEN_VIDEO_URL,
        caption: `${CAPTION}\n\n${HASHTAGS.map(t => '#' + t).join(' ')}`,
        title: TITLE,
        platforms: platforms,
        type: 'video'
      })
    });

    const responseText = await response.text();

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                  🎉 SUCCESS! 🎉                                 ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      console.log('✅ Video posted to Metricool!');
      console.log(`📊 Post ID: ${data.postId || data.id || 'Check dashboard'}`);
      console.log('\n📱 Platforms posted to:');
      platforms.forEach((p, i) => console.log(`   ✅ ${i + 1}. ${p.charAt(0).toUpperCase() + p.slice(1)}`));

      console.log('\n🔗 Next Steps:');
      console.log('   1. Check Metricool Dashboard: https://app.metricool.com/');
      console.log('   2. View scheduled/posted content on your social media accounts');
      console.log('   3. The video should appear on all 6 platforms!\n');

    } else {
      console.log('\n⚠️  Metricool Response:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Message: ${responseText}`);
      console.log('\n💡 Note: The Metricool API might require additional setup or the response format may differ.');
      console.log('   The video is ready at: ' + HEYGEN_VIDEO_URL);
      console.log('   You can manually post this video to your platforms via Metricool dashboard.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 The HeyGen video is ready! You can post it manually:');
    console.log('   Video URL: ' + HEYGEN_VIDEO_URL);
  }
}

postToSocialMedia();
