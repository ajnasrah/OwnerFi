import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { uploadVideoToR2 } from '@/lib/r2-upload';
import { isWebhookProcessed, markWebhookProcessed } from '@/lib/webhook-idempotency';
import { triggerLatePosting } from '@/lib/social-posting';

interface CreatifyWebhookPayload {
  id: string;
  status: 'success' | 'failed';
  output_url?: string;
  error?: string;
  callback_data?: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload: CreatifyWebhookPayload = await req.json();
    
    // Check idempotency
    const { processed } = await isWebhookProcessed('creatify', `${payload.id}-${payload.status}`, undefined, payload);
    
    if (processed) {
      console.log(`[Creatify Webhook] Duplicate webhook for render ${payload.id}, skipping`);
      return NextResponse.json({ status: 'duplicate_ignored' });
    }

    const { id, status, output_url, error, callback_data } = payload;

    console.log(`[Creatify Webhook] Received status ${status} for render ${id}`);

    // Parse callback data to get context
    let context: any = {};
    if (callback_data) {
      try {
        context = JSON.parse(callback_data);
      } catch (e) {
        console.error('[Creatify Webhook] Failed to parse callback data:', e);
      }
    }

    // For daily videos, we don't use workflows, so handle differently
    if (context.type === 'daily_video' || context.type === 'trending_video') {
      if (status === 'success' && output_url) {
        console.log(`[Creatify Webhook] Daily/Trending video completed: ${output_url}`);
        
        // Upload to R2
        let r2VideoUrl: string | undefined;
        try {
          const key = `creatify/${context.brand || 'ownerfi'}/${id}.mp4`;
          r2VideoUrl = await uploadVideoToR2(output_url, key);
          console.log(`[Creatify Webhook] Video uploaded to R2: ${r2VideoUrl}`);
        } catch (uploadError) {
          console.error('[Creatify Webhook] Failed to upload to R2:', uploadError);
          r2VideoUrl = output_url;
        }

        // Trigger Late posting directly
        if (context.caption) {
          try {
            await triggerLatePosting({
              workflowId: id,
              brand: context.brand || 'ownerfi',
              videoUrl: r2VideoUrl || output_url,
              caption: context.caption,
              title: context.title
            });
            console.log('[Creatify Webhook] Posted to Late.dev successfully');
          } catch (postError) {
            console.error('[Creatify Webhook] Failed to post to Late.dev:', postError);
          }
        }

        await markWebhookProcessed('creatify', `${payload.id}-${payload.status}`);
        
        return NextResponse.json({ 
          status: 'success',
          renderId: id,
          videoUrl: r2VideoUrl || output_url
        });
      } else if (status === 'failed') {
        console.error(`[Creatify Webhook] Render failed: ${error}`);
        await markWebhookProcessed('creatify', `${payload.id}-${payload.status}`);
        return NextResponse.json({ 
          status: 'failed',
          renderId: id,
          error
        });
      }
    }

    // For workflow-based videos (future implementation)
    if (context.workflowId && context.brand) {
      const collectionName = `${context.brand}_workflow_queue`;
      const workflowDoc = await db.collection(collectionName).doc(context.workflowId).get();
      
      if (!workflowDoc.exists) {
        console.error(`[Creatify Webhook] Workflow ${context.workflowId} not found`);
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      if (status === 'success' && output_url) {
        // Upload to R2
        let r2VideoUrl: string | undefined;
        try {
          r2VideoUrl = await uploadVideoToR2(output_url, `creatify/${context.brand}/${id}.mp4`);
        } catch (uploadError) {
          console.error('[Creatify Webhook] Failed to upload to R2:', uploadError);
          r2VideoUrl = output_url;
        }

        // Update workflow
        await db.collection(collectionName).doc(context.workflowId).update({
          status: 'completed',
          finalVideoUrl: r2VideoUrl || output_url,
          completedAt: Date.now(),
          statusChangedAt: Date.now()
        });

        // Post to social media
        const workflowData = workflowDoc.data();
        if (workflowData?.caption) {
          try {
            await triggerLatePosting({
              workflowId: context.workflowId,
              brand: context.brand,
              videoUrl: r2VideoUrl || output_url,
              caption: workflowData.caption,
              title: workflowData.title
            });
          } catch (postError) {
            console.error('[Creatify Webhook] Failed to post:', postError);
          }
        }

        await markWebhookProcessed('creatify', `${payload.id}-${payload.status}`);
        return NextResponse.json({ 
          status: 'success',
          workflowId: context.workflowId,
          videoUrl: r2VideoUrl || output_url
        });
        
      } else if (status === 'failed') {
        await db.collection(collectionName).doc(context.workflowId).update({
          status: 'failed',
          error: error || 'Creatify render failed',
          statusChangedAt: Date.now()
        });

        await markWebhookProcessed('creatify', `${payload.id}-${payload.status}`);
        return NextResponse.json({ 
          status: 'failed',
          workflowId: context.workflowId,
          error
        });
      }
    }

    return NextResponse.json({ status: 'ignored', reason: 'Missing context or unhandled status' });
    
  } catch (error) {
    console.error('[Creatify Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Creatify webhook endpoint' });
}