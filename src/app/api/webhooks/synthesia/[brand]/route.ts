/**
 * Brand-Specific Synthesia Webhook Handler
 *
 * Receives notifications from Synthesia when video generation completes.
 * Mirrors the HeyGen webhook handler pattern.
 *
 * Route: /api/webhooks/synthesia/[brand]
 *
 * Synthesia webhook payload:
 * {
 *   "type": "video.completed",
 *   "data": {
 *     "id": "video-uuid",
 *     "status": "complete",
 *     "download": "https://presigned-url.mp4",
 *     "callbackId": "brand:workflow-id",
 *     "duration": "0:00:17.000000"
 *   }
 * }
 *
 * NOTE: Synthesia webhooks are registered GLOBALLY (one URL for all videos).
 * The brand is encoded in the callbackId as "brand:workflowId" so we can
 * route to the correct Firestore collection regardless of the URL brand param.
 *
 * IMPORTANT: Synthesia download URLs are presigned and time-limited.
 * We must download to R2 immediately upon receiving the webhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBrand, createBrandError } from '@/lib/brand-utils';
import { getBrandConfig } from '@/config/brand-configs';

// Handle OPTIONS for webhook validation
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  try {
    // Parse payload first to extract brand from callbackId
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Extract Synthesia webhook data
    const webhookType = body.type;
    const eventData = body.data;

    if (!eventData) {
      console.error('Synthesia webhook missing data in payload');
      return NextResponse.json({
        success: false,
        error: 'Missing data in webhook payload',
      }, { status: 400 });
    }

    // Parse brand from callbackId (format: "brand:workflowId")
    // Synthesia webhooks are global — the actual brand is encoded in callbackId
    const rawCallbackId = eventData.callbackId as string | undefined;
    const { brand: brandParam } = await context.params;
    let brand: ReturnType<typeof validateBrand>;

    if (rawCallbackId && rawCallbackId.includes(':')) {
      const [encodedBrand, ...rest] = rawCallbackId.split(':');
      brand = validateBrand(encodedBrand);
      workflowId = rest.join(':'); // Rejoin in case workflowId itself contained colons
    } else {
      // Fallback: use URL brand param (for backwards compatibility or direct registration)
      brand = validateBrand(brandParam);
      workflowId = rawCallbackId;
    }

    const brandConfig = getBrandConfig(brand);

    console.log('\n' + '='.repeat(70));
    console.log(`[${brandConfig.displayName}] Synthesia webhook received at ${new Date().toISOString()}`);
    console.log('='.repeat(70));
    console.log(`[${brandConfig.displayName}] Payload (${rawBody.length} bytes):`, JSON.stringify(body, null, 2));

    const videoId = eventData.id;

    // Check idempotency
    const { isWebhookProcessed, markWebhookProcessed } = await import('@/lib/webhook-idempotency');

    if (!videoId) {
      console.error(`[${brandConfig.displayName}] Missing video id in webhook`);
      return NextResponse.json({
        success: false,
        brand,
        error: 'Missing video id - required for idempotency',
      }, { status: 400 });
    }

    const idempotencyCheck = await isWebhookProcessed('synthesia', videoId, brand, body);
    if (idempotencyCheck.processed) {
      console.log(`[${brandConfig.displayName}] Webhook already processed, returning cached response`);
      return NextResponse.json(idempotencyCheck.previousResponse || {
        success: true,
        brand,
        message: 'Already processed',
      });
    }

    if (!workflowId) {
      console.warn(`[${brandConfig.displayName}] Missing callbackId in webhook`);
      return NextResponse.json({
        success: false,
        brand,
        error: 'Missing callbackId in event data',
      }, { status: 400 });
    }

    console.log(`[${brandConfig.displayName}] Looking for workflow: ${workflowId}`);
    console.log(`[${brandConfig.displayName}] Webhook type: ${webhookType}`);
    console.log(`[${brandConfig.displayName}] Video ID: ${videoId}`);

    // Find workflow
    const workflow = await getWorkflowForBrand(brand, workflowId);

    if (!workflow) {
      console.error(`[${brandConfig.displayName}] No workflow found for callbackId: ${workflowId}`);
      return NextResponse.json({
        success: false,
        brand,
        workflow_id: workflowId,
        error: 'No pending workflow found for this callbackId',
      }, { status: 404 });
    }

    // Skip if workflow already past this stage
    const alreadyProcessedStatuses = ['submagic_processing', 'video_processing', 'posting', 'completed'];
    if (alreadyProcessedStatuses.includes(workflow.status)) {
      console.warn(`[${brandConfig.displayName}] Workflow ${workflowId} already in ${workflow.status} - skipping`);
      return NextResponse.json({
        success: true,
        brand,
        workflow_id: workflowId,
        message: `Workflow already in ${workflow.status} - duplicate ignored`,
      });
    }

    // Handle video completion
    if (webhookType === 'video.completed' && eventData.download) {
      console.log(`[${brandConfig.displayName}] Synthesia video completed!`);
      console.log(`   Download URL: ${eventData.download.substring(0, 80)}...`);
      console.log(`   Duration: ${eventData.duration}`);

      // STEP 1: Download presigned URL to R2 immediately (URLs expire!)
      console.log(`[${brandConfig.displayName}] STEP 1: Downloading video to R2 (presigned URL is time-limited)...`);

      let r2VideoUrl: string;
      try {
        const { downloadAndUploadToR2 } = await import('@/lib/video-storage');
        r2VideoUrl = await downloadAndUploadToR2(
          eventData.download,
          '', // No auth header needed for presigned URLs
          `synthesia-videos/${videoId}.mp4`
        );
        console.log(`[${brandConfig.displayName}] Video uploaded to R2: ${r2VideoUrl}`);
      } catch (r2Error) {
        console.error(`[${brandConfig.displayName}] R2 upload failed:`, r2Error);

        await updateWorkflowForBrand(brand, workflowId, {
          status: 'failed',
          error: `R2 upload failed: ${r2Error instanceof Error ? r2Error.message : 'Unknown error'}`,
          synthesiaVideoUrl: eventData.download, // Save presigned URL for manual recovery
          failedAt: Date.now(),
          statusChangedAt: Date.now(),
        });

        return NextResponse.json({
          success: false,
          brand,
          workflow_id: workflowId,
          error: 'Failed to upload video to R2',
        }, { status: 500 });
      }

      // Save R2 URL to workflow
      await updateWorkflowForBrand(brand, workflowId, {
        synthesiaVideoUrl: r2VideoUrl,
        synthesiaCompletedAt: Date.now(),
        statusChangedAt: Date.now(),
      });

      // STEP 2: Trigger Submagic processing with R2 URL
      console.log(`[${brandConfig.displayName}] STEP 2: Triggering Submagic processing...`);

      try {
        await Promise.race([
          triggerSubmagicProcessing(brand, workflowId, r2VideoUrl, workflow),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Submagic trigger timeout after 25s')), 25000)
          ),
        ]);

        console.log(`[${brandConfig.displayName}] Submagic processing triggered successfully`);
      } catch (submagicErr) {
        console.error(`[${brandConfig.displayName}] Submagic trigger failed:`, submagicErr);

        await updateWorkflowForBrand(brand, workflowId, {
          status: 'failed',
          error: `Submagic trigger failed: ${submagicErr instanceof Error ? submagicErr.message : 'Unknown error'}`,
          failedAt: Date.now(),
          statusChangedAt: Date.now(),
        });

        return NextResponse.json({
          success: false,
          brand,
          workflow_id: workflowId,
          error: submagicErr instanceof Error ? submagicErr.message : 'Submagic trigger failed',
        }, { status: 500 });
      }

      const duration = Date.now() - startTime;
      console.log(`[${brandConfig.displayName}] Webhook processed in ${duration}ms`);

      const response = {
        success: true,
        brand,
        type: webhookType,
        workflow_id: workflowId,
        processing_time_ms: duration,
      };

      await markWebhookProcessed('synthesia', videoId, brand, body, response);
      return NextResponse.json(response);
    }

    // Handle video failure
    if (webhookType === 'video.failed' || eventData.status === 'failed') {
      console.error(`[${brandConfig.displayName}] Synthesia video generation failed`);

      await updateWorkflowForBrand(brand, workflowId, {
        status: 'failed',
        error: 'Synthesia generation failed',
        failedAt: Date.now(),
        statusChangedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        brand,
        type: webhookType,
        workflow_id: workflowId,
        message: 'Failure recorded',
      });
    }

    // Unknown event type
    console.warn(`[${brandConfig.displayName}] Unknown webhook type: ${webhookType}`);
    return NextResponse.json({
      success: false,
      brand,
      type: webhookType,
      workflow_id: workflowId,
      error: `Unknown webhook type: ${webhookType}`,
    }, { status: 400 });

  } catch (error) {
    console.error('Error processing Synthesia webhook:', error);

    const params = await context.params;
    await logToDeadLetterQueue('synthesia', params.brand, request, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      workflow_id: workflowId,
    }, { status: 500 });
  }
}

/**
 * Get workflow for specific brand
 */
