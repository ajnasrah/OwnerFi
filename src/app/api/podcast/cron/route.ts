// Automated Podcast Generation Cron Job
// Runs 5x daily (9 AM, 12 PM, 3 PM, 6 PM, 9 PM CDT)
// Generates up to 3 episodes per day with smart scheduling

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60; // 1 minute (webhook-based, no polling)

export async function GET(request: NextRequest) {
  let workflowId: string | null = null; // Track workflow ID for error handling

  try {
    // Verify authorization - allow dashboard, CRON_SECRET, or Vercel cron
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    // Allow requests from dashboard (same origin), with valid CRON_SECRET, or from Vercel cron
    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for force parameter (from dashboard button)
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    console.log('🎙️ Podcast cron job triggered - Generating daily episode [v2]');
    if (force) {
      console.log('⚡ Force mode enabled - Bypassing scheduler check');
    }

    // Import podcast generation libraries
    const { PodcastScheduler } = await import('../../../../../podcast/lib/podcast-scheduler');
    const ScriptGenerator = (await import('../../../../../podcast/lib/script-generator')).default;
    const { addPodcastWorkflow, updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');

    // Check if we should generate an episode (skip check if forced)
    const scheduler = new PodcastScheduler();
    // Load state from Firestore (async)
    await scheduler.loadStateFromFirestore();

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
    workflowId = workflow.id; // Capture for error handling
    console.log(`📊 Created workflow: ${workflow.id}`);

    // Step 1: Generate podcast script
    console.log('\n📝 Step 1: Generating podcast script...');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const scriptGen = new ScriptGenerator(OPENAI_API_KEY);

    // Load profiles from Firestore (async)
    await scriptGen.loadProfiles();

    const script = await scriptGen.generateScript(undefined, 1); // 1 Q&A pair (15-20 seconds)

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

    // Get host and guest profiles from Firestore
    const { getHostProfile, getGuestProfile } = await import('@/lib/feed-store-firestore');
    const hostProfile = await getHostProfile();
    if (!hostProfile) {
      throw new Error('Host profile not found in Firestore');
    }

    const guestProfile = await getGuestProfile(script.guest_id);
    if (!guestProfile) {
      throw new Error(`Guest profile not found: ${script.guest_id}`);
    }

    console.log(`   Host: ${hostProfile.name} (Avatar: ${hostProfile.avatar_id})`);
    console.log(`   Guest: ${guestProfile.name} (Avatar: ${guestProfile.avatar_id})`);

    // Use brand-specific webhook URL for podcast
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const webhookUrl = getBrandWebhookUrl('podcast', 'heygen');

    // Build multi-scene video inputs: alternating host questions and guest answers
    const videoInputs = script.qa_pairs.flatMap((pair) => {
      // Build host character config based on avatar type
      const hostCharacter = hostProfile.avatar_type === 'talking_photo'
        ? {
            type: 'talking_photo',
            talking_photo_id: hostProfile.avatar_id,
            scale: hostProfile.scale,
            talking_photo_style: 'square',
            talking_style: 'expressive'
          }
        : {
            type: 'avatar',
            avatar_id: hostProfile.avatar_id,
            avatar_style: 'normal'
          };

      // Build guest character config based on avatar type
      const guestCharacter = guestProfile.avatar_type === 'talking_photo'
        ? {
            type: 'talking_photo',
            talking_photo_id: guestProfile.avatar_id,
            scale: guestProfile.scale,
            talking_photo_style: 'square',
            talking_style: 'expressive'
          }
        : {
            type: 'avatar',
            avatar_id: guestProfile.avatar_id,
            avatar_style: 'normal'
          };

      return [
        // Scene: Host asks question
        {
          character: hostCharacter,
          voice: {
            type: 'text',
            input_text: pair.question,
            voice_id: hostProfile.voice_id
          }
        },
        // Scene: Guest answers
        {
          character: guestCharacter,
          voice: {
            type: 'text',
            input_text: pair.answer,
            voice_id: guestProfile.voice_id
          }
        }
      ];
    });

    console.log(`   Generated ${videoInputs.length} scenes (${script.qa_pairs.length} Q&A pairs)`);

    // Use multi-scene format: each entry in video_inputs is a separate scene
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
        video_inputs: videoInputs,
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
    const recordedEpisodeNumber = await scheduler.recordEpisode(
      script.guest_id,
      videoId
    );

    console.log(`\n🎉 Episode #${recordedEpisodeNumber} initiated!`);
    console.log(`   ⚡ HeyGen → Submagic → GetLate (automatic via webhooks)`);

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
      message: 'Podcast generation started. Workflow continues via webhooks (HeyGen → Submagic → GetLate).',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Podcast cron job error:', error);

    // Try to mark workflow as failed (if workflow was created)
    if (workflowId) {
      try {
        const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
        await updatePodcastWorkflow(workflowId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.log(`✅ Marked workflow ${workflowId} as failed`);
      } catch (updateError) {
        console.error('Failed to update workflow status:', updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        workflow_id: workflowId,
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
