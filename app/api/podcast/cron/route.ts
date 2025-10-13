// Automated Podcast Generation Cron Job
// Runs every Monday at 9 AM

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🎙️ Podcast cron job triggered - Generating weekly episode');

    // Import podcast generation libraries
    const { PodcastScheduler } = await import('../../../../podcast/lib/podcast-scheduler');
    const { generatePodcastScript } = await import('../../../../podcast/lib/script-generator');
    const { generateHeyGenVideo } = await import('../../../../podcast/lib/heygen-podcast');
    const { enhanceWithSubmagic } = await import('../../../../podcast/lib/submagic-integration');
    const { PodcastPublisher } = await import('../../../../podcast/lib/podcast-publisher');

    // Check if we should generate an episode
    const scheduler = new PodcastScheduler();

    if (!scheduler.shouldGenerateEpisode()) {
      console.log('⏭️  Skipping - Not time for a new episode yet');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Not time for a new episode yet',
        stats: scheduler.getStats()
      });
    }

    console.log('✅ Time to generate a new episode!');

    // Step 1: Generate podcast script
    console.log('\n📝 Step 1: Generating podcast script...');
    const scriptResult = await generatePodcastScript({
      topic: 'auto', // Auto-select from trending topics
      recentGuestIds: scheduler.getRecentGuestIds(4)
    });

    if (!scriptResult.success || !scriptResult.script) {
      throw new Error('Failed to generate script');
    }

    console.log(`✅ Generated script: ${scriptResult.script.episode_title}`);
    console.log(`   Guest: ${scriptResult.script.guest_info.name}`);
    console.log(`   Topic: ${scriptResult.script.topic}`);

    // Step 2: Generate HeyGen video
    console.log('\n🎥 Step 2: Generating HeyGen video...');
    const videoResult = await generateHeyGenVideo(scriptResult.script);

    if (!videoResult.success || !videoResult.video_id) {
      throw new Error('HeyGen video generation failed');
    }

    console.log(`✅ HeyGen video ID: ${videoResult.video_id}`);

    // Step 3: Wait for HeyGen completion (with timeout)
    console.log('\n⏳ Step 3: Waiting for HeyGen video...');
    const heygenUrl = await waitForVideoCompletion(videoResult.video_id, 14);

    if (!heygenUrl) {
      throw new Error('HeyGen video timed out');
    }

    console.log(`✅ HeyGen completed: ${heygenUrl}`);

    const episodeNumber = scheduler.getStats().last_episode_number + 1;

    // Step 4: Enhance with Submagic
    console.log('\n✨ Step 4: Adding Submagic captions...');
    const submagicResult = await enhanceWithSubmagic({
      videoUrl: heygenUrl,
      title: scriptResult.script.episode_title,
      language: 'en',
      templateName: 'Hormozi 2'
    });

    if (!submagicResult.success || !submagicResult.project_id) {
      throw new Error('Submagic enhancement failed');
    }

    console.log(`✅ Submagic project: ${submagicResult.project_id}`);

    // Step 5: Wait for Submagic completion
    console.log('\n⏳ Step 5: Waiting for Submagic...');
    const finalVideoUrl = await waitForSubmagicCompletion(submagicResult.project_id, 14);

    if (!finalVideoUrl) {
      throw new Error('Submagic processing timed out');
    }

    console.log(`✅ Final video ready: ${finalVideoUrl}`);

    // Step 6: Use Submagic URL directly (Metricool trusts submagic.co domain)
    console.log('\n✅ Step 6: Using Submagic URL directly (no storage needed)...');
    const publicFinalUrl = finalVideoUrl;
    console.log(`   Video URL: ${publicFinalUrl}`);

    // Step 7: Publish to social media
    console.log('\n📱 Step 7: Publishing to social media...');
    const publisher = new PodcastPublisher('ownerfi');

    const publishResult = await publisher.publishEpisode(
      {
        episode_number: episodeNumber,
        episode_title: scriptResult.script.episode_title,
        guest_name: scriptResult.script.guest_info.name,
        topic: scriptResult.script.topic
      },
      publicFinalUrl
    );

    if (!publishResult.success) {
      console.error('⚠️  Publishing failed:', publishResult.error);
    } else {
      console.log('✅ Published to social media!');
    }

    // Step 8: Record episode in scheduler
    const recordedEpisodeNumber = scheduler.recordEpisode(
      scriptResult.script.guest_info.id,
      videoResult.video_id
    );

    console.log(`\n🎉 Episode #${recordedEpisodeNumber} complete!`);

    return NextResponse.json({
      success: true,
      episode: {
        number: recordedEpisodeNumber,
        title: scriptResult.script.episode_title,
        guest: scriptResult.script.guest_info.name,
        topic: scriptResult.script.topic,
        video_id: videoResult.video_id,
        final_url: publicFinalUrl
      },
      publishing: publishResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Podcast cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}

// Helper: Wait for HeyGen video completion
async function waitForVideoCompletion(videoId: string, maxAttempts: number = 14): Promise<string | null> {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 45000)); // 45 seconds

    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        { headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY! } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.data?.status;

      console.log(`⏳ HeyGen (${attempt + 1}/${maxAttempts}): ${status}`);

      if (status === 'completed') return data.data.video_url;
      if (status === 'failed') return null;
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  }

  return null;
}

// Helper: Wait for Submagic completion
async function waitForSubmagicCompletion(projectId: string, maxAttempts: number = 14): Promise<string | null> {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 45000)); // 45 seconds

    try {
      const response = await fetch(
        `https://api.submagic.co/v1/projects/${projectId}`,
        { headers: { 'x-api-key': SUBMAGIC_API_KEY! } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const status = data.status;

      console.log(`⏳ Submagic (${attempt + 1}/${maxAttempts}): ${status}`);

      if (status === 'completed' || status === 'done' || status === 'ready') {
        const videoUrl = data.media_url || data.mediaUrl || data.video_url || data.videoUrl || data.download_url;
        return videoUrl;
      }

      if (status === 'failed' || status === 'error') return null;
    } catch (error) {
      console.error('Error checking Submagic status:', error);
    }
  }

  return null;
}
