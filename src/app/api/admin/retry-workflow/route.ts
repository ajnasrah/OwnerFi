/**
 * Admin API: Retry Failed Workflows
 *
 * POST /api/admin/retry-workflow - Retry a failed workflow
 *
 * This endpoint allows retrying workflows that failed at any stage.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBrand } from '@/lib/brand-utils';
import { getBrandWebhookUrl } from '@/lib/brand-utils';

/**
 * POST - Retry a failed workflow
 *
 * Body:
 * - workflowId: Workflow ID to retry
 * - brand: Brand (carz, ownerfi, podcast)
 * - stage: Stage to retry from (heygen, submagic, posting)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, brand, stage } = body;

    // Validate inputs
    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: 'workflowId is required' },
        { status: 400 }
      );
    }

    if (!brand) {
      return NextResponse.json(
        { success: false, error: 'brand is required' },
        { status: 400 }
      );
    }

    const validatedBrand = validateBrand(brand);

    console.log(`🔄 Retrying workflow ${workflowId} for ${validatedBrand} from stage: ${stage || 'auto'}`);

    // Get workflow from Firestore
    const workflow = await getWorkflowForRetry(validatedBrand, workflowId);

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    console.log(`   Current status: ${workflow.status}`);
    console.log(`   Failed at: ${new Date(workflow.failedAt || 0).toISOString()}`);

    // Determine retry strategy based on current status or requested stage
    const retryStage = stage || determineRetryStage(workflow.status);

    switch (retryStage) {
      case 'heygen':
        return await retryHeyGen(validatedBrand, workflowId, workflow);

      case 'submagic':
        return await retrySubmagic(validatedBrand, workflowId, workflow);

      case 'posting':
        return await retryPosting(validatedBrand, workflowId, workflow);

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Cannot retry from stage: ${retryStage}. Workflow status: ${workflow.status}`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error retrying workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get workflow for retry (supports both social media and podcast)
 */
async function getWorkflowForRetry(
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
 * Determine which stage to retry from based on workflow status
 */
function determineRetryStage(status: string): string {
  if (status === 'failed' || status === 'pending') {
    return 'heygen';
  }
  if (status === 'heygen_processing') {
    return 'heygen';
  }
  if (status === 'submagic_processing') {
    return 'submagic';
  }
  if (status === 'posting' || status === 'publishing') {
    return 'posting';
  }
  return 'unknown';
}

/**
 * Retry from HeyGen stage
 */
async function retryHeyGen(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  workflow: any
): Promise<NextResponse> {
  console.log(`   Retrying from HeyGen stage...`);

  // TODO: Re-trigger HeyGen video generation
  // This would require regenerating the script and calling HeyGen API again
  // For now, we'll just reset the status

  const { updateWorkflowStatus, updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');

  if (brand === 'podcast') {
    await updatePodcastWorkflow(workflowId, {
      status: 'pending',
      error: null,
      retryCount: (workflow.retryCount || 0) + 1,
    });
  } else {
    await updateWorkflowStatus(workflowId, brand, {
      status: 'pending',
      error: null,
      retryCount: (workflow.retryCount || 0) + 1,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Workflow reset to pending. Re-trigger video generation manually.',
    workflowId,
    brand,
  });
}

/**
 * Retry from Submagic stage
 */
async function retrySubmagic(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  workflow: any
): Promise<NextResponse> {
  console.log(`   Retrying from Submagic stage...`);

  if (!workflow.heygenVideoId && !workflow.finalVideoUrl) {
    return NextResponse.json(
      { success: false, error: 'No HeyGen video URL found. Cannot retry Submagic.' },
      { status: 400 }
    );
  }

  // Re-trigger Submagic processing
  // This would call the Submagic API again with the existing HeyGen video
  // For now, we'll just reset the status

  const { updateWorkflowStatus, updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');

  if (brand === 'podcast') {
    await updatePodcastWorkflow(workflowId, {
      status: 'heygen_processing',
      error: null,
      retryCount: (workflow.retryCount || 0) + 1,
    });
  } else {
    await updateWorkflowStatus(workflowId, brand, {
      status: 'heygen_processing',
      error: null,
      retryCount: (workflow.retryCount || 0) + 1,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Workflow reset to heygen_processing. Webhook will retry Submagic automatically.',
    workflowId,
    brand,
  });
}

/**
 * Retry from posting stage
 */
async function retryPosting(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  workflow: any
): Promise<NextResponse> {
  console.log(`   Retrying from posting stage...`);

  if (!workflow.finalVideoUrl) {
    return NextResponse.json(
      { success: false, error: 'No final video URL found. Cannot retry posting.' },
      { status: 400 }
    );
  }

  // Re-trigger posting to Late API
  const { postToLate } = await import('@/lib/late-api');
  const { getBrandPlatforms } = await import('@/lib/brand-utils');

  const platforms = getBrandPlatforms(brand, false);
  const caption = workflow.caption || workflow.episodeTitle || 'Retry post';
  const title = workflow.title || workflow.episodeTitle || 'Retry post';

  console.log(`   Posting to platforms: ${platforms.join(', ')}`);

  const postResult = await postToLate({
    videoUrl: workflow.finalVideoUrl,
    caption,
    title,
    platforms: platforms as any[],
    useQueue: true,
    brand,
  });

  if (!postResult.success) {
    return NextResponse.json(
      { success: false, error: `Posting failed: ${postResult.error}` },
      { status: 500 }
    );
  }

  // Update workflow status
  const { updateWorkflowStatus, updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');

  if (brand === 'podcast') {
    await updatePodcastWorkflow(workflowId, {
      status: 'completed',
      latePostId: postResult.postId,
      error: null,
      completedAt: Date.now(),
      retryCount: (workflow.retryCount || 0) + 1,
    });
  } else {
    await updateWorkflowStatus(workflowId, brand, {
      status: 'completed',
      latePostId: postResult.postId,
      error: null,
      completedAt: Date.now(),
      retryCount: (workflow.retryCount || 0) + 1,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Workflow completed successfully',
    workflowId,
    brand,
    postId: postResult.postId,
    platforms: postResult.platforms,
  });
}
