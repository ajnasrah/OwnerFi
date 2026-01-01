/**
 * Brand-Specific HeyGen Webhook Handler
 *
 * This webhook receives notifications from HeyGen when video generation completes.
 * Each brand has its own isolated webhook endpoint to prevent failures from affecting other brands.
 *
 * Route: /api/webhooks/heygen/[brand]
 * Brands: carz, ownerfi, benefit, abdullah, personal, gaza
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBrand, createBrandError } from '@/lib/brand-utils';
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
  params: Promise<{
    brand: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  let workflowId: string | undefined;
  let rawBody: string | undefined;

  try {
    // Validate brand from URL path
    const { brand: brandParam } = await context.params;
    const brand = validateBrand(brandParam);
    const brandConfig = getBrandConfig(brand);

    console.log('\n' + '='.repeat(70));
    console.log(`🔔 [${brandConfig.displayName}] HeyGen webhook received at ${new Date().toISOString()}`);
    console.log('='.repeat(70));

    // Get raw body for signature verification
    rawBody = await request.text();
    const body = JSON.parse(rawBody);

    console.log(`📦 [${brandConfig.displayName}] Raw payload received (${rawBody.length} bytes)`);
    console.log(`📋 [${brandConfig.displayName}] Parsed payload:`, JSON.stringify(body, null, 2));

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

    // Check idempotency - prevent duplicate processing (CRITICAL for cost)
    const { isWebhookProcessed, markWebhookProcessed } = await import('@/lib/webhook-idempotency');
    const videoId = event_data?.video_id;

    // CRITICAL: Require video_id for idempotency - without it, retries will duplicate processing
    if (!videoId) {
      console.error(`❌ [${brandConfig.displayName}] CRITICAL: Missing video_id in webhook - cannot ensure idempotency`);
      return NextResponse.json({
        success: false,
        brand,
        message: 'Missing video_id - required for idempotency',
      }, { status: 400 });
    }

    const idempotencyCheck = await isWebhookProcessed('heygen', videoId, brand, body);

    if (idempotencyCheck.processed) {
      console.log(`⚠️  [${brandConfig.displayName}] Webhook already processed, returning cached response`);
      return NextResponse.json(idempotencyCheck.previousResponse || {
        success: true,
        brand,
        message: 'Already processed',
      });
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

    console.log(`🔍 [${brandConfig.displayName}] Looking for workflow: ${workflowId}`);
    console.log(`🔍 [${brandConfig.displayName}] Event type: ${event_type}`);
    console.log(`🔍 [${brandConfig.displayName}] Video ID: ${videoId}`);

    // Find workflow in brand-specific collection (NO sequential lookups!)
    const workflow = await getWorkflowForBrand(brand, workflowId);

    if (!workflow) {
      console.error(`❌ [${brandConfig.displayName}] CRITICAL: No workflow found for callback_id: ${workflowId}`);
      console.error(`❌ [${brandConfig.displayName}] Brand: ${brand}, Collection: ${brand}_workflow_queue`);
      return NextResponse.json({
        success: false,
        brand,
        workflow_id: workflowId,
        message: 'No pending workflow found for this callback_id',
      }, { status: 404 });
    }

    // DUPLICATE CHECK: Skip if workflow already past heygen_processing stage
    const alreadyProcessedStatuses = ['submagic_processing', 'video_processing', 'posting', 'completed'];
    if (alreadyProcessedStatuses.includes(workflow.status)) {
      console.warn(`⚠️  [${brandConfig.displayName}] Workflow ${workflowId} already in ${workflow.status} - skipping HeyGen webhook`);
      return NextResponse.json({
        success: true,
        brand,
        workflow_id: workflowId,
        message: `Workflow already in ${workflow.status} status - duplicate webhook ignored`,
        status: workflow.status,
      });
    }

    // Handle video generation success
    if (event_type === 'avatar_video.success' && event_data.url) {
      console.log(`✅ [${brandConfig.displayName}] HeyGen video completed!`);
      console.log(`   Video URL: ${event_data.url}`);
      console.log(`   Workflow ID: ${workflowId}`);

      // CRITICAL FIX: Save HeyGen video URL IMMEDIATELY before doing anything else
      // This ensures we can recover even if Submagic trigger fails
      console.log(`💾 [${brandConfig.displayName}] STEP 1: Saving HeyGen video URL to database...`);
      console.log(`   Workflow ID: ${workflowId}`);
      console.log(`   Video URL: ${event_data.url}`);
      console.log(`   Current workflow status: ${workflow?.status}`);

      try {
        await updateWorkflowForBrand(brand, workflowId, {
          heygenVideoUrl: event_data.url,
          heygenCompletedAt: Date.now()
        });
        console.log(`✅ [${brandConfig.displayName}] HeyGen video URL saved successfully`);
      } catch (saveError) {
        console.error(`❌ [${brandConfig.displayName}] CRITICAL: Failed to save HeyGen URL:`, saveError);
        console.error(`   Error details:`, saveError instanceof Error ? saveError.stack : saveError);
        // Don't fail the webhook - try to continue anyway
      }

      // Use the HeyGen video URL directly for Submagic processing
      const finalVideoUrl = event_data.url;

      // STEP 2: Trigger Submagic processing with timeout protection
      // Wait up to 25 seconds for Submagic API call to complete
      // This ensures we catch immediate failures but don't timeout the webhook
      console.log(`🚀 [${brandConfig.displayName}] STEP 2: Triggering Submagic processing...`);

      try {
        await Promise.race([
          triggerSubmagicProcessing(
            brand,
            workflowId,
            finalVideoUrl,  // Use video with hook if available
            workflow
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Submagic trigger timeout after 25s')), 25000)
          )
        ]);

        console.log(`✅ [${brandConfig.displayName}] Submagic processing triggered successfully`);
      } catch (err) {
        console.error(`❌ [${brandConfig.displayName}] Submagic trigger failed:`, err);

        // CRITICAL: Mark workflow as failed so it doesn't stay stuck forever
        // NOTE: heygenVideoUrl was already saved above, so recovery is possible via scripts
        console.log(`⚠️  [${brandConfig.displayName}] Submagic failed - marking workflow as failed`);

        try {
          await updateWorkflowForBrand(brand, workflowId, {
            status: 'failed',
            error: `Submagic trigger failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            failedAt: Date.now()
          });
          console.log(`✅ [${brandConfig.displayName}] Marked workflow ${workflowId} as failed due to Submagic error (recoverable - HeyGen URL saved)`);
        } catch (updateErr) {
          console.error(`❌ [${brandConfig.displayName}] CRITICAL: Failed to update workflow status to failed:`, updateErr);
          console.error(`   Error details:`, updateErr instanceof Error ? updateErr.stack : updateErr);
        }

        // Return error response
        return NextResponse.json({
          success: false,
          brand,
          workflow_id: workflowId,
          error: err instanceof Error ? err.message : 'Submagic trigger failed',
        }, { status: 500 });
      }

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
    const params = await context.params;
    await logToDeadLetterQueue('heygen', params.brand, request, error);

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
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  workflowId: string
): Promise<any | null> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  // All brands use standard ${brand}_workflow_queue pattern
  const collectionName = `${brand}_workflow_queue`;
  const docSnap = await adminDb.collection(collectionName).doc(workflowId).get();
  return docSnap.exists ? docSnap.data() : null;
}

/**
 * Update workflow for specific brand
 * CRITICAL: Also updates dedup document when status changes to prevent duplicate processing
 */
