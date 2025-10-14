import { NextRequest, NextResponse } from 'next/server';
import { getAllFeedSources, processFeedSources } from '@/lib/feed-store-firestore';
import { processFeedSource } from '@/lib/rss-fetcher';

/**
 * Daily Article Fetch & Rating Cron Job
 * Runs once per day at 12pm
 *
 * Process:
 * 1. Fetch new articles from all RSS feeds
 * 2. Auto-trigger AI rating for unrated articles
 * 3. Keep top 10 articles per brand
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('📰 Starting daily article fetch cron...');

    // Get all feed sources
    const feedSources = await getAllFeedSources();

    if (!feedSources || feedSources.length === 0) {
      console.log('⚠️  No feed sources found');
      return NextResponse.json({
        success: true,
        message: 'No feed sources configured'
      });
    }

    console.log(`📡 Found ${feedSources.length} feed sources`);

    // Process all feeds in parallel
    const results = await Promise.allSettled(
      feedSources.map(feed => processFeedSource(feed))
    );

    let totalNewArticles = 0;
    const errors: string[] = [];
    const brandsThatNeedRating = new Set<'carz' | 'ownerfi'>();

    results.forEach((result, index) => {
      const feedSource = feedSources[index];
      if (result.status === 'fulfilled') {
        const newArticles = result.value.newArticles;
        totalNewArticles += newArticles;

        if (newArticles > 0) {
          // Track which brands need rating
          brandsThatNeedRating.add(feedSource.category);
        }

        if (result.value.error) {
          errors.push(`${feedSource.name}: ${result.value.error}`);
        }
      } else {
        errors.push(`${feedSource.name}: ${result.reason.message}`);
      }
    });

    console.log(`✅ Fetch complete: ${totalNewArticles} new articles found`);

    // Trigger rating for brands that have new articles
    if (brandsThatNeedRating.size > 0) {
      console.log(`🤖 Triggering AI rating for: ${Array.from(brandsThatNeedRating).join(', ')}`);

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

      // Trigger rating for each brand (fire and forget)
      for (const brand of brandsThatNeedRating) {
        fetch(`${baseUrl}/api/articles/rate-brand`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand })
        }).catch(err => {
          console.error(`Failed to trigger rating for ${brand}:`, err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalNewArticles,
      feedsProcessed: feedSources.length,
      brandsRated: Array.from(brandsThatNeedRating),
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Article fetch cron failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
