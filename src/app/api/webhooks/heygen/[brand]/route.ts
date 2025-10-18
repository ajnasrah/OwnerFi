/**
 * Brand-Specific HeyGen Webhook Handler
 *
 * This webhook receives notifications from HeyGen when video generation completes.
 * Each brand has its own isolated webhook endpoint to prevent failures from affecting other brands.
 *
 * Route: /api/webhooks/heygen/[brand]
 * Brands: carz, ownerfi, podcast
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBrand, buildErrorContext, createBrandError, getBrandWebhookUrl } from '@/lib/brand-utils';
import { getBrandConfig } from '@/config/brand-configs';

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

interface RouteContext {
  params: {
    brand: string;
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  let workflowId: string | undefined;

  try {
    // Validate brand from URL path
    const brand = validateBrand(context.params.brand);
    const brandConfig = getBrandConfig(brand);

    console.log(`🔔 [${brandConfig.displayName}] HeyGen webhook received`);

    // Parse request body
    const body = await request.json();
    console.log(`   Payload:`, JSON.stringify(body, null, 2));

    // Extract HeyGen webhook data
    // Structure: { event_type: "avatar_video.success", event_data: { video_id, url, callback_id, ... } }
    const { event_type, event_data } = body;

    if (!event_data || !event_data.callback_id) {
      console.warn(`⚠️ [${brandConfig.displayName}] Missing callback_id in webhook`);
      return NextResponse.json({
        success: false,
        brand,
        message: 'Missing callback_id in event_data',
      }, { status: 400 });
    }

    workflowId = event_data.callback_id;

    // Find workflow in brand-specific collection (NO sequential lookups!)
    const workflow = await getWorkflowForBrand(brand, workflowId);

    if (!workflow) {
      console.warn(`⚠️ [${brandConfig.displayName}] No workflow found for callback_id: ${workflowId}`);
      return NextResponse.json({
        success: false,
        brand,
        workflow_id: workflowId,
        message: 'No pending workflow found for this callback_id',
      }, { status: 404 });
    }

    // Handle video generation success
    if (event_type === 'avatar_video.success' && event_data.url) {
      console.log(`✅ [${brandConfig.displayName}] HeyGen video completed!`);
      console.log(`   Video URL: ${event_data.url}`);
      console.log(`   Workflow ID: ${workflowId}`);

      // Trigger Submagic processing synchronously
      // CRITICAL: Must complete before function terminates in serverless environment
      await triggerSubmagicProcessing(
        brand,
        workflowId,
        event_data.url,
        workflow
      );

      const duration = Date.now() - startTime;
      console.log(`⏱️  [${brandConfig.displayName}] Webhook processed in ${duration}ms`);

      return NextResponse.json({
        success: true,
        brand,
        event_type,
        workflow_id: workflowId,
        processing_time_ms: duration,
      });
    }

    // Handle video generation failure
    if (event_type === 'avatar_video.fail') {
      console.error(`❌ [${brandConfig.displayName}] HeyGen video generation failed`);

      await updateWorkflowForBrand(brand, workflowId, {
        status: 'failed',
        error: 'HeyGen generation failed',
        failedAt: Date.now(),
      });

      // Send failure alert
      await sendFailureAlert(brand, workflowId, workflow, 'HeyGen generation failed');

      return NextResponse.json({
        success: true,
        brand,
        event_type,
        workflow_id: workflowId,
        message: 'Failure recorded',
      });
    }

    // Unknown event type
    console.warn(`⚠️ [${brandConfig.displayName}] Unknown event type: ${event_type}`);
    return NextResponse.json({
      success: false,
      brand,
      event_type,
      workflow_id: workflowId,
      message: `Unknown event type: ${event_type}`,
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error processing HeyGen webhook:', error);

    // Log to DLQ for later analysis
    await logToDeadLetterQueue('heygen', context.params.brand, request, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      workflow_id: workflowId,
    }, { status: 500 });
  }
}

/**
 * Get workflow for specific brand (NO sequential lookups)
 */
async function getWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string
): Promise<any | null> {
  if (brand === 'podcast') {
    const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getPodcastWorkflowById(workflowId);
  } else {
    const { getWorkflowById } = await import('@/lib/feed-store-firestore');
    const result = await getWorkflowById(workflowId);
    return result?.workflow || null;
  }
}