async function updateWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  workflowId: string,
  updates: Record<string, any>
): Promise<void> {
  // Filter out undefined values - Firestore doesn't accept undefined
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const collectionName = `${brand}_workflow_queue`;

  // Get the workflow first to extract articleId for dedup doc update
  const workflowDoc = await adminDb.collection(collectionName).doc(workflowId).get();
  const workflowData = workflowDoc.data();

  await adminDb.collection(collectionName).doc(workflowId).update({
    ...cleanUpdates,
    updatedAt: Date.now()
  });

  // CRITICAL: If status is being updated, also update the dedup document
  // This ensures the dedup check reflects current workflow state
  if (updates.status && workflowData?.articleId && workflowData?.createdAt) {
    try {
      const createdDate = new Date(workflowData.createdAt).toISOString().split('T')[0];
      const dedupKey = `dedup_${workflowData.articleId}_${createdDate}`;
      const dedupRef = adminDb.collection(collectionName).doc(dedupKey);

      // Check if dedup doc exists before updating
      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) {
        await dedupRef.update({
          status: updates.status,
          updatedAt: Date.now()
        });
        console.log(`   ✅ Updated dedup doc ${dedupKey} with status: ${updates.status}`);
      }
    } catch (dedupError) {
      // Log but don't fail - dedup update is best-effort
      console.warn(`   ⚠️  Failed to update dedup doc:`, dedupError);
    }
  }
}

/**
 * Trigger Submagic processing with brand-specific webhook
 */
