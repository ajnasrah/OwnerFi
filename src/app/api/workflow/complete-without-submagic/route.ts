import { NextRequest, NextResponse } from 'next/server';
import { getBrandConfig } from '@/config/brand-configs';
import { validateBrand } from '@/lib/brand-utils';

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

    // Post to Late.so (or Metricool for backwards compatibility)
    const LATE_API_KEY = process.env.LATE_API_KEY;
    if (!LATE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Late API key not configured' },
        { status: 500 }
      );
    }

    // Prepare caption - generate from benefit data if missing
    let caption = workflow.caption;
    if (!caption && validatedBrand === 'benefit') {
      const benefitId = workflow.benefitId;
      if (benefitId) {
        const { getBenefitById, generateBenefitCaption } = await import('@/lib/benefit-content');
        const benefit = getBenefitById(benefitId);
        if (benefit) {
          caption = generateBenefitCaption(benefit);
        }
      }
    }
    // Final fallback
    caption = caption || workflow.articleTitle || workflow.episodeTitle || 'Check out this video!';

    // Schedule post
    const scheduledDate = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes from now

    const lateResponse = await fetch('https://api.getlate.so/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: caption,
        mediaUrls: [finalVideoUrl],
        scheduledDate: scheduledDate,
        platforms: ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter']
      })
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      return NextResponse.json(
        { success: false, error: `Late API error: ${lateResponse.status} - ${errorText}` },
        { status: 500 }
      );
    }

    const lateData = await lateResponse.json();
    const postId = lateData.id || lateData.postId;

    console.log(`✅ Posted to Late: ${postId}`);

    // Update workflow as completed
    await updateWorkflowStatus(workflowId, validatedBrand, {
      status: 'completed',
      finalVideoUrl: finalVideoUrl,
      latePostId: postId,
      completedAt: Date.now(),
      submagicSkipped: true, // Mark that Submagic was intentionally skipped
      error: null
    });

    return NextResponse.json({
      success: true,
      postId,
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
