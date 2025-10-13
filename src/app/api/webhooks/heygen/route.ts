import { NextRequest, NextResponse } from 'next/server';

// Updated Submagic API key - 2025-10-13
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

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

    // Find workflow in Firestore by ID
    const { getWorkflowById } = await import('@/lib/feed-store-firestore');
    const result = await getWorkflowById(workflowId);

    if (!result) {
      console.log('⚠️ No pending workflow found for callback_id:', workflowId);
      return NextResponse.json({
        received: true,
        message: 'No pending workflow found'
      });
    }

    const { workflow, brand } = result;

    if (event_type === 'avatar_video.success' && event_data.url) {
      console.log('✅ HeyGen video completed via webhook!');
      console.log('   Video URL:', event_data.url);

      // Update workflow status to 'submagic_processing'
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand, {
        status: 'submagic_processing'
      });

      // Send immediate confirmation to HeyGen
      const response = NextResponse.json({
        received: true,
        event_type,
        workflow_id: workflowId
      });

      // Trigger Submagic processing asynchronously (don't block webhook response)
      setImmediate(async () => {
        await triggerSubmagicProcessing(workflowId, event_data.url, brand, workflow);
      });

      return response;

    } else if (event_type === 'avatar_video.fail') {
      console.error('❌ HeyGen video generation failed via webhook');

      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand, {
        status: 'failed',
        error: 'HeyGen generation failed'
      });

      // Send alert
      const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
      await alertWorkflowFailure(
        brand,
        workflowId,
        workflow.articleTitle || 'Unknown',
        'HeyGen generation failed'
      );
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
  brand: 'carz' | 'ownerfi',
  workflow: any
) {
  if (!SUBMAGIC_API_KEY) {
    console.error('❌ Submagic API key not configured');
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, {
      status: 'failed',
      error: 'Submagic API key not configured'
    });
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

    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: workflow.articleTitle || `Viral Video - ${workflowId}`,
        language: 'en',
        videoUrl: publicHeygenUrl, // Use R2 public URL
        templateName: 'Hormozi 2',
        magicBrolls: true,
        magicBrollsPercentage: 50,
        magicZooms: true,
        callbackUrl: webhookUrl
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const projectId = data.id || data.project_id || data.projectId;

    console.log('✅ Submagic project created via HeyGen webhook:', projectId);

    // Update workflow with Submagic project ID
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, {
      submagicVideoId: projectId
    });

  } catch (error) {
    console.error('❌ Error triggering Submagic from HeyGen webhook:', error);

    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Send alert
    const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
    await alertWorkflowFailure(
      brand,
      workflowId,
      workflow.articleTitle || 'Unknown',
      `Submagic trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
