// Test Dual Output: Individual Clips + Final Stitched Video
require('dotenv').config({ path: '.env.local' });

async function testDualOutput() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         DUAL OUTPUT TEST                                       ║');
  console.log('║         Individual Clips + Final Stitched Video                ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!OPENAI_API_KEY || !HEYGEN_API_KEY) {
    console.error('❌ Missing API keys in .env.local');
    process.exit(1);
  }

  try {
    // Check FFmpeg
    const { PodcastVideoGenerator } = await import('../lib/video-generator.ts');

    console.log('🔧 Checking FFmpeg installation...\n');
    if (!PodcastVideoGenerator.checkFFmpeg()) {
      console.error('❌ FFmpeg not found!');
      console.log('\n💡 Install FFmpeg:');
      console.log('   macOS: brew install ffmpeg');
      console.log('   Ubuntu: sudo apt install ffmpeg');
      console.log('   Windows: Download from https://ffmpeg.org\n');
      process.exit(1);
    }
    console.log('✅ FFmpeg is installed\n');

    // Import modules
    const { ScriptGenerator } = await import('../lib/script-generator.ts');
    const { PodcastScheduler } = await import('../lib/podcast-scheduler.ts');

    // Initialize
    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);
    const videoGen = new PodcastVideoGenerator(HEYGEN_API_KEY);
    const scheduler = new PodcastScheduler();

    // Generate script (2 questions for faster testing)
    console.log('📝 Step 1: Generating test script (2 questions)...\n');
    const script = await scriptGen.generateScript('doctor', 2);

    console.log(`✅ Script generated!`);
    console.log(`   Title: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name}`);
    console.log(`   Questions: ${script.qa_pairs.length}\n`);

    // Generate videos
    const episodeNumber = scheduler.recordEpisode(script.guest_id, 'pending');

    console.log('🎬 Step 2: Generating individual clips and final video...\n');
    console.log('   This will take 5-10 minutes. Progress:\n');

    const output = await videoGen.generatePodcast(script, episodeNumber);

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    GENERATION COMPLETE!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Output Summary:\n');
    console.log(`   Episode #: ${output.episode_number}`);
    console.log(`   Individual Clips: ${output.individual_clips.length}`);
    console.log(`   Clips Directory: ${output.clips_directory}`);
    console.log(`   Final Video: ${output.final_video_url}\n`);

    console.log('📹 Individual Clips:\n');
    output.individual_clips.forEach(clip => {
      const type = clip.type === 'question' ? 'Q' : 'A';
      const num = Math.ceil(clip.scene_number / 2);
      console.log(`   ${type}${num}: ${clip.video_url}`);
    });

    console.log('\n✅ Dual output test successful!\n');
    console.log('💡 Next steps:');
    console.log(`   1. Check clips in: ${output.clips_directory}`);
    console.log('   2. Review final stitched video');
    console.log('   3. Add captions with Submagic (optional)');
    console.log('   4. Publish to YouTube\n');

    console.log('📁 Files created:');
    console.log(`   - q1.mp4, a1.mp4, q2.mp4, a2.mp4 (individual clips)`);
    console.log(`   - episode-${episodeNumber}-final.mp4 (stitched video)`);
    console.log(`   - metadata.json (episode info)\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify all API keys are valid');
    console.log('   2. Check FFmpeg is installed');
    console.log('   3. Ensure sufficient disk space');
    console.log('   4. Update avatar IDs in guest-profiles.json');
    process.exit(1);
  }
}

testDualOutput();
