import { NextRequest, NextResponse } from 'next/server';
import { validateBrand } from '@/lib/brand-utils';

/**
 * Fetch HeyGen video URL from HeyGen API and update workflow
 * Used when workflow has heygenVideoId but missing heygenVideoUrl/heygenVideoR2Url
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

    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    console.log(`🔍 Fetching HeyGen video for workflow ${workflowId} (${brand})`);

    // Get workflow data
    const { getWorkflowById, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    const result = await getWorkflowById(workflowId);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    const workflow = result.workflow;
    const workflowBrand = result.brand;

    // Check if we have HeyGen video ID
    if (!workflow.heygenVideoId) {
      return NextResponse.json(
        { success: false, error: 'No HeyGen video ID found in workflow' },
        { status: 400 }
      );
    }

    console.log(`📹 HeyGen Video ID: ${workflow.heygenVideoId}`);

    // Fetch video status from HeyGen API
    const response = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${workflow.heygenVideoId}`,
      {
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `HeyGen API error: ${response.status} - ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const status = data.data?.status;
    const videoUrl = data.data?.video_url;

    console.log(`📊 HeyGen Status: ${status}`);
    console.log(`🎬 Video URL: ${videoUrl || 'N/A'}`);

    if (status !== 'completed') {
      return NextResponse.json(
        { success: false, error: `HeyGen video not ready yet. Status: ${status}` },
        { status: 400 }
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: 'HeyGen video completed but no URL returned' },
        { status: 500 }
      );
    }

    // Upload to R2 for permanent storage
    console.log('☁️  Uploading HeyGen video to R2...');
    const { downloadAndUploadToR2 } = await import('@/lib/video-storage');
    const r2Url = await downloadAndUploadToR2(
      videoUrl,
      HEYGEN_API_KEY,
      `heygen-videos/${workflow.heygenVideoId}.mp4`
    );

    console.log(`✅ R2 Upload complete: ${r2Url}`);

    // Update workflow with URLs (use the brand from the workflow, not from request)
    await updateWorkflowStatus(workflowId, workflowBrand, {
      heygenVideoUrl: videoUrl,
      heygenVideoR2Url: r2Url
    });

    return NextResponse.json({
      success: true,
      heygenVideoUrl: videoUrl,
      heygenVideoR2Url: r2Url,
      message: 'HeyGen video URL fetched and saved to workflow'
    });

  } catch (error) {
    console.error('Error fetching HeyGen video:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
