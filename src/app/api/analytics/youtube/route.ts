import { NextRequest, NextResponse } from 'next/server';
import {
  getChannelInfo,
  getRecentVideos,
  getAnalyticsSummary,
  syncYouTubeAnalytics,
  analyzeContentPatterns,
  type YouTubeAnalyticsSummary,
} from '@/lib/youtube-analytics';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/analytics/youtube
 *
 * Fetches YouTube analytics for a brand
 *
 * Query params:
 * - brand: abdullah|ownerfi|carz (required)
 * - refresh: true to fetch fresh data from YouTube API (default: use cached)
 * - limit: number of videos to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const refresh = searchParams.get('refresh') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!brand) {
      return NextResponse.json({
        success: false,
        error: 'Brand parameter is required (abdullah, ownerfi, carz)',
      }, { status: 400 });
    }

    const validBrands = ['abdullah', 'ownerfi', 'carz'];
    if (!validBrands.includes(brand)) {
      return NextResponse.json({
        success: false,
        error: `Invalid brand. Must be one of: ${validBrands.join(', ')}`,
      }, { status: 400 });
    }

    console.log(`📊 [YouTube Analytics API] Fetching for ${brand}...`);

    let summary: YouTubeAnalyticsSummary | null = null;

    // Check for cached data first (unless refresh requested)
    if (!refresh) {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const cached = await (adminDb as any).collection('youtube_analytics').doc(brand).get();
        if (cached.exists) {
          const data = cached.data();
          const age = Date.now() - (data.fetchedAt || 0);
          const maxAge = 60 * 60 * 1000; // 1 hour cache

          if (age < maxAge) {
            console.log(`   Using cached data (${Math.round(age / 1000 / 60)} minutes old)`);
            summary = data as YouTubeAnalyticsSummary;
          }
        }
      }
    }

    // Fetch fresh data if no cache or refresh requested
    if (!summary) {
      console.log(`   Fetching fresh data from YouTube API...`);
      summary = await syncYouTubeAnalytics(brand);
    }

    if (!summary) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch YouTube analytics for ${brand}. Check credentials.`,
      }, { status: 500 });
    }

    // Analyze content patterns
    const patterns = analyzeContentPatterns(summary.recentVideos);

    return NextResponse.json({
      success: true,
      brand,
      channel: {
        id: summary.channelId,
        title: summary.channelTitle,
        subscribers: summary.totalSubscribers,
        totalViews: summary.totalViews,
        totalVideos: summary.totalVideos,
      },
      performance: {
        avgViewsPerVideo: Math.round(summary.avgViewsPerVideo),
        avgEngagementRate: parseFloat(summary.avgEngagementRate.toFixed(2)),
        totalRecentViews: summary.totalRecentViews,
        totalRecentLikes: summary.totalRecentLikes,
        totalRecentComments: summary.totalRecentComments,
      },
      topPerformers: {
        byViews: summary.topByViews.slice(0, 5).map(v => ({
          videoId: v.videoId,
          title: v.title,
          views: v.viewCount,
          likes: v.likeCount,
          engagement: parseFloat(v.engagementRate.toFixed(2)),
          publishedAt: v.publishedAt,
          url: `https://youtube.com/shorts/${v.videoId}`,
        })),
        byEngagement: summary.topByEngagement.slice(0, 5).map(v => ({
          videoId: v.videoId,
          title: v.title,
          views: v.viewCount,
          likes: v.likeCount,
          engagement: parseFloat(v.engagementRate.toFixed(2)),
          publishedAt: v.publishedAt,
          url: `https://youtube.com/shorts/${v.videoId}`,
        })),
      },
      patterns: {
        bestHooks: patterns.bestHooks,
        bestPostingTimes: patterns.bestPostingTimes,
        avgDurationSeconds: Math.round(patterns.avgDuration),
        shortsVsLongForm: patterns.shortsVsLongForm,
      },
      recentVideos: summary.recentVideos.slice(0, limit).map(v => ({
        videoId: v.videoId,
        title: v.title,
        views: v.viewCount,
        likes: v.likeCount,
        comments: v.commentCount,
        engagement: parseFloat(v.engagementRate.toFixed(2)),
        duration: v.durationSeconds,
        isShort: v.isShort,
        publishedAt: v.publishedAt,
        url: v.isShort
          ? `https://youtube.com/shorts/${v.videoId}`
          : `https://youtube.com/watch?v=${v.videoId}`,
      })),
      fetchedAt: summary.fetchedAt,
      cached: !refresh && !!summary,
    });

  } catch (error) {
    console.error('Error fetching YouTube analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/analytics/youtube
 *
 * Force sync YouTube analytics for one or all brands
 *
 * Body:
 * - brand: abdullah|ownerfi|carz (optional, syncs all if not specified)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { brand } = body;

    const validBrands = ['abdullah', 'ownerfi', 'carz'];

    if (brand && !validBrands.includes(brand)) {
      return NextResponse.json({
        success: false,
        error: `Invalid brand. Must be one of: ${validBrands.join(', ')}`,
      }, { status: 400 });
    }

    const brandsToSync = brand ? [brand] : validBrands;
    const results: Record<string, any> = {};

    for (const b of brandsToSync) {
      console.log(`📊 Syncing YouTube analytics for ${b}...`);

      try {
        const summary = await syncYouTubeAnalytics(b);

        if (summary) {
          results[b] = {
            success: true,
            channel: summary.channelTitle,
            subscribers: summary.totalSubscribers,
            videosAnalyzed: summary.recentVideos.length,
            avgViews: Math.round(summary.avgViewsPerVideo),
            avgEngagement: parseFloat(summary.avgEngagementRate.toFixed(2)),
          };
        } else {
          results[b] = {
            success: false,
            error: 'Failed to fetch analytics',
          };
        }
      } catch (err) {
        results[b] = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced YouTube analytics for ${brandsToSync.length} brand(s)`,
      results,
      syncedAt: Date.now(),
    });

  } catch (error) {
    console.error('Error syncing YouTube analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
