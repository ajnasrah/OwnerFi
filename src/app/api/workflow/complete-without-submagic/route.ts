import { NextRequest, NextResponse } from 'next/server';
import { getBrandConfig } from '@/config/brand-configs';
import { validateBrand, getBrandPlatforms } from '@/lib/brand-utils';

/**
 * Complete a workflow using HeyGen video directly (skip Submagic)
 * Useful when Submagic keeps failing or for quick testing
 */
export async function POST(request: NextRequest) {
  try {
    const { workflowId, brand } = await request.json();

    if (!workflowId || !brand) {
      return NextResponse.json(
        { success: false, error: 'workflowId and brand are required' },
        { status: 400 }
      );
    }

    const validatedBrand = validateBrand(brand);
    const brandConfig = getBrandConfig(validatedBrand);

    console.log(`⚡ Completing workflow ${workflowId} without Submagic (${brandConfig.displayName})`);

    // Get workflow data
    const { getWorkflowById, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    const result = await getWorkflowById(workflowId);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Unwrap the workflow object
    const workflow = result.workflow;

    // Check if we have the HeyGen video URL
    const finalVideoUrl = workflow.heygenVideoR2Url || workflow.heygenVideoUrl;
    if (!finalVideoUrl) {
      return NextResponse.json(
        { success: false, error: 'No HeyGen video URL found in workflow. Cannot complete.' },
        { status: 400 }
      );
    }

    console.log(`📹 Using HeyGen video as final: ${finalVideoUrl}`);

    // Prepare caption - use workflow caption or fallback
    const caption = workflow.caption || workflow.articleTitle || 'Check out this video!';
    const title = workflow.title || workflow.articleTitle || 'Video';

    // Get brand platforms
    const platforms = getBrandPlatforms(validatedBrand, false);

    // Post using unified posting: YouTube via direct API + other platforms via Late.dev
    const { postToAllPlatforms, getYouTubeCategoryForBrand } = await import('@/lib/unified-posting');

    const unifiedResult = await postToAllPlatforms({
      videoUrl: finalVideoUrl,
      caption,
      title,
      platforms: platforms as any[],
      brand: validatedBrand as any,
      useQueue: true,
      timezone: brandConfig.scheduling.timezone,
      youtubeCategory: getYouTubeCategoryForBrand(validatedBrand),
      youtubePrivacy: 'public',
      youtubeMadeForKids: false,
    });

    if (!unifiedResult.success) {
      return NextResponse.json(
        { success: false, error: `Posting failed: ${unifiedResult.errors.join(', ')}` },
        { status: 500 }
      );
    }

    const postId = unifiedResult.otherPlatforms?.postId;
    const youtubeVideoId = unifiedResult.youtube?.videoId;

    console.log(`✅ Posted successfully`);
    if (youtubeVideoId) console.log(`   YouTube: ${youtubeVideoId}`);
    if (postId) console.log(`   Late.dev: ${postId}`);

    // Update workflow as completed
    const completionUpdate: Record<string, any> = {
      status: 'completed',
      finalVideoUrl: finalVideoUrl,
      completedAt: Date.now(),
      submagicSkipped: true,
      error: null,
    };
    if (postId) completionUpdate.latePostId = postId;
    if (youtubeVideoId) completionUpdate.youtubeVideoId = youtubeVideoId;

    await updateWorkflowStatus(workflowId, validatedBrand, completionUpdate);

    return NextResponse.json({
      success: true,
      postId,
      youtubeVideoId,
      finalVideoUrl,
      message: 'Workflow completed with HeyGen video (Submagic skipped)'
    });

  } catch (error) {
    console.error('Error completing workflow without Submagic:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
