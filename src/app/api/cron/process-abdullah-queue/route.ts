/**
 * Abdullah Queue Processor Cron
 *
 * Runs 5x daily at: 8:30am, 11:30am, 2:30pm, 5:30pm, 8:30pm CST
 * Processes ONE pending queue item at a time to prevent overwhelming APIs
 *
 * Flow:
 * 1. Get next pending queue item (if scheduled time has arrived)
 * 2. Generate HeyGen video
 * 3. Mark as "generating" and let webhooks handle the rest
 * 4. Exit (next cron run will process next item)
 */

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ABDULLAH QUEUE PROCESSOR STARTED');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      console.error('❌ Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Authorization passed\n');

    // Validate API key
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    // Import queue system
    const { getNextPendingItem, updateQueueItem, getQueueStats } = await import('@/lib/abdullah-queue');
    const { buildAbdullahVideoRequest } = await import('@/lib/abdullah-content-generator');
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const { addWorkflowToQueue, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');
    const { circuitBreakers, fetchWithTimeout, TIMEOUTS } = await import('@/lib/api-utils');

    // Get queue stats
    const stats = await getQueueStats();
    console.log('📊 Queue Statistics:');
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Generating: ${stats.generating}`);
    console.log(`   Completed Today: ${stats.completedToday}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log();

    // Get next pending item
    const queueItem = await getNextPendingItem();

    if (!queueItem) {
      console.log('⏭️  No pending items ready for processing');
      console.log('   Either all items processed or scheduled times not yet arrived');

      const duration = Date.now() - startTime;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 ABDULLAH QUEUE PROCESSOR COMPLETED (${duration}ms)`);
      console.log(`   Status: NO ITEMS TO PROCESS`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'No pending items ready for processing',
        stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📹 Processing Queue Item: ${queueItem.id}`);
    console.log(`   Theme: ${queueItem.theme}`);
    console.log(`   Title: ${queueItem.title}`);
    console.log(`   Priority: ${queueItem.priority}/5`);
    console.log(`   Scheduled Generation: ${queueItem.scheduledGenerationTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);
    console.log(`   Scheduled Post: ${queueItem.scheduledPostTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);
    console.log();

    // Mark as generating (atomic operation to prevent race conditions)
    await updateQueueItem(queueItem.id!, {
      status: 'generating',
      updatedAt: new Date()
    });

    console.log('✅ Marked as generating');
    console.log();

    try {
      // Create workflow tracking
      const workflow = await addWorkflowToQueue(
        `abdullah_queue_${queueItem.id}`,
        queueItem.title,
        'abdullah'
      );

      console.log(`📋 Created workflow: ${workflow.id}`);

      // Update workflow with caption and title
      await updateWorkflowStatus(workflow.id, 'abdullah', {
        caption: queueItem.caption,
        title: queueItem.title,
        status: 'heygen_processing'
      } as any);

      // Update queue item with workflow ID
      await updateQueueItem(queueItem.id!, {
        workflowId: workflow.id
      });

      // Build HeyGen request
      const videoRequest = buildAbdullahVideoRequest(
        {
          theme: queueItem.theme,
          title: queueItem.title,
          script: queueItem.script,
          caption: queueItem.caption,
          hook: queueItem.hook
        },
        workflow.id
      );

      // Get webhook URL
      const webhookUrl = getBrandWebhookUrl('abdullah', 'heygen');

      const fullRequest = {
        ...videoRequest,
        webhook_url: webhookUrl,
        test: false
      };

      console.log(`🚀 Sending to HeyGen...`);
      console.log(`   Webhook: ${webhookUrl}`);
      console.log();

      // Call HeyGen API
      const response = await circuitBreakers.heygen.execute(async () => {
        return await fetchWithTimeout(
          'https://api.heygen.com/v2/video/generate',
          {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'x-api-key': HEYGEN_API_KEY
            },
            body: JSON.stringify(fullRequest)
          },
          TIMEOUTS.HEYGEN_API
        );
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.video_id) {
        throw new Error('HeyGen did not return video_id');
      }

      const videoId = data.data.video_id;
      console.log(`✅ HeyGen video initiated: ${videoId}`);

      // Update workflow with video ID
      await updateWorkflowStatus(workflow.id, 'abdullah', {
        heygenVideoId: videoId
      } as any);

      // Update queue item
      await updateQueueItem(queueItem.id!, {
        heygenVideoId: videoId,
        generatedAt: new Date()
      });

      console.log(`\n⏳ Video is processing...`);
      console.log(`   Webhooks will handle: HeyGen → Submagic → Late posting`);
      console.log(`   Post will go live at: ${queueItem.scheduledPostTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);

      const duration = Date.now() - startTime;
      const updatedStats = await getQueueStats();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 ABDULLAH QUEUE PROCESSOR COMPLETED (${duration}ms)`);
      console.log(`   Status: SUCCESS`);
      console.log(`   Theme: ${queueItem.theme}`);
      console.log(`   Video ID: ${videoId}`);
      console.log(`   Queue: ${updatedStats.pending} pending, ${updatedStats.generating} generating`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        success: true,
        message: 'Queue item processed successfully',
        queueItem: {
          id: queueItem.id,
          theme: queueItem.theme,
          title: queueItem.title,
          workflowId: workflow.id,
          heygenVideoId: videoId,
          scheduledPostTime: queueItem.scheduledPostTime
        },
        stats: updatedStats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ Error processing queue item:`, error);

      // Mark as failed
      await updateQueueItem(queueItem.id!, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: queueItem.retryCount + 1
      });

      throw error;
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ QUEUE PROCESSOR ERROR (${duration}ms):`, error);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.log(`\n${'='.repeat(60)}\n`);

    return NextResponse.json(
      {
        success: false,
        error: 'Queue processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
