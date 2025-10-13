import { NextRequest, NextResponse } from 'next/server';
import { scheduleVideoPost } from '@/lib/metricool-api';

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

    // Find the workflow for this project in Firestore
    const { findWorkflowBySubmagicId } = await import('@/lib/feed-store-firestore');
    const result = await findWorkflowBySubmagicId(submagicProjectId);

    if (!result) {
      console.log('⚠️ No pending workflow found for Submagic project:', submagicProjectId);
      return NextResponse.json({
        received: true,
        message: 'No pending workflow found'
      });
    }

    const { workflowId, workflow, brand } = result;

    if (status === 'completed' || status === 'done' || status === 'ready') {
      console.log('✅ Submagic video completed via webhook!');
      console.log('   Video URL from webhook:', finalVideoUrl);

      // If no video URL provided in webhook, fetch it from Submagic API
      let videoUrl = finalVideoUrl;
      if (!videoUrl) {
        console.log('⚠️  No video URL in webhook, fetching from Submagic API...');
        try {
          const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
          if (!SUBMAGIC_API_KEY) {
            throw new Error('Submagic API key not configured');
          }

          const response = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}`, {
            headers: { 'x-api-key': SUBMAGIC_API_KEY }
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

      // Update workflow status to 'posting'
      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand, {
        status: 'posting'
      });

      console.log('🎉 Submagic completed via webhook!');
      console.log('   Workflow ID:', workflowId);
      console.log('   Brand:', brand);

      // Send immediate confirmation to Submagic (don't wait for R2 upload)
      const response = NextResponse.json({
        received: true,
        projectId: submagicProjectId,
        workflowId: workflowId,
        brand: brand,
        timestamp: new Date().toISOString()
      });

      // Upload to R2 and post to Metricool asynchronously (don't block webhook response)
      setImmediate(async () => {
        try {
          console.log('\n☁️ Uploading Submagic video to R2...');

          // Import video storage utilities
          const { uploadSubmagicVideo } = await import('@/lib/video-storage');

          // Download from Submagic and upload to R2
          const publicVideoUrl = await uploadSubmagicVideo(videoUrl);

          console.log('✅ Video uploaded to R2!');
          console.log('   Public URL:', publicVideoUrl);

          console.log('\n📱 Auto-posting to social media via Metricool...');

          // Get platforms from env or use defaults (Instagram Reel, Facebook Reel, TikTok, YouTube Short, LinkedIn)
          const platforms = (process.env.METRICOOL_PLATFORMS || 'instagram,facebook,tiktok,youtube,linkedin').split(',') as any[];
          const schedule = (process.env.METRICOOL_SCHEDULE_DELAY || 'immediate') as any;

          // Post to Reels/Shorts
          const postResult = await scheduleVideoPost(
            publicVideoUrl,
            workflow.caption || 'Check out this video! 🔥',
            workflow.title || 'Viral Video',
            platforms,
            schedule,
            brand
          );

          // Also post to Stories if Instagram/Facebook are included
          if (platforms.includes('instagram') || platforms.includes('facebook')) {
            console.log('📱 Also posting to Stories...');
            const storyPlatforms = [];
            if (platforms.includes('instagram')) storyPlatforms.push('instagram');
            if (platforms.includes('facebook')) storyPlatforms.push('facebook');

            const { postToMetricool } = await import('@/lib/metricool-api');
            await postToMetricool({
              videoUrl: publicVideoUrl,
              caption: workflow.caption || 'Check out this video! 🔥',
              title: workflow.title || 'Viral Video',
              platforms: storyPlatforms as any,
              postTypes: {
                instagram: 'story',
                facebook: 'story'
              },
              brand: brand
            }).catch(err => console.warn('Story posting failed:', err));
          }

          if (postResult.success) {
            console.log('✅ Posted to Metricool via webhook!');
            console.log('   Post ID:', postResult.postId);
            console.log('   Platforms:', postResult.platforms?.join(', '));

            // Mark workflow as completed
            await updateWorkflowStatus(workflowId, brand, {
              status: 'completed',
              metricoolPostId: postResult.postId,
              completedAt: Date.now()
            });
          } else {
            console.error('❌ Failed to post to Metricool:', postResult.error);

            // Mark workflow as failed
            await updateWorkflowStatus(workflowId, brand, {
              status: 'failed',
              error: `Metricool posting failed: ${postResult.error}`
            });

            // Send alert
            const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
            await alertWorkflowFailure(
              brand,
              workflowId,
              workflow.articleTitle || 'Unknown',
              `Metricool posting failed: ${postResult.error}`
            );
          }
        } catch (error) {
          console.error('❌ Error in R2 upload or Metricool posting (async):', error);

          // Mark workflow as failed
          const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
          await updateWorkflowStatus(workflowId, brand, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error in webhook handler'
          });
        }
      });

      return response;

    } else if (status === 'failed' || status === 'error') {
      console.error('❌ Submagic processing failed via webhook');

      const { updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
      await updateWorkflowStatus(workflowId, brand, {
        status: 'failed',
        error: 'Submagic processing failed'
      });

      // Send alert
      const { alertWorkflowFailure } = await import('@/lib/error-monitoring');
      await alertWorkflowFailure(
        brand,
        workflowId,
        workflow.articleTitle || 'Unknown',
        'Submagic processing failed'
      );
    } else {
      console.log('⏳ Submagic webhook - intermediate status:', status);
    }

    return NextResponse.json({
      received: true,
      projectId: submagicProjectId,
      workflowId: workflowId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing Submagic webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
