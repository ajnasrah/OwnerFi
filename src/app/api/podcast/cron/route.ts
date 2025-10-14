// Automated Podcast Generation Cron Job
// Runs daily at 9 AM

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60; // 1 minute (webhook-based, no polling)

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

    console.log('🎙️ Podcast cron job triggered - Generating daily episode');
    if (force) {
      console.log('⚡ Force mode enabled - Bypassing scheduler check');
    }

    // Import podcast generation libraries
    const { PodcastScheduler } = await import('../../../../../podcast/lib/podcast-scheduler');
    const ScriptGenerator = (await import('../../../../../podcast/lib/script-generator')).default;
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

    // Step 2: Generate HeyGen video with webhook callback
    console.log('\n🎥 Step 2: Generating HeyGen video with webhook...');
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    // Get base URL for webhook callback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    const webhookUrl = `${baseUrl}/api/webhooks/heygen`;

    // Use Photo Avatar (0.2 credits/min vs 1 credit/min for Standard Avatar)
    // This is 5x cheaper for podcast-style content
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        test: false,
        caption: false,
        callback_id: workflow.id, // Use workflow ID as callback ID
        webhook_url: webhookUrl,
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: 'Wayne_20240711', // Photo Avatar (cheap option)
            avatar_style: 'normal'
          },
          voice: {
            type: 'text',
            input_text: script.full_dialogue,
            voice_id: 'bf9fd52eff1f4b999d75ca24e5e5a52d' // Wayne voice
          }
        }],
        dimension: {
          width: 1080,
          height: 1920
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const heygenData = await response.json();
    const videoId = heygenData.data?.video_id;

    if (!videoId) {
      throw new Error('HeyGen did not return video_id');
    }

    console.log(`✅ HeyGen video ID: ${videoId}`);
    console.log(`   Webhook callback: ${webhookUrl}`);
    console.log(`   Workflow continues via webhooks...`);

    // Update workflow with HeyGen video ID
    await updatePodcastWorkflow(workflow.id, {
      heygenVideoId: videoId
    });

    // Step 3: Record episode in scheduler
    const recordedEpisodeNumber = scheduler.recordEpisode(
      script.guest_id,
      videoId
    );

    console.log(`\n🎉 Episode #${recordedEpisodeNumber} initiated!`);
    console.log(`   ⚡ HeyGen → Submagic → Metricool (automatic via webhooks)`);

    return NextResponse.json({
      success: true,
      episode: {
        number: recordedEpisodeNumber,
        title: script.episode_title,
        guest: script.guest_name,
        topic: script.topic,
        video_id: videoId,
        workflow_id: workflow.id
      },
      message: 'Podcast generation started. Workflow continues via webhooks (HeyGen → Submagic → Publishing).',
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
