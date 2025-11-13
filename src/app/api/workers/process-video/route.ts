/**
 * Dedicated Worker Endpoint for Cloud Tasks
 *
 * This endpoint is called by Cloud Tasks (or as fallback) to process videos.
 * Key benefits:
 * - No timeout limits (Vercel maxDuration: 300s / Cloud Tasks: 30min)
 * - Proper error handling and retries
 * - Isolated from webhook execution
 * - Can be monitored and scaled independently
 */

import { NextRequest, NextResponse } from 'next/server';
import { postToLate } from '@/lib/late-api';
import { getBrandConfig } from '@/config/brand-configs';
import { getBrandPlatforms, getBrandStoragePath, validateBrand } from '@/lib/brand-utils';

// Maximum duration for video processing (5 minutes on Vercel, more on Cloud Run)
export const maxDuration = 300;

// Secret for authenticating Cloud Tasks requests
const CLOUD_TASKS_SECRET = process.env.CLOUD_TASKS_SECRET || process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('X-Cloud-Tasks-Worker') ||
                       request.headers.get('Authorization')?.replace('Bearer ', '');

    if (authHeader !== CLOUD_TASKS_SECRET) {
      console.warn('❌ Unauthorized worker request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brand: brandStr, workflowId, videoUrl, submagicProjectId } = body;

    if (!brandStr || !workflowId) {
      return NextResponse.json({
        error: 'Missing required fields: brand, workflowId'
      }, { status: 400 });
    }

    const brand = validateBrand(brandStr);
    const brandConfig = getBrandConfig(brand);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎬 [WORKER] Processing video for ${brandConfig.displayName}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Has video URL: ${!!videoUrl}`);
    console.log(`   Has Submagic ID: ${!!submagicProjectId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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
      // Update status to processing
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'video_processing',
        processingStartedAt: Date.now(),
      });

      // Step 1: Get video download URL
      let downloadUrl = videoUrl || workflow.submagicDownloadUrl;

      if (!downloadUrl && submagicProjectId) {
        console.log(`🔄 Fetching fresh download URL from Submagic API...`);
        downloadUrl = await fetchVideoUrlFromSubmagic(submagicProjectId);
        console.log(`✅ Fresh URL obtained from Submagic API`);
      }

      if (!downloadUrl) {
        throw new Error('No video URL available for download');
      }

      console.log(`📥 Video URL: ${downloadUrl.substring(0, 80)}...`);

      // Step 2: Upload to R2 with retry logic
      console.log(`☁️  Uploading to R2...`);
      const { uploadSubmagicVideo } = await import('@/lib/video-storage');
      const storagePath = getBrandStoragePath(brand, `submagic-videos/${workflowId}.mp4`);

      const publicVideoUrl = await retryOperation(
        () => uploadSubmagicVideo(downloadUrl, storagePath),
        3, // max retries
        'R2 upload'
      );

      console.log(`✅ Video uploaded to R2: ${publicVideoUrl}`);

      // CRITICAL: Save video URL IMMEDIATELY before changing status
      await updateWorkflowForBrand(brand, workflowId, {
        finalVideoUrl: publicVideoUrl,
        uploadCompletedAt: Date.now(),
      });
      console.log(`💾 Video URL saved to workflow`);

      // Step 3: Update status to "posting"
      await updateWorkflowForBrand(brand, workflowId, {
        status: 'posting',
      });
      console.log(`📝 Status set to "posting"`);

      // Step 4: Get caption and title
      let caption: string;
      let title: string;

      // Personal videos use AI caption generation
      if (brand === 'personal') {
        console.log(`🤖 Using AI caption generation for personal video...`);
        const { generateCaptionAndHashtags } = await import('@/lib/ai-caption-generator');

        const aiResult = await generateCaptionAndHashtags(
          workflow.submagicProjectId,
          workflow.fileName
        );

        caption = aiResult.fullCaption; // Includes caption + hashtags
        title = workflow.fileName?.replace(/\.(mp4|mov|avi|mkv)$/i, '') || 'Personal Video';

        console.log(`✅ AI-generated caption and hashtags`);
      } else {
        // Other brands use standard caption generation
        const result = await getCaptionAndTitle(brand, workflow);
        caption = result.caption;
        title = result.title;
      }

      console.log(`📝 Caption: "${caption.substring(0, 100)}..."`);
      console.log(`📝 Title: "${title}"`);

      // Step 5: Post to Late API with retry logic
      console.log(`📱 Posting to Late API...`);

      let postResult: any;

      // Personal videos use same-day optimal posting (each platform at its best hour)
      if (brand === 'personal') {
        console.log(`   Using same-day optimal posting for personal brand...`);
        const { postVideoSameDayOptimal } = await import('@/lib/same-day-optimal-posting');

        const result = await retryOperation(
          () => postVideoSameDayOptimal(publicVideoUrl, caption, title, brand as any),
          3,
          'Same-day optimal posting'
        );

        // Convert to postResult format
        postResult = {
          success: result.success,
          postId: result.posts.length > 0 ? result.posts[0].result.postId : undefined,
          scheduledFor: result.posts.length > 0 ? result.posts[0].scheduledFor : undefined,
          platforms: result.posts.map(p => p.platform),
          error: result.errors.length > 0 ? result.errors.join(', ') : undefined
        };

        console.log(`✅ Scheduled ${result.totalPosts} platform posts at optimal times`);
        result.posts.forEach(p => {
          const hour = p.scheduledHour > 12 ? p.scheduledHour - 12 : p.scheduledHour;
          const ampm = p.scheduledHour >= 12 ? 'PM' : 'AM';
          console.log(`   ${p.platform}: ${hour} ${ampm} CST`);
        });
      } else {
        // Other brands use standard queue posting
        const platforms = getBrandPlatforms(brand, false);
        console.log(`   Platforms: ${platforms.join(', ')}`);

        postResult = await retryOperation(
          () => postToLate({
            videoUrl: publicVideoUrl,
            caption,
            title,
            platforms: platforms as any[],
            brand: brand as any,
            useQueue: true,
            timezone: brandConfig.scheduling.timezone
          }),
          3, // max retries
          'Late posting'
        );
      }

      if (postResult.success) {
        console.log(`✅ Posted to Late queue successfully`);
        if (postResult.postId) {
          console.log(`   Post ID: ${postResult.postId}`);
        }
        if (postResult.scheduledFor) {
          console.log(`   Scheduled for: ${postResult.scheduledFor}`);
        }

        // Mark as completed
        await updateWorkflowForBrand(brand, workflowId, {
          status: 'completed',
          latePostId: postResult.postId,
          completedAt: Date.now(),
        });

        // Delete from Google Drive if this is a personal video (user preference)
        if (brand === 'personal' && workflow.fileId) {
          try {
            console.log(`🗑️  Deleting video from Google Drive...`);
            const { deleteFile } = await import('@/lib/google-drive-client');
            await deleteFile(workflow.fileId);
            console.log(`✅ Video deleted from Google Drive`);
          } catch (deleteError) {
            console.warn(`⚠️  Failed to delete from Google Drive:`, deleteError);
            // Don't fail the workflow if cleanup fails
          }
        }

        const duration = Date.now() - startTime;
        console.log(`\n⏱️  Processing completed in ${(duration / 1000).toFixed(2)}s`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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

      // Re-throw to trigger Cloud Tasks retry
      throw error;
    }

  } catch (error) {
    console.error('❌ Error in worker endpoint:', error);

    // Return 500 to trigger Cloud Tasks retry
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      retryable: true, // Signal that this can be retried
    }, { status: 500 });
  }
}

