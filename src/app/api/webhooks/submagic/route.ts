import { NextRequest, NextResponse } from 'next/server';
import { findWorkflowBySubmagicId, updateWorkflow } from '@/lib/workflow-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('🔔 Submagic webhook received:', JSON.stringify(body, null, 2));

    // Submagic webhook payload structure (may vary - check actual payload)
    const { project_id, projectId, id, status, video_url, videoUrl, output_url } = body;

    const submagicProjectId = project_id || projectId || id;
    const finalVideoUrl = video_url || videoUrl || output_url;

    if (!submagicProjectId) {
      return NextResponse.json(
        { error: 'Missing project_id in webhook payload' },
        { status: 400 }
      );
    }

    // Find the workflow for this project
    const result = findWorkflowBySubmagicId(submagicProjectId);

    if (!result) {
      console.log('⚠️ No pending workflow found for Submagic project:', submagicProjectId);
      return NextResponse.json({
        received: true,
        message: 'No pending workflow found'
      });
    }

    const { id: workflowId, workflow } = result;

    if (status === 'completed' || status === 'done' || status === 'ready') {
      console.log('✅ Submagic video completed:', finalVideoUrl);

      // Update workflow
      updateWorkflow(workflowId, {
        finalVideoUrl: finalVideoUrl,
        status: 'complete'
      });

      console.log('🎉 WORKFLOW COMPLETE!');
      console.log('   Workflow ID:', workflowId);
      console.log('   HeyGen Video:', workflow.videoUrl);
      console.log('   Final Video:', finalVideoUrl);

    } else if (status === 'failed' || status === 'error') {
      console.error('❌ Submagic processing failed');
      updateWorkflow(workflowId, {
        status: 'failed',
        error: 'Submagic processing failed'
      });
    } else {
      console.log('⏳ Submagic status:', status);
    }

    return NextResponse.json({
      received: true,
      project_id: submagicProjectId,
      workflow_id: workflowId
    });

  } catch (error) {
    console.error('Error processing Submagic webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
