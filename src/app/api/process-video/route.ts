/**
 * Async Video Processing Endpoint
 *
 * This endpoint handles the heavy lifting of:
 * 1. Downloading video from Submagic
 * 2. Uploading to R2 storage
 * 3. Posting to Late API
 *
 * Separated from webhook handler to avoid timeout issues.
 * Can be triggered by:
 * - Submagic webhook (async)
 * - Failsafe cron (retry)
 * - Manual trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { postToLate } from '@/lib/late-api';
import { getBrandConfig } from '@/config/brand-configs';
import { getBrandPlatforms, getBrandStoragePath, validateBrand } from '@/lib/brand-utils';
import { fetchWithTimeout, circuitBreakers, TIMEOUTS } from '@/lib/api-utils';

export const maxDuration = 300; // 5 minutes - plenty of time for download/upload

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { brand: brandStr, workflowId, videoUrl, submagicProjectId } = body;

    if (!brandStr || !workflowId) {
      return NextResponse.json({
        error: 'Missing required fields: brand, workflowId'
      }, { status: 400 });
    }

    const brand = validateBrand(brandStr);
    const brandConfig = getBrandConfig(brand);

    console.log(`🎬 [${brandConfig.displayName}] Processing video for workflow ${workflowId}`);

    // Get workflow from Firestore
    const workflow = await getWorkflowForBrand(brand, workflowId);

    if (!workflow) {
      return NextResponse.json({
        error: 'Workflow not found',
        workflowId
      }, { status: 404 });
    }

    // Check if already processed
    if (workflow.status === 'completed') {
      console.log(`✅ Workflow already completed, skipping`);
      return NextResponse.json({
        success: true,
        message: 'Already completed',
        workflowId
      });
    }

    try {
      // Step 1: Get fresh Submagic download URL
      // Use submagicProjectId from request body or workflow data
      const projectId = submagicProjectId || workflow.submagicProjectId;
      let downloadUrl = videoUrl;

      if (projectId) {
        // Fetch fresh URL from Submagic API to avoid expired URLs
        console.log(`🔄 Fetching fresh download URL from Submagic API...`);
        console.log(`   Project ID: ${projectId}`);

        try {
          downloadUrl = await fetchVideoUrlFromSubmagic(projectId);
          console.log(`✅ Fresh URL obtained from Submagic API`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️  Failed to fetch from Submagic API:`, errorMsg);
          console.warn(`   Will ${videoUrl ? 'fall back to provided URL' : 'fail - no fallback URL'}`);

          // Fall back to provided videoUrl if API fetch fails
          if (!videoUrl) {
            throw new Error(`Cannot get video URL: Submagic API failed (${errorMsg}) and no fallback URL provided`);
          }
          console.warn(`   ⚠️  WARNING: Using potentially expired URL from webhook payload`);
        }
      } else if (!videoUrl) {
        throw new Error('No submagicProjectId or videoUrl provided - need at least one to download video');
      }

      console.log(`   Download URL: ${downloadUrl.substring(0, 80)}...`);
      console.log(`   URL age: ${workflow.submagicDownloadUrl ? 'cached from webhook' : 'fresh from API'}`);

      // Step 2: Upload to R2
      console.log(`☁️  Uploading to R2...`);
      const { uploadSubmagicVideo } = await import('@/lib/video-storage');
      const storagePath = getBrandStoragePath(brand, `submagic-videos/${workflowId}.mp4`);

      const publicVideoUrl = await uploadSubmagicVideo(downloadUrl, storagePath);

      console.log(`✅ Video uploaded to R2: ${publicVideoUrl}`);

      // CRITICAL: Save video URL IMMEDIATELY before changing status
      // This ensures we don't lose the URL if status update fails
      await updateWorkflowForBrand(brand, workflowId, {
        finalVideoUrl: publicVideoUrl,
      });
      console.log(`💾 Video URL saved to workflow`);

      // Now update status to "posting"
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'posting', // Use 'posting' for all brands including podcast
      });

      console.log(`📝 Status set to "posting"`);

      // Step 3: Get caption and title
      let caption: string;
      let title: string;

      // DEBUG: Log what we have in the workflow
      console.log(`🔍 DEBUG: Workflow caption data:`);
      console.log(`   workflow.caption exists: ${!!workflow.caption}`);
      console.log(`   workflow.caption value: ${workflow.caption ? `"${workflow.caption.substring(0, 100)}..."` : 'UNDEFINED'}`);
      console.log(`   workflow.title exists: ${!!workflow.title}`);
      console.log(`   workflow.title value: ${workflow.title || 'UNDEFINED'}`);

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
      } else {
        caption = workflow.caption || 'Check out this video! 🔥';
        title = workflow.title || 'Viral Video';
      }

      console.log(`📝 Final caption being sent to Late: "${caption.substring(0, 100)}..."`);
      console.log(`📝 Final title being sent to Late: "${title}"`)

      console.log(`📱 Scheduling posts to Late API using queue system...`);

      // Use Late's queue system - no custom timing logic
      const { postToLate } = await import('@/lib/late-api');
      const { getBrandPlatforms } = await import('@/lib/brand-utils');

      const platforms = getBrandPlatforms(brand, false);
      console.log(`   Platforms: ${platforms.join(', ')}`);

      const postResult = await postToLate({
        videoUrl: publicVideoUrl,
        caption,
        title,
        platforms: platforms as any[],
        brand: brand as any,
        useQueue: true, // Use Late's queue system
        timezone: 'America/Chicago'
      });

      if (postResult.success) {
        console.log(`✅ Posted to Late queue successfully`);
        console.log(`   Post ID: ${postResult.postId}`);
        console.log(`   Scheduled for: ${postResult.scheduledFor}`);

        // Mark as completed
        await updateWorkflowForBrand(brand, workflowId, {
          status: 'completed',
          latePostId: postResult.postId,
          completedAt: Date.now(),
        });

        const duration = Date.now() - startTime;
        console.log(`⏱️  Processing completed in ${duration}ms`);

        return NextResponse.json({
          success: true,
          workflowId,
          videoUrl: publicVideoUrl,
          postId: postResult.postId,
          scheduledFor: postResult.scheduledFor,
          platforms: postResult.platforms,
          processing_time_ms: duration,
        });
      } else {
        throw new Error(`Late posting failed: ${postResult.error}`);
      }

    } catch (error) {
      console.error(`❌ Error processing video:`, error);

      // Update workflow status to failed
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error in video processing',
        failedAt: Date.now(),
      });

      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Processing failed',
        workflowId
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error in video processing endpoint:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Get workflow for specific brand
 */