/**
 * Retry helper with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  operationName: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   ${operationName} attempt ${attempt}/${maxRetries}...`);
      const result = await operation();
      if (attempt > 1) {
        console.log(`   ✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`   ❌ ${operationName} attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s
        console.log(`   ⏳ Retrying in ${backoffMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Get workflow for specific brand
 */
async function getWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah' | 'personal',
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
  } else if (brand === 'personal') {
    const { db } = await import('@/lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const docSnap = await getDoc(doc(db, 'personal_workflow_queue', workflowId));
    return docSnap.exists() ? docSnap.data() : null;
  } else {
    const { getWorkflowById } = await import('@/lib/feed-store-firestore');
    const result = await getWorkflowById(workflowId);
    return result ? result.workflow : null;
  }
}

/**
 * Update workflow for specific brand
 */
async function updateWorkflowForBrand(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah' | 'personal',
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
  } else if (brand === 'personal') {
    const { db } = await import('@/lib/firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'personal_workflow_queue', workflowId), {
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
 */
async function fetchVideoUrlFromSubmagic(submagicProjectId: string): Promise<string> {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

  if (!SUBMAGIC_API_KEY) {
    throw new Error('Submagic API key not configured');
  }

  const response = await fetch(
    `https://api.submagic.co/v1/projects/${submagicProjectId}`,
    {
      headers: { 'x-api-key': SUBMAGIC_API_KEY }
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error');
    throw new Error(`Submagic API returned ${response.status}: ${errorText}`);
  }

  const projectData = await response.json();

  const videoUrl = projectData.media_url ||
                   projectData.video_url ||
                   projectData.downloadUrl ||
                   projectData.download_url ||
                   projectData.export_url;

  if (!videoUrl) {
    throw new Error(`No video URL found in Submagic project (status: ${projectData.status})`);
  }

  return videoUrl;
}

/**
 * Get caption and title for brand
 */
async function getCaptionAndTitle(
  brand: string,
  workflow: any
): Promise<{ caption: string; title: string }> {
  let caption: string;
  let title: string;

  if (brand === 'podcast') {
    caption = workflow.episodeTitle || 'New Podcast Episode';
    title = `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`;
  } else if (brand === 'benefit') {
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
    caption = caption! || workflow.caption || 'Learn about owner financing! 🏡';
    title = title! || workflow.title || 'Owner Finance Benefits';
  } else if (brand === 'property') {
    caption = workflow.caption || 'New owner finance property for sale! 🏡';
    title = workflow.title || 'Property For Sale';
  } else if (brand === 'ownerfi') {
    caption = workflow.caption || workflow.articleTitle || 'Discover owner financing opportunities! 🏡';
    title = workflow.title || workflow.articleTitle || 'Owner Finance News';
  } else if (brand === 'carz') {
    caption = workflow.caption || workflow.articleTitle || 'Electric vehicle news and updates! ⚡';
    title = workflow.title || workflow.articleTitle || 'EV News';
  } else if (brand === 'vassdistro') {
    caption = workflow.caption || workflow.articleTitle || 'Check out this vape industry update! 🔥';
    title = workflow.title || workflow.articleTitle || 'Industry Update';
  } else {
    caption = workflow.caption || workflow.articleTitle || workflow.episodeTitle || 'Check out this video! 🔥';
    title = workflow.title || workflow.articleTitle || workflow.episodeTitle || 'Viral Video';
  }

  return { caption, title };
}
