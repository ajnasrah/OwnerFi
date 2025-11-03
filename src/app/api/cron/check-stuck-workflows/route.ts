/**
 * Cron Job: Check Stuck HeyGen Workflows
 *
 * This cron job runs every 5 minutes to check for workflows stuck at "heygen_processing"
 * and manually polls HeyGen to see if they've completed. If completed, it manually
 * triggers the webhook handler logic.
 *
 * This is a FALLBACK mechanism in case HeyGen webhooks fail to fire.
 *
 * Schedule: *//*5 * * * * (every 5 minutes)
 * Auth: CRON_SECRET header required
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHeyGenVideoStatus } from '@/lib/heygen-client';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 [CRON] Checking for stuck HeyGen workflows...');

  try {
    const results = {
      checked: 0,
      recovered: 0,
      failed: 0,
      stillProcessing: 0,
      errors: [] as string[],
    };

    // Get all workflows stuck at heygen_processing for more than 15 minutes
    const { db } = await import('@/lib/firebase');
    const { collection, query, where, getDocs, Timestamp } = await import('firebase/firestore');

    const brands = ['carz', 'ownerfi', 'vassdistro'] as const;
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);

    for (const brand of brands) {
      const collectionName = `${brand}_workflow_queue`;

      try {
        // Find workflows stuck at heygen_processing for > 15 minutes
        const stuckWorkflowsQuery = query(
          collection(db, collectionName),
          where('status', '==', 'heygen_processing'),
          where('statusChangedAt', '<', fifteenMinutesAgo)
        );

        const snapshot = await getDocs(stuckWorkflowsQuery);

        console.log(`   [${brand}] Found ${snapshot.size} stuck workflows`);

        for (const docSnap of snapshot.docs) {
          const workflow = docSnap.data();
          const workflowId = docSnap.id;
          const heygenVideoId = workflow.heygenVideoId;

          if (!heygenVideoId) {
            console.warn(`   ⚠️  Workflow ${workflowId} has no heygenVideoId`);
            results.errors.push(`${brand}:${workflowId} - no heygenVideoId`);
            continue;
          }

          results.checked++;

          try {
            // Check HeyGen video status
            const statusData = await getHeyGenVideoStatus(heygenVideoId);
            const videoStatus = statusData.data?.status;
            const videoUrl = statusData.data?.video_url;

            console.log(`   📹 Workflow ${workflowId} - HeyGen status: ${videoStatus}`);

            if (videoStatus === 'completed' && videoUrl) {
              // Video completed but webhook wasn't called - manually trigger webhook logic
              console.log(`   ✅ Recovering stuck workflow ${workflowId}`);

              // Manually trigger Submagic processing
              const { getBrandConfig } = await import('@/config/brand-configs');
              const brandConfig = getBrandConfig(brand);

              // Import the triggerSubmagicProcessing function from webhook handler
              // Instead of duplicating code, we'll update the workflow and let Submagic webhook handle it
              const { updateWorkflowForBrand } = await import('@/lib/feed-store-firestore');

              // Trigger Submagic processing by calling internal API
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

              const response = await fetch(`${baseUrl}/api/internal/trigger-submagic`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-internal-secret': process.env.INTERNAL_API_SECRET || CRON_SECRET || '',
                },
                body: JSON.stringify({
                  brand,
                  workflowId,
                  heygenVideoUrl: videoUrl,
                  workflow,
                }),
              });

              if (response.ok) {
                console.log(`   ✅ Successfully triggered Submagic for ${workflowId}`);
                results.recovered++;
              } else {
                const errorText = await response.text();
                console.error(`   ❌ Failed to trigger Submagic: ${errorText}`);
                results.errors.push(`${brand}:${workflowId} - Submagic trigger failed`);
              }

            } else if (videoStatus === 'failed') {
              // Mark workflow as failed
              console.log(`   ❌ HeyGen video failed for ${workflowId}`);

              const { doc, updateDoc } = await import('firebase/firestore');
              await updateDoc(doc(db, collectionName, workflowId), {
                status: 'failed',
                error: 'HeyGen video generation failed',
                failedAt: Date.now(),
              });

              results.failed++;

            } else if (videoStatus === 'processing') {
              console.log(`   ⏳ Still processing: ${workflowId}`);
              results.stillProcessing++;
            }

          } catch (err) {
            console.error(`   ❌ Error checking workflow ${workflowId}:`, err);
            results.errors.push(`${brand}:${workflowId} - ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }

      } catch (brandError) {
        console.error(`   ❌ Error processing brand ${brand}:`, brandError);
        results.errors.push(`${brand} - ${brandError instanceof Error ? brandError.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ [CRON] Stuck workflow check complete:`);
    console.log(`   Checked: ${results.checked}`);
    console.log(`   Recovered: ${results.recovered}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Still Processing: ${results.stillProcessing}`);
    console.log(`   Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('❌ [CRON] Error in stuck workflow check:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
