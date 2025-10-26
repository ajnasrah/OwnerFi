// Test endpoint to verify RSS fetcher is working
import { NextRequest, NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-fetcher';
import { getAllFeedSources } from '@/lib/feed-store-firestore';

export async function GET(request: NextRequest) {
  try {
    const brand = request.nextUrl.searchParams.get('brand') || 'vassdistro';

    console.log(`🧪 Testing RSS fetcher for ${brand}...`);

    // Get all feeds
    const allFeeds = await getAllFeedSources();
    const brandFeeds = allFeeds.filter(f => f.category === brand && f.enabled);

    if (brandFeeds.length === 0) {
      return NextResponse.json({
        error: `No enabled feeds found for ${brand}`,
        totalFeeds: allFeeds.length,
        brandFeedsDisabled: allFeeds.filter(f => f.category === brand && !f.enabled).length
      }, { status: 404 });
    }

    const results = [];

    // Test first feed
    const testFeed = brandFeeds[0];
    console.log(`Testing feed: ${testFeed.name}`);

    const feed = await fetchRSSFeed(testFeed.url);

    const articles = feed.items.slice(0, 5).map(item => {
      const content = item.content || item.description || '';
      return {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
        hasFullContent: content.length > 1000,
        quality: content.length === 0 ? 'FAIL' :
                 content.length < 200 ? 'POOR' :
                 content.length < 1000 ? 'ADEQUATE' : 'EXCELLENT'
      };
    });

    return NextResponse.json({
      success: true,
      brand,
      feed: {
        name: testFeed.name,
        url: testFeed.url,
        lastFetched: testFeed.lastFetched ? new Date(testFeed.lastFetched).toISOString() : 'Never'
      },
      rss: {
        title: feed.title,
        totalItems: feed.items.length
      },
      sampleArticles: articles,
      summary: {
        totalFeeds: brandFeeds.length,
        articlesInFeed: feed.items.length,
        sampledArticles: articles.length,
        excellentQuality: articles.filter(a => a.quality === 'EXCELLENT').length,
        adequateQuality: articles.filter(a => a.quality === 'ADEQUATE').length,
        poorQuality: articles.filter(a => a.quality === 'POOR').length,
        failedQuality: articles.filter(a => a.quality === 'FAIL').length
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
