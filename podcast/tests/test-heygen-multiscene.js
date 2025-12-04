// Test HeyGen Multi-Scene Video Generation
require('dotenv').config({ path: '.env.local' });

async function testHeyGenMultiScene() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         HEYGEN MULTI-SCENE VIDEO TEST                          ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env.local');
    process.exit(1);
  }

  try {
    // Dynamically import ES modules
    const { ScriptGenerator } = await import('../lib/script-generator.ts');
    const { HeyGenPodcastGenerator } = await import('../lib/heygen-podcast.ts');

    // Generate a short test script (2 questions for faster testing)
    console.log('📝 Step 1: Generating test script (2 questions)...\n');
    const scriptGen = new ScriptGenerator(process.env.OPENAI_API_KEY);
    const script = await scriptGen.generateScript('doctor', 2);

    console.log(`Generated: ${script.episode_title}`);
    console.log(`Guest: ${script.guest_name}`);
    console.log(`Questions: ${script.qa_pairs.length}\n`);

    // Generate multi-scene video
    console.log('🎬 Step 2: Creating multi-scene video with HeyGen...\n');
    const videoGen = new HeyGenPodcastGenerator(HEYGEN_API_KEY);
    const videoId = await videoGen.generatePodcastVideo(script);

    console.log(`✅ Video generation started!`);
    console.log(`Video ID: ${videoId}\n`);

    console.log('⏳ Step 3: Waiting for video to complete...\n');
    console.log('   This will take 2-5 minutes. Please wait...\n');

    const videoUrl = await videoGen.waitForVideoCompletion(videoId, 10);

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    VIDEO COMPLETE!                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`Video URL: ${videoUrl}\n`);

    console.log('✅ Multi-scene video test successful!\n');
    console.log('💡 Next steps:');
    console.log('   1. Download the video from the URL above');
    console.log('   2. Verify the Q&A alternation works correctly');
    console.log('   3. Check both avatars appear as expected\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. HEYGEN_API_KEY and OPENAI_API_KEY are set');
    console.log('   2. HeyGen account has credits');
    console.log('   3. Avatar IDs in guest-profiles.json are valid');
    process.exit(1);
  }
}

testHeyGenMultiScene();
