// Video Generation Cron Job
// Runs 5 times daily (9am, 12pm, 3pm, 6pm, 9pm)
// Takes top-rated unprocessed article and generates video

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 VIDEO GENERATION CRON STARTED`);
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

    console.log(`🔍 Fetching unprocessed articles from Firestore...`);
    const carzArticles = await getUnprocessedArticles('carz', 5);
    console.log(`   Carz: Found ${carzArticles.length} articles`);

    const ownerfiArticles = await getUnprocessedArticles('ownerfi', 5);
    console.log(`   OwnerFi: Found ${ownerfiArticles.length} articles\n`);

    if (carzArticles.length > 0) {
      console.log(`📰 Top Carz articles:`);
      carzArticles.slice(0, 3).forEach((article, i) => {
        console.log(`   ${i + 1}. ${article.title?.substring(0, 60)}...`);
      });
    }

    if (ownerfiArticles.length > 0) {
      console.log(`📰 Top OwnerFi articles:`);
      ownerfiArticles.slice(0, 3).forEach((article, i) => {
        console.log(`   ${i + 1}. ${article.title?.substring(0, 60)}...`);
      });
    }
    console.log();

    const workflowsTriggered = [];
    const results = [];

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    // Trigger Carz workflow if articles available
    if (carzArticles.length > 0) {
      console.log('🎬 Triggering Carz video workflow...');
      console.log(`   Top article: ${carzArticles[0].title.substring(0, 60)}...`);

      try {
        const response = await fetch(`${baseUrl}/api/workflow/complete-viral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: 'carz',
            platforms: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'],
            schedule: 'immediate'
          })
        });

        const data = await response.json();

        workflowsTriggered.push('carz');
        results.push({
          brand: 'carz',
          success: response.ok,
          workflowId: data.workflow_id,
          article: carzArticles[0].title.substring(0, 60)
        });

        console.log(`✅ Carz workflow triggered: ${data.workflow_id}`);
      } catch (error) {
        console.error('❌ Carz workflow error:', error);
        results.push({
          brand: 'carz',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      console.log('⚠️  No unprocessed Carz articles available');
    }

    // Trigger OwnerFi workflow if articles available
    if (ownerfiArticles.length > 0) {
      console.log('🎬 Triggering OwnerFi video workflow...');
      console.log(`   Top article: ${ownerfiArticles[0].title.substring(0, 60)}...`);

      try {
        const response = await fetch(`${baseUrl}/api/workflow/complete-viral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: 'ownerfi',
            platforms: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'],
            schedule: 'immediate'
          })
        });

        const data = await response.json();

        workflowsTriggered.push('ownerfi');
        results.push({
          brand: 'ownerfi',
          success: response.ok,
          workflowId: data.workflow_id,
          article: ownerfiArticles[0].title.substring(0, 60)
        });

        console.log(`✅ OwnerFi workflow triggered: ${data.workflow_id}`);
      } catch (error) {
        console.error('❌ OwnerFi workflow error:', error);
        results.push({
          brand: 'ownerfi',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      console.log('⚠️  No unprocessed OwnerFi articles available');
    }

    const duration = Date.now() - startTime;

    if (workflowsTriggered.length === 0) {
      console.log(`⚠️  No workflows triggered - no unprocessed articles available`);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏁 CRON COMPLETED (${duration}ms) - No workflows created`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        success: true,
        message: 'No unprocessed articles available for video generation',
        articlesAvailable: {
          carz: carzArticles.length,
          ownerfi: ownerfiArticles.length
        },
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏁 CRON COMPLETED (${duration}ms) - ${workflowsTriggered.length} workflow(s) triggered`);
    console.log(`   Brands: ${workflowsTriggered.join(', ')}`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      message: `Triggered ${workflowsTriggered.length} video workflow(s)`,
      workflowsTriggered,
      results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ VIDEO GENERATION CRON ERROR (${duration}ms):`, error);
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
