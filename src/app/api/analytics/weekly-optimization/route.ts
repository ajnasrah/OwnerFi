/**
 * Weekly Optimization API Route
 *
 * Provides weekly analytics insights for captions, hashtags, duration, and timing
 * Used by the analytics dashboard for data-driven content recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

interface WeeklyOptimizationData {
  brand: string;
  period: {
    start: string;
    end: string;
  };
  youtube: {
    performance: {
      totalPosts: number;
      avgViews: number;
      avgEngagement: number;
    };
    captions: {
      avgLength: number;
      optimalRange: string;
      topPerformingLength: string;
      hasQuestion: number;
      hasExclamation: number;
    };
    hashtags: {
      avgCount: number;
      recommendedCount: number;
    };
  };
  instagram: {
    performance: {
      totalPosts: number;
      avgViews: number;
      avgEngagement: number;
    };
    captions: {
      avgLength: number;
      optimalRange: string;
      topPerformingLength: string;
      hasQuestion: number;
      hasExclamation: number;
    };
    hashtags: {
      avgCount: number;
      recommendedCount: number;
    };
  };
  timing: {
    bestHours: Array<{ hour: number; label: string; avgViews: number }>;
    bestDays: Array<{ day: string; avgViews: number }>;
    worstHours: Array<{ hour: number; label: string; avgViews: number }>;
  };
  recommendations: {
    captions: string[];
    hashtags: string[];
    duration: string[];
    scheduling: string[];
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') || 'ownerfi';
    const days = parseInt(searchParams.get('days') || '7', 10);

    const db = getAdminDb();

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Fetch analytics data
    const analyticsSnapshot = await db.collection('platform_analytics')
      .where('brand', '==', brand)
      .where('syncedAt', '>=', startDate.toISOString())
      .get();

    const posts = analyticsSnapshot.docs.map(doc => doc.data());

    if (posts.length === 0) {
      return NextResponse.json({
        error: `No data available for ${brand} in the last ${days} days`
      }, { status: 404 });
    }

    // Separate by platform
    const youtubePosts = posts.filter(p => p.platform === 'youtube');
    const instagramPosts = posts.filter(p => p.platform === 'instagram');

    // Analyze each platform
    const youtubeData = analyzePlatform(youtubePosts);
    const instagramData = analyzePlatform(instagramPosts);

    // Analyze timing across all posts
    const timingData = analyzePostingTimes(posts);

    // Generate recommendations
    const recommendations = generateRecommendations(youtubeData, instagramData, timingData);

    const response: WeeklyOptimizationData = {
      brand,
      period: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      youtube: youtubeData,
      instagram: instagramData,
      timing: timingData,
      recommendations
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating weekly optimization data:', error);
    return NextResponse.json(
      { error: 'Failed to generate optimization data' },
      { status: 500 }
    );
  }
}

function analyzePlatform(posts: any[]) {
  if (posts.length === 0) {
    return {
      performance: {
        totalPosts: 0,
        avgViews: 0,
        avgEngagement: 0
      },
      captions: {
        avgLength: 0,
        optimalRange: 'N/A',
        topPerformingLength: 'N/A',
        hasQuestion: 0,
        hasExclamation: 0
      },
      hashtags: {
        avgCount: 0,
        recommendedCount: 3
      }
    };
  }

  // Sort by views to get top performers
  const sortedByViews = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0));
  const top20Percent = sortedByViews.slice(0, Math.max(1, Math.floor(posts.length * 0.2)));

  // Performance metrics
  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalEngagement = posts.reduce((sum, p) => {
    return sum + ((p.likes || 0) + (p.comments || 0) + (p.shares || 0));
  }, 0);

  // Caption analysis (top 20% performers)
  const totalLength = top20Percent.reduce((sum, p) => sum + (p.content?.length || 0), 0);
  const avgLength = Math.round(totalLength / top20Percent.length);

  const hashtagCount = top20Percent.reduce((sum, p) => {
    return sum + ((p.content?.match(/#/g) || []).length);
  }, 0) / top20Percent.length;

  const hasQuestion = top20Percent.filter(p => p.content?.includes('?')).length;
  const hasExclamation = top20Percent.filter(p => p.content?.includes('!')).length;

  // Determine optimal length range
  let optimalRange = '200-300';
  if (avgLength < 150) optimalRange = '100-200';
  else if (avgLength > 300) optimalRange = '250-350';

  // Length distribution
  const lengthBuckets: Record<string, number> = {
    'short (<150)': 0,
    'medium (150-250)': 0,
    'long (250-350)': 0,
    'very long (>350)': 0
  };

  top20Percent.forEach(p => {
    const len = p.content?.length || 0;
    if (len < 150) lengthBuckets['short (<150)']++;
    else if (len < 250) lengthBuckets['medium (150-250)']++;
    else if (len < 350) lengthBuckets['long (250-350)']++;
    else lengthBuckets['very long (>350)']++;
  });

  const topPerformingLength = Object.entries(lengthBuckets)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    performance: {
      totalPosts: posts.length,
      avgViews: Math.round(totalViews / posts.length),
      avgEngagement: Math.round(totalEngagement / posts.length)
    },
    captions: {
      avgLength,
      optimalRange,
      topPerformingLength,
      hasQuestion: Math.round((hasQuestion / top20Percent.length) * 100),
      hasExclamation: Math.round((hasExclamation / top20Percent.length) * 100)
    },
    hashtags: {
      avgCount: Math.round(hashtagCount),
      recommendedCount: Math.max(3, Math.ceil(hashtagCount))
    }
  };
}

function analyzePostingTimes(posts: any[]) {
  const hourStats = new Map<number, { totalViews: number; count: number }>();
  const dayStats = new Map<string, { totalViews: number; count: number }>();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  posts.forEach(post => {
    if (post.publishedAt) {
      const date = new Date(post.publishedAt);
      const hour = date.getHours();
      const day = dayNames[date.getDay()];
      const views = post.views || 0;

      // Hour stats
      const hourStat = hourStats.get(hour) || { totalViews: 0, count: 0 };
      hourStat.totalViews += views;
      hourStat.count += 1;
      hourStats.set(hour, hourStat);

      // Day stats
      const dayStat = dayStats.get(day) || { totalViews: 0, count: 0 };
      dayStat.totalViews += views;
      dayStat.count += 1;
      dayStats.set(day, dayStat);
    }
  });

  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:00 ${period}`;
  };

  const bestHours = Array.from(hourStats.entries())
    .map(([hour, stats]) => ({
      hour,
      label: formatHour(hour),
      avgViews: Math.round(stats.totalViews / stats.count)
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5);

  const worstHours = Array.from(hourStats.entries())
    .map(([hour, stats]) => ({
      hour,
      label: formatHour(hour),
      avgViews: Math.round(stats.totalViews / stats.count)
    }))
    .filter(h => hourStats.get(h.hour)!.count >= 2)
    .sort((a, b) => a.avgViews - b.avgViews)
    .slice(0, 3);

  const bestDays = Array.from(dayStats.entries())
    .map(([day, stats]) => ({
      day,
      avgViews: Math.round(stats.totalViews / stats.count)
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  return { bestHours, bestDays, worstHours };
}

function generateRecommendations(
  youtube: any,
  instagram: any,
  timing: any
) {
  const recommendations = {
    captions: [] as string[],
    hashtags: [] as string[],
    duration: [] as string[],
    scheduling: [] as string[]
  };

  // Caption recommendations
  if (youtube.performance.totalPosts > 0) {
    recommendations.captions.push(
      `YouTube: Target ${youtube.captions.optimalRange} characters (current avg: ${youtube.captions.avgLength})`
    );

    if (youtube.captions.hasQuestion < 50) {
      recommendations.captions.push(
        `YouTube: Add questions to captions (${youtube.captions.hasQuestion}% of top posts have questions)`
      );
    }

    if (youtube.captions.hasExclamation < 70) {
      recommendations.captions.push(
        `YouTube: Use exclamation marks for urgency (${youtube.captions.hasExclamation}% of top posts use them)`
      );
    }
  }

  if (instagram.performance.totalPosts > 0) {
    recommendations.captions.push(
      `Instagram: Target ${instagram.captions.optimalRange} characters (current avg: ${instagram.captions.avgLength})`
    );

    if (instagram.captions.hasQuestion < 50) {
      recommendations.captions.push(
        `Instagram: Add questions to captions (${instagram.captions.hasQuestion}% of top posts have questions)`
      );
    }
  }

  // Hashtag recommendations
  if (youtube.hashtags.avgCount < 3) {
    recommendations.hashtags.push(
      `YouTube: Increase hashtags to 3-5 (current avg: ${youtube.hashtags.avgCount})`
    );
  }

  if (instagram.hashtags.avgCount < 5) {
    recommendations.hashtags.push(
      `Instagram: Use 5-8 hashtags for better reach (current avg: ${instagram.hashtags.avgCount})`
    );
  }

  recommendations.hashtags.push(
    'Use platform-specific hashtags: YouTube focuses on topics, Instagram on community'
  );

  // Duration recommendations
  recommendations.duration.push(
    'YouTube Shorts: 15-30 seconds optimal for retention'
  );
  recommendations.duration.push(
    'Instagram Reels: 15-30 seconds, test 7-15 for viral potential'
  );

  // Scheduling recommendations
  if (timing.bestHours.length > 0) {
    const topHours = timing.bestHours.slice(0, 3).map(h => h.label);
    recommendations.scheduling.push(
      `Best posting times: ${topHours.join(', ')}`
    );
  }

  if (timing.worstHours.length > 0) {
    const worstHours = timing.worstHours.slice(0, 2).map(h => h.label);
    recommendations.scheduling.push(
      `Avoid posting: ${worstHours.join(', ')} (lowest engagement)`
    );
  }

  if (timing.bestDays.length > 0) {
    const topDays = timing.bestDays.slice(0, 3).map(d => d.day);
    recommendations.scheduling.push(
      `Focus on: ${topDays.join(', ')}`
    );
  }

  return recommendations;
}
