/**
 * Admin API: Recover Stuck Submagic Workflows
 *
 * Manually check Submagic status for stuck workflows and trigger webhooks
 * GET /api/admin/recover-stuck-submagic?brand=benefit&limit=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log(`🔧 Recovering stuck Submagic workflows for ${brand}...`);

    const adminDb = await getAdminDb();
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin not initialized'
      }, { status: 500 });
    }

    const collections: Record<string, string> = {
      benefit: 'benefit_workflow_queue',
      property: 'propertyShowcaseWorkflows',
      'property-spanish': 'propertyShowcaseWorkflows',
      carz: 'carz_workflow_queue',
      ownerfi: 'ownerfi_workflow_queue',
      podcast: 'podcast_workflow_queue',
      vassdistro: 'vassdistro_workflow_queue',
      abdullah: 'abdullah_workflow_queue'
    };

    const brandsToCheck = brand === 'all' ? Object.keys(collections) : [brand];
    const results: any[] = [];

    for (const brandName of brandsToCheck) {
      const collection = collections[brandName];
      if (!collection) continue;

      console.log(`\n📋 Checking ${brandName}...`);

      const snapshot = await adminDb.collection(collection)
        .where('status', '==', 'submagic_processing')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      console.log(`   Found ${snapshot.size} stuck workflows`);

      for (const doc of snapshot.docs) {
        const workflow = doc.data();
        const workflowId = doc.id;
        const submagicId = workflow.submagicVideoId;

        if (!submagicId) {
          results.push({
            brand: brandName,
            workflowId,
            status: 'skipped',
            reason: 'No Submagic ID'
          });
          continue;
        }

        try {
          // Check Submagic status
          const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
            headers: {
              'x-api-key': SUBMAGIC_API_KEY!,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            results.push({
              brand: brandName,
              workflowId,
              submagicId,
              status: 'error',
              error: `Submagic API error: ${response.status}`
            });
            continue;
          }

          const submagicData = await response.json();
          const submagicStatus = submagicData.status;

          if (submagicStatus === 'completed' || submagicStatus === 'done' || submagicStatus === 'ready') {
            const videoUrl = submagicData.media_url || submagicData.mediaUrl || submagicData.video_url || submagicData.videoUrl || submagicData.downloadUrl || submagicData.download_url;

            if (videoUrl) {
              // Trigger webhook manually
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
              const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic/${brandName}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  projectId: submagicId,
                  id: submagicId,
                  status: 'completed',
                  media_url: videoUrl,
                  downloadUrl: videoUrl
                })
              });

              results.push({
                brand: brandName,
                workflowId,
                submagicId,
                status: webhookResponse.ok ? 'recovered' : 'webhook_failed',
                videoUrl: videoUrl.substring(0, 60) + '...',
                webhookStatus: webhookResponse.status
              });
            } else {
              results.push({
                brand: brandName,
                workflowId,
                submagicId,
                status: 'no_video_url',
                submagicStatus
              });
            }
          } else {
            results.push({
              brand: brandName,
              workflowId,
              submagicId,
              status: 'still_processing',
              submagicStatus
            });
          }

          // Rate limit: wait 1 second between checks
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          results.push({
            brand: brandName,
            workflowId,
            submagicId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    const recovered = results.filter(r => r.status === 'recovered').length;
    const stillProcessing = results.filter(r => r.status === 'still_processing').length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        recovered,
        stillProcessing,
        errors
      },
      results
    });

  } catch (error) {
    console.error('Recovery error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
