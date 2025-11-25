import { NextRequest, NextResponse } from 'next/server';
import {
  syncYouTubeAnalytics,
  analyzeContentPatterns,
  type YouTubeAnalyticsSummary,
} from '@/lib/youtube-analytics';
import { getAdminDb } from '@/lib/firebase-admin';

// All brands with YouTube credentials
const YOUTUBE_BRANDS = ['abdullah', 'ownerfi', 'carz'];

/**
 * GET /api/cron/sync-youtube-analytics
 *
 * Syncs YouTube analytics for all brands
 * Run daily via cron to keep analytics fresh
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 [YouTube Analytics Cron] Starting sync for all brands...');

    const results: Record<string, any> = {};
    const adminDb = await getAdminDb();

    for (const brand of YOUTUBE_BRANDS) {
      console.log(`\n📺 Syncing ${brand}...`);

      try {
        const summary = await syncYouTubeAnalytics(brand);

        if (summary) {
          // Analyze patterns
          const patterns = analyzeContentPatterns(summary.recentVideos);

          results[brand] = {
            success: true,
            channel: summary.channelTitle,
            subscribers: summary.totalSubscribers,
            totalViews: summary.totalViews,
            videosAnalyzed: summary.recentVideos.length,
            avgViewsPerVideo: Math.round(summary.avgViewsPerVideo),
            avgEngagement: parseFloat(summary.avgEngagementRate.toFixed(2)),
            topVideo: summary.topByViews[0] ? {
              title: summary.topByViews[0].title,
              views: summary.topByViews[0].viewCount,
              url: `https://youtube.com/shorts/${summary.topByViews[0].videoId}`,
            } : null,
            bestPostingTimes: patterns.bestPostingTimes.slice(0, 3),
          };

          // Save aggregated stats to a summary collection
          if (adminDb) {
            await (adminDb as any).collection('youtube_analytics_summary').doc(brand).set({
              ...results[brand],
              patterns,
              lastSyncedAt: Date.now(),
            }, { merge: true });
          }

          console.log(`   ✅ ${brand}: ${summary.recentVideos.length} videos, ${summary.avgViewsPerVideo.toFixed(0)} avg views`);
        } else {
          results[brand] = {
            success: false,
            error: 'Failed to fetch analytics - check credentials',
          };
          console.log(`   ❌ ${brand}: Failed to fetch`);
        }
      } catch (error) {
        results[brand] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        console.error(`   ❌ ${brand}:`, error);
      }
    }

    // Calculate totals across all brands
    const totals = {
      totalSubscribers: 0,
      totalViews: 0,
      totalVideos: 0,
      brandsSuccessful: 0,
    };

    for (const brand of YOUTUBE_BRANDS) {
      if (results[brand]?.success) {
        totals.totalSubscribers += results[brand].subscribers || 0;
        totals.totalViews += results[brand].totalViews || 0;
        totals.totalVideos += results[brand].videosAnalyzed || 0;
        totals.brandsSuccessful++;
      }
    }

    // Save totals
    if (adminDb) {
      await (adminDb as any).collection('youtube_analytics_summary').doc('_totals').set({
        ...totals,
        brands: YOUTUBE_BRANDS,
        lastSyncedAt: Date.now(),
      }, { merge: true });
    }

    console.log('\n📊 [YouTube Analytics Cron] Sync complete!');
    console.log(`   Brands synced: ${totals.brandsSuccessful}/${YOUTUBE_BRANDS.length}`);
    console.log(`   Total subscribers: ${totals.totalSubscribers.toLocaleString()}`);
    console.log(`   Total views: ${totals.totalViews.toLocaleString()}`);

    return NextResponse.json({
      success: true,
      message: `YouTube analytics synced for ${totals.brandsSuccessful} brands`,
      totals,
      results,
      syncedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [YouTube Analytics Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/cron/sync-youtube-analytics
 *
 * Same as GET but for manual triggering
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
