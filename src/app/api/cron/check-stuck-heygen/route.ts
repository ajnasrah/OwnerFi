// Failsafe Cron: Check for stuck HeyGen workflows and advance them
// Runs every 10 minutes to check if HeyGen videos are complete

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

    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🔍 [HEYGEN FAILSAFE] Checking for stuck HeyGen workflows...');

    const { getCollectionName } = await import('@/lib/feed-store-firestore');
    const { db } = await import('@/lib/firebase');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const { collection, getDocs, query, where } = await import('firebase/firestore');

    const heygenProjects = [];

    // Check all brand workflows stuck in heygen_processing
    for (const brand of ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'heygen_processing')
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} workflows in heygen_processing`);

        snapshot.forEach(doc => {
          const data = doc.data();
          const heygenVideoId = data.heygenVideoId;
          // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
          const timestamp = data.statusChangedAt || data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

          console.log(`   📄 Workflow ${doc.id}: heygenVideoId = ${heygenVideoId || 'MISSING'}, stuck for ${stuckMinutes} min`);

          if (heygenVideoId) {
            heygenProjects.push({
              videoId: heygenVideoId,
              workflowId: doc.id,
              brand,
              stuckMinutes,
              workflow: data
            });
          } else if (stuckMinutes > 30) {
            // No HeyGen video ID after 30 minutes = failed
            console.warn(`   ❌ Workflow ${doc.id} has no heygenVideoId after ${stuckMinutes} min - marking failed`);
            heygenProjects.push({
              videoId: null,
              workflowId: doc.id,
              brand,
              shouldFail: true,
              workflow: data
            });
          }
        });
      } catch (err) {
        console.error(`   ❌ Error querying ${collectionName}:`, err);
      }
    }

    // Check Podcast workflows stuck in heygen_processing
    console.log(`\n📂 Checking podcast_workflow_queue...`);
    try {
      const q = query(
        collection(db, 'podcast_workflow_queue'),
        where('status', '==', 'heygen_processing')
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} podcast workflows in heygen_processing`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const heygenVideoId = data.heygenVideoId;
        // Use statusChangedAt if available (new field), fallback to updatedAt for old workflows
        const timestamp = data.statusChangedAt || data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Podcast ${doc.id}: heygenVideoId = ${heygenVideoId || 'MISSING'}, stuck for ${stuckMinutes} min`);

        if (heygenVideoId) {
          heygenProjects.push({
            videoId: heygenVideoId,
            workflowId: doc.id,
            brand: 'podcast',
            isPodcast: true,
            stuckMinutes,
            workflow: data
          });
        } else if (stuckMinutes > 30) {
          console.warn(`   ❌ Podcast ${doc.id} has no heygenVideoId after ${stuckMinutes} min - marking failed`);
          heygenProjects.push({
            videoId: null,
            workflowId: doc.id,
            brand: 'podcast',
            isPodcast: true,
            shouldFail: true,
            workflow: data
          });
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying podcast_workflow_queue:`, err);
    }

    // Check Property video workflows stuck in heygen_processing
    console.log(`\n📂 Checking property_video_workflows...`);
    try {
      const q = query(
        collection(db, 'property_video_workflows'),
        where('status', '==', 'heygen_processing')
      );

      const snapshot = await getDocs(q);
      console.log(`   Found ${snapshot.size} property workflows in heygen_processing`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const heygenVideoId = data.heygenVideoId;
        const timestamp = data.statusChangedAt || data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

        console.log(`   📄 Property ${doc.id}: heygenVideoId = ${heygenVideoId || 'MISSING'}, stuck for ${stuckMinutes} min`);

        if (heygenVideoId) {
          heygenProjects.push({
            videoId: heygenVideoId,
            workflowId: doc.id,
            brand: 'property',
            isProperty: true,
            stuckMinutes,
            workflow: data
          });
        } else if (stuckMinutes > 30) {
          console.warn(`   ❌ Property ${doc.id} has no heygenVideoId after ${stuckMinutes} min - marking failed`);
          heygenProjects.push({
            videoId: null,
            workflowId: doc.id,
            brand: 'property',
            isProperty: true,
            shouldFail: true,
            workflow: data
          });
        }
      });
    } catch (err) {
      console.error(`   ❌ Error querying property_video_workflows:`, err);
    }

    console.log(`\n📋 Found ${heygenProjects.length} stuck HeyGen workflows`);

    const results = [];

    // Check each stuck workflow's HeyGen status
    for (const project of heygenProjects) {
      const { videoId, workflowId, brand, stuckMinutes, shouldFail, workflow, isPodcast, isProperty } = project as any;

      // Handle workflows that should be marked as failed
      if (shouldFail || !videoId) {
        const workflowType = isPodcast ? 'podcast' : isProperty ? 'property' : 'workflow';
        console.log(`\n❌ Marking ${workflowType} ${workflowId} as failed (no HeyGen video ID)`);

        try {
          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, {
              status: 'failed',
              error: 'HeyGen video generation failed - no video ID received'
            });
          } else if (isProperty) {
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'property_video_workflows', workflowId), {
              status: 'failed',
              error: 'HeyGen video generation failed - no video ID received',
              updatedAt: Date.now()
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand, {
              status: 'failed',
              error: 'HeyGen video generation failed - no video ID received'
            });
          }

          results.push({
            workflowId,
            brand,
            isPodcast,
            isProperty,
            action: 'marked_failed',
            reason: 'no_heygen_id'
          });
        } catch (err) {
          console.error(`   ❌ Error marking ${workflowType} as failed:`, err);
        }
        continue;
      }

      console.log(`\n🔍 Checking HeyGen video: ${videoId} (stuck ${stuckMinutes} min)`);

      try {
        // Get status from HeyGen API
        const heygenResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
          headers: { 'x-api-key': HEYGEN_API_KEY }
        });

        if (!heygenResponse.ok) {
          console.log(`   ❌ HeyGen API error: ${heygenResponse.status}`);
          results.push({
            videoId,
            workflowId,
            action: 'api_error',
            error: `API returned ${heygenResponse.status}`
          });
          continue;
        }

        const heygenData = await heygenResponse.json();
        const status = heygenData.data?.status;
        const videoUrl = heygenData.data?.video_url;

        console.log(`   Status: ${status}`);

        if (status === 'completed' && videoUrl) {
          console.log(`   ✅ COMPLETED! Triggering Submagic processing...`);

          // Trigger Submagic processing (same logic as HeyGen webhook)
          try {
            // Import Submagic trigger function from HeyGen webhook
            const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
            if (!SUBMAGIC_API_KEY) {
              throw new Error('Submagic API key not configured');
            }

            console.log('   ☁️  Uploading HeyGen video to R2...');
            const { downloadAndUploadToR2 } = await import('@/lib/video-storage');
            const publicHeygenUrl = await downloadAndUploadToR2(
              videoUrl,
              HEYGEN_API_KEY,
              `heygen-videos/${workflowId}.mp4`
            );

            console.log('   ✅ R2 upload complete');
            console.log('   ✨ Sending to Submagic...');

            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                            'https://ownerfi.ai';
            const webhookUrl = isPodcast
              ? `${baseUrl}/api/webhooks/submagic-podcast`
              : isProperty
                ? `${baseUrl}/api/webhooks/submagic-property`
                : `${baseUrl}/api/webhooks/submagic`;

            let title = workflow.articleTitle || workflow.topic || workflow.propertyAddress ||
              `${isPodcast ? 'Podcast' : isProperty ? 'Property' : 'Viral Video'} - ${workflowId}`;

            // Decode HTML entities before measuring length
            title = title
              .replace(/&#8217;/g, "'")
              .replace(/&#8216;/g, "'")
              .replace(/&#8211;/g, "-")
              .replace(/&#8212;/g, "-")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&nbsp;/g, " ");

            if (title.length > 50) {
              title = title.substring(0, 47) + '...';
            }

            const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
              method: 'POST',
              headers: {
                'x-api-key': SUBMAGIC_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                title,
                language: 'en',
                videoUrl: publicHeygenUrl,
                templateName: 'Hormozi 2',
                magicBrolls: true,
                magicBrollsPercentage: 50,
                magicZooms: true,
                webhookUrl: webhookUrl
              })
            });

            if (!submagicResponse.ok) {
              const errorText = await submagicResponse.text();
              throw new Error(`Submagic API error: ${submagicResponse.status} - ${errorText}`);
            }

            const submagicData = await submagicResponse.json();
            const projectId = submagicData.id || submagicData.project_id || submagicData.projectId;

            console.log('   ✅ Submagic project created:', projectId);

            // Update workflow to submagic_processing
            if (isPodcast) {
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'submagic_processing',
                submagicVideoId: projectId
              });
            } else if (isProperty) {
              const { doc, updateDoc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'property_video_workflows', workflowId), {
                status: 'submagic_processing',
                submagicVideoId: projectId,
                heygenVideoUrl: videoUrl,
                updatedAt: Date.now()
              });
            } else {
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand, {
                status: 'submagic_processing',
                submagicVideoId: projectId
              });
            }

            results.push({
              videoId,
              workflowId,
              brand,
              isPodcast,
              isProperty,
              action: 'advanced_to_submagic',
              submagicProjectId: projectId,
              success: true
            });
          } catch (submagicError) {
            console.error(`   ❌ Error triggering Submagic:`, submagicError);

            if (isPodcast) {
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'failed',
                error: submagicError instanceof Error ? submagicError.message : 'Unknown error'
              });
            } else if (isProperty) {
              const { doc, updateDoc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'property_video_workflows', workflowId), {
                status: 'failed',
                error: submagicError instanceof Error ? submagicError.message : 'Unknown error',
                updatedAt: Date.now()
              });
            } else {
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand, {
                status: 'failed',
                error: submagicError instanceof Error ? submagicError.message : 'Unknown error'
              });
            }

            results.push({
              videoId,
              workflowId,
              brand,
              isPodcast,
              action: 'failed',
              error: submagicError instanceof Error ? submagicError.message : 'Unknown error'
            });
          }
        } else if (status === 'failed') {
          console.log(`   ❌ HeyGen video failed`);

          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, {
              status: 'failed',
              error: 'HeyGen video generation failed'
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand, {
              status: 'failed',
              error: 'HeyGen video generation failed'
            });
          }

          results.push({
            videoId,
            workflowId,
            brand,
            isPodcast,
            action: 'marked_failed',
            reason: 'heygen_failed'
          });
        } else {
          console.log(`   ⏳ Still processing (${status})`);
          results.push({
            videoId,
            workflowId,
            status,
            action: 'still_processing'
          });
        }
      } catch (error) {
        console.error(`   ❌ Error checking ${videoId}:`, error);
        results.push({
          videoId,
          workflowId,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const advancedCount = results.filter(r => r.action === 'advanced_to_submagic').length;
    const failedCount = results.filter(r => r.action === 'marked_failed').length;
    const stillProcessingCount = results.filter(r => r.action === 'still_processing').length;

    console.log(`\n✅ [HEYGEN FAILSAFE] Checked ${heygenProjects.length} stuck workflows (${advancedCount} advanced)`);

    // Log metrics for monitoring failsafe usage
    console.log(JSON.stringify({
      event: 'failsafe_check',
      type: 'heygen',
      timestamp: new Date().toISOString(),
      found: heygenProjects.length,
      advanced: advancedCount,
      failed: failedCount,
      stillProcessing: stillProcessingCount,
      utilization: heygenProjects.length > 0 ? 'ACTIVE' : 'IDLE'
    }));

    return NextResponse.json({
      success: true,
      totalWorkflows: heygenProjects.length,
      processed: results.length,
      advanced: advancedCount,
      failed: failedCount,
      stillProcessing: stillProcessingCount,
      results
    });

  } catch (error) {
    console.error('❌ [HEYGEN FAILSAFE] Error:', error);
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
