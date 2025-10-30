import { NextRequest, NextResponse } from 'next/server';
import { analyzePlatformPerformance, getPlatformRecommendations } from '@/lib/late-analytics-v2';

/**
 * GET /api/analytics/platforms
 *
 * Returns platform-specific performance analytics
 *
 * Query params:
 * - brand: carz|ownerfi|podcast|vassdistro|abdullah (optional)
 * - days: number of days to analyze (default: 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') || undefined;
    const days = parseInt(searchParams.get('days') || '7');

    console.log(`📊 Fetching platform analytics for ${brand || 'all brands'}, ${days} days`);

    // Get platform performance analysis
    const performance = await analyzePlatformPerformance(brand, days);

    if (performance.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          platforms: [],
          recommendations: null
        },
        meta: {
          brand: brand || 'all',
          days,
          message: 'No analytics data found. Run sync-platform-analytics script first.'
        }
      });
    }

    // Convert Map to array for JSON serialization
    const platformsArray = Array.from(performance.entries()).map(([platform, perf]) => ({
      platform,
      ...perf
    }));

    // Sort by engagement rate
    platformsArray.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

    // Get recommendations if brand specified
    let recommendations = null;
    if (brand) {
      recommendations = await getPlatformRecommendations(brand, days);
    }

    return NextResponse.json({
      success: true,
      data: {
        platforms: platformsArray,
        recommendations
      },
      meta: {
        brand: brand || 'all',
        days,
        totalPlatforms: platformsArray.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
