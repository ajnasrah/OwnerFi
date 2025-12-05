import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const YOUTUBE_BRANDS = ['abdullah', 'ownerfi', 'carz', 'gaza'];

/**
 * GET /api/admin/youtube-analytics
 *
 * Returns YouTube analytics dashboard for all brands
 * Uses cached data from Firestore (synced by cron)
 *
 * Query params:
 * - brand: Optional filter for specific brand
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandFilter = searchParams.get('brand');

    const adminDb = await getAdminDb();
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin not initialized',
      }, { status: 500 });
    }

    const brands = brandFilter ? [brandFilter] : YOUTUBE_BRANDS;
    const analytics: Record<string, any> = {};

    // Fetch analytics for each brand
    for (const brand of brands) {
      const doc = await (adminDb as any).collection('youtube_analytics').doc(brand).get();

      if (doc.exists) {
        const data = doc.data();
        analytics[brand] = {
          channel: {
            id: data.channelId,
            title: data.channelTitle,
            subscribers: data.totalSubscribers,
            totalViews: data.totalViews,
            totalVideos: data.totalVideos,
          },
          performance: {
            avgViewsPerVideo: Math.round(data.avgViewsPerVideo || 0),
            avgEngagementRate: parseFloat((data.avgEngagementRate || 0).toFixed(2)),
            totalRecentViews: data.totalRecentViews || 0,
            totalRecentLikes: data.totalRecentLikes || 0,
            totalRecentComments: data.totalRecentComments || 0,
          },
          topVideos: (data.topByViews || []).slice(0, 5).map((v: any) => ({
            title: v.title,
            views: v.viewCount,
            likes: v.likeCount,
            engagement: parseFloat((v.engagementRate || 0).toFixed(2)),
            url: v.isShort
              ? `https://youtube.com/shorts/${v.videoId}`
              : `https://youtube.com/watch?v=${v.videoId}`,
            publishedAt: v.publishedAt,
          })),
          lastUpdated: data.fetchedAt ? new Date(data.fetchedAt).toISOString() : null,
        };
      } else {
        analytics[brand] = {
          error: 'No analytics data. Run /api/cron/sync-youtube-analytics first.',
        };
      }
    }

    // Get totals
    const totalsDoc = await (adminDb as any).collection('youtube_analytics_summary').doc('_totals').get();
    const totals = totalsDoc.exists ? totalsDoc.data() : null;

    return NextResponse.json({
      success: true,
      totals: totals ? {
        totalSubscribers: totals.totalSubscribers,
        totalViews: totals.totalViews,
        totalVideos: totals.totalVideos,
        brandsTracked: totals.brandsSuccessful,
        lastSyncedAt: totals.lastSyncedAt ? new Date(totals.lastSyncedAt).toISOString() : null,
      } : null,
      brands: analytics,
    });

  } catch (error) {
    console.error('Error fetching YouTube analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
