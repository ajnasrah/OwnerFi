/**
 * Brand-Specific Submagic Webhook Handler
 *
 * This webhook receives notifications from Submagic when video enhancement completes.
 * Each brand has its own isolated webhook endpoint to prevent failures from affecting other brands.
 *
 * Route: /api/webhooks/submagic/[brand]
 * Brands: carz, ownerfi, podcast, vassdistro, benefit, property, abdullah
 */

import { NextRequest, NextResponse } from 'next/server';
import { postToLate } from '@/lib/late-api';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import {
  validateBrand,
  buildErrorContext,
  createBrandError,
  getBrandPlatforms,
  getBrandStoragePath,
} from '@/lib/brand-utils';
import { getBrandConfig } from '@/config/brand-configs';
import { postToMultiplePlatformGroups, getScheduleDescription } from '@/lib/platform-scheduling';

interface RouteContext {
  params: {
    brand: string;
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  let workflowId: string | undefined;
  let submagicProjectId: string | undefined;

  try {
    // Validate brand from URL path
    const brand = validateBrand(context.params.brand);
    const brandConfig = getBrandConfig(brand);

    console.log(`🔔 [${brandConfig.displayName}] Submagic webhook received`);

    // Parse request body
    const body = await request.json();
    console.log(`   Payload:`, JSON.stringify(body, null, 2));

    // Extract Submagic webhook data
    // Payload: { projectId: "uuid", status: "completed", downloadUrl: "url", directUrl: "url", ... }
    // OR: { id: "uuid", status: "completed", media_url: "url", ... }
    submagicProjectId = body.projectId || body.id;
    const status = body.status;
    let downloadUrl = body.downloadUrl || body.directUrl || body.media_url || body.mediaUrl || body.video_url || body.videoUrl || body.download_url;

    if (!submagicProjectId) {
      console.warn(`⚠️ [${brandConfig.displayName}] Missing projectId in webhook`);
      return NextResponse.json({
        success: false,
        brand,
        message: 'Missing projectId in webhook payload',
      }, { status: 400 });
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

    // Handle completion
    if (status === 'completed' || status === 'done' || status === 'ready') {
      console.log(`✅ [${brandConfig.displayName}] Submagic project completed!`);

      // Check if this is the initial completion (captions done) or export completion (video ready)
      // If no download URL, this is the initial completion - we need to trigger export
      if (!downloadUrl) {
        console.log(`   📤 No download URL - triggering export to generate final video...`);

        // Call /export endpoint to generate the final video
        const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
        if (!SUBMAGIC_API_KEY) {
          throw new Error('Submagic API key not configured');
        }

        const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}/export`, {
          method: 'POST',
          headers: {
            'x-api-key': SUBMAGIC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhookUrl: brandConfig.webhooks.submagic // Webhook will be called again when export completes
          })
        });

        if (!exportResponse.ok) {
          const exportError = await exportResponse.text();
          console.error(`❌ [${brandConfig.displayName}] Export trigger failed:`, exportError);

          // Update workflow to indicate export failed
          await updateWorkflowForBrand(brand, workflowId, {
            status: 'failed',
            error: `Failed to trigger Submagic export: ${exportError}`,
            failedAt: Date.now(),
          });

          return NextResponse.json({
            success: false,
            brand,
            projectId: submagicProjectId,
            workflow_id: workflowId,
            message: 'Export trigger failed',
            error: exportError
          }, { status: 500 });
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

      return NextResponse.json({
        success: true,
        brand,
        projectId: submagicProjectId,
        workflow_id: workflowId,
        message: 'Video processing queued',
        processing_time_ms: duration,
      });
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
    await logToDeadLetterQueue('submagic', context.params.brand, request, error);

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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah',
  submagicProjectId: string
): Promise<{ workflowId: string; workflow: any } | null> {
  if (brand === 'podcast') {
    const { findPodcastBySubmagicId } = await import('@/lib/feed-store-firestore');
    return await findPodcastBySubmagicId(submagicProjectId);
  } else if (brand === 'benefit') {
    const { findBenefitBySubmagicId } = await import('@/lib/feed-store-firestore');
    return await findBenefitBySubmagicId(submagicProjectId);
  } else if (brand === 'property') {
    // Property videos are stored in property_videos collection
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();
    const propertyVideosSnapshot = await adminDb
      .collection('property_videos')
      .where('submagicProjectId', '==', submagicProjectId)
      .limit(1)
      .get();

    if (!propertyVideosSnapshot.empty) {
      const doc = propertyVideosSnapshot.docs[0];
      return {
        workflowId: doc.id,
        workflow: doc.data()
      };
    }
    return null;
  } else if (brand === 'abdullah') {
    // Abdullah workflows use client SDK
    const { db } = await import('@/lib/firebase');
    const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
    const q = query(
      collection(db, 'abdullah_workflow_queue'),
      where('submagicVideoId', '==', submagicProjectId),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        workflowId: doc.id,
        workflow: doc.data()
      };
    }
    return null;
  } else {
    const { findWorkflowBySubmagicId } = await import('@/lib/feed-store-firestore');
    const result = await findWorkflowBySubmagicId(submagicProjectId);

    // Ensure the workflow belongs to the correct brand
    if (result && result.brand === brand) {
      return {
        workflowId: result.workflowId,
        workflow: result.workflow,
      };
    }

    return null;
  }
}

/**
 * Update workflow for specific brand
 */
async function updateWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah',
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
  } else if (brand === 'abdullah') {
    const { db } = await import('@/lib/firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'abdullah_workflow_queue', workflowId), {
      ...updates,
      updatedAt: Date.now()
    });
  } else {
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, updates);
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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah',
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
    // This ensures:
    // 1. Status only changes after R2 upload succeeds (no timeouts leave it stuck)
    // 2. Video URL is saved before Late posting (failsafe can retry if posting fails)
    await updateWorkflowForBrand(brand, workflowId, {
      status: 'posting', // Use 'posting' for all brands including podcast
      finalVideoUrl: publicVideoUrl,
    });

    console.log(`💾 [${brandConfig.displayName}] Status set to "posting" with video URL saved`);

    // Get brand-specific platforms from config
    const platforms = getBrandPlatforms(brand, false); // Use default platforms

    // Prepare caption and title
    let caption: string;
    let title: string;

    if (brand === 'podcast') {
      caption = workflow.episodeTitle || 'New Podcast Episode';
      title = `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`;
    } else if (brand === 'benefit') {
      // Generate caption from benefit data if missing
      if (!workflow.caption || !workflow.title) {
        const benefitId = workflow.benefitId;
        if (benefitId) {
          const { getBenefitById, generateBenefitCaption, generateBenefitTitle } = await import('@/lib/benefit-content');
          const benefit = getBenefitById(benefitId);
          if (benefit) {
            caption = workflow.caption || generateBenefitCaption(benefit);
            title = workflow.title || generateBenefitTitle(benefit);
          }
        }
      }
      // Final fallbacks
      caption = caption || workflow.caption || 'Learn about owner financing! 🏡';
      title = title || workflow.title || 'Owner Finance Benefits';
    } else if (brand === 'property') {
      caption = workflow.caption || 'New owner finance property for sale! 🏡';
      title = workflow.title || 'Property For Sale';
    } else if (brand === 'vassdistro') {
      caption = workflow.caption || workflow.articleTitle || 'Check out this vape industry update! 🔥';
      title = workflow.title || 'Vape Industry News';
    } else {
      caption = workflow.caption || 'Check out this video! 🔥';
      title = workflow.title || 'Viral Video';
    }

    console.log(`📱 [${brandConfig.displayName}] Posting with same-day multi-platform schedule`);
    console.log(`   All platforms will post TODAY at their optimal hours`);

    // Import same-day posting system
    const { postVideoSameDay } = await import('@/lib/same-day-posting');

    // Post to all platforms on the SAME DAY at different optimal hours
    // Each platform gets posted at its optimal hour for today
    // Example for Monday: TikTok 7 AM, Instagram 11 AM, Facebook 1 PM, YouTube 3 PM, LinkedIn 10 AM
    const postResult = await postVideoSameDay(
      publicVideoUrl,
      caption,
      title,
      brand,
      {
        // Future: Add first comment for engagement boost
        // firstComment: getEngagementComment(brand),
      }
    );

    if (postResult.success) {
      console.log(`✅ [${brandConfig.displayName}] Posted to Late (same-day schedule)!`);
      console.log(`   Total posts created: ${postResult.totalPosts}`);
      console.log(`   All platforms posting today at optimal hours`);

      // Collect all post IDs
      const postIds = postResult.posts
        .map(p => p.result.postId)
        .filter(Boolean)
        .join(', ');

      // Get unique platforms count
      const platforms = new Set(postResult.posts.map(p => p.platform));

      // Mark workflow as completed (video URL already saved above)
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'completed',
        latePostId: postIds, // Store all post IDs
        completedAt: Date.now(),
        weeklyPosts: postResult.totalPosts,
        platformsUsed: platforms.size,
      });
    } else {
      const errorMsg = postResult.errors.join('; ') || 'Unknown platform scheduling error';
      throw new Error(`Late posting failed: ${errorMsg}`);
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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro',
  workflowId: string,
  workflow: any,
  reason: string
): Promise<void> {
  try {
    if (brand !== 'podcast' && brand !== 'benefit' && brand !== 'property') {
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
    // Don't throw - alerting failure shouldn't block webhook processing
  }
}

/**
 * Trigger async video processing (non-blocking)
 * Makes a fire-and-forget request to the processing endpoint
 */
async function triggerAsyncVideoProcessing(
  brand: string,
  workflowId: string,
  videoUrl: string,
  submagicProjectId?: string
): Promise<void> {
  try {
    // Get the base URL for the API - FIXED: Proper precedence
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    console.log(`🌐 [${brand}] Triggering process-video at: ${baseUrl}/api/process-video`);
    console.log(`   Workflow: ${workflowId}`);

    // Trigger the processing endpoint (fire-and-forget with error handling)
    // Don't await - let it run in the background
    // Pass submagicProjectId so we can fetch a fresh URL later
    fetch(`${baseUrl}/api/process-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, workflowId, videoUrl, submagicProjectId }),
    }).then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ [${brand}] process-video failed (${response.status}):`, errorData.error);

        // Update workflow to failed status so it can be retried
        try {
          await updateWorkflowForBrand(brand, workflowId, {
            status: 'video_processing_failed',
            error: `process-video failed: ${errorData.error}`,
            failedAt: Date.now(),
          });
          console.log(`   Updated workflow ${workflowId} to failed status for retry`);
        } catch (updateErr) {
          console.error(`   Failed to update workflow status:`, updateErr);
        }
      } else {
        console.log(`✅ [${brand}] process-video completed successfully for ${workflowId}`);
      }
    }).catch(async (err) => {
      console.error(`❌ [${brand}] Failed to trigger video processing:`, err);

      // Update workflow to failed status so it can be retried
      try {
        await updateWorkflowForBrand(brand, workflowId, {
          status: 'video_processing_failed',
          error: `process-video network error: ${err.message}`,
          failedAt: Date.now(),
        });
        console.log(`   Updated workflow ${workflowId} to failed status for retry`);
      } catch (updateErr) {
        console.error(`   Failed to update workflow status:`, updateErr);
      }
    });

    console.log(`✅ [${brand}] Triggered async video processing for ${workflowId}`);
  } catch (error) {
    console.error(`❌ [${brand}] Error triggering video processing:`, error);
    // Don't throw - webhook should still succeed
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
