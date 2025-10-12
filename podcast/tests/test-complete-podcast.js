// Test Complete Podcast Workflow: Script → Video → Captions
require('dotenv').config({ path: '.env.local' });

async function testCompletePodcast() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         COMPLETE PODCAST WORKFLOW TEST                         ║');
  console.log('║         Script → HeyGen → Submagic → Ready to Publish          ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  if (!OPENAI_API_KEY || !HEYGEN_API_KEY || !SUBMAGIC_API_KEY) {
    console.error('❌ Missing API keys in .env.local');
    console.log('   Required: OPENAI_API_KEY, HEYGEN_API_KEY, SUBMAGIC_API_KEY');
    process.exit(1);
  }

  try {
    // Dynamically import ES modules
    const { ScriptGenerator } = await import('../lib/script-generator.ts');
    const { HeyGenPodcastGenerator } = await import('../lib/heygen-podcast.ts');
    const { SubmagicIntegration } = await import('../lib/submagic-integration.ts');
    const { PodcastScheduler } = await import('../lib/podcast-scheduler.ts');

    // Initialize services
    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);
    const videoGen = new HeyGenPodcastGenerator(HEYGEN_API_KEY);
    const submagic = new SubmagicIntegration(SUBMAGIC_API_KEY);
    const scheduler = new PodcastScheduler();

    // Step 1: Generate Script
    console.log('📝 Step 1: Generating podcast script...\n');
    const recentGuests = scheduler.getRecentGuestIds();
    console.log(`   Avoiding recent guests: ${recentGuests.join(', ') || 'None'}\n`);

    const script = await scriptGen.generateScript(undefined, 3); // 3 questions for testing

    console.log(`✅ Script generated!`);
    console.log(`   Title: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name}`);
    console.log(`   Duration: ~${script.estimated_duration_seconds}s\n`);

    // Step 2: Generate Video
    console.log('🎬 Step 2: Generating multi-scene video with HeyGen...\n');
    const videoId = await videoGen.generatePodcastVideo(script);

    console.log(`✅ Video generation started: ${videoId}\n`);

    console.log('⏳ Waiting for HeyGen to complete (2-5 minutes)...\n');
    const rawVideoUrl = await videoGen.waitForVideoCompletion(videoId);

    console.log(`✅ Video completed: ${rawVideoUrl}\n`);

    // Step 3: Add Captions with Submagic
    console.log('📝 Step 3: Adding captions with Submagic...\n');
    const finalVideoUrl = await submagic.addCaptions(rawVideoUrl, 'Hormozi 2', 'en');

    console.log(`✅ Captions added: ${finalVideoUrl}\n`);

    // Step 4: Record Episode
    console.log('💾 Step 4: Recording episode in scheduler...\n');
    const episodeNumber = scheduler.recordEpisode(script.guest_id, videoId);

    console.log(`✅ Episode #${episodeNumber} recorded\n`);

    // Display Stats
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    WORKFLOW COMPLETE!                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Episode Details:');
    console.log(`   Episode #: ${episodeNumber}`);
    console.log(`   Title: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name} (${script.guest_id})`);
    console.log(`   Topic: ${script.topic}`);
    console.log(`   Duration: ~${script.estimated_duration_seconds}s`);
    console.log(`   Final Video: ${finalVideoUrl}\n`);

    console.log('📈 Scheduler Stats:');
    const stats = scheduler.getStats();
    console.log(`   Total Episodes: ${stats.total_episodes}`);
    console.log(`   Published: ${stats.published_episodes}`);
    console.log(`   Recent Guests: ${stats.recent_guests.join(', ')}\n`);

    console.log('✅ Complete workflow test successful!\n');
    console.log('💡 Next steps:');
    console.log('   1. Download and review the video');
    console.log('   2. Publish to YouTube (manual or automated)');
    console.log('   3. Set up weekly cron job for automation\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check all API keys are valid');
    console.log('   2. Verify accounts have sufficient credits');
    console.log('   3. Ensure guest-profiles.json has valid avatar IDs');
    console.log('   4. Check network connectivity');
    process.exit(1);
  }
}

testCompletePodcast();
