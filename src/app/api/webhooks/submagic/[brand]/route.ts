/**
 * Brand-Specific Submagic Webhook Handler
 *
 * This webhook receives notifications from Submagic when video enhancement completes.
 * Each brand has its own isolated webhook endpoint to prevent failures from affecting other brands.
 *
 * Route: /api/webhooks/submagic/[brand]
 * Brands: carz, ownerfi, benefit, abdullah, personal, gaza
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { postToLate } from '@/lib/late-api';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import {
  validateBrand,
  getBrandPlatforms,
  getBrandStoragePath,
} from '@/lib/brand-utils';
import { getBrandConfig } from '@/config/brand-configs';

// Webhook secret for signature validation
const SUBMAGIC_WEBHOOK_SECRET = process.env.SUBMAGIC_WEBHOOK_SECRET;

/**
 * Verify Submagic webhook signature
 * Supports multiple signature formats for compatibility
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!SUBMAGIC_WEBHOOK_SECRET) {
    // In development, warn but allow (for local testing)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [SECURITY] SUBMAGIC_WEBHOOK_SECRET not set - skipping validation in dev');
      return true;
    }
    // In production, require the secret
    console.error('❌ [SECURITY] SUBMAGIC_WEBHOOK_SECRET not configured');
    return false;
  }

  if (!signature) {
    console.warn('⚠️ [SECURITY] No signature provided in webhook request');
    return false;
  }

  // Try different signature formats that Submagic might use
  // Format 1: raw HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', SUBMAGIC_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Direct comparison (timing-safe)
  try {
    const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length === expectedBuffer.length) {
      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    }
  } catch {
    // If buffer conversion fails, fall back to string comparison for simple secret match
  }

  // Format 2: Simple shared secret (some services just pass the secret)
  if (signature === SUBMAGIC_WEBHOOK_SECRET) {
    return true;
  }

  return false;
}

interface RouteContext {
  params: Promise<{
    brand: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  let workflowId: string | undefined;
  let submagicProjectId: string | undefined;

  try {
    // SECURITY: Verify webhook signature first
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') ||
                      request.headers.get('x-submagic-signature') ||
                      request.headers.get('x-signature');

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ [SECURITY] Submagic webhook signature verification failed');
      return NextResponse.json(
        { error: 'Unauthorized - invalid signature' },
        { status: 401 }
      );
    }

    // Parse the body we already read
    const body = JSON.parse(rawBody);

    // Validate brand from URL path
    const { brand: brandParam } = await context.params;
    const brand = validateBrand(brandParam);
    const brandConfig = getBrandConfig(brand);

    console.log(`🔔 [${brandConfig.displayName}] Submagic webhook received (signature verified)`);
    console.log(`   Payload:`, JSON.stringify(body, null, 2));

    // Extract Submagic webhook data
    // Payload: { projectId: "uuid", status: "completed", downloadUrl: "url", directUrl: "url", ... }
    // OR: { id: "uuid", status: "completed", media_url: "url", ... }
    submagicProjectId = body.projectId || body.id;
    const status = body.status;
    const downloadUrl = body.downloadUrl || body.directUrl || body.media_url || body.mediaUrl || body.video_url || body.videoUrl || body.download_url;

    if (!submagicProjectId) {
      console.warn(`⚠️ [${brandConfig.displayName}] Missing projectId in webhook`);
      return NextResponse.json({
        success: false,
        brand,
        message: 'Missing projectId in webhook payload',
      }, { status: 400 });
    }

    // IDEMPOTENCY CHECK - Prevent duplicate processing (CRITICAL for cost/duplicate posts)
    const { isWebhookProcessed, markWebhookProcessed } = await import('@/lib/webhook-idempotency');

    if (!submagicProjectId) {
      console.error(`❌ [${brandConfig.displayName}] CRITICAL: Missing projectId - cannot ensure idempotency`);
      return NextResponse.json({
        success: false,
        brand,
        message: 'Missing projectId - required for idempotency',
      }, { status: 400 });
    }

    const idempotencyCheck = await isWebhookProcessed('submagic', submagicProjectId, brand, body);

    if (idempotencyCheck.processed) {
      console.log(`⚠️  [${brandConfig.displayName}] Submagic webhook already processed, returning cached response`);
      return NextResponse.json(idempotencyCheck.previousResponse || {
        success: true,
        brand,
        message: 'Already processed',
      });
    }

    // Find workflow in brand-specific collection (NO sequential lookups!)
    const workflowResult = await getWorkflowBySubmagicId(brand, submagicProjectId);

    if (!workflowResult) {
      console.warn(`⚠️ [${brandConfig.displayName}] No workflow found for Submagic project: ${submagicProjectId}`);
      return NextResponse.json({
        success: false,
        brand,
        projectId: submagicProjectId,
        message: 'No pending workflow found for this Submagic project',
      }, { status: 404 });
    }

    workflowId = workflowResult.workflowId;
    const workflow = workflowResult.workflow;

    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Status: ${status}`);

    // DUPLICATE CHECK: Skip if workflow already past submagic stage or completed
    const alreadyProcessedStatuses = ['posting', 'completed'];
    if (alreadyProcessedStatuses.includes(workflow.status)) {
      console.warn(`⚠️  [${brandConfig.displayName}] Workflow ${workflowId} already in ${workflow.status} - skipping Submagic webhook`);
      return NextResponse.json({
        success: true,
        brand,
        projectId: submagicProjectId,
        workflow_id: workflowId,
        message: `Workflow already in ${workflow.status} status - duplicate webhook ignored`,
        status: workflow.status,
      });
    }

    // Also check if we already have a latePostId (already posted)
    if (workflow.latePostId) {
      console.warn(`⚠️  [${brandConfig.displayName}] Workflow ${workflowId} already has latePostId - skipping Submagic webhook`);
      return NextResponse.json({
        success: true,
        brand,
        projectId: submagicProjectId,
        workflow_id: workflowId,
        message: 'Workflow already posted to Late - duplicate webhook ignored',
        latePostId: workflow.latePostId,
      });
    }

    // Handle completion
    if (status === 'completed' || status === 'done' || status === 'ready') {
      console.log(`✅ [${brandConfig.displayName}] Submagic project completed!`);

      // Check if this is the initial completion (captions done) or export completion (video ready)
      // If no download URL, this is the initial completion - we need to trigger export
      if (!downloadUrl) {
        console.log(`   📤 No download URL - triggering export to generate final video...`);

        // EXPORT IDEMPOTENCY CHECK - Prevent duplicate export triggers
        // If we've already triggered export for this project, skip
        if (workflow.exportTriggeredAt) {
          const timeSinceExport = Date.now() - workflow.exportTriggeredAt;
          const fiveMinutesMs = 5 * 60 * 1000;

          if (timeSinceExport < fiveMinutesMs) {
            console.log(`⚠️  [${brandConfig.displayName}] Export already triggered ${Math.round(timeSinceExport / 1000)}s ago - skipping duplicate`);
            return NextResponse.json({
              success: true,
              brand,
              projectId: submagicProjectId,
              workflow_id: workflowId,
              message: 'Export already triggered - waiting for completion',
            });
          }
          console.log(`   Previous export was ${Math.round(timeSinceExport / 1000)}s ago - allowing retry`);
        }

        // Call /export endpoint to generate the final video
        const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
        if (!SUBMAGIC_API_KEY) {
          throw new Error('Submagic API key not configured');
        }

        // Mark export as triggered BEFORE calling API (prevents race conditions)
        await updateWorkflowForBrand(brand, workflowId, {
          exportTriggeredAt: Date.now(),
          status: 'exporting',
        });

        // Retry logic for export trigger (max 3 attempts)
        let exportResponse;
        let exportError;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`   Attempt ${attempt}/${maxRetries} to trigger export...`);

            exportResponse = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}/export`, {
              method: 'POST',
              headers: {
                'x-api-key': SUBMAGIC_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                webhookUrl: brandConfig.webhooks.submagic // Webhook will be called again when export completes
              })
            });

            if (exportResponse.ok) {
              console.log(`✅ [${brandConfig.displayName}] Export triggered successfully on attempt ${attempt}`);
              break; // Success - exit retry loop
            }

            exportError = await exportResponse.text();
            console.warn(`⚠️  [${brandConfig.displayName}] Export trigger failed on attempt ${attempt}: ${exportError}`);

            // If this was the last attempt, throw error
            if (attempt === maxRetries) {
              throw new Error(`Export trigger failed after ${maxRetries} attempts: ${exportError}`);
            }

            // Wait before retrying (exponential backoff: 2s, 4s, 8s)
            const delayMs = Math.pow(2, attempt) * 1000;
            console.log(`   Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));

          } catch (err) {
            exportError = err instanceof Error ? err.message : 'Unknown error';
            console.error(`❌ [${brandConfig.displayName}] Export trigger error on attempt ${attempt}:`, exportError);

            // If this was the last attempt, update workflow as failed but keep it retryable
            if (attempt === maxRetries) {
              // Update workflow to indicate export failed (but keep submagic data for retry)
              await updateWorkflowForBrand(brand, workflowId, {
                status: 'export_failed',
                error: `Failed to trigger Submagic export after ${maxRetries} attempts: ${exportError}`,
                exportRetries: (workflow.exportRetries || 0) + 1,
                lastExportAttempt: Date.now(),
              });

              return NextResponse.json({
                success: false,
                brand,
                projectId: submagicProjectId,
                workflow_id: workflowId,
                message: `Export trigger failed after ${maxRetries} attempts - workflow can be retried`,
                error: exportError
              }, { status: 500 });
            }

            // Wait before retrying
            const delayMs = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }

        console.log(`✅ [${brandConfig.displayName}] Export triggered - webhook will fire when export completes`);

        // Return success - we'll receive another webhook when export is done
        return NextResponse.json({
          success: true,
          brand,
          projectId: submagicProjectId,
          workflow_id: workflowId,
          message: 'Export triggered - awaiting completion webhook',
        });
      }

      // If we have a download URL, the export is complete - proceed with video processing
      console.log(`✅ [${brandConfig.displayName}] Export completed - video ready!`);
      console.log(`   Video URL: ${downloadUrl}`);

      // ✅ SAVE VIDEO URL IMMEDIATELY - This is our backup!
      // Even if processing fails, we can retry later
      await updateWorkflowForBrand(brand, workflowId, {
        submagicDownloadUrl: downloadUrl,  // Save the original Submagic URL
        status: 'video_processing',        // New intermediate status
      });

      console.log(`💾 [${brandConfig.displayName}] Submagic URL saved, triggering async processing...`);

      // Trigger async video processing (non-blocking)
      // This calls a separate endpoint that has no timeout limits
      // Pass submagicProjectId so we can fetch a fresh URL when downloading
      await triggerAsyncVideoProcessing(brand, workflowId, downloadUrl, submagicProjectId);

      const duration = Date.now() - startTime;
      console.log(`⏱️  [${brandConfig.displayName}] Webhook acknowledged in ${duration}ms`);

      const response = {
        success: true,
        brand,
        projectId: submagicProjectId,
        workflow_id: workflowId,
        message: 'Video processing queued',
        processing_time_ms: duration,
      };

      // Mark webhook as processed for idempotency (prevents duplicate video processing)
      await markWebhookProcessed('submagic', submagicProjectId!, brand, body, response);

      return NextResponse.json(response);
    }

    // Handle failure
    if (status === 'failed' || status === 'error') {
      console.error(`❌ [${brandConfig.displayName}] Submagic processing failed`);

      await updateWorkflowForBrand(brand, workflowId, {
        status: 'failed',
        error: 'Submagic processing failed',
        failedAt: Date.now(),
      });

      await sendFailureAlert(brand, workflowId, workflow, 'Submagic processing failed');

      // For Gaza, log explicit alert
      if (brand === 'gaza') {
        try {
          const { alertSubmagicFailed } = await import('@/lib/gaza-alerting');
          await alertSubmagicFailed(workflowId, workflow?.articleTitle || 'Unknown', 'Submagic processing failed');
        } catch (alertError) {
          console.error('Failed to log Gaza alert:', alertError);
        }
      }

      return NextResponse.json({
        success: true,
        brand,
        projectId: submagicProjectId,
        workflow_id: workflowId,
        message: 'Failure recorded',
      });
    }

    // Intermediate status (processing, etc.)
    console.log(`⏳ [${brandConfig.displayName}] Submagic intermediate status: ${status}`);

    return NextResponse.json({
      success: true,
      brand,
      projectId: submagicProjectId,
      workflow_id: workflowId,
      status,
    });

  } catch (error) {
    console.error('❌ Error processing Submagic webhook:', error);

    // Log to DLQ for later analysis
    const params = await context.params;
    await logToDeadLetterQueue('submagic', params.brand, request, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      workflow_id: workflowId,
      projectId: submagicProjectId,
    }, { status: 500 });
  }
}

/**
 * Get workflow by Submagic project ID for specific brand
 */
