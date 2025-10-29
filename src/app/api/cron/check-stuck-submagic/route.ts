// ULTRA-SIMPLE Failsafe: Use feed-store-firestore functions to find stuck workflows
// Then check each one's Submagic status and complete if ready
// Force rebuild: v2

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    // Verify authorization - either via Bearer token OR Vercel cron
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acquire lock to prevent concurrent execution
    const { withCronLock } = await import('@/lib/cron-lock');
    const result = await withCronLock('check-stuck-submagic', async () => {
      return await executeFailsafe();
    });

    if (result === null) {
      return NextResponse.json({
        success: true,
        message: 'Skipped - another instance is running',
        skipped: true
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [FAILSAFE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

async function executeFailsafe() {
  try {
    const startTime = Date.now();
    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      throw new Error('Submagic API key not configured');
    }

    console.log('🔍 [FAILSAFE] Checking for stuck Submagic workflows...');

  // Import the feed store functions that already work
  const {
    findWorkflowBySubmagicId,
    getCollectionName
  } = await import('@/lib/feed-store-firestore');

  const { db } = await import('@/lib/firebase');

  if (!db) {
    throw new Error('Firebase not initialized');
  }

  console.log('✅ Firebase initialized');

  // Try to get workflows using client SDK (same as feed-store uses)
  const { collection, getDocs, query, where } = await import('firebase/firestore');

  const projects = [];
  const MAX_WORKFLOWS_PER_RUN = 10; // Process max 10 workflows per cron run to avoid timeouts

  // Check all brand workflows (use submagicVideoId field)
  for (const brand of ['carz', 'ownerfi', 'vassdistro', 'benefit'] as const) {
    const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        // PERFORMANCE FIX: Add limit and orderBy to prevent unbounded queries
        const { limit: firestoreLimit, orderBy } = await import('firebase/firestore');
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'submagic_processing'),
          orderBy('updatedAt', 'asc'),
          firestoreLimit(15) // Process max 15 per brand per run
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} workflows in submagic_processing`);

        snapshot.forEach(doc => {
          const data = doc.data();
          const submagicVideoId = data.submagicVideoId;
          // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
          const timestamp = data.statusChangedAt || data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

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

    // Check Property videos stuck in HeyGen processing
    console.log(`\n📂 Checking property_videos (heygen_processing)...`);
    try {
      // PERFORMANCE FIX: Add limit to prevent scanning all property videos
      const { limit: firestoreLimit, orderBy } = await import('firebase/firestore');
      const q = query(
        collection(db, 'property_videos'),
        where('status', '==', 'heygen_processing'),
        orderBy('updatedAt', 'asc'),
        firestoreLimit(15) // Process max 15 per run
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} property videos in heygen_processing`);

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const heygenVideoId = data.heygenVideoId;
        const timestamp = data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Property ${doc.id}: heygenVideoId = ${heygenVideoId || 'MISSING'}, stuck for ${stuckMinutes} min`);

        // Check HeyGen status if stuck > 5 minutes
        if (heygenVideoId && stuckMinutes > 5) {
          const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
          try {
            const heygenResponse = await fetch(
              `https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`,
              {
                headers: {
                  'accept': 'application/json',
                  'x-api-key': HEYGEN_API_KEY!
                }
              }
            );

            if (heygenResponse.ok) {
              const heygenData = await heygenResponse.json();
              if (heygenData.data?.status === 'completed' && heygenData.data?.video_url) {
                console.log(`   ✅ HeyGen completed! Recovering workflow...`);

                // Upload to R2
                const {downloadAndUploadToR2} = await import('@/lib/video-storage');
                const r2Url = await downloadAndUploadToR2(
                  heygenData.data.video_url,
                  HEYGEN_API_KEY!,
                  `property-videos/${doc.id}.mp4`
                );

                // Update workflow
                const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
                await updateDoc(firestoreDoc(db, 'property_videos', doc.id), {
                  heygenVideoUrl: heygenData.data.video_url,
                  heygenVideoR2Url: r2Url,
                  status: 'heygen_completed',
                  updatedAt: Date.now()
                });

                // Send to Submagic
                const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
                const submagicWebhookUrl = `${baseUrl}/api/webhooks/submagic/property`;

                const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
                  method: 'POST',
                  headers: {
                    'x-api-key': SUBMAGIC_API_KEY!,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    title: `${data.address} - Property Video`,
                    language: 'en',
                    videoUrl: r2Url,
                    templateName: 'Hormozi 2',
                    magicBrolls: true,
                    magicBrollsPercentage: 50,
                    magicZooms: true,
                    webhookUrl: submagicWebhookUrl
                  })
                });

                const submagicData = await submagicResponse.json();
                const projectId = submagicData?.id || submagicData?.project_id;

                if (projectId) {
                  await updateDoc(firestoreDoc(db, 'property_videos', doc.id), {
                    submagicProjectId: projectId,
                    submagicVideoId: projectId,
                    status: 'submagic_processing',
                    updatedAt: Date.now()
                  });

                  console.log(`   ✅ Property video recovered and sent to Submagic: ${projectId}`);
                  results.push({
                    workflowId: doc.id,
                    brand: 'property',
                    action: 'heygen_recovered',
                    success: true
                  });
                } else {
                  console.error(`   ❌ Failed to create Submagic project`);
                }
              }
            }
          } catch (err) {
            console.error(`   ❌ Error recovering property video ${doc.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`   ❌ Error querying property_videos:`, err);
    }

    // Check Property videos in Submagic processing
    console.log(`\n📂 Checking property_videos (submagic_processing)...`);
    try {
      // PERFORMANCE FIX: Add limit to prevent scanning all property videos
      const { limit: firestoreLimit, orderBy } = await import('firebase/firestore');
      const q = query(
        collection(db, 'property_videos'),
        where('status', '==', 'submagic_processing'),
        orderBy('updatedAt', 'asc'),
        firestoreLimit(15) // Process max 15 per run
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} property videos in submagic_processing`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const submagicProjectId = data.submagicProjectId || data.submagicVideoId;
        const timestamp = data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Property ${doc.id}: submagicProjectId = ${submagicProjectId || 'MISSING'}, stuck for ${stuckMinutes} min`);

        if (submagicProjectId) {
          projects.push({
            projectId: submagicProjectId,
            workflowId: doc.id,
            brand: 'property',
            isPodcast: false,
            isProperty: true
          });
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying property_videos (submagic):`, err);
    }

    // Check Podcast workflows (use submagicProjectId field)
    console.log(`\n📂 Checking podcast_workflow_queue...`);
    try {
      // PERFORMANCE FIX: Add limit to prevent scanning all podcasts
      const { limit: firestoreLimit, orderBy } = await import('firebase/firestore');
      const q = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'submagic_processing'),
        orderBy('updatedAt', 'asc'),
        firestoreLimit(15) // Process max 15 per run
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} podcast workflows in submagic_processing`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const submagicProjectId = data.submagicProjectId;
        // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
        const timestamp = data.statusChangedAt || data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

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

    const MAX_RETRIES = 3;

    // Limit processing to prevent timeouts
    const projectsToProcess = projects.slice(0, MAX_WORKFLOWS_PER_RUN);
    const skippedCount = projects.length - projectsToProcess.length;

    if (skippedCount > 0) {
      console.log(`\n⚠️  Limiting to ${MAX_WORKFLOWS_PER_RUN} workflows (${skippedCount} will be processed in next run)`);
    }

    // Check each stuck workflow's Submagic status
    for (const project of projectsToProcess) {
      const { projectId, workflowId, brand, isPodcast, shouldFail } = project as any;
      const workflow = (project as any).workflow;
      const retryCount = workflow?.retryCount || 0;

      // Check if max retries exceeded
      if (retryCount >= MAX_RETRIES) {
        console.log(`\n⚠️  Workflow ${workflowId} exceeded max retries (${retryCount}/${MAX_RETRIES}), marking as failed`);

        try {
          const updates = {
            status: 'failed' as const,
            error: `Max retry attempts (${MAX_RETRIES}) exceeded`,
            failedAt: Date.now()
          };

          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, updates);
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand, updates);
          }

          results.push({
            workflowId,
            brand,
            isPodcast,
            action: 'max_retries_exceeded',
            retryCount
          });
        } catch (err) {
          console.error(`   ❌ Error marking as failed:`, err);
        }
        continue;
      }

      // Handle workflows that need to be marked as failed
      if (shouldFail || !projectId) {
        console.log(`\n❌ Marking ${isPodcast ? 'podcast' : 'workflow'} ${workflowId} as failed (no Submagic ID)`);

        try {
          const updates = {
            status: 'failed' as const,
            error: 'Submagic API call failed - no project ID received',
            failedAt: Date.now(),
            retryCount: ((project as any).workflow?.retryCount || 0) + 1
          };

          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, updates);
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand, updates);
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
            console.log(`   ⚠️  Complete but no download URL - triggering export...`);

            // Project is complete (captions done) but not exported yet
            // Call /export to generate the final video
            try {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                              'https://ownerfi.ai';

              const webhookUrl = `${baseUrl}/api/webhooks/submagic/${brand}`;

              const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}/export`, {
                method: 'POST',
                headers: {
                  'x-api-key': SUBMAGIC_API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  webhookUrl,
                  format: 'mp4',
                  quality: 'high'
                })
              });

              if (!exportResponse.ok) {
                const exportError = await exportResponse.text();
                console.error(`   ❌ Export trigger failed:`, exportError);

                results.push({
                  projectId,
                  workflowId,
                  action: 'export_failed',
                  error: exportError
                });
              } else {
                console.log(`   ✅ Export triggered - webhook will fire when complete`);

                results.push({
                  projectId,
                  workflowId,
                  brand,
                  action: 'export_triggered',
                  success: true
                });
              }
            } catch (exportError) {
              console.error(`   ❌ Error triggering export:`, exportError);
              results.push({
                projectId,
                workflowId,
                action: 'export_error',
                error: exportError instanceof Error ? exportError.message : 'Unknown error'
              });
            }

            continue;
          }

          const isProperty = (project as any).isProperty;
          console.log(`   ✅ COMPLETED! Processing ${isPodcast ? 'podcast' : isProperty ? 'property video' : 'workflow'} directly...`);

          // Process workflow completion directly (no webhook fetch needed)
          const { uploadSubmagicVideo } = await import('@/lib/video-storage');

          try {
            // CRITICAL FIX: Upload to R2 FIRST, then change status
            // If R2 upload fails, status stays as 'submagic_processing' for retry
            console.log(`   ☁️  Uploading to R2...`);
            const publicVideoUrl = await uploadSubmagicVideo(downloadUrl);
            console.log(`   ✅ R2 upload complete: ${publicVideoUrl.substring(0, 80)}...`);

            // NOW update status to 'posting' with video URL and retry info
            const retryUpdates = {
              status: 'posting' as const,
              finalVideoUrl: publicVideoUrl, // CRITICAL: Save video URL immediately
              submagicDownloadUrl: downloadUrl, // Save original Submagic URL as backup
              retryCount: retryCount + 1,
              lastRetryAt: Date.now()
            };

            if (isPodcast) {
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, retryUpdates);
            } else if (isProperty) {
              const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
              await updateDoc(firestoreDoc(db, 'property_videos', workflowId), retryUpdates);
            } else {
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand, retryUpdates);
            }

            console.log(`   💾 Status updated to 'posting' with video URL saved`);

            if (isPodcast) {
              // PODCAST: Post as SHORT VIDEOS (Reels/Shorts) - same as carz/ownerfi
              const { getPodcastWorkflowById } = await import('@/lib/feed-store-firestore');
              const workflow = await getPodcastWorkflowById(workflowId);

              if (workflow) {
                console.log(`   📱 Posting podcast to social media via Late queue...`);
                const { postToLate } = await import('@/lib/late-api');

                // Post to all platforms using queue
                const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter', 'bluesky'] as any[];

                const postResult = await postToLate({
                  videoUrl: publicVideoUrl,
                  caption: workflow.episodeTitle || 'New Podcast Episode',
                  title: `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`,
                  platforms: allPlatforms,
                  useQueue: true,  // Use Late's queue system
                  brand: 'podcast'
                });

                console.log(`   ${postResult.success ? '✅' : '❌'} Late post: ${postResult.postId || postResult.error}`);

                if (postResult.success) {
                  console.log(`   ✅ Posted podcast to Late!`);
                  const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
                  await updatePodcastWorkflow(workflowId, {
                    status: 'completed',
                    finalVideoUrl: publicVideoUrl,
                    latePostId: postResult.postId,
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
            } else if (brand === 'benefit') {
              // BENEFIT: Educational videos about owner financing
              const { getBenefitWorkflowById } = await import('@/lib/feed-store-firestore');
              const workflow = await getBenefitWorkflowById(workflowId);

              if (workflow) {
                console.log(`   📱 Posting benefit video to social media via Late queue...`);

                const { postToLate } = await import('@/lib/late-api');

                // Post to all platforms using queue
                const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads'] as any[];

                const postResult = await postToLate({
                  videoUrl: publicVideoUrl,
                  caption: workflow.caption || 'Learn about owner financing! 🏡',
                  title: workflow.title || 'Owner Finance Benefits',
                  platforms: allPlatforms,
                  useQueue: true,
                  brand: 'benefit'
                });

                console.log(`   ${postResult.success ? '✅' : '❌'} Late post: ${postResult.postId || postResult.error}`);

                if (postResult.success) {
                  console.log(`   ✅ Posted benefit video to Late!`);
                  const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
                  await updateBenefitWorkflow(workflowId, {
                    status: 'completed',
                    finalVideoUrl: publicVideoUrl,
                    latePostId: postResult.postId,
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
                  throw new Error(`Benefit Late posting failed: ${postResult.error}`);
                }
              } else {
                throw new Error('Benefit workflow not found');
              }
            } else if (isProperty) {
              // PROPERTY: Property listing videos with owner finance deals
              const { getPropertyVideoById } = await import('@/lib/feed-store-firestore');
              const workflow = await getPropertyVideoById(workflowId);

              if (workflow) {
                console.log(`   📱 Posting property video to social media via Late queue...`);

                const { postToLate } = await import('@/lib/late-api');

                // Post to all platforms using OwnerFi queue
                const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads'] as any[];

                // Generate caption from property data
                const caption = workflow.caption ||
                  `${workflow.address}, ${workflow.city}, ${workflow.state} • Down: $${workflow.downPayment?.toLocaleString()} • Monthly: $${workflow.monthlyPayment?.toLocaleString()} 🏡`;

                const title = workflow.title || `${workflow.address} - Owner Finance Property`;

                const postResult = await postToLate({
                  videoUrl: publicVideoUrl,
                  caption,
                  title,
                  platforms: allPlatforms,
                  useQueue: true,
                  brand: 'ownerfi' // Property videos use OwnerFi profile
                });

                console.log(`   ${postResult.success ? '✅' : '❌'} Late post: ${postResult.postId || postResult.error}`);

                if (postResult.success) {
                  console.log(`   ✅ Posted property video to Late!`);
                  const { updatePropertyVideo } = await import('@/lib/feed-store-firestore');
                  await updatePropertyVideo(workflowId, {
                    status: 'completed',
                    finalVideoUrl: publicVideoUrl,
                    latePostId: postResult.postId,
                    completedAt: Date.now()
                  });

                  results.push({
                    projectId,
                    workflowId,
                    brand: 'property',
                    isProperty: true,
                    action: 'completed_via_failsafe',
                    success: true
                  });
                } else {
                  throw new Error(`Property Late posting failed: ${postResult.error}`);
                }
              } else {
                throw new Error('Property workflow not found');
              }
            } else {
              // SOCIAL MEDIA (carz, ownerfi, vassdistro): Post to Reels/Shorts + Stories
              const { getWorkflowById } = await import('@/lib/feed-store-firestore');
              const workflowData = await getWorkflowById(workflowId, brand);
              const workflow = workflowData?.workflow;

              if (workflow) {
                console.log(`   📱 Posting to social media via Late queue...`);

                const { postToLate } = await import('@/lib/late-api');

                // Post to all platforms using queue
                const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads'] as any[];
                if (brand === 'ownerfi') {
                  allPlatforms.push('twitter', 'bluesky');
                }

                const postResult = await postToLate({
                  videoUrl: publicVideoUrl,
                  caption: workflow.caption || 'Check out this video! 🔥',
                  title: workflow.title || 'Viral Video',
                  platforms: allPlatforms,
                  useQueue: true,  // Use Late's queue system
                  brand: brand
                });

                console.log(`   ${postResult.success ? '✅' : '❌'} Late post: ${postResult.postId || postResult.error}`);

                if (postResult.success) {
                  console.log(`   ✅ Posted to Late!`);
                  const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
                  await updateWorkflowStatus(workflowId, brand, {
                    status: 'completed',
                    finalVideoUrl: publicVideoUrl,
                    latePostId: postResult.postId,
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
    const failedCount = results.filter(r => r.action === 'marked_failed').length;
    const stillProcessingCount = results.filter(r => r.action === 'still_processing').length;
    const maxRetriesCount = results.filter(r => r.action === 'max_retries_exceeded').length;

    console.log(`\n✅ [FAILSAFE] Checked ${projects.length} stuck workflows (${completedCount} completed)`);

    // Track failsafe execution metrics
    const { trackFailsafeExecution } = await import('@/lib/monitoring');
    await trackFailsafeExecution('check-stuck-submagic', {
      found: projects.length,
      processed: projectsToProcess.length,
      completed: completedCount,
      failed: failedCount + maxRetriesCount,
      skipped: skippedCount,
      duration: Date.now() - startTime
    });

    return {
      success: true,
      totalWorkflows: projects.length,
      processed: results.length,
      completed: completedCount,
      failed: failedCount,
      stillProcessing: stillProcessingCount,
      results
    };

  } catch (error) {
    console.error('❌ [FAILSAFE] Error:', error);
    throw error; // Re-throw to be caught by outer handler
  }
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
