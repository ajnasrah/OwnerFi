// Failsafe: Check workflows stuck in 'video_processing' status
// These workflows have the Submagic video URL saved but haven't been uploaded to R2 yet

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 [FAILSAFE-VIDEO-PROCESSING] Checking workflows stuck in video_processing...');

    const { db } = await import('@/lib/firebase');
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const { getCollectionName } = await import('@/lib/feed-store-firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const stuckWorkflows = [];

    // Check all brands for workflows stuck in 'video_processing'
    for (const brand of ['carz', 'ownerfi', 'vassdistro', 'benefit'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'video_processing')
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} workflows in 'video_processing'`);

        snapshot.forEach(doc => {
          const data = doc.data();
          // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
          const timestamp = data.statusChangedAt || data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

          console.log(`   📄 Workflow ${doc.id}: stuck for ${stuckMinutes} min`);

          // Only retry if stuck > 5 minutes (allows for normal processing time)
          if (stuckMinutes > 5) {
            stuckWorkflows.push({
              workflowId: doc.id,
              brand,
              workflow: data,
              stuckMinutes
            });
          }
        });
      } catch (err) {
        console.error(`   ❌ Error querying ${collectionName}:`, err);
      }
    }

    // Check Podcast workflows
    console.log(`\n📂 Checking podcast_workflow_queue...`);
    try {
      const q = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'video_processing')
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} podcasts in 'video_processing'`);

      snapshot.forEach(doc => {
        const data = doc.data();
        // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
        const timestamp = data.statusChangedAt || data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Podcast ${doc.id}: stuck for ${stuckMinutes} min`);

        if (stuckMinutes > 5) {
          stuckWorkflows.push({
            workflowId: doc.id,
            brand: 'podcast',
            workflow: data,
            stuckMinutes
          });
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying podcast_workflow_queue:`, err);
    }

    console.log(`\n📋 Found ${stuckWorkflows.length} stuck workflows to retry`);

    const results = [];
    const MAX_WORKFLOWS_PER_RUN = 10; // Process max 10 workflows per cron run

    // Limit processing to prevent timeouts
    const workflowsToProcess = stuckWorkflows.slice(0, MAX_WORKFLOWS_PER_RUN);
    const skippedCount = stuckWorkflows.length - workflowsToProcess.length;

    if (skippedCount > 0) {
      console.log(`\n⚠️  Limiting to ${MAX_WORKFLOWS_PER_RUN} workflows (${skippedCount} will be processed in next run)`);
    }

    // Retry video processing for each stuck workflow
    for (const item of workflowsToProcess) {
      const { workflowId, brand, workflow, stuckMinutes } = item;

      console.log(`\n🔄 Retrying workflow ${workflowId} (stuck ${stuckMinutes} min)`);

      try {
        // Check if we have the Submagic download URL
        const videoUrl = workflow.submagicDownloadUrl;
        if (!videoUrl) {
          console.error(`   ❌ No submagicDownloadUrl found for workflow ${workflowId}`);
          results.push({
            workflowId,
            brand,
            action: 'failed',
            error: 'No Submagic download URL found'
          });
          continue;
        }

        console.log(`   📱 Triggering video processing...`);

        // Trigger the async processing endpoint
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
        const response = await fetch(`${baseUrl}/api/process-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand,
            workflowId,
            videoUrl
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log(`   ✅ Successfully processed! Post ID: ${result.postId}`);
          results.push({
            workflowId,
            brand,
            action: 'completed',
            postId: result.postId,
            stuckMinutes
          });
        } else {
          console.error(`   ❌ Processing failed: ${result.error}`);
          results.push({
            workflowId,
            brand,
            action: 'retry_failed',
            error: result.error,
            stuckMinutes
          });
        }

      } catch (error) {
        console.error(`   ❌ Error retrying workflow:`, error);
        results.push({
          workflowId,
          brand,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          stuckMinutes
        });
      }
    }

    const completedCount = results.filter(r => r.action === 'completed').length;
    const failedCount = results.filter(r => r.action === 'failed').length;

    console.log(`\n✅ [FAILSAFE-VIDEO-PROCESSING] Processed ${stuckWorkflows.length} workflows (${completedCount} completed, ${failedCount} failed)`);

    return NextResponse.json({
      success: true,
      totalWorkflows: stuckWorkflows.length,
      completed: completedCount,
      failed: failedCount,
      results
    });

  } catch (error) {
    console.error('❌ [FAILSAFE-VIDEO-PROCESSING] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
