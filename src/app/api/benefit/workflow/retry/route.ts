/**
 * Benefit Workflow Retry API
 * Automatically retries failed benefit video workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { BenefitVideoGenerator } from '@/lib/benefit-video-generator';
import { getBenefitById } from '@/lib/benefit-content';
import { updateBenefitWorkflow } from '@/lib/feed-store-firestore';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId } = body;

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId required' }, { status: 400 });
    }

    console.log(`\n🔄 Retrying benefit workflow: ${workflowId}`);

    const db = admin.firestore();
    const workflowRef = db.collection('benefit_workflow_queue').doc(workflowId);
    const workflowDoc = await workflowRef.get();

    if (!workflowDoc.exists) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflow = workflowDoc.data();

    if (!workflow) {
      return NextResponse.json({ error: 'Invalid workflow data' }, { status: 500 });
    }

    // Only retry failed workflows
    if (workflow.status !== 'failed') {
      return NextResponse.json({
        error: `Cannot retry workflow with status: ${workflow.status}`,
        currentStatus: workflow.status
      }, { status: 400 });
    }

    // Get benefit data
    const benefit = getBenefitById(workflow.benefitId);
    if (!benefit) {
      return NextResponse.json({
        error: `Benefit not found: ${workflow.benefitId}`
      }, { status: 404 });
    }

    // Get API key
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    // Reset workflow status
    await updateBenefitWorkflow(workflowId, {
      status: 'heygen_processing',
      error: null,
      retryCount: (workflow.retryCount || 0) + 1,
      lastRetryAt: Date.now()
    });

    console.log(`   Retry attempt: ${(workflow.retryCount || 0) + 1}`);
    console.log(`   Previous error: ${workflow.error}`);

    // Generate video
    const generator = new BenefitVideoGenerator(HEYGEN_API_KEY);
    const videoId = await generator.generateVideo(benefit, workflowId);

    // Update workflow with new video ID
    await updateBenefitWorkflow(workflowId, {
      heygenVideoId: videoId
    });

    console.log(`✅ Workflow retry successful - new video ID: ${videoId}`);

    return NextResponse.json({
      success: true,
      workflowId,
      videoId,
      retryCount: (workflow.retryCount || 0) + 1,
      previousError: workflow.error,
      message: 'Workflow retry successful'
    });

  } catch (error) {
    console.error('❌ Workflow retry error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Support GET for manual testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const workflowId = searchParams.get('workflowId');

  if (!workflowId) {
    return NextResponse.json({ error: 'workflowId query param required' }, { status: 400 });
  }

  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ workflowId })
  }));
}
