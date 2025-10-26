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
  let rawBody: string | undefined;

  try {
    // Validate brand from URL path
    const brand = validateBrand(context.params.brand);
    const brandConfig = getBrandConfig(brand);

    console.log(`🔔 [${brandConfig.displayName}] HeyGen webhook received`);

    // Get raw body for signature verification
    rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Verify webhook signature (if configured)
    const { verifyHeyGenWebhook, shouldEnforceWebhookVerification } = await import('@/lib/webhook-verification');
    const signature = request.headers.get('X-HeyGen-Signature') || request.headers.get('x-heygen-signature');

    if (shouldEnforceWebhookVerification()) {
      const verification = verifyHeyGenWebhook(brand, rawBody, signature);

      if (!verification.valid) {
        console.error(`❌ [${brandConfig.displayName}] Webhook signature verification failed: ${verification.error}`);
        return NextResponse.json({
          success: false,
          brand,
          error: 'Webhook verification failed',
        }, { status: 401 });
      }

      console.log(`✅ [${brandConfig.displayName}] Webhook signature verified`);
    }

    console.log(`   Payload:`, JSON.stringify(body, null, 2));

    // Extract HeyGen webhook data
    // Structure: { event_type: "avatar_video.success", event_data: { video_id, url, callback_id, ... } }
    const { event_type, event_data } = body;

    // Check idempotency - prevent duplicate processing
    const { isWebhookProcessed, markWebhookProcessed } = await import('@/lib/webhook-idempotency');
    const videoId = event_data?.video_id;

    if (videoId) {
      const idempotencyCheck = await isWebhookProcessed('heygen', videoId, brand, body);

      if (idempotencyCheck.processed) {
        console.log(`⚠️  [${brandConfig.displayName}] Webhook already processed, returning cached response`);
        return NextResponse.json(idempotencyCheck.previousResponse || {
          success: true,
          brand,
          message: 'Already processed',
        });
      }
    }

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

      // Trigger Submagic processing ASYNCHRONOUSLY to avoid webhook timeout
      // Don't await - let it run in background, failsafe cron will handle failures
      triggerSubmagicProcessing(
        brand,
        workflowId,
        event_data.url,
        workflow
      ).catch(err => {
        console.error(`❌ [${brandConfig.displayName}] Submagic trigger failed (will be retried by failsafe):`, err);
        // Don't throw - we've already marked workflow as heygen_processing
        // Failsafe cron will detect and retry
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️  [${brandConfig.displayName}] Webhook processed in ${duration}ms`);

      const response = {
        success: true,
        brand,
        event_type,
        workflow_id: workflowId,
        processing_time_ms: duration,
      };

      // Mark webhook as processed for idempotency
      if (videoId) {
        await markWebhookProcessed('heygen', videoId, brand, body, response);
      }

      return NextResponse.json(response);
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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro',
  workflowId: string
): Promise<any | null> {
  if (brand === 'podcast') {
    const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getPodcastWorkflowById(workflowId);
  } else if (brand === 'benefit') {
    const { getBenefitWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getBenefitWorkflowById(workflowId);
  } else if (brand === 'property') {
    const { db } = await import('@/lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const docSnap = await getDoc(doc(db, 'property_videos', workflowId));
    return docSnap.exists() ? docSnap.data() : null;
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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro',
  workflowId: string,
  updates: Record<string, any>
): Promise<void> {
  if (brand === 'podcast') {
    const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
    await updatePodcastWorkflow(workflowId, updates);
  } else if (brand === 'benefit') {
    const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
    await updateBenefitWorkflow(workflowId, updates);
  } else if (brand === 'property') {
    const { updatePropertyVideo } = await import('@/lib/feed-store-firestore');
    await updatePropertyVideo(workflowId, updates);
  } else {
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, updates);
  }
}

/**
 * Trigger Submagic processing with brand-specific webhook
 */
async function triggerSubmagicProcessing(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit',
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
    // ⚡ FAST PATH: Send HeyGen URL directly to Submagic (no R2 upload yet)
    // R2 upload will happen AFTER Submagic completes (in Submagic webhook)
    console.log(`✨ [${brandConfig.displayName}] Sending HeyGen video to Submagic...`);

    // Save HeyGen URL to workflow for reference
    await updateWorkflowForBrand(brand, workflowId, {
      heygenVideoUrl: heygenVideoUrl
    });

    // Use brand-specific webhook URL from config
    const submagicWebhookUrl = brandConfig.webhooks.submagic;

    // Prepare title (max 50 characters for Submagic)
    let title = workflow.articleTitle || workflow.episodeTitle || workflow.benefitTitle || `${brandConfig.displayName} Video - ${workflowId}`;

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

    // Send HeyGen URL directly to Submagic (no R2 upload - faster!)
    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        language: 'en',
        videoUrl: heygenVideoUrl, // ⚡ Send HeyGen URL directly (not R2 URL)
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
    console.log(`📦 [${brandConfig.displayName}] Submagic API response:`, JSON.stringify(data, null, 2));

    // Extract project ID with multiple fallback options
    const projectId = data?.id || data?.project_id || data?.projectId || data?.data?.id;

    // Validate that we received a project ID
    if (!projectId || projectId === '' || projectId === null || projectId === undefined) {
      console.error(`❌ [${brandConfig.displayName}] Submagic response missing project ID!`);
      console.error(`   Response status: ${response.status}`);
      console.error(`   Response headers:`, Object.fromEntries(response.headers.entries()));
      console.error(`   Full response:`, JSON.stringify(data, null, 2));
      console.error(`   Extracted values - id: ${data?.id}, project_id: ${data?.project_id}, projectId: ${data?.projectId}`);

      // Save the error but keep the HeyGen video
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'failed',
        error: `Submagic API call failed - no project ID received. Status: ${response.status}. Response keys: ${Object.keys(data || {}).join(', ')}`
      });

      throw new Error(`Submagic API call failed - no project ID received. Response: ${JSON.stringify(data)}`);
    }

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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit',
  workflowId: string,
  workflow: any,
  reason: string
): Promise<void> {
  try {
    if (brand !== 'podcast' && brand !== 'benefit') {
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
