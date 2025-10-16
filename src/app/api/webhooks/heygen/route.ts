import { NextRequest, NextResponse } from 'next/server';

// Handle OPTIONS for HeyGen webhook validation (required)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('🔔 HeyGen webhook received:', JSON.stringify(body, null, 2));

    // HeyGen webhook payload structure:
    // { event_type: "avatar_video.success", event_data: { video_id, url, callback_id, ... } }
    const { event_type, event_data } = body;

    if (!event_data || !event_data.callback_id) {
      console.log('⚠️ Missing callback_id in webhook');
      return NextResponse.json({
        received: true,
        message: 'Missing callback_id'
      });
    }

    const workflowId = event_data.callback_id;

    // Find workflow in Firestore by ID (check social media workflows first)
    const { getWorkflowById, getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
    let result = await getWorkflowById(workflowId);
    let isPodcast = false;
    let brand: 'carz' | 'ownerfi' | 'podcast' = 'ownerfi';

    // If not found in social media, check podcast workflows
    if (!result) {
      const podcastWorkflow = await getPodcastWorkflowById(workflowId);
      if (podcastWorkflow) {
        isPodcast = true;
        brand = 'podcast';
        result = { workflow: podcastWorkflow, brand: 'ownerfi' as any }; // Temp structure
      }
    }

    if (!result) {
      console.log('⚠️ No pending workflow found for callback_id:', workflowId);
      return NextResponse.json({
        received: true,
        message: 'No pending workflow found'
      });
    }

    const { workflow } = result;
    if (!isPodcast) {
      brand = result.brand;
    }

    if (event_type === 'avatar_video.success' && event_data.url) {
      console.log('✅ HeyGen video completed via webhook!');
      console.log('   Video URL:', event_data.url);
      console.log('   Type:', isPodcast ? 'PODCAST' : 'SOCIAL MEDIA');

      // Trigger Submagic processing synchronously (CRITICAL: Must complete before function terminates)
      // In serverless environments, setImmediate() work gets killed when the response is sent
      // NOTE: Status is set to 'submagic_processing' INSIDE triggerSubmagicProcessing
      // AFTER we get the Submagic project ID, so failsafe can find it
      await triggerSubmagicProcessing(workflowId, event_data.url, brand, workflow, isPodcast);

      return NextResponse.json({
        received: true,
        event_type,
        workflow_id: workflowId
      });

    } else if (event_type === 'avatar_video.fail') {
      console.error('❌ HeyGen video generation failed via webhook');

      if (isPodcast) {
        const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
        await updatePodcastWorkflow(workflowId, {
          status: 'failed',
          error: 'HeyGen generation failed'
        });
      } else {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'failed',
          error: 'HeyGen generation failed'
        });

        // Send alert
        const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
        await alertWorkflowFailure(
          brand as 'carz' | 'ownerfi',
          workflowId,
          workflow.articleTitle || 'Unknown',
          'HeyGen generation failed'
        );
      }
    }

    return NextResponse.json({
      received: true,
      event_type,
      workflow_id: workflowId
    });

  } catch (error) {
    console.error('Error processing HeyGen webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Trigger Submagic processing with retry logic
async function triggerSubmagicProcessing(
  workflowId: string,
  heygenVideoUrl: string,
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflow: any,
  isPodcast: boolean = false
) {
  // Read environment variables at runtime, not at module load time
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ Submagic API key not configured');
    if (isPodcast) {
      const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
      await updatePodcastWorkflow(workflowId, {
        status: 'failed',
        error: 'Submagic API key not configured'
      });
    } else {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        status: 'failed',
        error: 'Submagic API key not configured'
      });
    }
    return;
  }

  try {
    console.log('☁️  Step 1: Uploading HeyGen video to R2 for Submagic...');

    // Upload HeyGen video directly to R2
    const { downloadAndUploadToR2 } = await import('@/lib/video-storage');
    const publicHeygenUrl = await downloadAndUploadToR2(
      heygenVideoUrl,
      HEYGEN_API_KEY!,
      `heygen-videos/${workflowId}.mp4`
    );

    console.log('✅ Public R2 URL:', publicHeygenUrl);
    console.log('✨ Step 2: Sending to Submagic...');

    // Get base URL for webhook callback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    const webhookUrl = `${baseUrl}/api/webhooks/submagic`;

    // Ensure title is ≤50 characters (Submagic requirement)
    let title = workflow.articleTitle || `Viral Video - ${workflowId}`;
    if (title.length > 50) {
      console.warn(`⚠️  Submagic title too long (${title.length} chars), truncating to 50`);
      title = title.substring(0, 47) + '...';
    }

    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        language: 'en',
        videoUrl: publicHeygenUrl, // Use R2 public URL
        templateName: 'Hormozi 2',
        magicBrolls: true,
        magicBrollsPercentage: 50,
        magicZooms: true,
        webhookUrl: webhookUrl // ⭐ Webhook notification when complete (parameter is webhookUrl, not callbackUrl)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const projectId = data.id || data.project_id || data.projectId;

    console.log('✅ Submagic project created via HeyGen webhook:', projectId);

    // Update workflow with Submagic project ID AND set status to submagic_processing
    // (both must be set together so failsafe can find stuck workflows)
    if (isPodcast) {
      const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
      await updatePodcastWorkflow(workflowId, {
        status: 'submagic_processing',
        submagicProjectId: projectId
      });
    } else {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        status: 'submagic_processing',
        submagicVideoId: projectId
      });
    }

  } catch (error) {
    console.error('❌ Error triggering Submagic from HeyGen webhook:', error);

    if (isPodcast) {
      const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
      await updatePodcastWorkflow(workflowId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Send alert
      const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
      await alertWorkflowFailure(
        brand as 'carz' | 'ownerfi',
        workflowId,
        workflow.articleTitle || 'Unknown',
        `Submagic trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
