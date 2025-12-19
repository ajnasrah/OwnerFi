import { NextRequest, NextResponse } from 'next/server';
import { analyzePlatformPerformance, getPlatformRecommendations } from '@/lib/late-analytics-v2';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/analytics/platforms
 *
 * Returns platform-specific performance analytics with optimization insights
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
          recommendations: null,
          optimizationInsights: null
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

    // Get optimization insights
    const optimizationInsights = await getOptimizationInsights(brand, days);

    return NextResponse.json({
      success: true,
      data: {
        platforms: platformsArray,
        recommendations,
        optimizationInsights
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

async function getOptimizationInsights(brand?: string, days: number = 30) {
  const adminDb = await getAdminDb();
  if (!adminDb) return null;

  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  let query: any = (adminDb as any).collection('platform_analytics');
  if (brand) {
    query = query.where('brand', '==', brand);
  }
  query = query.where('lastUpdated', '>=', cutoffTime);

  const snapshot = await query.get();
  if (snapshot.empty) return null;

  // Group by platform
  const platformData = new Map<string, any[]>();
  snapshot.forEach((doc: Record<string, unknown>) => {
    const data = doc.data();
    const platform = data.platform;
    if (!platformData.has(platform)) platformData.set(platform, []);
    platformData.get(platform)!.push(data);
  });

  const insights: any[] = [];

  platformData.forEach((posts, platform) => {
    // Calculate performance score
    const calculateScore = (p: any) => {
      // Instagram uses 'reach', TikTok uses 'views', YouTube uses 'views'
      let visibility = 0;
      if (platform.toLowerCase() === 'instagram') {
        visibility = p.reach || 0;
      } else {
        // TikTok, YouTube, and other platforms use 'views'
        visibility = p.views || 0;
      }
      const engagement = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
      return visibility + (engagement * 10);
    };

    // Analyze by hour
    const hourMap = new Map<number, { scores: number[]; posts: number }>();
    posts.forEach(p => {
      const score = calculateScore(p);
      if (!hourMap.has(p.hour)) hourMap.set(p.hour, { scores: [], posts: 0 });
      hourMap.get(p.hour)!.scores.push(score);
      hourMap.get(p.hour)!.posts++;
    });

    const hourStats = Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      posts: data.posts,
    }));

    const bestHours = [...hourStats].sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
    const worstHours = [...hourStats].sort((a, b) => a.avgScore - b.avgScore).slice(0, 2);

    // Analyze by day
    const dayMap = new Map<string, { scores: number[]; posts: number }>();
    posts.forEach(p => {
      const score = calculateScore(p);
      if (!dayMap.has(p.dayName)) dayMap.set(p.dayName, { scores: [], posts: 0 });
      dayMap.get(p.dayName)!.scores.push(score);
      dayMap.get(p.dayName)!.posts++;
    });

    const dayStats = Array.from(dayMap.entries()).map(([day, data]) => ({
      day,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      posts: data.posts,
    }));

    const bestDays = [...dayStats].sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
    const worstDays = [...dayStats].sort((a, b) => a.avgScore - b.avgScore).slice(0, 2);

    // Trend analysis
    const sortedByDate = [...posts].sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    const midpoint = Math.floor(sortedByDate.length / 2);
    const recentPosts = sortedByDate.slice(0, midpoint);
    const olderPosts = sortedByDate.slice(midpoint);

    const recentPerf = recentPosts.reduce((sum, p) => sum + calculateScore(p), 0) / recentPosts.length;
    const olderPerf = olderPosts.reduce((sum, p) => sum + calculateScore(p), 0) / olderPosts.length;
    const trendPercent = olderPerf > 0 ? ((recentPerf - olderPerf) / olderPerf) * 100 : 0;
    const trend = trendPercent > 10 ? 'improving' : trendPercent < -10 ? 'declining' : 'stable';

    // Calculate metrics
    const totalPosts = posts.length;
    const avgReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0) / totalPosts;

    // Use platform-specific visibility metric
    const getVisibility = (p: any): number => {
      if (platform.toLowerCase() === 'instagram') {
        return p.reach || 0;
      }
      return p.views || 0;
    };
    const avgViews = posts.reduce((sum, p) => sum + getVisibility(p), 0) / totalPosts;
    const totalEngagement = posts.reduce((sum, p) => sum + (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0), 0);
    const avgEngagement = totalEngagement / totalPosts;

    // Generate actions
    const actions: string[] = [];

    if (bestHours.length > 0 && worstHours.length > 0) {
      actions.push(`Post at ${bestHours[0].hour.toString().padStart(2, '0')}:00 instead of ${worstHours[0].hour.toString().padStart(2, '0')}:00`);
    }

    if (trend === 'declining') {
      actions.push(`Performance declining ${Math.abs(trendPercent).toFixed(0)}% - test new content`);
    } else if (trend === 'improving') {
      actions.push(`Performance improving ${trendPercent.toFixed(0)}% - keep current strategy`);
    }

    if (totalPosts < 20) {
      actions.push(`Only ${totalPosts} posts - increase to 1-2 posts/day`);
    }

    if (platform === 'instagram' && avgReach > 0 && avgEngagement < 1) {
      actions.push(`Good reach but low engagement - add CTAs and questions`);
    }

    insights.push({
      platform,
      totalPosts,
      avgReach,
      avgViews,
      avgEngagement,
      trend,
      trendPercent: trendPercent.toFixed(1),
      bestHours: bestHours.map(h => ({ hour: h.hour, score: h.avgScore.toFixed(0) })),
      worstHours: worstHours.map(h => ({ hour: h.hour, score: h.avgScore.toFixed(0) })),
      bestDays: bestDays.map(d => d.day),
      worstDays: worstDays.map(d => d.day),
      actions,
      priority: trend === 'declining' ? 'urgent' : trend === 'improving' ? 'double-down' : 'optimize'
    });
  });

  return insights;
}
