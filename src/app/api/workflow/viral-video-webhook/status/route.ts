import { NextRequest, NextResponse } from 'next/server';
import { getWorkflow } from '@/lib/workflow-store';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workflowId = searchParams.get('id');

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflow_id parameter is required' },
        { status: 400 }
      );
    }

    const workflow = getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    const response: any = {
      workflow_id: workflowId,
      status: workflow.status,
      script: workflow.script,
      heygen_video_id: workflow.videoId,
      created_at: new Date(workflow.createdAt).toISOString()
    };

    // Add URLs based on status
    if (workflow.videoUrl) {
      response.heygen_video_url = workflow.videoUrl;
    }

    if (workflow.submagicProjectId) {
      response.submagic_project_id = workflow.submagicProjectId;
      response.submagic_editor_url = `https://app.submagic.co/projects/${workflow.submagicProjectId}`;
    }

    if (workflow.finalVideoUrl) {
      response.final_video_url = workflow.finalVideoUrl;
    }

    if (workflow.error) {
      response.error = workflow.error;
    }

    // Add status messages
    const statusMessages: Record<string, string> = {
      heygen_pending: 'HeyGen is generating the video...',
      heygen_complete: 'HeyGen video complete. Sending to Submagic...',
      submagic_pending: 'Submagic is adding captions and effects...',
      complete: 'Video is ready! Download from final_video_url',
      failed: 'Workflow failed. Check error field for details.'
    };

    response.message = statusMessages[workflow.status] || 'Processing...';

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error checking workflow status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