async function getWorkflowBySubmagicId(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  submagicProjectId: string
): Promise<{ workflowId: string; workflow: any } | null> {
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const adminDb = await getAdminDb();

  // Brands use their respective collections
  let collectionName: string;
  if (brand === 'abdullah') {
    collectionName = 'abdullah_workflow_queue';
  } else if (brand === 'personal') {
    collectionName = 'personal_workflow_queue';
  } else if (brand === 'gaza') {
    collectionName = 'gaza_workflow_queue';
  } else {
    collectionName = `${brand}_workflow_queue`;
  }

  // Try BOTH field names to handle legacy workflows
  // First try submagicProjectId (standardized field)
  let snapshot = await adminDb
    .collection(collectionName)
    .where('submagicProjectId', '==', submagicProjectId)
    .limit(1)
    .get();

  // If not found, try legacy field name submagicVideoId
  if (snapshot.empty) {
    console.log(`   Trying legacy field submagicVideoId for brand ${brand}...`);
    snapshot = await adminDb
      .collection(collectionName)
      .where('submagicVideoId', '==', submagicProjectId)
      .limit(1)
      .get();
  }

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return {
      workflowId: doc.id,
      workflow: doc.data()
    };
  }

  return null;
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

  // Helper to update dedup doc for non-RSS brands
  const updateDedupDoc = async (collectionName: string, workflowData: any) => {
    if (updates.status && workflowData?.articleId && workflowData?.createdAt) {
      try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const adminDb = await getAdminDb();
        const createdDate = new Date(workflowData.createdAt).toISOString().split('T')[0];
        const dedupKey = `dedup_${workflowData.articleId}_${createdDate}`;
        const dedupRef = adminDb.collection(collectionName).doc(dedupKey);

        const dedupDoc = await dedupRef.get();
        if (dedupDoc.exists) {
          await dedupRef.update({
            status: updates.status,
            updatedAt: Date.now()
          });
          console.log(`   ✅ Updated dedup doc ${dedupKey} with status: ${updates.status}`);
        }
      } catch (dedupError) {
        console.warn(`   ⚠️  Failed to update dedup doc:`, dedupError);
      }
    }
  };

  if (brand === 'abdullah') {
    const { db } = await import('@/lib/firebase');
    const { doc, updateDoc, getDoc } = await import('firebase/firestore');
    const collectionName = 'abdullah_workflow_queue';

    // Get workflow data for dedup update
    const workflowDoc = await getDoc(doc(db, collectionName, workflowId));
    const workflowData = workflowDoc.data();

    await updateDoc(doc(db, collectionName, workflowId), {
      ...cleanUpdates,
      updatedAt: Date.now()
    });

    // Update dedup doc
    await updateDedupDoc(collectionName, workflowData);
  } else if (brand === 'personal') {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();
    const collectionName = 'personal_workflow_queue';

    // Get workflow data for dedup update
    const workflowDoc = await adminDb.collection(collectionName).doc(workflowId).get();
    const workflowData = workflowDoc.data();

    await adminDb.collection(collectionName).doc(workflowId).update({
      ...cleanUpdates,
      updatedAt: Date.now()
    });

    // Update dedup doc
    await updateDedupDoc(collectionName, workflowData);
  } else if (brand === 'gaza') {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();
    const collectionName = 'gaza_workflow_queue';

    // Get workflow data for dedup update
    const workflowDoc = await adminDb.collection(collectionName).doc(workflowId).get();
    const workflowData = workflowDoc.data();

    await adminDb.collection(collectionName).doc(workflowId).update({
      ...cleanUpdates,
      updatedAt: Date.now()
    });

    // Update dedup doc
    await updateDedupDoc(collectionName, workflowData);
  } else {
    // Uses updateWorkflowStatus which handles dedup docs
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, cleanUpdates);
  }
}