async function triggerSubmagicProcessing(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
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

    // Validate HeyGen video URL before sending to Submagic
    if (!heygenVideoUrl || typeof heygenVideoUrl !== 'string' || heygenVideoUrl.trim().length === 0) {
      throw new Error(`Invalid HeyGen video URL: ${heygenVideoUrl}`);
    }

    // Check if URL is accessible
    try {
      console.log(`🔍 [${brandConfig.displayName}] Validating HeyGen video URL...`);
      const headResponse = await fetch(heygenVideoUrl, { method: 'HEAD' });
      if (!headResponse.ok) {
        console.warn(`⚠️  [${brandConfig.displayName}] HeyGen video URL returned ${headResponse.status}`);
      } else {
        const contentType = headResponse.headers.get('content-type');
        const contentLength = headResponse.headers.get('content-length');
        console.log(`✅ [${brandConfig.displayName}] Video URL valid - Type: ${contentType}, Size: ${contentLength} bytes`);
      }
    } catch (urlCheckError) {
      console.warn(`⚠️  [${brandConfig.displayName}] Could not validate video URL:`, urlCheckError);
      // Don't fail the workflow - URL might be temporarily unavailable
    }

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
    // Full Submagic optimization with brand-specific features
    const submagicConfig: any = {
      title,
      language: 'en', // English for all brands
      videoUrl: heygenVideoUrl, // Send HeyGen URL directly (not R2 URL)
      webhookUrl: submagicWebhookUrl, // Brand-specific webhook
      templateName: 'Hormozi 2', // Professional captions style
      magicZooms: true, // Auto zoom on important moments
      magicBrolls: true, // B-rolls enabled
      magicBrollsPercentage: 75, // 75% B-roll coverage
      removeSilencePace: 'fast', // Fast pace for viral content
      removeBadTakes: true, // Remove bad takes
    };

    // Budget check before Submagic API call
    try {
      const { canAfford } = await import('@/lib/cost-tracker');
      const budgetCheck = await canAfford('submagic', 1);

      if (!budgetCheck.allowed) {
        console.error(`🚫 [${brandConfig.displayName}] Submagic budget exceeded: ${budgetCheck.reason}`);

        await updateWorkflowForBrand(brand, workflowId, {
          status: 'budget_exceeded',
          error: budgetCheck.reason,
          heygenVideoUrl: heygenVideoUrl, // Save HeyGen URL for retry when budget resets
        });

        // Don't throw - just skip Submagic. The workflow can be retried when budget resets.
        return;
      }

      if (budgetCheck.status.nearLimit) {
        console.warn(`⚠️  [${brandConfig.displayName}] Submagic budget at ${budgetCheck.status.percentage.toFixed(1)}%`);
      }
    } catch (budgetError) {
      console.warn(`⚠️  [${brandConfig.displayName}] Budget check failed, proceeding anyway:`, budgetError);
      // Don't block if budget check fails - cost tracking is non-critical
    }

    console.log(`📤 [${brandConfig.displayName}] Sending Submagic request:`);
    console.log(`   Video URL: ${heygenVideoUrl}`);
    console.log(`   Webhook URL: ${submagicWebhookUrl}`);
    console.log(`   Title: ${title}`);
    console.log(`   Config:`, JSON.stringify(submagicConfig, null, 2));

    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submagicConfig)
    });

    console.log(`📡 [${brandConfig.displayName}] Submagic API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${brandConfig.displayName}] Submagic API error response:`, errorText);
      throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📦 [${brandConfig.displayName}] Submagic API raw response:`, responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`📦 [${brandConfig.displayName}] Submagic API parsed response:`, JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error(`❌ [${brandConfig.displayName}] Failed to parse Submagic response as JSON:`, parseError);
      throw new Error(`Submagic returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    // Extract project ID with multiple fallback options
    const projectId = data?.id || data?.project_id || data?.projectId || data?.data?.id;

    // Validate that we received a valid project ID (string with length > 0)
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
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
    console.log(`   ⏳ Waiting for Submagic to process captions...`);
    console.log(`   📞 Webhook will be called when project completes: ${submagicWebhookUrl}`);

    // Track Submagic cost
    try {
      const { trackCost, calculateSubmagicCost } = await import('@/lib/cost-tracker');
      await trackCost(
        brand,
        'submagic',
        'caption_generation',
        1, // 1 credit per video
        calculateSubmagicCost(1), // $0.25
        workflowId
      );
      console.log(`💰 [${brandConfig.displayName}] Tracked Submagic cost: $0.25`);
    } catch (costError) {
      console.error(`⚠️  [${brandConfig.displayName}] Failed to track Submagic cost:`, costError);
      // Don't fail the workflow if cost tracking fails
    }

    // Update workflow with Submagic ID and status
    await updateWorkflowForBrand(brand, workflowId, {
      status: 'submagic_processing',
      submagicVideoId: projectId,
      submagicProjectId: projectId,
    });

    // NOTE: We do NOT call /export here!
    // The webhook URL provided during project creation will be called when captions are done.
    // The Submagic webhook handler will then call /export to generate the final video.

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
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  workflowId: string,
  workflow: any,
  reason: string
): Promise<void> {
  try {
    // Skip alerts for benefit, personal, and gaza (they have their own alerting)
    if (brand !== 'benefit' && brand !== 'gaza' && brand !== 'personal') {
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