/**
 * Update workflow for specific brand
 */
async function updateWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  updates: Record<string, any>
): Promise<void> {
  if (brand === 'podcast') {
    const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
    await updatePodcastWorkflow(workflowId, updates);
  } else {
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, updates);
  }
}

/**
 * Trigger Submagic processing with brand-specific webhook
 */
async function triggerSubmagicProcessing(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  heygenVideoUrl: string,
  workflow: any
): Promise<void> {
  const brandConfig = getBrandConfig(brand);
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!SUBMAGIC_API_KEY) {
    throw createBrandError(brand, 'Submagic API key not configured');
  }

  try {
    console.log(`☁️  [${brandConfig.displayName}] Step 1: Uploading to R2...`);

    // Upload HeyGen video to R2 with brand-specific path
    const { downloadAndUploadToR2 } = await import('@/lib/video-storage');
    const { getBrandStoragePath } = await import('@/lib/brand-utils');

    const storagePath = getBrandStoragePath(brand, `heygen-videos/${workflowId}.mp4`);
    const publicHeygenUrl = await downloadAndUploadToR2(
      heygenVideoUrl,
      HEYGEN_API_KEY!,
      storagePath
    );

    console.log(`✅ [${brandConfig.displayName}] R2 URL: ${publicHeygenUrl}`);
    console.log(`✨ [${brandConfig.displayName}] Step 2: Sending to Submagic...`);

    // Use brand-specific webhook URL from config
    const submagicWebhookUrl = brandConfig.webhooks.submagic;

    // Prepare title (max 50 characters for Submagic)
    let title = workflow.articleTitle || workflow.episodeTitle || `${brandConfig.displayName} Video - ${workflowId}`;

    // Decode HTML entities
    title = title
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8211;/g, "-")
      .replace(/&#8212;/g, "-")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");

    if (title.length > 50) {
      console.warn(`⚠️  [${brandConfig.displayName}] Title too long (${title.length} chars), truncating to 50`);
      title = title.substring(0, 47) + '...';
    }

    // Send to Submagic API
    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        language: 'en',
        videoUrl: publicHeygenUrl,
        templateName: 'Hormozi 2',
        magicBrolls: true,
        magicBrollsPercentage: 50,
        magicZooms: true,
        webhookUrl: submagicWebhookUrl // Brand-specific webhook
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const projectId = data.id || data.project_id || data.projectId;

    console.log(`✅ [${brandConfig.displayName}] Submagic project created: ${projectId}`);

    // Update workflow with Submagic ID and status
    await updateWorkflowForBrand(brand, workflowId, {
      status: 'submagic_processing',
      submagicVideoId: projectId,
      submagicProjectId: projectId, // For podcast compatibility
    });

  } catch (error) {
    console.error(`❌ [${brandConfig.displayName}] Error triggering Submagic:`, error);

    await updateWorkflowForBrand(brand, workflowId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error triggering Submagic',
      failedAt: Date.now(),
    });

    await sendFailureAlert(
      brand,
      workflowId,
      workflow,
      `Submagic trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    throw error;
  }
}

/**
 * Send failure alert for brand
 */
async function sendFailureAlert(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  workflow: any,
  reason: string
): Promise<void> {
  try {
    if (brand !== 'podcast') {
      const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
      await alertWorkflowFailure(
        brand,
        workflowId,
        workflow.articleTitle || 'Unknown',
        reason
      );
    }
  } catch (error) {
    console.error('Failed to send alert:', error);
    // Don't throw - alerting failure shouldn't block webhook processing
  }
}

/**
 * Log failed webhook to dead letter queue
 */
async function logToDeadLetterQueue(
  service: string,
  brand: string,
  request: NextRequest,
  error: unknown
): Promise<void> {
  try {
    const { logWebhookFailure } = await import('@/lib/webhook-dlq');
    await logWebhookFailure({
      service,
      brand,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
    });
  } catch (dlqError) {
    console.error('Failed to log to DLQ:', dlqError);
    // Don't throw - DLQ failure shouldn't block webhook response
  }
}