async function getWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah',
  workflowId: string
): Promise<any | null> {
  if (brand === 'podcast') {
    const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getPodcastWorkflowById(workflowId);
  } else if (brand === 'benefit') {
    const { getBenefitWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getBenefitWorkflowById(workflowId);
  } else if (brand === 'property') {
    const { getPropertyVideoById } = await import('@/lib/feed-store-firestore');
    return await getPropertyVideoById(workflowId);
  } else if (brand === 'abdullah') {
    const { db } = await import('@/lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const docSnap = await getDoc(doc(db, 'abdullah_workflow_queue', workflowId));
    return docSnap.exists() ? docSnap.data() : null;
  } else {
    const { getWorkflowById } = await import('@/lib/feed-store-firestore');
    const result = await getWorkflowById(workflowId);
    // getWorkflowById returns { workflow, brand }, so unwrap it
    return result ? result.workflow : null;
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
 * Fetch fresh video URL from Submagic API
 * This ensures we always get a valid, non-expired download URL
 *
 * If the video hasn't been exported yet, this will trigger the export
 * and return a URL for a subsequent attempt.
 */
async function fetchVideoUrlFromSubmagic(submagicProjectId: string): Promise<string> {
  if (!SUBMAGIC_API_KEY) {
    throw new Error('Submagic API key not configured');
  }

  console.log(`   Checking Submagic project status...`);

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
    const errorText = await response.text().catch(() => 'Unable to read error');
    throw new Error(`Submagic API returned ${response.status}: ${errorText}`);
  }

  const projectData = await response.json();
  console.log(`   Project status: ${projectData.status}`);

  // Try multiple field names that Submagic might use
  const videoUrl = projectData.media_url ||
                   projectData.video_url ||
                   projectData.downloadUrl ||
                   projectData.download_url ||
                   projectData.export_url;

  if (!videoUrl) {
    // If no URL but status is completed, the export might not have been triggered
    if (projectData.status === 'completed' || projectData.status === 'done' || projectData.status === 'ready') {
      console.warn(`   ⚠️  Project is ${projectData.status} but no download URL found`);
      console.warn(`   Available fields:`, Object.keys(projectData).join(', '));
    }
    throw new Error(`No video URL found in Submagic project (status: ${projectData.status})`);
  }

  console.log(`   ✅ Found video URL (${videoUrl.length} chars)`);
  return videoUrl;
}
