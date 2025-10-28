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

    // Check all brand workflows stuck in 'posting' OR 'video_processing'
    for (const brand of ['carz', 'ownerfi', 'vassdistro', 'benefit'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const qPosting = query(
          collection(db, collectionName),
          where('status', '==', 'posting')
        );
        const qProcessing = query(
          collection(db, collectionName),
          where('status', '==', 'video_processing')
        );

        const [postingSnapshot, processingSnapshot] = await Promise.all([
          getDocs(qPosting),
          getDocs(qProcessing)
        ]);

        console.log(`   Found ${postingSnapshot.size} in 'posting', ${processingSnapshot.size} in 'video_processing'`);

        // Process both status types
        [...postingSnapshot.docs, ...processingSnapshot.docs].forEach(doc => {
          const data = doc.data();
          // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
          const timestamp = data.statusChangedAt || data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

          console.log(`   📄 Workflow ${doc.id}: ${data.status} for ${stuckMinutes} min`);

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

    // Check Podcast workflows stuck in 'publishing' OR 'video_processing'
    console.log(`\n📂 Checking podcast_workflow_queue...`);
    try {
      const qPublishing = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'publishing')
      );
      const qProcessing = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'video_processing')
      );

      const [publishingSnapshot, processingSnapshot] = await Promise.all([
        getDocs(qPublishing),
        getDocs(qProcessing)
      ]);

      console.log(`   Found ${publishingSnapshot.size} in 'publishing', ${processingSnapshot.size} in 'video_processing'`);

      // Process both status types
      [...publishingSnapshot.docs, ...processingSnapshot.docs].forEach(doc => {
        const data = doc.data();
        // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
        const timestamp = data.statusChangedAt || data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Podcast ${doc.id}: ${data.status} for ${stuckMinutes} min`);

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

    // Check Property videos stuck in 'posting' OR 'video_processing'
    // Properties use nested workflowStatus.stage field in properties collection
    console.log(`\n📂 Checking properties...`);
    try {
      const qPosting = query(
        collection(db, 'properties'),
        where('workflowStatus.stage', '==', 'Posting')
      );

      const postingSnapshot = await getDocs(qPosting);

      console.log(`   Found ${postingSnapshot.size} in 'Posting'`);

      // Process properties stuck in Posting stage
      postingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Use workflowStatus.lastUpdated for properties
        const timestamp = data.workflowStatus?.lastUpdated || data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Property ${doc.id}: ${data.address} - Posting for ${stuckMinutes} min`);

        if (stuckMinutes > 10) {
          stuckWorkflows.push({
            workflowId: doc.id,
            brand: 'property',
            isProperty: true,
            workflow: {
              ...data,
              // Map workflowStatus to flat structure for consistency with processing logic
              status: 'posting',
              submagicProjectId: data.workflowStatus?.submagicVideoId,
              finalVideoUrl: data.workflowStatus?.finalVideoUrl,
              submagicDownloadUrl: data.workflowStatus?.submagicDownloadUrl,
              heygenVideoId: data.workflowStatus?.heygenVideoId,
              caption: `${data.address}, ${data.city}, ${data.state} • Down: $${data.downPayment?.toLocaleString()} • Monthly: $${data.monthlyPayment?.toLocaleString()} 🏡`,
              title: `${data.address} - Owner Finance Property`
            },
            stuckMinutes
          });
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying properties:`, err);
    }

    console.log(`\n📋 Found ${stuckWorkflows.length} stuck workflows to retry`);

    const results = [];
    const MAX_RETRIES = 3;
    const MAX_WORKFLOWS_PER_RUN = 10; // Process max 10 workflows per cron run

    // Limit processing to prevent timeouts
    const workflowsToProcess = stuckWorkflows.slice(0, MAX_WORKFLOWS_PER_RUN);
    const skippedCount = stuckWorkflows.length - workflowsToProcess.length;

    if (skippedCount > 0) {
      console.log(`\n⚠️  Limiting to ${MAX_WORKFLOWS_PER_RUN} workflows (${skippedCount} will be processed in next run)`);
    }

    // Retry posting for each stuck workflow
    for (const item of workflowsToProcess) {
      const { workflowId, brand, isPodcast, isProperty, workflow, stuckMinutes } = item as any;
      const retryCount = workflow?.retryCount || 0;

      // Check if max retries exceeded
      if (retryCount >= MAX_RETRIES) {
        console.log(`\n⚠️  Workflow ${workflowId} exceeded max retries (${retryCount}/${MAX_RETRIES}), marking as failed`);

        try {
          const updates = {
            status: 'failed' as const,
            error: `Max retry attempts (${MAX_RETRIES}) exceeded for posting`,
            failedAt: Date.now()
          };

          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, updates);
          } else if (brand === 'benefit') {
            const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
            await updateBenefitWorkflow(workflowId, updates);
          } else if (brand === 'property' || isProperty) {
            // Properties use nested workflowStatus structure
            const { updateDoc, doc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'properties', workflowId), {
              'workflowStatus.stage': 'Failed',
              'workflowStatus.error': `Max retry attempts (${MAX_RETRIES}) exceeded for posting`,
              'workflowStatus.lastUpdated': Date.now()
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand as any, updates);
          }

          results.push({
            workflowId,
            brand,
            action: 'max_retries_exceeded',
            retryCount
          });
        } catch (err) {
          console.error(`   ❌ Error marking as failed:`, err);
        }
        continue;
      }

      console.log(`\n🔄 Retrying ${isPodcast ? 'podcast' : 'workflow'} ${workflowId} (stuck ${stuckMinutes} min, attempt ${retryCount + 1}/${MAX_RETRIES})`);

      try {
        // If workflow is in 'video_processing' status, trigger the video processing endpoint
        if (workflow.status === 'video_processing') {
          console.log(`   🎬 Workflow stuck in video_processing, triggering process-video endpoint...`);

          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
          const videoUrl = workflow.submagicDownloadUrl;
          const submagicProjectId = workflow.submagicProjectId;

          if (!videoUrl && !submagicProjectId) {
            console.error(`   ❌ No submagicDownloadUrl or submagicProjectId found`);
            results.push({
              workflowId,
              brand,
              action: 'failed',
              error: 'No Submagic video URL or project ID found'
            });
            continue;
          }

          try {
            const response = await fetch(`${baseUrl}/api/process-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                brand,
                workflowId,
                videoUrl,
                submagicProjectId
              })
            });

            const result = await response.json();

            if (result.success) {
              console.log(`   ✅ Video processing completed! Post ID: ${result.postId}`);
              results.push({
                workflowId,
                brand,
                action: 'completed',
                postId: result.postId,
                stuckMinutes
              });
            } else {
              throw new Error(result.error || 'Video processing failed');
            }
          } catch (error) {
            console.error(`   ❌ Video processing failed:`, error);
            results.push({
              workflowId,
              brand,
              action: 'retry_failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              stuckMinutes
            });
          }
          continue;
        }

        // Check if we have the video URL (for 'posting' status)
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
        } else if (brand === 'property' || isProperty) {
          caption = workflow.caption || 'New owner finance property for sale! 🏡';
          title = workflow.title || 'Property For Sale';
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

          // Mark as completed with retry info
          const completionUpdates = {
            status: 'completed' as const,
            latePostId: postResult.postId,
            completedAt: Date.now(),
            retryCount: retryCount + 1,
            lastRetryAt: Date.now()
          };

          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, completionUpdates);
          } else if (brand === 'benefit') {
            const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
            await updateBenefitWorkflow(workflowId, completionUpdates);
          } else if (brand === 'property' || isProperty) {
            // Properties use nested workflowStatus structure
            const { updateDoc, doc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'properties', workflowId), {
              'workflowStatus.stage': 'Completed',
              'workflowStatus.latePostId': postResult.postId,
              'workflowStatus.lastUpdated': Date.now(),
              'workflowStatus.completedAt': Date.now()
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand as any, completionUpdates);
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
            } else if (brand === 'property' || isProperty) {
              // Properties use nested workflowStatus structure
              const { updateDoc, doc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'properties', workflowId), {
                'workflowStatus.stage': 'Failed',
                'workflowStatus.error': `Late API posting failed: ${postResult.error}`,
                'workflowStatus.lastUpdated': Date.now()
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
