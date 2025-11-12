/**
 * Admin endpoint to force-complete a workflow with a direct video URL
 * Bypasses normal workflow checks and directly processes the video
 */

import { NextRequest, NextResponse } from 'next/server';
import { postToLate } from '@/lib/late-api';
import { validateBrand, getBrandPlatforms } from '@/lib/brand-utils';
import { getBrandConfig } from '@/config/brand-configs';

export async function POST(request: NextRequest) {
  try {
    const { workflowId, brand, videoUrl } = await request.json();

    if (!workflowId || !brand || !videoUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: workflowId, brand, videoUrl' },
        { status: 400 }
      );
    }

    const validatedBrand = validateBrand(brand);
    const brandConfig = getBrandConfig(validatedBrand);

    console.log(`🔧 [ADMIN] Force-completing workflow ${workflowId}`);
    console.log(`   Brand: ${brandConfig.displayName}`);
    console.log(`   Video URL: ${videoUrl.substring(0, 60)}...`);

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
    console.log(`   Article: ${workflow.articleTitle}`);

    // Step 1: Download video from Submagic and upload to R2
    console.log(`   ☁️  Uploading video to R2...`);
    const { downloadAndUploadVideoToR2 } = await import('@/lib/video-storage');
    const r2Url = await downloadAndUploadVideoToR2(
      videoUrl,
      `videos/${workflowId}.mp4`
    );

    console.log(`   ✅ R2 upload complete: ${r2Url.substring(0, 60)}...`);

    // Update workflow with R2 URL
    await updateWorkflowStatus(workflowId, validatedBrand, {
      submagicDownloadUrl: videoUrl,
      finalVideoR2Url: r2Url,
      status: 'posting'
    });

    // Step 2: Post to Late.so
    console.log(`   📱 Posting to social media...`);

    const caption = workflow.caption || workflow.articleTitle || 'Check this out!';
    const title = workflow.title || workflow.articleTitle || 'Check this out!';
    const platforms = getBrandPlatforms(validatedBrand);

    const lateResponse = await postToLate({
      videoUrl: r2Url,
      caption: caption,
      title: title,
      platforms: platforms,
      brand: validatedBrand,
      useQueue: true, // ✅ Use GetLate's queue system
      timezone: 'America/Chicago'
    });

    console.log(`   ✅ Posted to Late.so: ${lateResponse.postId}`);

    // Step 3: Mark workflow as completed
    await updateWorkflowStatus(workflowId, validatedBrand, {
      status: 'completed',
      latePostId: lateResponse.postId,
      completedAt: Date.now(),
      error: null
    });

    console.log(`✅ [ADMIN] Workflow ${workflowId} force-completed successfully!`);

    return NextResponse.json({
      success: true,
      workflowId,
      latePostId: lateResponse.postId,
      message: 'Workflow force-completed and posted to social media'
    });

  } catch (error) {
    console.error('❌ [ADMIN] Force-complete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
