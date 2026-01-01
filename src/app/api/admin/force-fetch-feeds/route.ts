// Force fetch specific feeds immediately (bypass fetchInterval check)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAllFeedSources } from '@/lib/feed-store-firestore';
import { processFeedSources } from '@/lib/rss-fetcher';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const body = await request.json();
    const { brand } = body; // 'ownerfi', 'carz', or 'gaza'

    console.log(`🚀 Force fetching ${brand} feeds...`);

    // Get all feeds for this brand
    const allFeeds = await getAllFeedSources(brand as any);
    const enabledFeeds = allFeeds.filter(f => f.enabled);

    console.log(`📊 Found ${enabledFeeds.length} enabled feeds for ${brand}`);

    if (enabledFeeds.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No enabled feeds found for ${brand}`
      }, { status: 404 });
    }

    // Force fetch ALL enabled feeds (ignore lastFetched)
    const result = await processFeedSources(enabledFeeds);

    console.log(`✅ Force fetch complete: ${result.totalNewArticles} new articles`);

    return NextResponse.json({
      success: true,
      brand,
      feedsFetched: result.totalProcessed,
      newArticles: result.totalNewArticles,
      errors: result.errors,
      message: `Fetched ${result.totalNewArticles} new articles for ${brand}`
    });

  } catch (error) {
    console.error('❌ Force fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
