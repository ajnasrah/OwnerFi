// Cron job to fetch RSS articles daily at 12 PM
// Vercel Cron: Add to vercel.json: { "path": "/api/cron/fetch-rss", "schedule": "0 12 * * *" }
// UPDATED: Now uses centralized feed configuration from feed-sources.ts (82 feeds total)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAllFeedSources } from '@/lib/feed-store-firestore';
import { processFeedSources } from '@/lib/rss-fetcher';
import { getFeedsToFetch } from '@/config/feed-sources';
import { withCronLock } from '@/lib/cron-lock';

export const maxDuration = 300; // 5 minutes timeout

export async function GET(request: NextRequest) {
  // Verify cron secret first (before acquiring lock)
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = userAgent === 'vercel-cron/1.0';

  // SECURITY: Require CRON_SECRET to be configured (no defaults)
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️  Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use cron lock to prevent concurrent execution
  const result = await withCronLock('fetch-rss', async () => {
    try {
      if (!db) {
        return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
      }

      console.log('🚀 Starting daily RSS fetch at', new Date().toISOString());

    // Get all feed sources from Firestore
    const allFeeds = await getAllFeedSources();
    console.log(`📊 Total feeds configured: ${allFeeds.length}`);

    // Filter to only feeds that need fetching (based on lastFetched + fetchInterval)
    const feedsToFetch = getFeedsToFetch(allFeeds);
    console.log(`📡 Feeds to fetch: ${feedsToFetch.length}`);

    if (feedsToFetch.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: 'No feeds need fetching at this time',
        totalFeeds: allFeeds.length
      });
    }

    // Process feeds in parallel
    const result = await processFeedSources(feedsToFetch);

    // Count by brand
    const brandCounts = {
      carz: feedsToFetch.filter(f => f.category === 'carz').length,
      ownerfi: feedsToFetch.filter(f => f.category === 'ownerfi').length,
      gaza: feedsToFetch.filter(f => f.category === 'gaza').length
    };

    console.log('✅ RSS fetch complete');
    console.log(`   Processed: ${result.totalProcessed} feeds`);
    console.log(`   New articles: ${result.totalNewArticles}`);
    console.log(`   Errors: ${result.errors.length}`);
    console.log(`   By brand: Carz (${brandCounts.carz}), OwnerFi (${brandCounts.ownerfi}), Gaza (${brandCounts.gaza})`);

    if (result.errors.length > 0) {
      console.error('❌ Errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalFeeds: allFeeds.length,
      feedsProcessed: result.totalProcessed,
      newArticles: result.totalNewArticles,
      errors: result.errors,
      brandCounts
    });

    } catch (error) {
      console.error('❌ RSS fetch error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }); // End withCronLock

  // If lock wasn't acquired, return early
  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true
    }, { status: 200 });
  }

  return result;
}
