// Cron Job for Automated Viral Video Generation
// Runs every 2 hours - serverless compatible (no persistent timers)

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

    console.log('🕐 Simplified cron - Fetch RSS and trigger workflows only');

    // Import required modules
    const { initializeFeedSources, getFeedsToFetch } = await import('@/config/feed-sources');
    const { getAllFeedSources, getUnprocessedArticles } = await import('@/lib/feed-store-firestore');
    const { processFeedSources } = await import('@/lib/rss-fetcher');

    // Step 1: Initialize feeds if needed (Firestore)
    const existingFeeds = await getAllFeedSources();
    if (existingFeeds.length === 0) {
      console.log('🔧 Initializing feed sources in Firestore...');
      await initializeFeedSources();
      console.log(`✅ Initialized feeds in Firestore`);
    }

    // Step 2: Fetch new articles from RSS
    console.log('📥 Fetching RSS feeds...');
    const allFeeds = await getAllFeedSources();
    const feedsToFetch = getFeedsToFetch(allFeeds);

    let newArticles = 0;
    if (feedsToFetch.length > 0) {
      const result = await processFeedSources(feedsToFetch);
      newArticles = result.totalNewArticles;
      console.log(`✅ Fetched ${newArticles} new articles from ${result.totalProcessed} feeds`);
    } else {
      console.log('✅ All feeds up to date');
    }

    // Step 3: Check if we have articles to process
    const carzArticles = await getUnprocessedArticles('carz', 5);
    const ownerfiArticles = await getUnprocessedArticles('ownerfi', 5);

    console.log(`📊 Top articles available: ${carzArticles.length} Carz, ${ownerfiArticles.length} OwnerFi`);

    // Trigger video generation in background (fire and forget)
    const workflowsTriggered = [];

    // Get base URL (production or development)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    if (carzArticles.length > 0) {
      console.log('🎬 Triggering Carz video workflow...');
      // Fire and forget - don't await
      fetch(`${baseUrl}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'carz',
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'immediate'
        })
      }).catch(err => console.error('Carz workflow error:', err));
      workflowsTriggered.push('carz');
    }

    if (ownerfiArticles.length > 0) {
      console.log('🎬 Triggering OwnerFi video workflow...');
      // Fire and forget - don't await
      fetch(`${baseUrl}/api/workflow/complete-viral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'ownerfi',
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
          schedule: 'immediate'
        })
      }).catch(err => console.error('OwnerFi workflow error:', err));
      workflowsTriggered.push('ownerfi');
    }

    const finalFeedsCount = (await getAllFeedSources()).length;

    return NextResponse.json({
      success: true,
      message: `Triggered ${workflowsTriggered.length} video workflow(s) - processing in background`,
      stats: {
        feedsInitialized: finalFeedsCount,
        newArticlesFetched: newArticles,
        workflowsTriggered: workflowsTriggered.length
      },
      workflowsTriggered,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
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

// Helper function to generate a single video
async function generateVideo(article: any, brand: 'carz' | 'ownerfi') {
  try {
    const { markArticleProcessed } = await import('@/lib/feed-store-firestore');

    // Call the complete viral video workflow
    // In development, use localhost. In production, use the public URL
    const API_BASE_URL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai');

    const response = await fetch(`${API_BASE_URL}/api/workflow/complete-viral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        brand,
        platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
        schedule: 'immediate'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Workflow failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Mark article as processed
    await markArticleProcessed(article.id, brand, data.video?.heygen_video_id);

    console.log(`✅ Video generated for ${brand}: ${data.video?.heygen_video_id}`);

    return {
      success: true,
      article: article.title.substring(0, 60),
      videoId: data.video?.heygen_video_id,
      postId: data.social?.post_id
    };

  } catch (error) {
    console.error(`❌ Failed to generate ${brand} video:`, error);
    return {
      success: false,
      article: article.title.substring(0, 60),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Also support POST for Vercel/Railway cron and admin dashboard
export async function POST(request: NextRequest) {
  return GET(request);
}
