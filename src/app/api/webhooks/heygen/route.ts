import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { updateWorkflowStatus } from '@/lib/feed-store-firestore';
import { uploadVideoToR2 } from '@/lib/r2-upload';
import { validateWebhookSignature } from '@/lib/webhook-validation';
import { isWebhookProcessed, markWebhookProcessed, generateIdempotencyKey } from '@/lib/webhook-idempotency';
import { Brand } from '@/config/constants';

interface HeyGenWebhookPayload {
  event_type: 'avatar_video.success' | 'avatar_video.failure';
  event_data: {
    video_id: string;
    status: 'completed' | 'failed';
    video_url?: string;
    error?: string;
    duration?: number;
    callback_id?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Validate webhook signature if secret is configured
    const signature = req.headers.get('x-heygen-signature');
    const webhookSecret = process.env.HEYGEN_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const body = await req.text();
      const isValid = await validateWebhookSignature(body, signature, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      req = new NextRequest(req.url, {
        ...req,
        body: body,
        headers: req.headers
      });
    }

    const payload: HeyGenWebhookPayload = await req.json();
    
    // Check idempotency to prevent duplicate processing
    const idempotencyKey = generateIdempotencyKey('heygen', payload.event_data.video_id);
    
    if (await isWebhookProcessed(idempotencyKey)) {
      console.log(`[HeyGen Webhook] Duplicate webhook for video ${payload.event_data.video_id}, skipping`);
      return NextResponse.json({ status: 'duplicate_ignored' });
    }

    const { event_type, event_data } = payload;
    const { video_id, status, video_url, error, callback_id } = event_data;

    console.log(`[HeyGen Webhook] Received ${event_type} for video ${video_id}`);

    // Find the workflow by HeyGen video ID or callback ID
    let workflowDoc: any = null;
    let brand: Brand | null = null;

    // Check all brand workflow collections
    const brands: Brand[] = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza', 'realtors'];
    
    for (const b of brands) {
      try {
        const collectionName = `${b}_workflow_queue`;
        const query = callback_id 
          ? db.collection(collectionName).where('workflowId', '==', callback_id).limit(1)
          : db.collection(collectionName).where('heygenVideoId', '==', video_id).limit(1);
        
        const snapshot = await query.get();
        if (!snapshot.empty) {
          workflowDoc = snapshot.docs[0];
          brand = b;
          break;
        }
      } catch (err) {
        // Collection might not exist for this brand
        continue;
      }
    }

    if (!workflowDoc || !brand) {
      console.error(`[HeyGen Webhook] No workflow found for video ${video_id}`);
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflowId = workflowDoc.id;
    const workflowData = workflowDoc.data();

    if (event_type === 'avatar_video.success' && video_url) {
      console.log(`[HeyGen Webhook] Video completed successfully for workflow ${workflowId}`);
      
      // Upload video to R2 for permanent storage
      let r2VideoUrl: string | undefined;
      try {
        r2VideoUrl = await uploadVideoToR2(video_url, `heygen/${brand}/${video_id}.mp4`);
        console.log(`[HeyGen Webhook] Video uploaded to R2: ${r2VideoUrl}`);
      } catch (uploadError) {
        console.error('[HeyGen Webhook] Failed to upload to R2:', uploadError);
        // Continue with original URL if upload fails
        r2VideoUrl = video_url;
      }

      // Update workflow status
      await updateWorkflowStatus(
        workflowId,
        brand,
        'submagic_processing', // Next step in pipeline
        {
          heygenVideoUrl: video_url,
          heygenVideoR2Url: r2VideoUrl,
          statusChangedAt: Date.now()
        }
      );

      // Trigger next step (Submagic processing) if configured
      if (process.env.SUBMAGIC_API_KEY) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/video/submagic/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
            },
            body: JSON.stringify({
              workflowId,
              brand,
              videoUrl: r2VideoUrl || video_url,
              caption: workflowData.caption,
              title: workflowData.title
            })
          });

          if (!response.ok) {
            throw new Error(`Submagic submission failed: ${response.status}`);
          }
        } catch (err) {
          console.error('[HeyGen Webhook] Failed to trigger Submagic:', err);
          // Update status to skip Submagic
          await updateWorkflowStatus(workflowId, brand, 'posting', {
            submagicSkipped: true,
            finalVideoUrl: r2VideoUrl || video_url
          });
        }
      } else {
        // No Submagic configured, skip to posting
        await updateWorkflowStatus(workflowId, brand, 'posting', {
          submagicSkipped: true,
          finalVideoUrl: r2VideoUrl || video_url
        });
      }

      // Mark idempotency key as processed
      await markWebhookProcessed(idempotencyKey, 'heygen');
      
      return NextResponse.json({ 
        status: 'success',
        workflowId,
        brand
      });
      
    } else if (event_type === 'avatar_video.failure') {
      console.error(`[HeyGen Webhook] Video failed for workflow ${workflowId}: ${error}`);
      
      // Update workflow as failed
      await updateWorkflowStatus(
        workflowId,
        brand,
        'video_processing_failed',
        {
          error: error || 'HeyGen processing failed',
          statusChangedAt: Date.now()
        }
      );

      // Trigger retry if under retry limit
      const retryCount = workflowData.retryCount || 0;
      if (retryCount < 3) {
        console.log(`[HeyGen Webhook] Scheduling retry ${retryCount + 1} for workflow ${workflowId}`);
        // Queue for retry
        await db.collection(`${brand}_workflow_queue`).doc(workflowId).update({
          status: 'pending',
          retryCount: retryCount + 1,
          lastRetryAt: Date.now(),
          error: `Retry after HeyGen failure: ${error}`
        });
      }

      // Mark idempotency key as processed
      await markWebhookProcessed(idempotencyKey, 'heygen');
      
      return NextResponse.json({ 
        status: 'failed',
        workflowId,
        brand,
        error
      });
    }

    return NextResponse.json({ status: 'ignored', reason: 'Unhandled event type' });
    
  } catch (error) {
    console.error('[HeyGen Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Handle webhook verification
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('challenge');
  if (challenge) {
    // HeyGen webhook verification
    return new Response(challenge, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({ status: 'HeyGen webhook endpoint' });
}