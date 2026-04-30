import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { updateWorkflowStatus, findWorkflowBySubmagicId } from '@/lib/feed-store-firestore';
import { uploadVideoToR2 } from '@/lib/r2-upload';
import { isWebhookProcessed, markWebhookProcessed, generateIdempotencyKey } from '@/lib/webhook-idempotency';
import { triggerLatePosting } from '@/lib/social-posting';
import { Brand } from '@/config/constants';

interface SubmagicWebhookPayload {
  projectId: string;
  status: 'completed' | 'failed' | 'processing';
  exportUrl?: string;
  error?: string;
  exports?: Array<{
    format: string;
    url: string;
    resolution: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // Submagic doesn't use signatures, so we rely on project ID matching
    const payload: SubmagicWebhookPayload = await req.json();
    
    // Check idempotency
    const idempotencyKey = generateIdempotencyKey('submagic', `${payload.projectId}-${payload.status}`);
    
    if (await isWebhookProcessed(idempotencyKey)) {
      console.log(`[Submagic Webhook] Duplicate webhook for project ${payload.projectId}, skipping`);
      return NextResponse.json({ status: 'duplicate_ignored' });
    }

    const { projectId, status, exportUrl, error, exports } = payload;

    console.log(`[Submagic Webhook] Received status ${status} for project ${projectId}`);

    // Find the workflow by Submagic project ID
    const workflowResult = await findWorkflowBySubmagicId(projectId);
    
    if (!workflowResult) {
      console.error(`[Submagic Webhook] No workflow found for project ${projectId}`);
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const { workflowId, brand, workflow } = workflowResult;

    // Handle different statuses
    if (status === 'completed') {
      // Find the best quality export
      let videoUrl = exportUrl;
      if (exports && exports.length > 0) {
        // Prefer 1080p, then 720p, then any
        const preferred = exports.find(e => e.resolution === '1080p') ||
                         exports.find(e => e.resolution === '720p') ||
                         exports[0];
        videoUrl = preferred.url;
      }

      if (!videoUrl) {
        console.error(`[Submagic Webhook] No video URL in completed webhook`);
        await updateWorkflowStatus(workflowId, brand, 'failed', {
          error: 'Submagic completed but no video URL provided',
          statusChangedAt: Date.now()
        });
        return NextResponse.json({ error: 'No video URL' }, { status: 400 });
      }

      console.log(`[Submagic Webhook] Video completed for workflow ${workflowId}`);
      
      // Upload to R2 for permanent storage
      let r2VideoUrl: string | undefined;
      try {
        r2VideoUrl = await uploadVideoToR2(videoUrl, `submagic/${brand}/${projectId}.mp4`);
        console.log(`[Submagic Webhook] Video uploaded to R2: ${r2VideoUrl}`);
      } catch (uploadError) {
        console.error('[Submagic Webhook] Failed to upload to R2:', uploadError);
        r2VideoUrl = videoUrl;
      }

      // Update workflow with final video
      await updateWorkflowStatus(
        workflowId,
        brand,
        'posting',
        {
          submagicDownloadUrl: videoUrl,
          finalVideoUrl: r2VideoUrl || videoUrl,
          statusChangedAt: Date.now()
        }
      );

      // Trigger Late.dev posting
      try {
        const posted = await triggerLatePosting({
          workflowId,
          brand,
          videoUrl: r2VideoUrl || videoUrl,
          caption: workflow.caption,
          title: workflow.title
        });

        if (posted) {
          await updateWorkflowStatus(workflowId, brand, 'completed', {
            completedAt: Date.now(),
            statusChangedAt: Date.now()
          });
        } else {
          throw new Error('Late.dev posting failed');
        }
      } catch (postError) {
        console.error('[Submagic Webhook] Failed to post to Late.dev:', postError);
        await updateWorkflowStatus(workflowId, brand, 'failed', {
          error: `Posting failed: ${postError}`,
          statusChangedAt: Date.now()
        });
      }

      await markWebhookProcessed(idempotencyKey, 'submagic');
      
      return NextResponse.json({ 
        status: 'success',
        workflowId,
        brand,
        videoUrl: r2VideoUrl || videoUrl
      });
      
    } else if (status === 'failed') {
      console.error(`[Submagic Webhook] Processing failed for workflow ${workflowId}: ${error}`);
      
      // Mark workflow as failed
      await updateWorkflowStatus(
        workflowId,
        brand,
        'failed',
        {
          error: error || 'Submagic processing failed',
          statusChangedAt: Date.now()
        }
      );

      // For Submagic failures, we might want to skip and use the original video
      if (workflow.heygenVideoR2Url || workflow.synthesiaVideoUrl) {
        console.log(`[Submagic Webhook] Falling back to original video`);
        const originalVideo = workflow.heygenVideoR2Url || workflow.synthesiaVideoUrl;
        
        await updateWorkflowStatus(workflowId, brand, 'posting', {
          submagicSkipped: true,
          finalVideoUrl: originalVideo,
          error: `Submagic failed, using original video: ${error}`
        });

        // Try to post the original video
        try {
          await triggerLatePosting({
            workflowId,
            brand,
            videoUrl: originalVideo,
            caption: workflow.caption,
            title: workflow.title
          });
          
          await updateWorkflowStatus(workflowId, brand, 'completed', {
            completedAt: Date.now()
          });
        } catch (postError) {
          console.error('[Submagic Webhook] Failed to post original video:', postError);
        }
      }

      await markWebhookProcessed(idempotencyKey, 'submagic');
      
      return NextResponse.json({ 
        status: 'failed',
        workflowId,
        brand,
        error,
        fallback: !!workflow.heygenVideoR2Url || !!workflow.synthesiaVideoUrl
      });
      
    } else if (status === 'processing') {
      console.log(`[Submagic Webhook] Still processing for workflow ${workflowId}`);
      return NextResponse.json({ status: 'processing_acknowledged' });
    }

    return NextResponse.json({ status: 'ignored', reason: 'Unhandled status' });
    
  } catch (error) {
    console.error('[Submagic Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Submagic webhook endpoint' });
}