async function getWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza' | 'realtors',
  workflowId: string
): Promise<any | null> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const collectionName = `${brand}_workflow_queue`;
  const docSnap = await adminDb.collection(collectionName).doc(workflowId).get();
  return docSnap.exists ? docSnap.data() : null;
}

/**
 * Update workflow for specific brand
 */
async function updateWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza' | 'realtors',
  workflowId: string,
  updates: Record<string, any>
): Promise<void> {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  const collectionName = `${brand}_workflow_queue`;

  const workflowDoc = await adminDb.collection(collectionName).doc(workflowId).get();
  const workflowData = workflowDoc.data();

  await adminDb.collection(collectionName).doc(workflowId).update({
    ...cleanUpdates,
    updatedAt: Date.now(),
  });

  // Update dedup document if status changed
  if (updates.status && workflowData?.articleId && workflowData?.createdAt) {
    try {
      const createdDate = new Date(workflowData.createdAt).toISOString().split('T')[0];
      const dedupKey = `dedup_${workflowData.articleId}_${createdDate}`;
      const dedupRef = adminDb.collection(collectionName).doc(dedupKey);

      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) {
        await dedupRef.update({
          status: updates.status,
          updatedAt: Date.now(),
        });
      }
    } catch (dedupError) {
      console.warn('Failed to update dedup doc:', dedupError);
    }
  }
}

