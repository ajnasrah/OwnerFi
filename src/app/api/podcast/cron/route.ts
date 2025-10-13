// Automated Podcast Generation Cron Job
// Runs every Monday at 9 AM

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify authorization - only require CRON_SECRET for external requests
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');

    // Allow requests from dashboard (same origin) or with valid CRON_SECRET
    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;

    if (!isFromDashboard && !hasValidSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for force parameter (from dashboard button)
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    console.log('🎙️ Podcast cron job triggered - Generating weekly episode');
    if (force) {
      console.log('⚡ Force mode enabled - Bypassing scheduler check');
    }

    // Import podcast generation libraries
    const { PodcastScheduler } = await import('../../../../../podcast/lib/podcast-scheduler');
    const ScriptGenerator = (await import('../../../../../podcast/lib/script-generator')).default;
    const HeyGenPodcastGenerator = (await import('../../../../../podcast/lib/heygen-podcast')).default;
    const { PodcastPublisher } = await import('../../../../../podcast/lib/podcast-publisher');
    const { addPodcastWorkflow, updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');

    // Check if we should generate an episode (skip check if forced)
    const scheduler = new PodcastScheduler();

    if (!force && !scheduler.shouldGenerateEpisode()) {
      console.log('⏭️  Skipping - Not time for a new episode yet');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Not time for a new episode yet',
        stats: scheduler.getStats()
      });
    }

    console.log('✅ Time to generate a new episode!');

    const episodeNumber = scheduler.getStats().last_episode_number + 1;

    // Create workflow record
    const workflow = await addPodcastWorkflow(episodeNumber, 'Generating...');
    console.log(`📊 Created workflow: ${workflow.id}`);

    // Step 1: Generate podcast script
    console.log('\n📝 Step 1: Generating podcast script...');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);
    const recentGuestIds = scheduler.getRecentGuestIds(4);
    const script = await scriptGen.generateScript(undefined, 2); // 2 Q&A pairs

    console.log(`✅ Generated script: ${script.episode_title}`);
    console.log(`   Guest: ${script.guest_name}`);
    console.log(`   Topic: ${script.topic}`);

    // Update workflow with script details
    await updatePodcastWorkflow(workflow.id, {
      episodeTitle: script.episode_title,
      guestName: script.guest_name,
      topic: script.topic,
      status: 'heygen_processing'
    });

    // Step 2: Generate HeyGen video
    console.log('\n🎥 Step 2: Generating HeyGen video...');
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    const heygenGen = new HeyGenPodcastGenerator(HEYGEN_API_KEY);
    const videoId = await heygenGen.generatePodcastVideo(script);

    console.log(`✅ HeyGen video ID: ${videoId}`);

    // Update workflow with HeyGen video ID
    await updatePodcastWorkflow(workflow.id, {
      heygenVideoId: videoId
    });

    // Step 3: Wait for HeyGen completion (with timeout)
    console.log('\n⏳ Step 3: Waiting for HeyGen video...');
    const heygenUrl = await waitForVideoCompletion(videoId, 14);

    if (!heygenUrl) {
      throw new Error('HeyGen video timed out');
    }

    console.log(`✅ HeyGen completed: ${heygenUrl}`);

    // Update workflow to Submagic processing
    await updatePodcastWorkflow(workflow.id, {
      status: 'submagic_processing'
    });

    // Step 4: Enhance with Submagic
    console.log('\n✨ Step 4: Adding Submagic captions...');
    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      throw new Error('SUBMAGIC_API_KEY not configured');
    }

    const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SUBMAGIC_API_KEY
      },
      body: JSON.stringify({
        videoUrl: heygenUrl,
        title: script.episode_title,
        language: 'en',
        templateName: 'Hormozi 2'
      })
    });

    if (!submagicResponse.ok) {
      const errorText = await submagicResponse.text();
      throw new Error(`Submagic API error: ${submagicResponse.status} - ${errorText}`);
    }

    const submagicData = await submagicResponse.json();
    const projectId = submagicData.project_id || submagicData.id;

    if (!projectId) {
      throw new Error('Submagic did not return project_id');
    }

    console.log(`✅ Submagic project: ${projectId}`);

    // Update workflow with Submagic project ID
    await updatePodcastWorkflow(workflow.id, {
      submagicProjectId: projectId
    });

    // Step 5: Wait for Submagic completion
    console.log('\n⏳ Step 5: Waiting for Submagic...');
    const finalVideoUrl = await waitForSubmagicCompletion(projectId, 14);

    if (!finalVideoUrl) {
      throw new Error('Submagic processing timed out');
    }

    console.log(`✅ Final video ready: ${finalVideoUrl}`);

    // Update workflow with final video URL
    await updatePodcastWorkflow(workflow.id, {
      finalVideoUrl: finalVideoUrl,
      status: 'publishing'
    });

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
        episode_title: script.episode_title,
        guest_name: script.guest_name,
        topic: script.topic
      },
      publicFinalUrl
    );

    if (!publishResult.success) {
      console.error('⚠️  Publishing failed:', publishResult.error);
      // Mark workflow as failed
      await updatePodcastWorkflow(workflow.id, {
        status: 'failed',
        error: publishResult.error,
        completedAt: Date.now()
      });
    } else {
      console.log('✅ Published to social media!');
      // Mark workflow as completed
      await updatePodcastWorkflow(workflow.id, {
        status: 'completed',
        metricoolPostId: publishResult.postId,
        completedAt: Date.now()
      });
    }

    // Step 8: Record episode in scheduler
    const recordedEpisodeNumber = scheduler.recordEpisode(
      script.guest_id,
      videoId
    );

    console.log(`\n🎉 Episode #${recordedEpisodeNumber} complete!`);

    return NextResponse.json({
      success: true,
      episode: {
        number: recordedEpisodeNumber,
        title: script.episode_title,
        guest: script.guest_name,
        topic: script.topic,
        video_id: videoId,
        final_url: publicFinalUrl
      },
      publishing: publishResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Podcast cron job error:', error);

    // Try to mark workflow as failed (if workflow was created)
    try {
      const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
      // Get workflow ID from URL or context if available
      // For now, we'll just log - in production you'd want to track this better
      console.log('Note: Workflow error occurred, but cannot update status without workflow ID reference');
    } catch (updateError) {
      // Ignore errors updating workflow status
    }

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
