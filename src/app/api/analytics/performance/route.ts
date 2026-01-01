import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/analytics/performance
 *
 * Returns comprehensive performance analytics with:
 * - Time slot trends
 * - Content type comparisons
 * - Hook performance
 * - Platform breakdowns
 * - Progress over time
 *
 * Query params:
 * - brand: carz|ownerfi|benefit|abdullah|personal|gaza (optional, defaults to all)
 * - days: number of days to analyze (default: 7)
 * - groupBy: hour|day|week (for time series)
 */

interface PerformanceMetrics {
  // Time-based trends
  timeSeries: {
    date: string;
    views: number;
    engagement: number;
    posts: number;
  }[];

  // Time slot analysis
  timeSlots: {
    slot: string; // "07:00-08:00"
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    trend: 'up' | 'down' | 'stable';
  }[];

  // Day of week analysis
  dayOfWeek: {
    day: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
  }[];

  // Content type performance
  contentTypes: {
    type: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    bestTimeSlot: string;
  }[];

  // Hook performance
  hooks: {
    type: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    examples: string[];
  }[];

  // Platform breakdown
  platforms: {
    platform: string;
    avgViews: number;
    avgEngagement: number;
    totalPosts: number;
    trend: 'up' | 'down' | 'stable';
  }[];

  // Top performers (common traits)
  topPerformers: {
    commonTraits: {
      mostCommonTimeSlot: string;
      mostCommonHook: string;
      mostCommonContentType: string;
      avgVideoLength: string;
      bestPlatform: string;
    };
    posts: Array<{
      id: string;
      views: number;
      engagement: number;
      timeSlot: string;
      contentType: string;
      hook: string;
      platforms: string[];
    }>;
  };

