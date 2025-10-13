// Weekly Maintenance Cron
// Runs once per week to clean up articles and workflows
// Keep only top 20 articles per brand based on quality and recency

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization - either via Bearer token OR admin session
    const authHeader = request.headers.get('authorization');
    const session = await getServerSession(authOptions as any);
    const isAdmin = session?.user && (session.user as any).role === 'admin';

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🗓️ Weekly maintenance cron triggered');

    const {
      cleanupLowQualityArticles,
      cleanupProcessedArticles,
      cleanupCompletedWorkflows
    } = await import('@/lib/feed-store-firestore');

    // Step 1: Keep only top 20 unprocessed articles per brand (by recency)
    console.log('📊 Cleaning up articles - keeping top 20 per brand...');
    const articleCleanup = await cleanupLowQualityArticles(20);

    console.log(`   Carz: ${articleCleanup.carz} articles deleted`);
    console.log(`   OwnerFi: ${articleCleanup.ownerfi} articles deleted`);

    // Step 2: Delete processed articles older than 30 days
    console.log('🧹 Cleaning up old processed articles (>30 days)...');
    const processedCleanup = await cleanupProcessedArticles(30);

    console.log(`   Carz: ${processedCleanup.carz} processed articles deleted`);
    console.log(`   OwnerFi: ${processedCleanup.ownerfi} processed articles deleted`);

    // Step 3: Delete completed workflows older than 7 days
    console.log('🧹 Cleaning up old workflows (>7 days)...');
    const workflowCleanup = await cleanupCompletedWorkflows(24 * 7); // 7 days in hours

    console.log(`   ${workflowCleanup} completed workflows deleted`);

    return NextResponse.json({
      success: true,
      message: 'Weekly maintenance completed successfully',
      results: {
        articlesDeleted: {
          carz: articleCleanup.carz,
          ownerfi: articleCleanup.ownerfi
        },
        processedArticlesDeleted: {
          carz: processedCleanup.carz,
          ownerfi: processedCleanup.ownerfi
        },
        workflowsDeleted: workflowCleanup
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Weekly maintenance error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Also support POST for Vercel/Railway cron
export async function POST(request: NextRequest) {
  return GET(request);
}
