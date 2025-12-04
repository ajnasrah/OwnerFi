// Test: Single HeyGen API Call with Multi-Scene (CORRECT & CHEAPER WAY)
require('dotenv').config({ path: '.env.local' });

async function testSingleAPICall() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         SINGLE API CALL TEST (Multi-Scene)                     ║');
  console.log('║         1 API Call = Complete Video with All Scenes            ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!OPENAI_API_KEY || !HEYGEN_API_KEY) {
    console.error('❌ Missing API keys');
    process.exit(1);
  }

  try {
    // Import modules
    const { ScriptGenerator } = await import('../lib/script-generator.ts');
    const { HeyGenPodcastGenerator } = await import('../lib/heygen-podcast.ts');

    // Generate script
    console.log('📝 Step 1: Generating script (2 questions)...\n');
    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);
    const script = await scriptGen.generateScript('doctor', 2);

    console.log(`✅ Script: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name}\n`);

    // Generate video with SINGLE API call
    console.log('🎬 Step 2: Generating complete video (1 API call)...\n');
    console.log('   Creating video with 4 scenes (Q1, A1, Q2, A2)');
    console.log('   This is 1 HeyGen API call, not 4!\n');

    const videoGen = new HeyGenPodcastGenerator(HEYGEN_API_KEY);
    const videoId = await videoGen.generatePodcastVideo(script);

    console.log(`✅ Video generation started: ${videoId}\n`);

    console.log('⏳ Waiting for completion (2-5 minutes)...\n');
    const videoUrl = await videoGen.waitForVideoCompletion(videoId);

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    VIDEO COMPLETE!                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`Video URL: ${videoUrl}\n`);

    console.log('💰 Cost Comparison:\n');
    console.log('   ❌ Individual clips method: 4 API calls = ~$4');
    console.log('   ✅ Multi-scene method: 1 API call = ~$1');
    console.log('   💡 This method is 75% cheaper!\n');

    console.log('📝 Next Step: Extract Individual Clips\n');
    console.log('   Download the video and use FFmpeg to split:');
    console.log('   ffmpeg -i video.mp4 -ss 00:00:00 -to 00:00:30 q1.mp4');
    console.log('   ffmpeg -i video.mp4 -ss 00:00:30 -to 00:01:00 a1.mp4\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testSingleAPICall();
