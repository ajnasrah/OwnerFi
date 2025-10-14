// ULTRA-SIMPLE Failsafe: Use feed-store-firestore functions to find stuck workflows
// Then check each one's Submagic status and complete if ready
// Force rebuild: v2

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json({ error: 'Submagic API key not configured' }, { status: 500 });
    }

    console.log('🔍 [FAILSAFE] Checking for stuck Submagic workflows...');

    // Import the feed store functions that already work
    const {
      findWorkflowBySubmagicId,
      getCollectionName
    } = await import('@/lib/feed-store-firestore');

    const { db } = await import('@/lib/firebase');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('✅ Firebase initialized');

    // Try to get workflows using client SDK (same as feed-store uses)
    const { collection, getDocs, query, where } = await import('firebase/firestore');

    const projects = [];

    // Check Carz and OwnerFi workflows (use submagicVideoId field)
    for (const brand of ['carz', 'ownerfi'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'submagic_processing')
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} workflows in submagic_processing`);

        snapshot.forEach(doc => {
          const data = doc.data();
          const submagicVideoId = data.submagicVideoId;
          const updatedAt = data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - updatedAt) / 60000);

          console.log(`   📄 Workflow ${doc.id}: submagicVideoId = ${submagicVideoId || 'MISSING'}, stuck for ${stuckMinutes} min`);

          if (submagicVideoId) {
            projects.push({
              projectId: submagicVideoId,
              workflowId: doc.id,
              brand,
              isPodcast: false
            });
          } else {
            // Workflow is stuck in submagic_processing but has no submagicVideoId
            // This means Submagic API call failed. Mark as failed if stuck > 30 min
            console.warn(`   ⚠️  Workflow ${doc.id} has no submagicVideoId (stuck ${stuckMinutes} min)`);

            if (stuckMinutes > 30) {
              console.log(`   ❌ Marking workflow ${doc.id} as failed (no Submagic ID after 30+ min)`);
              projects.push({
                projectId: null, // Signal to mark as failed
                workflowId: doc.id,
                brand,
                isPodcast: false,
                shouldFail: true
              });
            }
          }
        });
      } catch (err) {
        console.error(`   ❌ Error querying ${collectionName}:`, err);
      }
    }

    // Check Podcast workflows (use submagicProjectId field)
    console.log(`\n📂 Checking podcast_workflow_queue...`);
    try {
      const q = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'submagic_processing')
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} podcast workflows in submagic_processing`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const submagicProjectId = data.submagicProjectId;
        const updatedAt = data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - updatedAt) / 60000);

        console.log(`   📄 Podcast ${doc.id}: submagicProjectId = ${submagicProjectId || 'MISSING'}, stuck for ${stuckMinutes} min`);

        if (submagicProjectId) {
          projects.push({
            projectId: submagicProjectId,
            workflowId: doc.id,
            brand: 'podcast',
            isPodcast: true
          });
        } else {
          console.warn(`   ⚠️  Podcast ${doc.id} has no submagicProjectId (stuck ${stuckMinutes} min)`);

          if (stuckMinutes > 30) {
            console.log(`   ❌ Marking podcast ${doc.id} as failed (no Submagic ID after 30+ min)`);
            projects.push({
              projectId: null,
              workflowId: doc.id,
              brand: 'podcast',
              isPodcast: true,
              shouldFail: true
            });
          }
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying podcast_workflow_queue:`, err);
    }

    console.log(`\n📋 Found ${projects.length} total stuck workflows`);

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    console.log(`🌐 Using baseUrl: ${baseUrl}`);

    // Check each stuck workflow's Submagic status
    for (const project of projects) {
      const { projectId, workflowId, brand, isPodcast, shouldFail } = project as any;

      // Handle workflows that need to be marked as failed
      if (shouldFail || !projectId) {
        console.log(`\n❌ Marking ${isPodcast ? 'podcast' : 'workflow'} ${workflowId} as failed (no Submagic ID)`);

        try {
          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, {
              status: 'failed',
              error: 'Submagic API call failed - no project ID received'
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand, {
              status: 'failed',
              error: 'Submagic API call failed - no project ID received'
            });
          }

          results.push({
            workflowId,
            brand,
            isPodcast,
            action: 'marked_failed',
            reason: 'no_submagic_id'
          });
        } catch (err) {
          console.error(`   ❌ Error marking ${isPodcast ? 'podcast' : 'workflow'} as failed:`, err);
        }
        continue;
      }

      console.log(`\n🔍 Checking Submagic project: ${projectId}`);

      try {
        // Get status from Submagic API
        const submagicResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (!submagicResponse.ok) {
          console.log(`   ❌ Submagic API error: ${submagicResponse.status}`);
          results.push({
            projectId,
            workflowId,
            action: 'api_error',
            error: `API returned ${submagicResponse.status}`
          });
          continue;
        }

        const submagicData = await submagicResponse.json();
        const status = submagicData.status;
        const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl;

        console.log(`   Status: ${status}`);

        if (status === 'completed' || status === 'done' || status === 'ready') {
          if (!downloadUrl) {
            console.log(`   ⚠️  Complete but no download URL`);
            results.push({
              projectId,
              workflowId,
              action: 'no_url',
              status
            });
            continue;
          }

          console.log(`   ✅ COMPLETED! Processing ${isPodcast ? 'podcast' : 'workflow'} directly...`);

          // Process workflow completion directly (no webhook fetch needed)
          const { uploadSubmagicVideo } = await import('@/lib/video-storage');

          try {
            // Update status to 'posting' or 'publishing'
            if (isPodcast) {
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'publishing'
              });
            } else {
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand, {
                status: 'posting'
              });
            }

            // Upload to R2
            console.log(`   ☁️  Uploading to R2...`);
            const publicVideoUrl = await uploadSubmagicVideo(downloadUrl);
            console.log(`   ✅ R2 upload complete`);

            if (isPodcast) {
              // PODCAST: Post to YouTube & Facebook (long-form)
              const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
              const workflow = await getPodcastWorkflowById(workflowId);

              if (workflow) {
                console.log(`   📱 Posting podcast to YouTube & Facebook...`);
                const { postToMetricool } = await import('@/lib/metricool-api');

                const postResult = await postToMetricool({
                  videoUrl: publicVideoUrl,
                  caption: workflow.episodeTitle || 'New Podcast Episode',
                  title: `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`,
                  platforms: ['youtube', 'facebook'] as any,
                  postTypes: {
                    youtube: 'video', // Long-form video
                    facebook: 'video'  // Long-form video
                  },
                  brand: 'podcast'
                });

                if (postResult.success) {
                  console.log(`   ✅ Posted podcast to YouTube & Facebook!`);
                  const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
                  await updatePodcastWorkflow(workflowId, {
                    status: 'completed',
                    finalVideoUrl: publicVideoUrl,
                    metricoolPostId: postResult.postId,
                    completedAt: Date.now()
                  });

                  results.push({
                    projectId,
                    workflowId,
                    brand: 'podcast',
                    isPodcast: true,
                    action: 'completed_via_failsafe',
                    success: true
                  });
                } else {
                  throw new Error(`Podcast Metricool posting failed: ${postResult.error}`);
                }
              } else {
                throw new Error('Podcast workflow not found');
              }
            } else {
              // SOCIAL MEDIA: Post to Reels/Shorts + Stories
              const { getWorkflowById } = await import('@/lib/feed-store-firestore');
              const workflowData = await getWorkflowById(workflowId);
              const workflow = workflowData?.workflow;

              if (workflow) {
                console.log(`   📱 Posting to social media...`);
                const { scheduleVideoPost, postToMetricool } = await import('@/lib/metricool-api');

                // POST 1: Reels/Shorts on all platforms
                console.log(`   📱 Post 1: Reels/Shorts on all platforms...`);
                const reelsPlatforms = ['facebook', 'instagram', 'tiktok', 'linkedin', 'threads', 'youtube'] as any[];

                const postResult = await scheduleVideoPost(
                  publicVideoUrl,
                  workflow.caption || 'Check out this video! 🔥',
                  workflow.title || 'Viral Video',
                  reelsPlatforms,
                  'immediate',
                  brand
                );

                console.log(`   ${postResult.success ? '✅' : '❌'} Reels/Shorts post: ${postResult.postId || postResult.error}`);

                // POST 2: Stories (Instagram Story + Facebook Story)
                console.log(`   📱 Post 2: Stories (Instagram + Facebook)...`);
                const storiesResult = await postToMetricool({
                  videoUrl: publicVideoUrl,
                  caption: workflow.caption || 'Check out this video! 🔥',
                  title: workflow.title || 'Viral Video',
                  platforms: ['instagram', 'facebook'] as any[],
                  postTypes: {
                    instagram: 'story',
                    facebook: 'story'
                  },
                  brand: brand
                }).catch(err => {
                  console.warn(`   ❌ Stories post failed:`, err.message);
                  return { success: false, error: err.message, postId: undefined };
                });

                console.log(`   ${storiesResult.success ? '✅' : '❌'} Stories post: ${storiesResult.postId || storiesResult.error}`);

                if (postResult.success) {
                  console.log(`   ✅ Posted to Metricool!`);
                  const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
                  await updateWorkflowStatus(workflowId, brand, {
                    status: 'completed',
                    metricoolPostId: postResult.postId,
                    completedAt: Date.now()
                  });

                  results.push({
                    projectId,
                    workflowId,
                    brand,
                    isPodcast: false,
                    action: 'completed_via_failsafe',
                    success: true
                  });
                } else {
                  throw new Error(`Metricool posting failed: ${postResult.error}`);
                }
              } else {
                throw new Error('Workflow not found');
              }
            }
          } catch (completionError) {
            console.error(`   ❌ Error completing ${isPodcast ? 'podcast' : 'workflow'}:`, completionError);

            if (isPodcast) {
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'failed',
                error: completionError instanceof Error ? completionError.message : 'Unknown error'
              });
            } else {
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand, {
                status: 'failed',
                error: completionError instanceof Error ? completionError.message : 'Unknown error'
              });
            }

            results.push({
              projectId,
              workflowId,
              brand,
              isPodcast,
              action: 'failed',
              error: completionError instanceof Error ? completionError.message : 'Unknown error'
            });
          }
        } else {
          console.log(`   ⏳ Still processing (${status})`);
          results.push({
            projectId,
            workflowId,
            status,
            action: 'still_processing'
          });
        }
      } catch (error) {
        console.error(`   ❌ Error checking ${projectId}:`, error);
        results.push({
          projectId,
          workflowId,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const completedCount = results.filter(r => r.action === 'completed_via_failsafe').length;

    console.log(`\n✅ [FAILSAFE] Checked ${projects.length} stuck workflows (${completedCount} completed)`);

    return NextResponse.json({
      success: true,
      totalWorkflows: projects.length,
      processed: results.length,
      completed: completedCount,
      results
    });

  } catch (error) {
    console.error('❌ [FAILSAFE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
