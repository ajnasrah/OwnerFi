// Abdullah Personal Brand Cron
// Runs 5 times daily - generates 1 video per run based on time of day
// 9 AM = Mindset, 12 PM = Business, 3 PM = Money, 6 PM = Freedom, 9 PM = Story
// NOW WITH MULTI-AGENT SUPPORT - uses agent pool for variety

import { NextRequest, NextResponse } from 'next/server';
import { generateSingleAbdullahScript, buildAbdullahVideoRequestWithAgent } from '@/lib/abdullah-content-generator';
import { addWorkflowToQueue, updateWorkflowStatus } from '@/lib/feed-store-firestore';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { getBrandWebhookUrl } from '@/lib/brand-utils';
import { withCronLock } from '@/lib/cron-lock';

const CRON_SECRET = process.env.CRON_SECRET;
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Theme schedule based on hour (CST)
const THEME_SCHEDULE: Record<number, 'mindset' | 'business' | 'money' | 'freedom' | 'story'> = {
  9: 'mindset',   // Morning motivation
  12: 'business', // Lunch break hustle
  15: 'money',    // Afternoon wealth mindset
  18: 'freedom',  // Evening freedom dreams
  21: 'story'     // Night reflection
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(60));
  console.log('🎯 ABDULLAH PERSONAL BRAND CRON STARTED');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  // Verify authorization first (before acquiring lock)
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const isVercelCron = userAgent === 'vercel-cron/1.0';

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
    console.error('❌ Authorization failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use cron lock to prevent concurrent execution
  const result = await withCronLock('abdullah-cron', async () => {
    try {

    // Validate API keys
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Determine video provider
    const { videoProvider } = await import('@/lib/env-config');
    const activeProvider = videoProvider;
    console.log(`🎥 Video provider: ${activeProvider}`);

    if (activeProvider === 'heygen' && !HEYGEN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'HEYGEN_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Determine theme based on current hour (CST)
    const now = new Date();
    const cstHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getHours();

    // Find closest matching hour from schedule
    const scheduledHours = Object.keys(THEME_SCHEDULE).map(Number).sort((a, b) => a - b);
    const closestHour = scheduledHours.reduce((prev, curr) =>
      Math.abs(curr - cstHour) < Math.abs(prev - cstHour) ? curr : prev
    );

    const theme = THEME_SCHEDULE[closestHour];

    console.log(`📅 Current time: ${now.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);
    console.log(`🎨 Theme for this run: ${theme.toUpperCase()}`);
    console.log();

    // Step 1: Generate script with OpenAI
    console.log('🤖 Step 1: Generating video script...');
    const script = await generateSingleAbdullahScript(theme, OPENAI_API_KEY);

    console.log(`✅ Generated script:`);
    console.log(`   Theme: ${script.theme}`);
    console.log(`   Title: ${script.title}`);
    console.log(`   Hook: ${script.hook}`);
    console.log(`   Script: ${script.script.substring(0, 80)}...`);
    console.log();

    // Step 2: Create workflow queue item
    // IMPORTANT: Use date-based articleId (not timestamp) for deduplication
    // This prevents creating duplicate videos if cron runs multiple times in same hour
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const articleId = `abdullah_${theme}_${today}_${closestHour}h`;

    console.log('📝 Step 2: Creating workflow...');
    console.log(`   Article ID: ${articleId} (dedup key)`);

    let queueItem;
    try {
      queueItem = await addWorkflowToQueue(
        articleId,
        script.title,
        'abdullah'
      );
    } catch (queueError) {
      // Handle duplicate workflow error gracefully
      if (queueError instanceof Error && queueError.message.includes('Duplicate workflow blocked')) {
        console.warn(`⚠️  ${queueError.message}`);
        return NextResponse.json({
          success: false,
          error: 'Duplicate workflow',
          message: queueError.message,
          theme,
          articleId
        }, { status: 409 }); // 409 Conflict
      }
      throw queueError; // Re-throw other errors
    }

    const workflowId = queueItem.id;
    console.log(`   Workflow ID: ${workflowId}`);

    let videoId: string;
    let agentId: string;

    if (activeProvider === 'synthesia') {
      // Step 3: Generate Synthesia video
      console.log('\n🎥 Step 3: Sending to Synthesia...');
      const { generateSynthesiaVideo } = await import('@/lib/synthesia-client');
      const { getSynthesiaAgentForBrand, buildSynthesiaClipConfig } = await import('@/config/synthesia-agents');

      const synthAgent = getSynthesiaAgentForBrand('abdullah');
      const clip = buildSynthesiaClipConfig(synthAgent, script.script);

      const result = await generateSynthesiaVideo(
        {
          title: script.title,
          aspectRatio: '9:16',
          clips: [clip],
          callbackId: `abdullah:${workflowId}`,
        },
        'abdullah',
        workflowId
      );

      if (!result.success || !result.video_id) {
        await updateWorkflowStatus(workflowId, 'abdullah', {
          status: 'failed',
          error: result.error || 'Synthesia video generation failed'
        } as any);
        throw new Error(result.error || 'Synthesia video generation failed');
      }

      videoId = result.video_id;
      agentId = synthAgent.id;

      await updateWorkflowStatus(workflowId, 'abdullah', {
        caption: script.caption,
        title: script.title,
        synthesiaVideoId: videoId,
        videoProvider: 'synthesia',
        agentId,
        status: 'synthesia_processing'
      } as any);

      console.log(`✅ Synthesia video ID: ${videoId}`);
    } else {
      // Step 3: Generate HeyGen video with agent rotation
      console.log('\n🎥 Step 3: Sending to HeyGen (with agent rotation)...');

      await updateWorkflowStatus(workflowId, 'abdullah', {
        caption: script.caption,
        title: script.title,
        status: 'heygen_processing'
      } as any);

      const webhookUrl = getBrandWebhookUrl('abdullah', 'heygen');
      const { request: videoRequest, agentId: heygenAgentId } = await buildAbdullahVideoRequestWithAgent(script, workflowId);

      const fullRequest = {
        ...videoRequest,
        webhook_url: webhookUrl,
        test: false
      };

      console.log(`   Webhook: ${webhookUrl}`);
      console.log(`   Agent: ${heygenAgentId}`);

      const response = await circuitBreakers.heygen.execute(async () => {
        return await fetchWithTimeout(
          'https://api.heygen.com/v2/video/generate',
          {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'x-api-key': HEYGEN_API_KEY!
            },
            body: JSON.stringify(fullRequest)
          },
          TIMEOUTS.HEYGEN_API
        );
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HeyGen API error: ${response.status}`);
        console.error(`   ${errorText}`);

        await updateWorkflowStatus(workflowId, 'abdullah', {
          status: 'failed',
          error: `HeyGen error: ${response.status}`
        } as any);

        throw new Error(`HeyGen API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.video_id) {
        console.error('❌ HeyGen response missing video_id:', data);
        throw new Error('HeyGen did not return video_id');
      }

      videoId = data.data.video_id;
      agentId = heygenAgentId;

      await updateWorkflowStatus(workflowId, 'abdullah', {
        heygenVideoId: videoId,
        videoProvider: 'heygen',
        agentId
      } as any);

      console.log(`✅ HeyGen video ID: ${videoId}`);
    }

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log(`🏁 ABDULLAH CRON COMPLETED (${duration}ms)`);
    console.log(`   Theme: ${theme}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Video ID: ${videoId} (${activeProvider})`);
    console.log(`   Webhooks will handle: ${activeProvider} → Submagic → Late posting`);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      theme,
      title: script.title,
      workflowId,
      videoId,
      provider: activeProvider,
      message: `Abdullah ${theme} video created successfully`,
      next_steps: [
        `⏳ ${activeProvider} is generating video (webhooks will notify when complete)`,
        '⏳ Submagic will add captions and effects',
        '⏳ Video will auto-post to Late.so at optimal time'
      ],
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ABDULLAH CRON ERROR (${duration}ms):`, error);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.log('\n' + '='.repeat(60) + '\n');

    return NextResponse.json(
      {
        success: false,
        error: 'Abdullah cron failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
    }
  }); // End withCronLock

  // If lock wasn't acquired, return early
  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true
    }, { status: 200 });
  }

  return result;
}

// Support POST for manual triggering
export async function POST(_request: NextRequest) {
  return GET(_request);
}
