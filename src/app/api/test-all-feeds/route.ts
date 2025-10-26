// Comprehensive test of all RSS feeds
import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss-fetcher';
import { getAllFeedSources } from '@/lib/feed-store-firestore';

export const maxDuration = 300;

export async function GET() {
  try {
    console.log('🧪 Testing ALL RSS feeds...');

    const allFeeds = await getAllFeedSources();
    const enabledFeeds = allFeeds.filter(f => f.enabled);

    console.log(`Total feeds: ${allFeeds.length}, Enabled: ${enabledFeeds.length}`);

    const results = [];

    for (const feed of enabledFeeds) {
      console.log(`\nTesting: ${feed.name}...`);

      try {
        const rss = await fetchRSSFeed(feed.url);

        const articles = rss.items.slice(0, 3).map(item => {
          const content = item.content || item.description || '';
          return {
            contentLength: content.length,
            quality: content.length === 0 ? 'FAIL' :
                    content.length < 200 ? 'POOR' :
                    content.length < 1000 ? 'ADEQUATE' : 'EXCELLENT'
          };
        });

        const excellent = articles.filter(a => a.quality === 'EXCELLENT').length;
        const adequate = articles.filter(a => a.quality === 'ADEQUATE').length;
        const poor = articles.filter(a => a.quality === 'POOR').length;
        const fail = articles.filter(a => a.quality === 'FAIL').length;

        results.push({
          id: feed.id,
          name: feed.name,
          category: feed.category,
          url: feed.url,
          status: 'SUCCESS',
          totalArticles: rss.items.length,
          sampledArticles: articles.length,
          excellent,
          adequate,
          poor,
          fail,
          overallQuality: rss.items.length === 0 ? 'EMPTY' :
                         excellent >= 2 ? 'EXCELLENT' :
                         adequate + excellent >= 2 ? 'ADEQUATE' : 'POOR'
        });

        console.log(`✅ ${feed.name}: ${rss.items.length} articles, Quality: ${results[results.length - 1].overallQuality}`);

      } catch (error) {
        results.push({
          id: feed.id,
          name: feed.name,
          category: feed.category,
          url: feed.url,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          totalArticles: 0,
          overallQuality: 'FAILED'
        });

        console.log(`❌ ${feed.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Summary by brand
    const summary = {
      vassdistro: {
        total: results.filter(r => r.category === 'vassdistro').length,
        working: results.filter(r => r.category === 'vassdistro' && r.status === 'SUCCESS' && r.totalArticles > 0).length,
        excellent: results.filter(r => r.category === 'vassdistro' && r.overallQuality === 'EXCELLENT').length,
        empty: results.filter(r => r.category === 'vassdistro' && r.overallQuality === 'EMPTY').length,
        failed: results.filter(r => r.category === 'vassdistro' && r.status === 'ERROR').length
      },
      ownerfi: {
        total: results.filter(r => r.category === 'ownerfi').length,
        working: results.filter(r => r.category === 'ownerfi' && r.status === 'SUCCESS' && r.totalArticles > 0).length,
        excellent: results.filter(r => r.category === 'ownerfi' && r.overallQuality === 'EXCELLENT').length,
        empty: results.filter(r => r.category === 'ownerfi' && r.overallQuality === 'EMPTY').length,
        failed: results.filter(r => r.category === 'ownerfi' && r.status === 'ERROR').length
      },
      carz: {
        total: results.filter(r => r.category === 'carz').length,
        working: results.filter(r => r.category === 'carz' && r.status === 'SUCCESS' && r.totalArticles > 0).length,
        excellent: results.filter(r => r.category === 'carz' && r.overallQuality === 'EXCELLENT').length,
        empty: results.filter(r => r.category === 'carz' && r.overallQuality === 'EMPTY').length,
        failed: results.filter(r => r.category === 'carz' && r.status === 'ERROR').length
      }
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalFeeds: enabledFeeds.length,
      results,
      summary
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