  // Overall stats
  overall: {
    totalPosts: number;
    totalViews: number;
    avgEngagement: number;
    growthRate: number; // % change from previous period
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') || undefined;
    const days = parseInt(searchParams.get('days') || '7');
    const groupBy = (searchParams.get('groupBy') || 'day') as 'hour' | 'day' | 'week';

    // Initialize Firebase Admin
    const adminDb = await getAdminDb();
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin not initialized'
      }, { status: 500 });
    }

    // Query analytics collection
    let query: any = (adminDb as any).collection('workflow_analytics');

    if (brand) {
      query = query.where('brand', '==', brand);
    }

    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    query = query.where('lastUpdated', '>=', cutoffDate);

    const snapshot = await query.get();

    if (snapshot.empty) {
      // Return empty analytics structure instead of error
      return NextResponse.json({
        success: true,
        data: {
          timeSeries: [],
          timeSlots: [],
          dayOfWeek: [],
          contentTypes: [],
          hooks: [],
          platforms: [],
          topPerformers: {
            commonTraits: {
              mostCommonTimeSlot: 'N/A',
              mostCommonHook: 'N/A',
              mostCommonContentType: 'N/A',
              avgVideoLength: 'N/A',
              bestPlatform: 'N/A'
            },
            posts: []
          },
          overall: {
            totalPosts: 0,
            totalViews: 0,
            avgEngagement: 0,
            growthRate: 0
          }
        },
        meta: {
          brand: brand || 'all',
          days,
          totalPosts: 0,
          generatedAt: new Date().toISOString(),
          note: 'Late.dev API does not provide analytics metrics. Please integrate platform-specific analytics APIs for view counts and engagement data.'
        }
      });
    }

    // Collect all posts
    const posts: any[] = [];
    snapshot.forEach(doc => {
      posts.push({ id: doc.id, ...doc.data() });
    });

    // Build time series (group by day)
    const timeSeries = buildTimeSeries(posts, groupBy, days);

    // Aggregate by time slot
    const timeSlots = aggregateByTimeSlot(posts);

    // Aggregate by day of week
    const dayOfWeek = aggregateByDayOfWeek(posts);

    // Aggregate by content type
    const contentTypes = aggregateByContentType(posts);

    // Aggregate by hook type
    const hooks = aggregateByHook(posts);

    // Aggregate by platform
    const platforms = aggregateByPlatform(posts);

    // Analyze top performers
    const topPerformers = analyzeTopPerformers(posts);

    // Calculate overall stats
    const overall = calculateOverallStats(posts, days);

    const response: PerformanceMetrics = {
      timeSeries,
      timeSlots,
      dayOfWeek,
      contentTypes,
      hooks,
      platforms,
      topPerformers,
      overall
    };

    return NextResponse.json({
      success: true,
      data: response,
      meta: {
        brand: brand || 'all',
        days,
        totalPosts: posts.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions

function buildTimeSeries(posts: any[], groupBy: 'hour' | 'day' | 'week', days: number) {
  const series: Map<string, { views: number; engagement: number; posts: number }> = new Map();

  posts.forEach(post => {
    const date = new Date(post.scheduledTime);
    let key: string;

    if (groupBy === 'hour') {
      key = date.toISOString().substring(0, 13) + ':00:00'; // Group by hour
    } else if (groupBy === 'day') {
      key = date.toISOString().split('T')[0]; // Group by day
    } else { // week
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    }

    const existing = series.get(key) || { views: 0, engagement: 0, posts: 0 };
    existing.views += post.totalViews || 0;
    existing.engagement += post.overallEngagementRate || 0;
    existing.posts += 1;
    series.set(key, existing);
  });

  return Array.from(series.entries())
    .map(([date, data]) => ({
      date,
      views: data.views,
      engagement: data.posts > 0 ? data.engagement / data.posts : 0,
      posts: data.posts
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByTimeSlot(posts: any[]) {
  const slots: Map<string, { totalViews: number; totalEngagement: number; count: number }> = new Map();

  posts.forEach(post => {
    if (!post.timeSlot) return;

    const existing = slots.get(post.timeSlot) || { totalViews: 0, totalEngagement: 0, count: 0 };
    existing.totalViews += post.totalViews || 0;
    existing.totalEngagement += post.overallEngagementRate || 0;
    existing.count += 1;
    slots.set(post.timeSlot, existing);
  });

  return Array.from(slots.entries())
    .map(([slot, data]) => ({
      slot,
      avgViews: data.totalViews / data.count,
      avgEngagement: data.totalEngagement / data.count,
      totalPosts: data.count,
      trend: 'stable' as 'up' | 'down' | 'stable' // TODO: Calculate trend
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

function aggregateByDayOfWeek(posts: any[]) {
  const days: Map<string, { totalViews: number; totalEngagement: number; count: number }> = new Map();

  posts.forEach(post => {
    if (!post.dayOfWeek) return;

    const existing = days.get(post.dayOfWeek) || { totalViews: 0, totalEngagement: 0, count: 0 };
    existing.totalViews += post.totalViews || 0;
    existing.totalEngagement += post.overallEngagementRate || 0;
    existing.count += 1;
    days.set(post.dayOfWeek, existing);
  });

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return dayOrder
    .filter(day => days.has(day))
    .map(day => {
      const data = days.get(day)!;
      return {
        day,
        avgViews: data.totalViews / data.count,
        avgEngagement: data.totalEngagement / data.count,
        totalPosts: data.count
      };
    });
}

function aggregateByContentType(posts: any[]) {
  const types: Map<string, { totalViews: number; totalEngagement: number; count: number; timeSlots: Map<string, number> }> = new Map();

  posts.forEach(post => {
    if (!post.contentType) return;

    const existing = types.get(post.contentType) || {
      totalViews: 0,
      totalEngagement: 0,
      count: 0,
      timeSlots: new Map()
    };

    existing.totalViews += post.totalViews || 0;
    existing.totalEngagement += post.overallEngagementRate || 0;
    existing.count += 1;

    if (post.timeSlot) {
      const slotCount = existing.timeSlots.get(post.timeSlot) || 0;
      existing.timeSlots.set(post.timeSlot, slotCount + 1);
    }

    types.set(post.contentType, existing);
  });

  return Array.from(types.entries())
    .map(([type, data]) => {
      // Find most common time slot
      let bestTimeSlot = 'N/A';
      let maxCount = 0;
      data.timeSlots.forEach((count, slot) => {
        if (count > maxCount) {
          maxCount = count;
          bestTimeSlot = slot;
        }
      });

      return {
        type,
        avgViews: data.totalViews / data.count,
        avgEngagement: data.totalEngagement / data.count,
        totalPosts: data.count,
        bestTimeSlot
      };
    })
    .sort((a, b) => b.avgViews - a.avgViews);
}

function aggregateByHook(posts: any[]) {
  const hooks: Map<string, { totalViews: number; totalEngagement: number; count: number; examples: Set<string> }> = new Map();

  posts.forEach(post => {
    if (!post.hookType) return;

    const existing = hooks.get(post.hookType) || {
      totalViews: 0,
      totalEngagement: 0,
      count: 0,
      examples: new Set()
    };

    existing.totalViews += post.totalViews || 0;
    existing.totalEngagement += post.overallEngagementRate || 0;
    existing.count += 1;

    if (post.hook && existing.examples.size < 3) {
      existing.examples.add(post.hook.substring(0, 100));
    }

    hooks.set(post.hookType, existing);
  });

  return Array.from(hooks.entries())
    .map(([type, data]) => ({
      type,
      avgViews: data.totalViews / data.count,
      avgEngagement: data.totalEngagement / data.count,
      totalPosts: data.count,
      examples: Array.from(data.examples)
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

function aggregateByPlatform(posts: any[]) {
  const platforms: Map<string, { totalViews: number; totalEngagement: number; count: number }> = new Map();

  posts.forEach(post => {
    if (!post.platformMetrics) return;

    Object.entries(post.platformMetrics).forEach(([platform, metrics]: [string, any]) => {
      const existing = platforms.get(platform) || { totalViews: 0, totalEngagement: 0, count: 0 };
      existing.totalViews += metrics.views || 0;
      existing.totalEngagement += metrics.engagement_rate || 0;
      existing.count += 1;
      platforms.set(platform, existing);
    });
  });

  return Array.from(platforms.entries())
    .map(([platform, data]) => ({
      platform,
      avgViews: data.totalViews / data.count,
      avgEngagement: data.totalEngagement / data.count,
      totalPosts: data.count,
      trend: 'stable' as 'up' | 'down' | 'stable'
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

function analyzeTopPerformers(posts: any[]) {
  // Get top 20% of posts by views
  const sorted = [...posts].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));
  const topCount = Math.ceil(posts.length * 0.2);
  const topPosts = sorted.slice(0, topCount);

  // Find common traits
  const timeSlots: Map<string, number> = new Map();
  const hooks: Map<string, number> = new Map();
  const contentTypes: Map<string, number> = new Map();
  const platforms: Map<string, number> = new Map();
  let totalLength = 0;

  topPosts.forEach(post => {
    if (post.timeSlot) {
      timeSlots.set(post.timeSlot, (timeSlots.get(post.timeSlot) || 0) + 1);
    }
    if (post.hookType) {
      hooks.set(post.hookType, (hooks.get(post.hookType) || 0) + 1);
    }
    if (post.contentType) {
      contentTypes.set(post.contentType, (contentTypes.get(post.contentType) || 0) + 1);
    }
    if (post.variant) {
      totalLength += post.variant === '15sec' ? 15 : 30;
    }
    if (post.platformMetrics) {
      Object.keys(post.platformMetrics).forEach(platform => {
        platforms.set(platform, (platforms.get(platform) || 0) + 1);
      });
    }
  });

  const getMostCommon = (map: Map<string, number>) => {
    let max = 0;
    let result = 'N/A';
    map.forEach((count, key) => {
      if (count > max) {
        max = count;
        result = key;
      }
    });
    return result;
  };

  return {
    commonTraits: {
      mostCommonTimeSlot: getMostCommon(timeSlots),
      mostCommonHook: getMostCommon(hooks),
      mostCommonContentType: getMostCommon(contentTypes),
      avgVideoLength: topPosts.length > 0 ? `${Math.round(totalLength / topPosts.length)}sec` : 'N/A',
      bestPlatform: getMostCommon(platforms)
    },
    posts: topPosts.slice(0, 10).map(post => ({
      id: post.workflowId,
      views: post.totalViews || 0,
      engagement: post.overallEngagementRate || 0,
      timeSlot: post.timeSlot || 'N/A',
      contentType: post.contentType || 'N/A',
      hook: (post.hook || '').substring(0, 100),
      platforms: post.platformMetrics ? Object.keys(post.platformMetrics) : []
    }))
  };
}

function calculateOverallStats(posts: any[], days: number) {
  const totalViews = posts.reduce((sum, post) => sum + (post.totalViews || 0), 0);
  const totalEngagement = posts.reduce((sum, post) => sum + (post.overallEngagementRate || 0), 0);

  // Calculate growth rate (compare first half vs second half of period)
  const midpoint = Date.now() - ((days / 2) * 24 * 60 * 60 * 1000);
  const recentPosts = posts.filter(p => p.lastUpdated >= midpoint);
  const olderPosts = posts.filter(p => p.lastUpdated < midpoint);

  const recentAvg = recentPosts.length > 0
    ? recentPosts.reduce((sum, p) => sum + (p.totalViews || 0), 0) / recentPosts.length
    : 0;

  const olderAvg = olderPosts.length > 0
    ? olderPosts.reduce((sum, p) => sum + (p.totalViews || 0), 0) / olderPosts.length
    : 0;

  const growthRate = olderAvg > 0
    ? ((recentAvg - olderAvg) / olderAvg) * 100
    : 0;

  return {
    totalPosts: posts.length,
    totalViews,
    avgEngagement: posts.length > 0 ? totalEngagement / posts.length : 0,
    growthRate
  };
}
