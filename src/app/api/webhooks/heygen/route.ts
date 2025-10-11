import { NextRequest, NextResponse } from 'next/server';
import { getWorkflow, updateWorkflow } from '@/lib/workflow-store';
import { fetchWithTimeout, retry, TIMEOUTS, rateLimiters, checkRateLimit } from '@/lib/api-utils';

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
    const workflow = getWorkflow(workflowId);

    if (!workflow) {
      console.log('⚠️ No pending workflow found for callback_id:', workflowId);
      return NextResponse.json({
        received: true,
        message: 'No pending workflow found'
      });
    }

    if (event_type === 'avatar_video.success' && event_data.url) {
      console.log('✅ HeyGen video completed:', event_data.url);

      // Update workflow
      updateWorkflow(workflowId, {
        videoUrl: event_data.url,
        status: 'heygen_complete'
      });

      // Trigger Submagic processing
      await triggerSubmagicProcessing(workflowId, event_data.url);

    } else if (event_type === 'avatar_video.fail') {
      console.error('❌ HeyGen video generation failed');
      updateWorkflow(workflowId, {
        status: 'failed',
        error: 'HeyGen generation failed'
      });
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
async function triggerSubmagicProcessing(workflowId: string, videoUrl: string) {
  if (!SUBMAGIC_API_KEY) {
    console.error('❌ Submagic API key not configured');
    updateWorkflow(workflowId, {
      status: 'failed',
      error: 'Submagic API key not configured'
    });
    return;
  }

  // Check rate limit
  if (!checkRateLimit(rateLimiters.submagic)) {
    console.error('❌ Submagic rate limit exceeded');
    updateWorkflow(workflowId, {
      status: 'failed',
      error: 'Submagic rate limit exceeded'
    });
    return;
  }

  try {
    console.log('✨ Sending to Submagic...');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await retry(
      async () => {
        const response = await fetchWithTimeout(
          'https://api.submagic.co/v1/projects',
          {
            method: 'POST',
            headers: {
              'x-api-key': SUBMAGIC_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: `Viral Video - ${workflowId}`,
              language: 'en',
              videoUrl: videoUrl,
              templateName: 'Hormozi 2',
              webhookUrl: `${baseUrl}/api/webhooks/submagic`
            })
          },
          TIMEOUTS.SUBMAGIC_SUBMIT
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const projectId = data.id || data.project_id || data.projectId;

        console.log('✅ Submagic project created:', projectId);

        // Update workflow
        updateWorkflow(workflowId, {
          submagicProjectId: projectId,
          status: 'submagic_pending'
        });
      },
      {
        maxAttempts: 3,
        backoff: 'exponential',
        onRetry: (attempt, error) => {
          console.log(`Submagic retry ${attempt}:`, error.message);
        }
      }
    );

  } catch (error) {
    console.error('❌ Error triggering Submagic after retries:', error);
    updateWorkflow(workflowId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
