import { NextRequest, NextResponse } from 'next/server';
import { getBrandConfig } from '@/config/brand-configs';
import { validateBrand } from '@/lib/brand-utils';

/**
 * Retry Submagic step for a failed workflow
 * Uses the saved heygenVideoR2Url from the workflow
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

    console.log(`🔄 Retrying Submagic for workflow ${workflowId} (${brandConfig.displayName})`);

    // Get workflow data based on brand type
    let workflow;
    if (validatedBrand === 'podcast') {
      const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
      workflow = await getPodcastWorkflowById(workflowId);
    } else if (validatedBrand === 'benefit') {
      const { getBenefitWorkflowById } = await import('@/lib/feed-store-firestore');
      workflow = await getBenefitWorkflowById(workflowId);
    } else {
      const { getWorkflowById } = await import('@/lib/feed-store-firestore');
      const result = await getWorkflowById(workflowId);
      workflow = result?.workflow || null;
    }

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Check if we have the HeyGen video URL
    const videoUrl = workflow.heygenVideoR2Url || workflow.heygenVideoUrl;
    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: 'No HeyGen video URL found in workflow. Cannot retry Submagic.' },
        { status: 400 }
      );
    }

    console.log(`📹 Using saved video URL: ${videoUrl}`);

    // Get Submagic API key
    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Submagic API key not configured' },
        { status: 500 }
      );
    }

    // Prepare title (max 50 characters for Submagic)
    let title = workflow.articleTitle || workflow.episodeTitle || workflow.benefitTitle || `${brandConfig.displayName} Video - ${workflowId}`;

    // Decode HTML entities
    title = title
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8211;/g, "-")
      .replace(/&#8212;/g, "-")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");

    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    // Send to Submagic
    const submagicWebhookUrl = brandConfig.webhooks.submagic;
    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        language: 'en',
        videoUrl: videoUrl,
        templateName: 'Hormozi 2',
        magicBrolls: true,
        magicBrollsPercentage: 50,
        magicZooms: true,
        webhookUrl: submagicWebhookUrl
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Submagic API error: ${response.status} - ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const projectId = data.id || data.project_id || data.projectId;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: `Submagic returned no project ID. Response: ${JSON.stringify(data)}` },
        { status: 500 }
      );
    }

    console.log(`✅ Submagic project created: ${projectId}`);

    // Update workflow based on brand type
    if (validatedBrand === 'podcast') {
      const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
      await updatePodcastWorkflow(workflowId, {
        status: 'submagic_processing',
        submagicVideoId: projectId,
        submagicProjectId: projectId,
        error: null // Clear previous error
      });
    } else if (validatedBrand === 'benefit') {
      const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
      await updateBenefitWorkflow(workflowId, {
        status: 'submagic_processing',
        submagicVideoId: projectId,
        submagicProjectId: projectId,
        error: null // Clear previous error
      });
    } else {
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, validatedBrand, {
        status: 'submagic_processing',
        submagicVideoId: projectId,
        submagicProjectId: projectId,
        error: null // Clear previous error
      });
    }

    return NextResponse.json({
      success: true,
      projectId,
      message: 'Submagic retry successful'
    });

  } catch (error) {
    console.error('Error retrying Submagic:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
