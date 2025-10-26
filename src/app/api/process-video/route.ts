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
          console.warn(`⚠️  Failed to fetch from Submagic API, falling back to provided URL:`, error);
          // Fall back to provided videoUrl if API fetch fails
          if (!videoUrl) {
            throw new Error('No video URL available and Submagic API fetch failed');
          }
        }
      } else if (!videoUrl) {
        throw new Error('No submagicProjectId or videoUrl provided');
      }

      console.log(`   Download URL: ${downloadUrl.substring(0, 80)}...`);

      // Step 2: Upload to R2
      console.log(`☁️  Uploading to R2...`);
      const { uploadSubmagicVideo } = await import('@/lib/video-storage');
      const storagePath = getBrandStoragePath(brand, `submagic-videos/${workflowId}.mp4`);

      const publicVideoUrl = await uploadSubmagicVideo(downloadUrl, storagePath);

      console.log(`✅ Video uploaded to R2: ${publicVideoUrl}`);

      // Step 2: Update workflow with video URL and set status to "posting"
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'posting', // Use 'posting' for all brands including podcast
        finalVideoUrl: publicVideoUrl,
      });

      console.log(`💾 Status set to "posting" with video URL saved`);

      // Step 3: Post to Late API
      const platforms = getBrandPlatforms(brand, false);

      let caption: string;
      let title: string;

      if (brand === 'podcast') {
        caption = workflow.episodeTitle || 'New Podcast Episode';
        title = `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`;
      } else if (brand === 'benefit') {
        caption = workflow.caption || 'Learn about owner financing! 🏡';
        title = workflow.title || 'Owner Finance Benefits';
      } else {
        caption = workflow.caption || 'Check out this video! 🔥';
        title = workflow.title || 'Viral Video';
      }

      console.log(`📱 Posting to Late API (${platforms.join(', ')})...`);

      const postResult = await postToLate({
        videoUrl: publicVideoUrl,
        caption,
        title,
        platforms: platforms as any[],
        useQueue: true,
        brand,
      });

      if (postResult.success) {
        console.log(`✅ Posted to Late! Post ID: ${postResult.postId}`);

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
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit',
  workflowId: string
): Promise<any | null> {
  if (brand === 'podcast') {
    const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getPodcastWorkflowById(workflowId);
  } else if (brand === 'benefit') {
    const { getBenefitWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getBenefitWorkflowById(workflowId);
  } else {
    const { getWorkflowById } = await import('@/lib/feed-store-firestore');
    return await getWorkflowById(workflowId, brand);
  }
}

/**
 * Update workflow for specific brand
 */
async function updateWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit',
  workflowId: string,
  updates: Record<string, any>
): Promise<void> {
  if (brand === 'podcast') {
    const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
    await updatePodcastWorkflow(workflowId, updates);
  } else if (brand === 'benefit') {
    const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
    await updateBenefitWorkflow(workflowId, updates);
  } else {
    const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    await updateWorkflowStatus(workflowId, brand, updates);
  }
}

/**
 * Fetch fresh video URL from Submagic API
 * This ensures we always get a valid, non-expired download URL
 */
async function fetchVideoUrlFromSubmagic(submagicProjectId: string): Promise<string> {
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
    throw new Error(`Submagic API returned ${response.status}: ${response.statusText}`);
  }

  const projectData = await response.json();
  const videoUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

  if (!videoUrl) {
    throw new Error('No video URL found in Submagic project data');
  }

  return videoUrl;
}
