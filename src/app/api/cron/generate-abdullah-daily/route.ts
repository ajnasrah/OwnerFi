// Abdullah Daily Content Cron Job
// Runs once daily at 6:00 AM CST
// Generates 5 personal brand videos and schedules staggered posting throughout the day

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

    console.log(`📅 Generating content for: ${dayName}, ${today.toLocaleDateString()}`);
    console.log();

    // Import and call the Abdullah workflow directly
    console.log(`📚 Loading complete-abdullah workflow module...`);
    const { POST: startAbdullahWorkflow } = await import('@/app/api/workflow/complete-abdullah/route');
    console.log(`✅ Workflow module loaded\n`);

    console.log('🎬 Triggering Abdullah daily content workflow...');
    console.log(`   Theme: ${dayName} content mix`);
    console.log(`   Videos: 5 (Mindset, Business, Money, Freedom, Story/Lesson)`);
    console.log(`   Schedule: Staggered posting (9am, 12pm, 3pm, 6pm, 9pm CST)`);
    console.log();

    try {
      // Create mock request with staggered scheduling
      const mockRequest = new Request('https://ownerfi.ai/api/workflow/complete-abdullah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
          schedule: 'staggered', // Posts throughout the day
          date: today.toISOString()
        })
      });

      const response = await startAbdullahWorkflow(mockRequest as any);
      const data = await response.json();

      const duration = Date.now() - startTime;

      if (response.status === 200 && data.success) {
        console.log(`✅ Abdullah workflow triggered successfully`);
        console.log(`   Videos generated: ${data.videos?.length || 0}`);

        // Log each video's schedule
        if (data.videos && Array.isArray(data.videos)) {
          console.log(`\n📋 Video Schedule:`);
          data.videos.forEach((video: any, i: number) => {
            if (video.scheduledTime) {
              const scheduleDate = new Date(video.scheduledTime);
              console.log(`   ${i + 1}. ${video.theme}: ${scheduleDate.toLocaleTimeString('en-US', {
                timeZone: 'America/Chicago',
                hour: 'numeric',
                minute: '2-digit'
              })} CST`);
            } else {
              console.log(`   ${i + 1}. ${video.theme}: ${video.status || 'pending'}`);
            }
          });
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏁 ABDULLAH DAILY CRON COMPLETED (${duration}ms)`);
        console.log(`   Status: SUCCESS`);
        console.log(`   Videos: ${data.videos?.length || 0} generated`);
        console.log(`   Next Run: Tomorrow at 6:00 AM CST`);
        console.log(`${'='.repeat(60)}\n`);

        return NextResponse.json({
          success: true,
          message: 'Abdullah daily content generated successfully',
          date: today.toISOString(),
          dayName,
          videos: data.videos || [],
          platforms: data.platforms || [],
          schedule: 'staggered',
          tracking: data.tracking,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        });

      } else {
        throw new Error(data.error || 'Workflow failed');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Abdullah workflow error:`, error);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 ABDULLAH DAILY CRON FAILED (${duration}ms)`);
      console.log(`   Status: FAILED`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json(
        {
          success: false,
          error: 'Abdullah workflow failed',
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
