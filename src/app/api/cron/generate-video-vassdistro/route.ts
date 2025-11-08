// VassDistro Video Generation Cron Job
// Runs 5 times daily (9am, 12pm, 3pm, 6pm, 9pm ET)
// Takes top-rated unprocessed article and generates video

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`💨 VASSDISTRO VIDEO GENERATION CRON STARTED`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Verify authorization - either via Bearer token OR admin session OR Vercel cron
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');

    console.log(`📋 Request details:`);
    console.log(`   User-Agent: ${userAgent}`);
    console.log(`   Has Auth Header: ${!!authHeader}`);
    console.log(`   CRON_SECRET set: ${!!CRON_SECRET}`);

    // Don't await getServerSession - it can timeout and block the cron
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

    console.log(`📚 Loading feed-store-firestore module...`);
    const { getUnprocessedArticles } = await import('@/lib/feed-store-firestore');
    console.log(`✅ Module loaded\n`);

    console.log(`🔍 Fetching unprocessed VassDistro articles from Firestore...`);
    const vassdistroArticles = await getUnprocessedArticles('vassdistro', 5);
    console.log(`   VassDistro: Found ${vassdistroArticles.length} articles\n`);

    if (vassdistroArticles.length > 0) {
      console.log(`📰 Top VassDistro articles:`);
      vassdistroArticles.slice(0, 3).forEach((article, i) => {
        console.log(`   ${i + 1}. ${article.title?.substring(0, 60)}...`);
      });
    }
    console.log();

    const results = [];

    // Import workflow handler directly instead of making HTTP call
    console.log(`📚 Loading complete-viral workflow module...`);
    const { POST: startWorkflow } = await import('@/app/api/workflow/complete-viral/route');
    console.log(`✅ Workflow module loaded\n`);

    // Trigger VassDistro workflow if articles available
    if (vassdistroArticles.length > 0) {
      console.log('💨 Triggering VassDistro video workflow...');
      console.log(`   Top article: ${vassdistroArticles[0].title.substring(0, 60)}...`);

      try {
        const mockRequest = new Request('https://ownerfi.ai/api/workflow/complete-viral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: 'vassdistro',
            platforms: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'],
            schedule: 'immediate'
          })
        });

        const response = await startWorkflow(mockRequest as any);
        const data = await response.json();

        results.push({
          brand: 'vassdistro',
          success: response.status === 200,
          workflowId: data.workflow_id,
          article: vassdistroArticles[0].title.substring(0, 60)
        });

        console.log(`✅ VassDistro workflow triggered: ${data.workflow_id}`);
      } catch (error) {
        console.error('❌ VassDistro workflow error:', error);
        results.push({
          brand: 'vassdistro',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      console.log('⚠️  No unprocessed VassDistro articles available');
    }

    const duration = Date.now() - startTime;

    if (results.length === 0) {
      console.log(`⚠️  No workflows triggered - no unprocessed articles available`);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 CRON COMPLETED (${duration}ms) - No workflows created`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        success: true,
        message: 'No unprocessed VassDistro articles available for video generation',
        articlesAvailable: vassdistroArticles.length,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏁 CRON COMPLETED (${duration}ms) - VassDistro workflow triggered`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      message: 'Triggered VassDistro video workflow',
      brand: 'vassdistro',
      results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ VASSDISTRO VIDEO GENERATION CRON ERROR (${duration}ms):`, error);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.log(`\n${'='.repeat(60)}\n`);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
