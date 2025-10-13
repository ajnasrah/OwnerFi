// Cron Job for Automated Viral Video Generation
// Runs every 2 hours - serverless compatible (no persistent timers)

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕐 Cron job triggered - Processing viral video generation');

    // Import required modules
    const { initializeFeedSources, getFeedsToFetch } = await import('@/config/feed-sources');
    const { getAllFeedSources, getUnprocessedArticles } = await import('@/lib/feed-store');
    const { processFeedSources } = await import('@/lib/rss-fetcher');

    // Step 1: Initialize feeds if needed
    if (getAllFeedSources().length === 0) {
      console.log('🔧 Initializing feed sources...');
      initializeFeedSources();
      console.log(`✅ Initialized ${getAllFeedSources().length} feeds`);
    }

    // Step 2: Fetch new articles from RSS
    console.log('📥 Fetching RSS feeds...');
    const feedsToFetch = getFeedsToFetch(getAllFeedSources());

    let newArticles = 0;
    if (feedsToFetch.length > 0) {
      const result = await processFeedSources(feedsToFetch);
      newArticles = result.totalNewArticles;
      console.log(`✅ Fetched ${newArticles} new articles from ${result.totalProcessed} feeds`);
    } else {
      console.log('✅ All feeds up to date');
    }

    // Step 3: Process articles and generate videos immediately
    const carzArticles = getUnprocessedArticles('carz', 20);
    const ownerfiArticles = getUnprocessedArticles('ownerfi', 20);

    console.log(`📊 Articles available: ${carzArticles.length} Carz, ${ownerfiArticles.length} OwnerFi`);

    // Generate one video for each brand if articles available
    const results = [];

    if (carzArticles.length > 0) {
      console.log('🎬 Generating Carz video...');
      const carzResult = await generateVideo(carzArticles[0], 'carz');
      results.push({ brand: 'carz', ...carzResult });
    }

    if (ownerfiArticles.length > 0) {
      console.log('🎬 Generating OwnerFi video...');
      const ownerfiResult = await generateVideo(ownerfiArticles[0], 'ownerfi');
      results.push({ brand: 'ownerfi', ...ownerfiResult });
    }

    return NextResponse.json({
      success: true,
      message: 'Viral video cron job completed',
      stats: {
        feedsInitialized: getAllFeedSources().length,
        newArticlesFetched: newArticles,
        articlesAvailable: {
          carz: carzArticles.length,
          ownerfi: ownerfiArticles.length
        },
        videosGenerated: results.length
      },
      results,
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
    const { markArticleProcessed } = await import('@/lib/feed-store');

    // Call the complete viral video workflow
    const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

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
    markArticleProcessed(article.id, data.video?.heygen_video_id);

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

// Also support POST for Vercel/Railway cron
export async function POST(request: NextRequest) {
  return GET(request);
}
