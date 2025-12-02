/**
 * Abdullah Mindset Video Cron
 * Runs daily at 8:30 AM CST (14:30 UTC)
 * Generates morning motivation video, posts at 9:00 AM
 */

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('🌅 MINDSET CRON - Morning Motivation Video');
  console.log(`Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);
  console.log('='.repeat(60) + '\n');

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      console.error('❌ Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Authorization passed\n');

    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    // 1. Generate script with ChatGPT
    console.log('Step 1: Generating MINDSET script with OpenAI...');
    const { generateSingleAbdullahScript } = await import('@/lib/abdullah-content-generator');

    const script = await generateSingleAbdullahScript('mindset');

    console.log(`✅ Script generated:`);
    console.log(`   Title: "${script.title}"`);
    console.log(`   Hook: "${script.hook}"`);
    console.log(`   Script length: ${script.script.length} chars`);
    console.log();

    // 2. Create workflow
    console.log('Step 2: Creating workflow in database...');
    const { addWorkflowToQueue, updateWorkflowStatus } = await import('@/lib/feed-store-firestore');

    const workflow = await addWorkflowToQueue(
      `abdullah_mindset_${Date.now()}`,
      script.title,
      'abdullah'
    );

    console.log(`✅ Workflow created: ${workflow.id}`);

    // Calculate post time (9:00 AM CST)
    const postTime = new Date();
    postTime.setHours(9, 0, 0, 0);
    if (postTime < new Date()) {
      postTime.setDate(postTime.getDate() + 1);
    }

    await updateWorkflowStatus(workflow.id, 'abdullah', {
      caption: script.caption,
      title: script.title,
      status: 'heygen_processing',
      scheduledPostTime: postTime.getTime()
    } as any);

    console.log(`✅ Scheduled to post at: ${postTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);
    console.log();

    // 3. Build HeyGen request with agent rotation
    console.log('Step 3: Preparing HeyGen video request (with agent rotation)...');
    const { buildAbdullahVideoRequestWithAgent } = await import('@/lib/abdullah-content-generator');
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');

    const { request: videoRequest, agentId } = await buildAbdullahVideoRequestWithAgent(script, workflow.id);
    const webhookUrl = getBrandWebhookUrl('abdullah', 'heygen');

    console.log(`   Webhook URL: ${webhookUrl}`);
    console.log(`   Agent: ${agentId}`);

    // 4. Send to HeyGen
    console.log('Step 4: Sending to HeyGen API...');

    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      },
      body: JSON.stringify({
        ...videoRequest,
        webhook_url: webhookUrl,
        test: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const videoId = data.data?.video_id;

    if (!videoId) {
      throw new Error('HeyGen did not return video_id');
    }

    console.log(`✅ HeyGen video initiated: ${videoId}`);
    console.log();

    // 5. Update workflow with video ID and agent
    console.log('Step 5: Updating workflow with HeyGen video ID...');
    await updateWorkflowStatus(workflow.id, 'abdullah', {
      heygenVideoId: videoId,
      agentId
    } as any);

    console.log(`✅ Workflow updated`);

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('✅ MINDSET CRON COMPLETED SUCCESSFULLY');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Workflow ID: ${workflow.id}`);
    console.log(`   HeyGen ID: ${videoId}`);
    console.log(`   Will post at: 9:00 AM CST`);
    console.log('='.repeat(60) + '\n');

    console.log('⏳ Next steps (handled by webhooks):');
    console.log('   1. HeyGen processes video (5-10 min)');
    console.log('   2. Webhook receives completion → sends to Submagic');
    console.log('   3. Submagic adds captions (10-15 min)');
    console.log('   4. Webhook receives completion → posts to social media');
    console.log();

    return NextResponse.json({
      success: true,
      theme: 'mindset',
      workflowId: workflow.id,
      heygenVideoId: videoId,
      title: script.title,
      caption: script.caption,
      postTime: '9:00 AM CST',
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('\n' + '='.repeat(60));
    console.error('❌ MINDSET CRON FAILED');
    console.error(`   Duration: ${duration}ms`);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.error('='.repeat(60) + '\n');

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
