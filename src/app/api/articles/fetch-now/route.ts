// Manual RSS fetch trigger for admins
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getAllFeedSources } from '@/lib/feed-store-firestore';
import { processFeedSource } from '@/lib/rss-fetcher';

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions as any);
    const isAdmin = session?.user && (session.user as any).role === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    console.log('📰 Manual article fetch triggered by admin');

    // Get all feed sources
    const feedSources = await getAllFeedSources();

    if (!feedSources || feedSources.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No feed sources configured'
      });
    }

    console.log(`📡 Processing ${feedSources.length} RSS feeds...`);

    // Process all feeds in parallel
    const results = await Promise.allSettled(
      feedSources.map(feed => processFeedSource(feed))
    );

    let totalNewArticles = 0;
    const carzArticles = 0;
    const ownerfiArticles = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      const feedSource = feedSources[index];
      if (result.status === 'fulfilled') {
        totalNewArticles += result.value.newArticles;

        if (result.value.error) {
          errors.push(`${feedSource.name}: ${result.value.error}`);
        }
      } else {
        errors.push(`${feedSource.name}: ${result.reason?.message || 'Unknown error'}`);
      }
    });

    console.log(`✅ RSS fetch complete: ${totalNewArticles} new articles`);

    return NextResponse.json({
      success: true,
      message: `Fetched ${totalNewArticles} new articles from ${feedSources.length} RSS feeds`,
      totalNewArticles,
      feedsProcessed: feedSources.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual article fetch failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
