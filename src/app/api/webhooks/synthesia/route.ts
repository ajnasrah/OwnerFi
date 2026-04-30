import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { updateWorkflowStatus } from '@/lib/feed-store-firestore';
import { uploadVideoToR2 } from '@/lib/r2-upload';
import { validateWebhookSignature } from '@/lib/webhook-validation';
import { isWebhookProcessed, markWebhookProcessed, generateIdempotencyKey } from '@/lib/webhook-idempotency';
import { Brand } from '@/config/constants';

interface SynthesiaWebhookPayload {
  videoId: string;
  status: 'complete' | 'failed' | 'processing';
  download?: string;
  error?: string;
  duration?: number;
  createdAt?: string;
  callbackId?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Validate webhook signature
    const signature = req.headers.get('x-synthesia-signature');
    const webhookSecret = process.env.SYNTHESIA_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const body = await req.text();
      const isValid = await validateWebhookSignature(body, signature, webhookSecret, 'sha256');
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      req = new NextRequest(req.url, {
        ...req,
        body: body,
        headers: req.headers
      });
    }

    const payload: SynthesiaWebhookPayload = await req.json();
    
    // Check idempotency
    const idempotencyKey = generateIdempotencyKey('synthesia', `${payload.videoId}-${payload.status}`);
    
    if (await isWebhookProcessed(idempotencyKey)) {
      console.log(`[Synthesia Webhook] Duplicate webhook for video ${payload.videoId}, skipping`);
      return NextResponse.json({ status: 'duplicate_ignored' });
    }

    const { videoId, status, download, error, callbackId } = payload;

    console.log(`[Synthesia Webhook] Received status ${status} for video ${videoId}`);

    // Find the workflow
    let workflowDoc: any = null;
    let brand: Brand | null = null;

    const brands: Brand[] = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza', 'realtors'];
    
    for (const b of brands) {
      try {
        const collectionName = `${b}_workflow_queue`;
        const query = callbackId 
          ? db.collection(collectionName).where('workflowId', '==', callbackId).limit(1)
          : db.collection(collectionName).where('synthesiaVideoId', '==', videoId).limit(1);
        
        const snapshot = await query.get();
        if (!snapshot.empty) {
          workflowDoc = snapshot.docs[0];
          brand = b;
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!workflowDoc || !brand) {
      console.error(`[Synthesia Webhook] No workflow found for video ${videoId}`);
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflowId = workflowDoc.id;
    const workflowData = workflowDoc.data();

    // Handle different statuses
    if (status === 'complete' && download) {
      console.log(`[Synthesia Webhook] Video completed for workflow ${workflowId}`);
      
      // Upload to R2
      let r2VideoUrl: string | undefined;
      try {
        r2VideoUrl = await uploadVideoToR2(download, `synthesia/${brand}/${videoId}.mp4`);
        console.log(`[Synthesia Webhook] Video uploaded to R2: ${r2VideoUrl}`);
      } catch (uploadError) {
        console.error('[Synthesia Webhook] Failed to upload to R2:', uploadError);
        r2VideoUrl = download;
      }

      // Update workflow
      await updateWorkflowStatus(
        workflowId,
        brand,
        'submagic_processing',
        {
          synthesiaVideoUrl: r2VideoUrl || download,
          statusChangedAt: Date.now()
        }
      );

      // Trigger Submagic if configured
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
              videoUrl: r2VideoUrl || download,
              caption: workflowData.caption,
              title: workflowData.title
            })
          });

          if (!response.ok) {
            throw new Error(`Submagic submission failed: ${response.status}`);
          }
        } catch (err) {
          console.error('[Synthesia Webhook] Failed to trigger Submagic:', err);
          await updateWorkflowStatus(workflowId, brand, 'posting', {
            submagicSkipped: true,
            finalVideoUrl: r2VideoUrl || download
          });
        }
      } else {
        await updateWorkflowStatus(workflowId, brand, 'posting', {
          submagicSkipped: true,
          finalVideoUrl: r2VideoUrl || download
        });
      }

      await markWebhookProcessed(idempotencyKey, 'synthesia');
      
      return NextResponse.json({ 
        status: 'success',
        workflowId,
        brand
      });
      
    } else if (status === 'failed') {
      console.error(`[Synthesia Webhook] Video failed for workflow ${workflowId}: ${error}`);
      
      await updateWorkflowStatus(
        workflowId,
        brand,
        'video_processing_failed',
        {
          error: error || 'Synthesia processing failed',
          statusChangedAt: Date.now()
        }
      );

      // Trigger retry if under limit
      const retryCount = workflowData.retryCount || 0;
      if (retryCount < 3) {
        console.log(`[Synthesia Webhook] Scheduling retry ${retryCount + 1}`);
        await db.collection(`${brand}_workflow_queue`).doc(workflowId).update({
          status: 'pending',
          retryCount: retryCount + 1,
          lastRetryAt: Date.now(),
          error: `Retry after Synthesia failure: ${error}`
        });
      }

      await markWebhookProcessed(idempotencyKey, 'synthesia');
      
      return NextResponse.json({ 
        status: 'failed',
        workflowId,
        brand,
        error
      });
      
    } else if (status === 'processing') {
      // Just acknowledge, no action needed
      console.log(`[Synthesia Webhook] Video still processing for workflow ${workflowId}`);
      return NextResponse.json({ status: 'processing_acknowledged' });
    }

    return NextResponse.json({ status: 'ignored', reason: 'Unhandled status' });
    
  } catch (error) {
    console.error('[Synthesia Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Synthesia webhook endpoint' });
}