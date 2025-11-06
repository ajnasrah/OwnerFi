// Abdullah Personal Brand Cron
// Runs 5 times daily - generates 1 video per run based on time of day
// 9 AM = Mindset, 12 PM = Business, 3 PM = Money, 6 PM = Freedom, 9 PM = Story

import { NextRequest, NextResponse } from 'next/server';
import { generateSingleAbdullahScript, buildAbdullahVideoRequest } from '@/lib/abdullah-content-generator';
import { addWorkflowToQueue, updateWorkflowStatus } from '@/lib/feed-store-firestore';
import { circuitBreakers, fetchWithTimeout, TIMEOUTS } from '@/lib/api-utils';
import { getBrandWebhookUrl } from '@/lib/brand-utils';

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

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      console.error('❌ Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate API keys
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

    // Step 2: Create workflow queue item with videoIndex
    console.log('📝 Step 2: Creating workflow...');

    // Calculate video index (which post of the day this is: 0-4)
    const { getWorkflowsCreatedToday } = await import('@/lib/feed-store-firestore');
    const todayWorkflows = await getWorkflowsCreatedToday('abdullah');
    const videoIndex = todayWorkflows.length; // 0-based index

    console.log(`   This is video ${videoIndex + 1} of the day for abdullah`);

    const queueItem = await addWorkflowToQueue(
      `abdullah_${theme}_${Date.now()}`,
      script.title,
      'abdullah',
      videoIndex // Pass video index for optimal time slot distribution
    );

    const workflowId = queueItem.id;
    console.log(`   Workflow ID: ${workflowId} (videoIndex: ${videoIndex})`);

    // Update with caption and title for webhooks
    await updateWorkflowStatus(workflowId, 'abdullah', {
      caption: script.caption,
      title: script.title,
      status: 'heygen_processing'
    } as any);

    // Step 3: Generate HeyGen video
    console.log('\n🎥 Step 3: Sending to HeyGen...');
    const webhookUrl = getBrandWebhookUrl('abdullah', 'heygen');
    const videoRequest = buildAbdullahVideoRequest(script, workflowId);

    const fullRequest = {
      ...videoRequest,
      webhook_url: webhookUrl,
      test: false
    };

    console.log(`   Webhook: ${webhookUrl}`);

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

    const heygenVideoId = data.data.video_id;
    console.log(`✅ HeyGen video ID: ${heygenVideoId}`);

    // Update workflow with HeyGen video ID
    await updateWorkflowStatus(workflowId, 'abdullah', {
      heygenVideoId
    } as any);

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log(`🏁 ABDULLAH CRON COMPLETED (${duration}ms)`);
    console.log(`   Theme: ${theme}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   HeyGen Video ID: ${heygenVideoId}`);
    console.log(`   Webhooks will handle: HeyGen → Submagic → Late posting`);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      theme,
      title: script.title,
      workflowId,
      heygenVideoId,
      message: `Abdullah ${theme} video created successfully`,
      next_steps: [
        '⏳ HeyGen is generating video (webhooks will notify when complete)',
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
}

// Support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