/**
 * Fetch video URL from Submagic API if not provided in webhook
 */
async function fetchVideoUrlFromSubmagic(submagicProjectId: string): Promise<string> {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  if (!SUBMAGIC_API_KEY) {
    throw new Error('Submagic API key not configured');
  }

  const response = await circuitBreakers.submagic.execute(async () => {
    return await fetchWithTimeout(
      `https://api.submagic.co/v1/projects/${submagicProjectId}`,
      {
        headers: { 'x-api-key': SUBMAGIC_API_KEY }
      },
      TIMEOUTS.SUBMAGIC_API
    );
  });

  if (!response.ok) {
    throw new Error(`Submagic API returned ${response.status}`);
  }

  const projectData = await response.json();
  const videoUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

  if (!videoUrl) {
    throw new Error('No video URL found in Submagic project data');
  }

  return videoUrl;
}

/**
 * Process video upload to R2 and post to Late
 */
async function processVideoAndPost(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  workflowId: string,
  workflow: any,
  videoUrl: string
): Promise<void> {
  const brandConfig = getBrandConfig(brand);

  try {
    console.log(`☁️  [${brandConfig.displayName}] Uploading video to R2...`);

    // Upload to R2 with brand-specific path
    const { uploadSubmagicVideo } = await import('@/lib/video-storage');
    const storagePath = getBrandStoragePath(brand, `submagic-videos/${workflowId}.mp4`);

    const publicVideoUrl = await uploadSubmagicVideo(videoUrl, storagePath);

    console.log(`✅ [${brandConfig.displayName}] Video uploaded to R2: ${publicVideoUrl}`);

    // ⚠️ CRITICAL: Change status to "posting" AND save video URL NOW
    await updateWorkflowForBrand(brand, workflowId, {
      status: 'posting',
      finalVideoUrl: publicVideoUrl,
    });

    console.log(`💾 [${brandConfig.displayName}] Status set to "posting" with video URL saved`);

    // Get brand-specific platforms from config
    const platforms = getBrandPlatforms(brand, false);

    // Prepare caption and title
    let caption: string;
    let title: string;

    if (brand === 'ownerfi') {
      caption = workflow.caption || workflow.articleTitle || 'Discover owner financing opportunities!';
      title = workflow.title || workflow.articleTitle || 'Owner Finance News';
    } else if (brand === 'carz') {
      caption = workflow.caption || workflow.articleTitle || 'Electric vehicle news and updates!';
      title = workflow.title || workflow.articleTitle || 'EV News';
    } else if (brand === 'benefit') {
      caption = workflow.caption || workflow.articleTitle || 'Maximize your benefits!';
      title = workflow.title || workflow.articleTitle || 'Benefits Update';
    } else if (brand === 'gaza') {
      caption = workflow.caption || workflow.articleTitle || 'Breaking news from Gaza. Help families in need.';
      title = workflow.title || workflow.articleTitle || 'Gaza News Update';
    } else {
      // abdullah, personal, etc.
      caption = workflow.caption || workflow.articleTitle || 'Check out this video!';
      title = workflow.title || workflow.articleTitle || 'Viral Video';
    }

    console.log(`📱 [${brandConfig.displayName}] Posting to GetLate's scheduling queue`);

    // Use GetLate's queue system
    const postResult = await postToLate({
      videoUrl: publicVideoUrl,
      caption,
      title,
      platforms: platforms as any[],
      brand: brand as any,
      useQueue: true,
      timezone: brandConfig.scheduling.timezone
    });

    if (postResult.success) {
      console.log(`✅ [${brandConfig.displayName}] Posted to GetLate queue successfully!`);
      console.log(`   Post ID: ${postResult.postId}`);
      console.log(`   Scheduled for: ${postResult.scheduledFor || 'Next available queue slot'}`);
      console.log(`   Platforms: ${postResult.platforms?.join(', ') || platforms.join(', ')}`);

      await updateWorkflowForBrand(brand, workflowId, {
        status: 'completed',
        latePostId: postResult.postId,
        completedAt: Date.now(),
        scheduledFor: postResult.scheduledFor,
        platformsUsed: postResult.platforms?.length || platforms.length,
      });
    } else {
      throw new Error(`GetLate posting failed: ${postResult.error}`);
    }

  } catch (error) {
    console.error(`❌ [${brandConfig.displayName}] Error in video processing or posting:`, error);

    await updateWorkflowForBrand(brand, workflowId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error in video processing',
      failedAt: Date.now(),
    });

    await sendFailureAlert(
      brand,
      workflowId,
      workflow,
      `Video processing or posting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    throw error;
  }
}

/**
 * Send failure alert for brand
 */
async function sendFailureAlert(
  brand: 'carz' | 'ownerfi' | 'benefit' | 'personal' | 'gaza' | 'abdullah',
  workflowId: string,
  workflow: any,
  reason: string
): Promise<void> {
  try {
    // Skip alerts for gaza and personal (they have their own alerting)
    if (brand !== 'gaza' && brand !== 'personal') {
      const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
      await alertWorkflowFailure(
        brand,
        workflowId,
        workflow.articleTitle || workflow.title || 'Unknown',
        reason
      );
    }
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

/**
 * Trigger async video processing using Cloud Tasks (or fallback to fetch)
 * This provides reliable async job execution with automatic retries
 */
async function triggerAsyncVideoProcessing(
  brand: string,
  workflowId: string,
  videoUrl: string,
  submagicProjectId?: string
): Promise<void> {
  try {
    console.log(`🚀 [${brand}] Creating Cloud Task for workflow ${workflowId}`);

    // Use Cloud Tasks for reliable async processing
    const { createVideoProcessingTask } = await import('@/lib/cloud-tasks');

    const payload = {
      brand,
      workflowId,
      videoUrl,
      submagicProjectId,
    };

    // Create task with 5-second delay to ensure webhook response completes first
    const result = await createVideoProcessingTask(payload, {
      delaySeconds: 5,
      queueName: 'video-processing',
    });

    console.log(`✅ [${brand}] Cloud Task created: ${result.taskName}`);
    console.log(`   Scheduled for: ${result.scheduleTime.toISOString()}`);
    console.log(`   Workflow will be processed asynchronously with automatic retries`);

  } catch (error) {
    console.error(`❌ [${brand}] Error creating Cloud Task:`, error);
    // Don't throw - webhook should still succeed even if task creation fails
    // The cron job will pick up stuck workflows as a failsafe
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
