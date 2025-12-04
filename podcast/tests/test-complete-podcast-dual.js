// Complete Workflow: Script → Individual Clips → Stitched Video → Captions
require('dotenv').config({ path: '.env.local' });

async function testCompletePodcastDual() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         COMPLETE DUAL-OUTPUT PODCAST WORKFLOW                  ║');
  console.log('║         Script → Clips → Stitch → Captions                     ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  if (!OPENAI_API_KEY || !HEYGEN_API_KEY) {
    console.error('❌ Missing required API keys');
    console.log('   Required: OPENAI_API_KEY, HEYGEN_API_KEY');
    console.log('   Optional: SUBMAGIC_API_KEY (for captions)');
    process.exit(1);
  }

  try {
    // Import modules
    const { ScriptGenerator } = await import('../lib/script-generator.ts');
    const { PodcastVideoGenerator } = await import('../lib/video-generator.ts');
    const { SubmagicIntegration } = await import('../lib/submagic-integration.ts');
    const { PodcastScheduler } = await import('../lib/podcast-scheduler.ts');

    // Check FFmpeg
    console.log('🔧 Checking FFmpeg...\n');
    if (!PodcastVideoGenerator.checkFFmpeg()) {
      console.error('❌ FFmpeg required but not found');
      console.log('   Install: brew install ffmpeg (macOS)\n');
      process.exit(1);
    }
    console.log('✅ FFmpeg ready\n');

    // Initialize
    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);
    const videoGen = new PodcastVideoGenerator(HEYGEN_API_KEY);
    const scheduler = new PodcastScheduler();

    // Step 1: Generate Script
    console.log('📝 Step 1: Generating podcast script...\n');
    const recentGuests = scheduler.getRecentGuestIds();
    const script = await scriptGen.generateScript(undefined, 3); // 3 Q&A for testing

    console.log(`✅ Script: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name}`);
    console.log(`   Duration: ~${script.estimated_duration_seconds}s\n`);

    // Step 2: Generate Videos (Individual + Stitched)
    console.log('🎬 Step 2: Generating videos...\n');
    console.log('   This creates both individual clips and final video');
    console.log('   Please wait 5-10 minutes...\n');

    const episodeNumber = scheduler.recordEpisode(script.guest_id, 'generating');
    const output = await videoGen.generatePodcast(script, episodeNumber);

    console.log(`✅ Videos complete!`);
    console.log(`   Individual clips: ${output.individual_clips.length}`);
    console.log(`   Final video: ${output.final_video_url}\n`);

    // Step 3: Add Captions (if Submagic key available)
    let finalVideoWithCaptions = output.final_video_url;

    if (SUBMAGIC_API_KEY) {
      console.log('📝 Step 3: Adding captions with Submagic...\n');

      // Upload final video to get URL (you may need to host it temporarily)
      console.log('   Note: Submagic needs a public URL');
      console.log('   Skipping captions for local file');
      console.log('   To add captions: upload video and pass URL to Submagic\n');
    } else {
      console.log('⏭️  Step 3: Skipping captions (no SUBMAGIC_API_KEY)\n');
    }

    // Display Results
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    WORKFLOW COMPLETE!                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Episode Details:\n');
    console.log(`   Episode #: ${output.episode_number}`);
    console.log(`   Title: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name} (${script.guest_id})`);
    console.log(`   Topic: ${script.topic}\n`);

    console.log('📁 Output Files:\n');
    console.log(`   Directory: ${output.clips_directory}\n`);

    console.log('   Individual Clips:');
    output.individual_clips.forEach((clip, i) => {
      const type = clip.type === 'question' ? 'Q' : 'A';
      const num = Math.ceil(clip.scene_number / 2);
      console.log(`   - ${type}${num}.mp4 (${clip.type})`);
    });

    console.log(`\n   Final Video:`);
    console.log(`   - episode-${output.episode_number}-final.mp4`);
    console.log(`\n   Metadata:`);
    console.log(`   - metadata.json\n`);

    console.log('📈 Scheduler Stats:');
    const stats = scheduler.getStats();
    console.log(`   Total Episodes: ${stats.total_episodes}`);
    console.log(`   Recent Guests: ${stats.recent_guests.join(', ') || 'None'}\n`);

    console.log('✅ Complete dual-output workflow successful!\n');
    console.log('💡 Next steps:');
    console.log('   1. Review individual clips for quality');
    console.log('   2. Edit clips if needed (they\'re separate files)');
    console.log('   3. Use final stitched video or re-stitch edited clips');
    console.log('   4. Upload final video to get public URL');
    console.log('   5. Add captions via Submagic (optional)');
    console.log('   6. Publish to YouTube\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check all API keys');
    console.log('   2. Verify FFmpeg is installed');
    console.log('   3. Ensure sufficient disk space (videos can be large)');
    console.log('   4. Check avatar IDs in guest-profiles.json');
    process.exit(1);
  }
}

testCompletePodcastDual();
