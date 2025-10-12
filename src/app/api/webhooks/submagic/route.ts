import { NextRequest, NextResponse } from 'next/server';
import { findWorkflowBySubmagicId, updateWorkflow, getWorkflow } from '@/lib/workflow-store';
import { postToMetricool } from '@/lib/metricool-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('🔔 Submagic webhook received:', JSON.stringify(body, null, 2));

    // Submagic webhook payload structure:
    // { projectId: "uuid", status: "completed", downloadUrl: "url", timestamp: "ISO8601" }
    const { projectId, status, downloadUrl, timestamp } = body;

    const submagicProjectId = projectId;
    const finalVideoUrl = downloadUrl;

    if (!submagicProjectId) {
      return NextResponse.json(
        { error: 'Missing projectId in webhook payload' },
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

      // Send immediate confirmation to Submagic (don't wait for Metricool)
      const response = NextResponse.json({
        received: true,
        projectId: submagicProjectId,
        workflowId: workflowId,
        timestamp: new Date().toISOString()
      });

      // Auto-post to Metricool asynchronously (don't block webhook response)
      if (process.env.METRICOOL_AUTO_POST === 'true' && finalVideoUrl) {
        // Run Metricool posting in background (after sending webhook response)
        setImmediate(async () => {
          try {
            console.log('\n📱 Auto-posting to social media via Metricool...');

            // Get the full workflow to access title and caption
            const fullWorkflow = getWorkflow(workflowId);

            if (fullWorkflow) {
              const platforms = (process.env.METRICOOL_PLATFORMS || 'instagram,tiktok,youtube,facebook,linkedin,threads').split(',') as any[];

              const postResult = await postToMetricool({
                videoUrl: finalVideoUrl,
                caption: fullWorkflow.caption || fullWorkflow.script?.substring(0, 150) || 'Check out this video!',
                title: fullWorkflow.title || 'Viral Video',
                hashtags: fullWorkflow.hashtags || extractHashtagsFromCaption(fullWorkflow.caption || ''),
                platforms: platforms,
                scheduleTime: process.env.METRICOOL_SCHEDULE_DELAY ? getScheduleTime(process.env.METRICOOL_SCHEDULE_DELAY) : undefined,
                brand: fullWorkflow.brand || 'ownerfi' // Default to ownerfi if brand not specified
              });

              if (postResult.success) {
                console.log('✅ Posted to Metricool!');
                console.log('   Post ID:', postResult.postId);
                console.log('   Platforms:', postResult.platforms?.join(', '));

                updateWorkflow(workflowId, {
                  metricoolPostId: postResult.postId,
                  metricoolPlatforms: postResult.platforms,
                  metricoolPosted: true
                });
              } else {
                console.error('❌ Failed to post to Metricool:', postResult.error);
              }
            }
          } catch (error) {
            console.error('❌ Error posting to Metricool (async):', error);
          }
        });
      }

      return response;

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
      projectId: submagicProjectId,
      workflowId: workflowId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing Submagic webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to extract hashtags from caption
function extractHashtagsFromCaption(caption: string): string[] {
  const hashtagRegex = /#[\w]+/g;
  const matches = caption.match(hashtagRegex);
  return matches ? matches.map(tag => tag.replace('#', '')) : [];
}

// Helper function to calculate schedule time
function getScheduleTime(delay: string): string | undefined {
  const now = new Date();

  switch (delay) {
    case '1hour':
      now.setHours(now.getHours() + 1);
      break;
    case '2hours':
      now.setHours(now.getHours() + 2);
      break;
    case '4hours':
      now.setHours(now.getHours() + 4);
      break;
    case 'optimal':
      // Schedule for next optimal time (e.g., 7 PM)
      now.setHours(19, 0, 0, 0);
      if (now.getTime() < Date.now()) {
        now.setDate(now.getDate() + 1);
      }
      break;
    default:
      return undefined;
  }

  return now.toISOString();
}
