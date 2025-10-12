// Test the complete viral video workflow with Submagic

async function testViralVideo() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         VIRAL VIDEO WORKFLOW - WITH SUBMAGIC                  ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🎬 Testing Complete Viral Video Workflow\n');
  console.log('This workflow will:');
  console.log('  1. ✅ Fetch Motor1 RSS feed');
  console.log('  2. ✅ Generate script with OpenAI');
  console.log('  3. ✅ Create HeyGen video with zoom (scale=1.4)');
  console.log('  4. ✅ Wait for HeyGen completion');
  console.log('  5. ✅ Send to Submagic for:');
  console.log('      • AI-generated captions');
  console.log('      • Sound effects');
  console.log('      • Dynamic cuts');
  console.log('      • Viral-style template');
  console.log('  6. ✅ Return final viral-ready video\n');

  const requestBody = {
    rss_url: 'https://www.motor1.com/rss/reviews/all/',
    auto_generate_script: true,
    talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
    voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
    scale: 1.4,
    width: 1080,
    height: 1920,
    submagic_template: 'Hormozi 2', // Viral template
    language: 'en'
  };

  console.log('📤 Request:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n🚀 Sending to: http://localhost:3000/api/workflow/viral-video\n');
  console.log('⏳ This will take ~5-10 minutes (HeyGen + Submagic processing)...\n');

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3000/api/workflow/viral-video', {
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

    if (result.success && result.final_video_url) {
      console.log('\n🎉 SUCCESS! VIRAL VIDEO CREATED!\n');

      console.log('═══════════════════════════════════════════════════');
      console.log('                    RESULTS                        ');
      console.log('═══════════════════════════════════════════════════\n');

      console.log('📝 Generated Script:');
      console.log('   ' + result.script + '\n');

      console.log('🎥 HeyGen Video (with zoom):');
      console.log('   Video ID:', result.heygen_video_id);
      console.log('   URL:', result.heygen_video_url);
      console.log('   Scale: 1.4 (zoomed in)\n');

      console.log('✨ Submagic Enhanced Video:');
      console.log('   Project ID:', result.submagic_project_id);
      console.log('   Final Video URL:', result.final_video_url);
      console.log('   Editor URL:', result.submagic_editor_url);
      console.log('   Template:', result.features_applied.viral_template);
      console.log('   Features Applied:');
      console.log('     • AI Captions:', result.features_applied.ai_captions ? '✅' : '❌');
      console.log('     • Sound Effects:', result.features_applied.sound_effects ? '✅' : '❌');
      console.log('     • Dynamic Cuts:', result.features_applied.dynamic_cuts ? '✅' : '❌');

      console.log('\n⏱️  Total Time:', duration, 'seconds');

      console.log('\n📥 Download Videos:');
      console.log('   HeyGen (original):');
      console.log(`     curl -o "heygen_video.mp4" "${result.heygen_video_url}"`);
      console.log('   Submagic (viral-ready):');
      console.log(`     curl -o "viral_video.mp4" "${result.final_video_url}"`);

      console.log('\n✏️  Edit Further (Optional):');
      console.log('   Open in Submagic editor:', result.submagic_editor_url);

      console.log('\n🎯 Ready to Post:');
      console.log('   • Instagram Reels');
      console.log('   • TikTok');
      console.log('   • YouTube Shorts');
      console.log('   • Facebook Reels');

      console.log('\n💰 Cost Breakdown:');
      console.log('   • OpenAI (script): ~$0.001');
      console.log('   • HeyGen (video): ~$0.15');
      console.log('   • Submagic (effects): Included in subscription');
      console.log('   • Total: ~$0.15 per video');

      console.log('\n🚀 Next Steps:');
      console.log('   1. Download the viral-ready video');
      console.log('   2. Post to your social channels');
      console.log('   3. Automate this with a cron job');
      console.log('   4. Scale to 100+ videos/day!');

    } else if (result.heygen_video_url && !result.final_video_url) {
      console.log('\n⏳ Partial Success: HeyGen completed, Submagic processing');
      console.log('   HeyGen Video:', result.heygen_video_url);
      console.log('   Submagic Project:', result.submagic_project_id);
      console.log('   Check status:', result.submagic_editor_url || result.check_url);

    } else {
      console.log('\n❌ Error:', result.error || result.message);
      if (result.details) {
        console.log('   Details:', result.details);
      }

      console.log('\n🔍 Troubleshooting:');
      console.log('   1. Check if dev server is running: npm run dev');
      console.log('   2. Verify HEYGEN_API_KEY in .env.local');
      console.log('   3. Verify OPENAI_API_KEY in .env.local');
      console.log('   4. Verify SUBMAGIC_API_KEY in .env.local');
      console.log('   5. Check Submagic subscription is active');
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);

    console.log('\n🔍 Make sure:');
    console.log('   1. Dev server is running: npm run dev');
    console.log('   2. Endpoint exists at: src/app/api/workflow/viral-video/route.ts');
    console.log('   3. All environment variables are set');
    console.log('   4. Submagic API key is valid');
  }
}

testViralVideo();
