// Admin endpoint to manually trigger RSS fetch
// No auth required - for testing/manual triggering

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAllFeedSources } from '@/lib/feed-store-firestore';
import { processFeedSources } from '@/lib/rss-fetcher';
import { getFeedsToFetch } from '@/config/feed-sources';

export const maxDuration = 300; // 5 minutes

export async function GET(_request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('🚀 Manual RSS fetch triggered at', new Date().toISOString());

    // Get all feed sources from Firestore
    const allFeeds = await getAllFeedSources();

    if (allFeeds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No feed sources configured'
      }, { status: 404 });
    }

    console.log(`📊 Total feeds in database: ${allFeeds.length}`);

    // Get feeds that need fetching (based on their intervals)
    const feedsToFetch = getFeedsToFetch(allFeeds);

    console.log(`🔄 Feeds due for fetching: ${feedsToFetch.length}`);

    if (feedsToFetch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No feeds need fetching yet (all recently fetched)',
        totalFeeds: allFeeds.length,
        nextFetchIn: 'Check individual feed intervals'
      });
    }

    // Process feeds in parallel
    const result = await processFeedSources(feedsToFetch);

    console.log(`✅ Fetch complete: ${result.totalNewArticles} new articles from ${feedsToFetch.length} feeds`);

    return NextResponse.json({
      success: true,
      totalFeeds: allFeeds.length,
      feedsFetched: result.totalProcessed,
      newArticles: result.totalNewArticles,
      errors: result.errors,
      message: `Fetched ${result.totalNewArticles} new articles`
    });

  } catch (error) {
    console.error('❌ RSS fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
