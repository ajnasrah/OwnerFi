// Failsafe: Check workflows stuck in 'posting' or 'publishing' status
// These are workflows where Submagic completed but Late API posting failed/timed out

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

    console.log('🔍 [FAILSAFE-POSTING] Checking workflows stuck in posting/publishing...');

    const { db } = await import('@/lib/firebase');
    const { collection, getDocs, query, where, or } = await import('firebase/firestore');
    const { getCollectionName } = await import('@/lib/feed-store-firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const stuckWorkflows = [];

    // Check Carz, OwnerFi, and Benefit workflows stuck in 'posting'
    for (const brand of ['carz', 'ownerfi', 'benefit'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'posting')
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} workflows in 'posting'`);

        snapshot.forEach(doc => {
          const data = doc.data();
          const updatedAt = data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - updatedAt) / 60000);

          console.log(`   📄 Workflow ${doc.id}: stuck for ${stuckMinutes} min`);

          // Only retry if stuck > 10 minutes (allows for normal processing time)
          if (stuckMinutes > 10) {
            stuckWorkflows.push({
              workflowId: doc.id,
              brand,
              isPodcast: false,
              workflow: data,
              stuckMinutes
            });
          }
        });
      } catch (err) {
        console.error(`   ❌ Error querying ${collectionName}:`, err);
      }
    }

    // Check Podcast workflows stuck in 'publishing'
    console.log(`\n📂 Checking podcast_workflow_queue...`);
    try {
      const q = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'publishing')
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} podcasts in 'publishing'`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const updatedAt = data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - updatedAt) / 60000);

        console.log(`   📄 Podcast ${doc.id}: stuck for ${stuckMinutes} min`);

        if (stuckMinutes > 10) {
          stuckWorkflows.push({
            workflowId: doc.id,
            brand: 'podcast',
            isPodcast: true,
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

    // Retry posting for each stuck workflow
    for (const item of stuckWorkflows) {
      const { workflowId, brand, isPodcast, workflow, stuckMinutes } = item;

      console.log(`\n🔄 Retrying ${isPodcast ? 'podcast' : 'workflow'} ${workflowId} (stuck ${stuckMinutes} min)`);

      try {
        // Check if we have the video URL
        const videoUrl = workflow.finalVideoUrl;
        if (!videoUrl) {
          console.error(`   ❌ No finalVideoUrl found for workflow ${workflowId}`);
          results.push({
            workflowId,
            brand,
            action: 'failed',
            error: 'No video URL found'
          });
          continue;
        }

        console.log(`   📱 Retrying Late API posting...`);
        const { postToLate } = await import('@/lib/late-api');
        const { getBrandPlatforms } = await import('@/lib/brand-utils');

        // Get platforms for brand
        const platforms = getBrandPlatforms(brand as any, false) as any[];

        // Prepare caption and title
        let caption: string;
        let title: string;

        if (isPodcast) {
          caption = workflow.episodeTitle || 'New Podcast Episode';
          title = `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`;
        } else if (brand === 'benefit') {
          caption = workflow.caption || 'Learn about owner financing! 🏡';
          title = workflow.title || 'Owner Finance Benefits';
        } else {
          caption = workflow.caption || 'Check out this video! 🔥';
          title = workflow.title || 'Viral Video';
        }

        // Retry posting
        const postResult = await postToLate({
          videoUrl,
          caption,
          title,
          platforms,
          useQueue: true,
          brand: brand as any
        });

        if (postResult.success) {
          console.log(`   ✅ Successfully posted! Post ID: ${postResult.postId}`);

          // Mark as completed
          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, {
              status: 'completed',
              latePostId: postResult.postId,
              completedAt: Date.now()
            });
          } else if (brand === 'benefit') {
            const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
            await updateBenefitWorkflow(workflowId, {
              status: 'completed',
              latePostId: postResult.postId,
              completedAt: Date.now()
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand as any, {
              status: 'completed',
              latePostId: postResult.postId,
              completedAt: Date.now()
            });
          }

          results.push({
            workflowId,
            brand,
            isPodcast,
            action: 'completed',
            postId: postResult.postId,
            stuckMinutes
          });
        } else {
          console.error(`   ❌ Late API failed: ${postResult.error}`);

          // Mark as failed if stuck > 60 minutes
          if (stuckMinutes > 60) {
            console.log(`   ❌ Marking as failed (stuck > 60 min)`);

            if (isPodcast) {
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'failed',
                error: `Late API posting failed: ${postResult.error}`
              });
            } else if (brand === 'benefit') {
              const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
              await updateBenefitWorkflow(workflowId, {
                status: 'failed',
                error: `Late API posting failed: ${postResult.error}`
              });
            } else {
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand as any, {
                status: 'failed',
                error: `Late API posting failed: ${postResult.error}`
              });
            }

            results.push({
              workflowId,
              brand,
              action: 'marked_failed',
              error: postResult.error,
              stuckMinutes
            });
          } else {
            results.push({
              workflowId,
              brand,
              action: 'retry_failed',
              error: postResult.error,
              stuckMinutes
            });
          }
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
    const failedCount = results.filter(r => r.action === 'marked_failed').length;

    console.log(`\n✅ [FAILSAFE-POSTING] Processed ${stuckWorkflows.length} workflows (${completedCount} completed, ${failedCount} failed)`);

    // Log metrics
    console.log(JSON.stringify({
      event: 'failsafe_posting_check',
      timestamp: new Date().toISOString(),
      found: stuckWorkflows.length,
      completed: completedCount,
      failed: failedCount,
      utilization: stuckWorkflows.length > 0 ? 'ACTIVE' : 'IDLE'
    }));

    return NextResponse.json({
      success: true,
      totalWorkflows: stuckWorkflows.length,
      completed: completedCount,
      failed: failedCount,
      results
    });

  } catch (error) {
    console.error('❌ [FAILSAFE-POSTING] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
