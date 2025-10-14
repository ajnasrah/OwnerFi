import { NextRequest, NextResponse } from 'next/server';
import { rateAndCleanupArticles } from '@/lib/feed-store-firestore';

/**
 * Auto-rate articles for a brand (background job)
 * Triggered automatically by daily cron job
 *
 * Process:
 * 1. Rates ALL unprocessed & unrated articles with AI
 * 2. Keeps top 10 highest-scoring articles
 * 3. Deletes lower-quality articles
 */
export async function POST(request: NextRequest) {
  try {
    const { brand } = await request.json();

    if (!brand || (brand !== 'carz' && brand !== 'ownerfi')) {
      return NextResponse.json(
        { success: false, error: 'Invalid brand' },
        { status: 400 }
      );
    }

    console.log(`🤖 Starting background rating for ${brand}...`);

    // Run in background (don't block response)
    setImmediate(async () => {
      try {
        // Rate ALL unrated articles and keep top 10
        const results = await rateAndCleanupArticles(10);
        console.log(`✅ Auto-rated ${brand} articles:`, results[brand]);
      } catch (error) {
        console.error(`❌ Auto-rating failed for ${brand}:`, error);
      }
    });

    return NextResponse.json({
      success: true,
      message: `Rating all unrated ${brand} articles in background`
    });
  } catch (error) {
    console.error('Rate-brand endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start rating' },
      { status: 500 }
    );
  }
}
