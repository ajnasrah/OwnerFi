// Abdullah Daily Content Cron Job
// Runs once daily at 11:00 AM CST
// Generates 5 scripts and adds them to the queue for staggered processing throughout the day

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 ABDULLAH DAILY CONTENT CRON STARTED`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Verify authorization - either via Bearer token OR Vercel cron
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');

    console.log(`📋 Request details:`);
    console.log(`   User-Agent: ${userAgent}`);
    console.log(`   Has Auth Header: ${!!authHeader}`);
    console.log(`   CRON_SECRET set: ${!!CRON_SECRET}`);

    const isVercelCron = userAgent === 'vercel-cron/1.0';

    console.log(`   Is Vercel Cron: ${isVercelCron}`);

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      console.error(`❌ Authorization failed - rejecting request`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`✅ Authorization passed\n`);

    // Get today's date
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

    console.log(`📅 Generating scripts for: ${dayName}, ${today.toLocaleDateString()}`);
    console.log();

    // Import queue system and content generator
    console.log(`📚 Loading Abdullah queue system...`);
    const { addScriptsToQueue, hasQueuedItemsForToday, getQueueStats } = await import('@/lib/abdullah-queue');
    const { generateAbdullahDailyContent } = await import('@/lib/abdullah-content-generator');
    console.log(`✅ Queue system loaded\n`);

    // Check if we already queued items today
    const alreadyQueued = await hasQueuedItemsForToday();
    if (alreadyQueued) {
      console.log('⏭️  Already queued scripts for today - skipping');
      const stats = await getQueueStats();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 ABDULLAH DAILY CRON SKIPPED (${Date.now() - startTime}ms)`);
      console.log(`   Status: ALREADY QUEUED`);
      console.log(`   Queue Stats: ${stats.pending} pending, ${stats.generating} generating, ${stats.completedToday} completed today`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Scripts already queued for today',
        stats,
        timestamp: new Date().toISOString()
      });
    }

    console.log('🤖 Generating 5 daily video scripts with OpenAI...');
    console.log(`   Themes: Mindset, Business, Money, Freedom, Story/Lesson`);
    console.log();

    try {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Generate all 5 scripts at once (fast, just AI text generation)
      const dailyContent = await generateAbdullahDailyContent(OPENAI_API_KEY, today);

      console.log(`✅ Generated ${dailyContent.videos.length} scripts:`);
      dailyContent.videos.forEach((video, i) => {
        console.log(`   ${i + 1}. ${video.theme}: "${video.title}"`);
      });
      console.log();

      // Add all scripts to queue for staggered processing
      console.log('📝 Adding scripts to processing queue...');
      const queueIds = await addScriptsToQueue(dailyContent.videos);

      console.log(`\n✅ Successfully queued ${queueIds.length} scripts`);
      console.log(`   Processing cron will generate videos one at a time`);
      console.log(`   Schedule: 8:30am, 11:30am, 2:30pm, 5:30pm, 8:30pm CST`);
      console.log(`   Posting: 9am, 12pm, 3pm, 6pm, 9pm CST (after processing)`);

      const duration = Date.now() - startTime;
      const stats = await getQueueStats();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 ABDULLAH DAILY CRON COMPLETED (${duration}ms)`);
      console.log(`   Status: SUCCESS`);
      console.log(`   Scripts Queued: ${queueIds.length}`);
      console.log(`   Queue Stats: ${stats.pending} pending, ${stats.generating} generating`);
      console.log(`   Next Run: Tomorrow at 11:00 AM CST`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        success: true,
        message: 'Abdullah daily scripts queued successfully',
        date: today.toISOString(),
        dayName,
        scripts: dailyContent.videos.map((v, i) => ({
          theme: v.theme,
          title: v.title,
          queueId: queueIds[i]
        })),
        queueIds,
        stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Script generation error:`, error);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 ABDULLAH DAILY CRON FAILED (${duration}ms)`);
      console.log(`   Status: FAILED`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json(
        {
          success: false,
          error: 'Script generation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ABDULLAH DAILY CRON ERROR (${duration}ms):`, error);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.log(`\n${'='.repeat(60)}\n`);

    return NextResponse.json(
      {
        success: false,
        error: 'Cron execution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
