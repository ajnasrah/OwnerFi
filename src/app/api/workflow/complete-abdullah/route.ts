// Complete Abdullah Personal Brand Workflow
// Generates 5 daily short-form video scripts (15-30 seconds each)
// and creates HeyGen videos → Submagic captions → Late.so posting

import { NextRequest, NextResponse } from 'next/server';
import { scheduleVideoPost } from '@/lib/late-api';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { generateAbdullahDailyContent, validateAbdullahScript, buildAbdullahVideoRequest, type AbdullahVideoScript } from '@/lib/abdullah-content-generator';
import { getBrandWebhookUrl } from '@/lib/brand-utils';
import { ERROR_MESSAGES } from '@/config/constants';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ABDULLAH PERSONAL BRAND WORKFLOW STARTED');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    // Validate required API keys
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'HEYGEN_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body (optional - allows manual override of schedule)
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine - use defaults
    }

    const platforms = body.platforms || ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'];
    const schedule = body.schedule || 'staggered'; // 'staggered' or 'immediate'
    const date = body.date ? new Date(body.date) : new Date();
    const count = body.count !== undefined ? parseInt(body.count, 10) : 5; // Default to 5 videos

    console.log(`📋 Configuration:`);
    console.log(`   Date: ${date.toLocaleDateString()}`);
    console.log(`   Count: ${count} video${count !== 1 ? 's' : ''}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Schedule: ${schedule}`);
    console.log();

    // Step 1: Generate daily scripts with OpenAI
    console.log(`🤖 Step 1: Generating ${count} daily video script${count !== 1 ? 's' : ''}...`);
    const dailyContent = await generateAbdullahDailyContent(OPENAI_API_KEY, date, count);

    console.log(`✅ Generated ${dailyContent.videos.length} scripts:`);
    dailyContent.videos.forEach((video, i) => {
      console.log(`   ${i + 1}. ${video.theme}: "${video.title}"`);

      // Validate each script
      const validation = validateAbdullahScript(video);
      if (!validation.valid) {
        console.warn(`   ⚠️  Warning - Script ${i + 1} validation issues:`, validation.errors);
      }
    });
    console.log();

    // Step 2: Create workflow queue items and generate videos
    console.log('🎥 Step 2: Creating HeyGen videos...');
    const { addWorkflowToQueue, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');

    const workflowResults = [];

    for (let i = 0; i < dailyContent.videos.length; i++) {
      const video = dailyContent.videos[i];
      const videoNumber = i + 1;

      console.log(`\n📹 Video ${videoNumber}/${dailyContent.videos.length}: ${video.theme}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Script: ${video.script.substring(0, 80)}...`);

      try {
        // Create workflow queue item
        const queueItem = await addWorkflowToQueue(
          `abdullah_daily_${Date.now()}_${i}`, // Unique article ID
          video.title,
          'abdullah'
        );

        const workflowId = queueItem.id;
        console.log(`   📋 Workflow ID: ${workflowId}`);

        // Update with caption and title for webhooks
        await updateWorkflowStatus(workflowId, 'abdullah', {
          caption: video.caption,
          title: video.title,
          status: 'heygen_processing'
        } as any);

        // Generate HeyGen video
        const videoResult = await generateAbdullahHeyGenVideo(
          video,
          workflowId,
          HEYGEN_API_KEY
        );

        if (!videoResult.success || !videoResult.video_id) {
          throw new Error(videoResult.error || 'HeyGen video generation failed');
        }

        console.log(`   ✅ HeyGen video ID: ${videoResult.video_id}`);

        // Update workflow with HeyGen video ID
        await updateWorkflowStatus(workflowId, 'abdullah', {
          heygenVideoId: videoResult.video_id
        } as any);

        // Calculate staggered post time if needed
        let scheduledTime: string | undefined;
        if (schedule === 'staggered') {
          // Post at: 9am, 12pm, 3pm, 6pm, 9pm (CDT)
          const postingHours = [9, 12, 15, 18, 21];
          const postDate = new Date(date);
          postDate.setHours(postingHours[i], 0, 0, 0);

          // If time has passed today, schedule for tomorrow
          if (postDate < new Date()) {
            postDate.setDate(postDate.getDate() + 1);
          }

          scheduledTime = postDate.toISOString();
          console.log(`   📅 Scheduled for: ${postDate.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT`);
        }

        workflowResults.push({
          theme: video.theme,
          title: video.title,
          workflowId,
          heygenVideoId: videoResult.video_id,
          scheduledTime,
          status: 'heygen_processing'
        });

      } catch (error) {
        console.error(`   ❌ Error generating video ${videoNumber}:`, error);

        workflowResults.push({
          theme: video.theme,
          title: video.title,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'failed'
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = workflowResults.filter(r => r.status !== 'failed').length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏁 ABDULLAH WORKFLOW COMPLETED (${duration}ms)`);
    console.log(`   Success: ${successCount}/${dailyContent.videos.length} videos`);
    console.log(`   Webhooks will handle: HeyGen → Submagic → Late posting`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount}/${dailyContent.videos.length} Abdullah videos successfully`,
      date: dailyContent.date,
      videos: workflowResults,
      platforms,
      schedule,
      tracking: {
        dashboard_url: 'https://ownerfi.ai/admin/social-dashboard',
        status_api: '/api/workflow/logs'
      },
      next_steps: [
        '⏳ HeyGen is generating videos (webhooks will notify when complete)',
        '⏳ Submagic will add captions and effects',
        '⏳ Videos will auto-post to Late.so',
        '📊 Monitor progress in the admin dashboard'
      ],
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ABDULLAH WORKFLOW ERROR (${duration}ms):`, error);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.log(`\n${'='.repeat(60)}\n`);

    return NextResponse.json(
      {
        success: false,
        error: 'Abdullah workflow failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

/**
 * Generate HeyGen video for Abdullah script
 */
async function generateAbdullahHeyGenVideo(
  script: AbdullahVideoScript,
  workflowId: string,
  apiKey: string
): Promise<{ success: boolean; video_id?: string; error?: string }> {
  try {
    // Get webhook URL for Abdullah brand
    const webhookUrl = getBrandWebhookUrl('abdullah', 'heygen');

    // Build HeyGen request using the helper from abdullah-content-generator
    const request = buildAbdullahVideoRequest(script, workflowId);

    // Add webhook URL to request
    const fullRequest = {
      ...request,
      webhook_url: webhookUrl,
      test: false
    };

    console.log(`   🚀 Sending to HeyGen...`);
    console.log(`   📞 Webhook: ${webhookUrl}`);

    // Call HeyGen API with circuit breaker
    const response = await circuitBreakers.heygen.execute(async () => {
      return await fetchWithTimeout(
        'https://api.heygen.com/v2/video/generate',
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify(fullRequest)
        },
        TIMEOUTS.HEYGEN_API
      );
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ HeyGen API error: ${response.status}`);
      console.error(`   ${errorText}`);
      return { success: false, error: `HeyGen API error: ${response.status}` };
    }

    const data = await response.json();

    if (!data.data || !data.data.video_id) {
      console.error(`   ❌ HeyGen response missing video_id:`, data);
      return { success: false, error: 'HeyGen did not return video_id' };
    }

    return { success: true, video_id: data.data.video_id };

  } catch (error) {
    console.error(`   ❌ HeyGen generation error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Support GET for manual triggering/testing
export async function GET(request: NextRequest) {
  return POST(request);
}