/**
 * Trigger Submagic processing with brand-specific webhook
 */
async function triggerSubmagicProcessing(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza' | 'realtors',
  workflowId: string,
  videoUrl: string,
  workflow: any
): Promise<void> {
  const brandConfig = getBrandConfig(brand);
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  if (!SUBMAGIC_API_KEY) {
    throw createBrandError(brand, 'Submagic API key not configured');
  }

  // Budget check
  try {
    const { canAfford } = await import('@/lib/cost-tracker');
    const budgetCheck = await canAfford('submagic', 1);

    if (!budgetCheck.allowed) {
      console.error(`[${brandConfig.displayName}] Submagic budget exceeded: ${budgetCheck.reason}`);
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'budget_exceeded',
        error: budgetCheck.reason,
        synthesiaVideoUrl: videoUrl,
      });
      return;
    }
  } catch (budgetError) {
    console.warn(`[${brandConfig.displayName}] Budget check failed, proceeding:`, budgetError);
  }

  // Prepare title
  let title = workflow.articleTitle || workflow.episodeTitle || `${brandConfig.displayName} Video - ${workflowId}`;
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
    title = title.substring(0, 47) + '...';
  }

  const submagicWebhookUrl = brandConfig.webhooks.submagic;

  const submagicConfig = {
    title,
    language: 'en',
    videoUrl,
    webhookUrl: submagicWebhookUrl,
    templateName: 'Hormozi 2',
    magicZooms: true,
    magicBrolls: true,
    magicBrollsPercentage: 75,
    removeSilencePace: 'fast',
    removeBadTakes: true,
  };

  console.log(`[${brandConfig.displayName}] Sending Submagic request:`);
  console.log(`   Video URL: ${videoUrl}`);
  console.log(`   Webhook URL: ${submagicWebhookUrl}`);

  const submagicController = new AbortController();
  const submagicTimeout = setTimeout(() => submagicController.abort(), 30_000); // 30s timeout

  const response = await fetch('https://api.submagic.co/v1/projects', {
    method: 'POST',
    headers: {
      'x-api-key': SUBMAGIC_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submagicConfig),
    signal: submagicController.signal,
  });

  clearTimeout(submagicTimeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const projectId = data?.id || data?.project_id || data?.projectId || data?.data?.id;

  if (!projectId || typeof projectId !== 'string') {
    throw new Error(`Submagic returned no project ID. Response: ${JSON.stringify(data)}`);
  }

  console.log(`[${brandConfig.displayName}] Submagic project created: ${projectId}`);

  // Track Submagic cost
  try {
    const { trackCost, calculateSubmagicCost } = await import('@/lib/cost-tracker');
    await trackCost(brand, 'submagic', 'caption_generation', 1, calculateSubmagicCost(1), workflowId);
  } catch (costError) {
    console.error(`[${brandConfig.displayName}] Failed to track Submagic cost:`, costError);
  }

  // Update workflow
  await updateWorkflowForBrand(brand, workflowId, {
    status: 'submagic_processing',
    submagicVideoId: projectId,
    submagicProjectId: projectId,
    statusChangedAt: Date.now(),
  });
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
  }
}
