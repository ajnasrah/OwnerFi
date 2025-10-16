import { NextRequest, NextResponse } from 'next/server';
import { postToLate } from '@/lib/late-api'; // Switched from Metricool to Late
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('🔔 Submagic webhook received:', JSON.stringify(body, null, 2));

    // Submagic webhook payload structure:
    // { projectId: "uuid", status: "completed", downloadUrl: "url", timestamp: "ISO8601" }
    // OR { id: "uuid", status: "completed", media_url: "url", ... }
    const projectId = body.projectId || body.id;
    const status = body.status;
    const downloadUrl = body.downloadUrl || body.media_url || body.mediaUrl || body.video_url || body.videoUrl || body.download_url;

    const submagicProjectId = projectId;
    const finalVideoUrl = downloadUrl;

    if (!submagicProjectId) {
      return NextResponse.json(
        { error: 'Missing projectId in webhook payload' },
        { status: 400 }
      );
    }

    // Find the workflow for this project in Firestore (check social media first, then podcast)
    const { findWorkflowBySubmagicId, findPodcastBySubmagicId } = await import('@/lib/feed-store-firestore');
    let result = await findWorkflowBySubmagicId(submagicProjectId);
    let isPodcast = false;
    let workflowId: string;
    let workflow: any;
    let brand: 'carz' | 'ownerfi' | 'podcast';

    if (!result) {
      // Try podcast workflows
      const podcastResult = await findPodcastBySubmagicId(submagicProjectId);
      if (podcastResult) {
        isPodcast = true;
        workflowId = podcastResult.workflowId;
        workflow = podcastResult.workflow;
        brand = 'podcast';
      }
    } else {
      workflowId = result.workflowId;
      workflow = result.workflow;
      brand = result.brand;
    }

    if (!result && !isPodcast) {
      console.log('⚠️ No pending workflow found for Submagic project:', submagicProjectId);
      return NextResponse.json({
        received: true,
        message: 'No pending workflow found'
      });
    }

    if (status === 'completed' || status === 'done' || status === 'ready') {
      console.log('✅ Submagic video completed via webhook!');
      console.log('   Video URL from webhook:', finalVideoUrl);
      console.log('   Type:', isPodcast ? 'PODCAST' : 'SOCIAL MEDIA');

      // If no video URL provided in webhook, fetch it from Submagic API
      let videoUrl = finalVideoUrl;
      if (!videoUrl) {
        console.log('⚠️  No video URL in webhook, fetching from Submagic API...');
        try {
          const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
          if (!SUBMAGIC_API_KEY) {
            throw new Error('Submagic API key not configured');
          }

          const response = await circuitBreakers.submagic.execute(async () => {
            return await fetchWithTimeout(
              `https://api.submagic.co/v1/projects/${submagicProjectId}`,
              {
                headers: { 'x-api-key': SUBMAGIC_API_KEY }
              },
              TIMEOUTS.SUBMAGIC_API
            );
          });

          if (!response.ok) {
            throw new Error(`Submagic API returned ${response.status}`);
          }

          const projectData = await response.json();
          videoUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

          if (!videoUrl) {
            throw new Error('No video URL found in Submagic project data');
          }

          console.log('✅ Fetched video URL from API:', videoUrl);
        } catch (error) {
          console.error('❌ Failed to fetch video URL from Submagic:', error);
          return NextResponse.json(
            { error: 'Failed to fetch video URL from Submagic', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          );
        }
      }

      // Update workflow status to 'posting' or 'publishing'
      if (isPodcast) {
        const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
        await updatePodcastWorkflow(workflowId, {
          status: 'publishing'
        });
      } else {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'posting'
        });
      }

      console.log('🎉 Submagic completed via webhook!');
      console.log('   Workflow ID:', workflowId);
      console.log('   Brand:', brand);

      // Process R2 upload and Late posting synchronously (CRITICAL: Must complete before function terminates)
      // In serverless environments, setImmediate() work gets killed when the response is sent
      try {
          console.log('\n☁️ Uploading Submagic video to R2...');

          // Import video storage utilities
          const { uploadSubmagicVideo } = await import('@/lib/video-storage');

          // Download from Submagic and upload to R2
          const publicVideoUrl = await uploadSubmagicVideo(videoUrl);

          console.log('✅ Video uploaded to R2!');
          console.log('   Public URL:', publicVideoUrl);

          if (isPodcast) {
            // Podcast: Scheduled posting to all platforms
            console.log('\n📱 Scheduling podcast to all social media platforms via Late...');

            // Get next available time slot for podcast brand
            const { getNextAvailableTimeSlot } = await import('@/lib/feed-store-firestore');
            const nextSlot = await getNextAvailableTimeSlot('ownerfi'); // Podcast uses OwnerFi scheduling
            const scheduledTime = nextSlot.toISOString();

            console.log(`📅 Scheduling podcast for: ${nextSlot.toLocaleString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })} ET`);

            // POST 1: Main post to all platforms
            const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter'] as any[];
            console.log(`📱 Post 1: All platforms (${allPlatforms.join(', ')})...`);

            const postResult = await postToLate({
              videoUrl: publicVideoUrl,
              caption: workflow.episodeTitle || 'New Podcast Episode',
              title: `Episode #${workflow.episodeNumber}: ${workflow.episodeTitle || 'New Episode'}`,
              platforms: allPlatforms,
              scheduleTime: scheduledTime,
              brand: 'podcast'
            });

            console.log(`   ${postResult.success ? '✅' : '❌'} Main post: ${postResult.postId || postResult.error}`);

            if (postResult.success) {
              console.log('✅ Posted podcast to social media!');
              console.log('   Post ID:', postResult.postId);

              // Mark podcast workflow as completed
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'completed',
                finalVideoUrl: publicVideoUrl,
                latePostId: postResult.postId,
                completedAt: Date.now()
              });
            } else {
              console.error('❌ Failed to post podcast to Late:', postResult.error);

              // Mark podcast workflow as failed
              const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
              await updatePodcastWorkflow(workflowId, {
                status: 'failed',
                error: `Late posting failed: ${postResult.error}`
              });
            }
          } else {
            // Social Media: Post to ALL platforms (Facebook Reels, Facebook Story, Instagram Reels, Instagram Story, TikTok, YouTube Shorts, LinkedIn, X, Threads)
            console.log('\n📱 Auto-posting to all social media platforms via Late...');

            // Get next available time slot for this brand
            const { getNextAvailableTimeSlot, updateWorkflowStatus: updateWorkflow } = await import('@/lib/feed-store-firestore');
            const nextSlot = await getNextAvailableTimeSlot(brand as 'carz' | 'ownerfi');
            const scheduledTime = nextSlot.toISOString();

            console.log(`📅 Scheduling post for: ${nextSlot.toLocaleString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })} ET`);

            // Store the scheduled time in workflow
            await updateWorkflow(workflowId, brand as 'carz' | 'ownerfi', {
              scheduledFor: nextSlot.getTime()
            });

            // POST 1: Main post to all platforms (Reels/Shorts)
            // Add Bluesky for OwnerFi only
            const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter'] as any[];
            if (brand === 'ownerfi') {
              allPlatforms.push('bluesky');
            }
            console.log(`📱 Post 1: All platforms (${allPlatforms.join(', ')})...`);

            const postResult = await postToLate({
              videoUrl: publicVideoUrl,
              caption: workflow.caption || 'Check out this video! 🔥',
              title: workflow.title || 'Viral Video',
              platforms: allPlatforms,
              scheduleTime: scheduledTime,
              brand: brand as 'carz' | 'ownerfi'
            });

            console.log(`   ${postResult.success ? '✅' : '❌'} Main post: ${postResult.postId || postResult.error}`);

            if (postResult.success) {
              console.log('✅ Posted to Late via webhook!');
              console.log('   Post ID:', postResult.postId);
              console.log('   Platforms:', postResult.platforms?.join(', '));

              // Mark workflow as completed
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
                status: 'completed',
                latePostId: postResult.postId,
                completedAt: Date.now()
              });
            } else {
              console.error('❌ Failed to post to Late:', postResult.error);

              // Mark workflow as failed
              const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
              await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
                status: 'failed',
                error: `Late posting failed: ${postResult.error}`
              });

              // Send alert
              const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
              await alertWorkflowFailure(
                brand as 'carz' | 'ownerfi',
                workflowId,
                workflow.articleTitle || 'Unknown',
                `Late posting failed: ${postResult.error}`
              );
            }
          }
        } catch (error) {
          console.error('❌ Error in R2 upload or Late posting (async):', error);

          // Mark workflow as failed
          if (isPodcast) {
            const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
            await updatePodcastWorkflow(workflowId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error in webhook handler'
            });
          } else {
            const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
            await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error in webhook handler'
            });
          }
        }

      // Return success response after all work completes
      return NextResponse.json({
        received: true,
        projectId: submagicProjectId,
        workflowId: workflowId,
        brand: brand,
        timestamp: new Date().toISOString()
      });

    } else if (status === 'failed' || status === 'error') {
      console.error('❌ Submagic processing failed via webhook');

      if (isPodcast) {
        const { updatePodcastWorkflow } = await import('@/lib/feed-store-firestore');
        await updatePodcastWorkflow(workflowId, {
          status: 'failed',
          error: 'Submagic processing failed'
        });
      } else {
        const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
        await updateWorkflowStatus(workflowId, brand as 'carz' | 'ownerfi', {
          status: 'failed',
          error: 'Submagic processing failed'
        });

        // Send alert (only for social media workflows)
        const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
        await alertWorkflowFailure(
          brand as 'carz' | 'ownerfi',
          workflowId,
          workflow.articleTitle || 'Unknown',
          'Submagic processing failed'
        );
      }

      return NextResponse.json({
        received: true,
        projectId: submagicProjectId,
        workflowId: workflowId,
        timestamp: new Date().toISOString()
      });

    } else {
      // Intermediate status (processing, etc.)
      console.log('⏳ Submagic webhook - intermediate status:', status);

      return NextResponse.json({
        received: true,
        projectId: submagicProjectId,
        workflowId: workflowId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error processing Submagic webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
