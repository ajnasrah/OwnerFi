/**
 * Late.dev Analytics V2 - Platform-Specific Analytics
 *
 * Enhanced analytics system that leverages Late's analytics endpoint
 * to provide platform-specific insights for optimization
 */

import { getAdminDb } from './firebase-admin';
import { fetchWithTimeout, TIMEOUTS } from './api-utils';

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

// Rate limiting for Late API (30 requests per hour)
const RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 60 * 1000, // 1 hour
  requests: [] as number[]
};

/**
 * Check rate limit and wait if necessary
 */
async function checkRateLimit(): Promise<void> {
  const now = Date.now();

  // Remove requests older than window
  RATE_LIMIT.requests = RATE_LIMIT.requests.filter(
    time => now - time < RATE_LIMIT.windowMs
  );

  // Check if we're at limit
  if (RATE_LIMIT.requests.length >= RATE_LIMIT.maxRequests) {
    const oldestRequest = RATE_LIMIT.requests[0];
    const waitTime = RATE_LIMIT.windowMs - (now - oldestRequest);
    console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return checkRateLimit(); // Recursive check
  }

  // Add current request
  RATE_LIMIT.requests.push(now);
}

/**
 * Get Late API Key
 */
function getLateApiKey(): string | undefined {
  return process.env.LATE_API_KEY;
}

/**
 * Platform-specific analytics from Late
 */
export interface PlatformAnalytics {
  postId: string;
  platform: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  engagementRate?: number;
  clickThroughRate?: number;
}

/**
 * Enhanced post analytics with platform breakdown
 */
export interface EnhancedPostAnalytics {
  _id: string;
  profileId: string;
  brand?: string;
  scheduledFor: string;
  publishedAt?: string;
  content: string;
  status: 'scheduled' | 'posted' | 'failed' | 'pending';

  // Platform-specific metrics
  platforms: Array<{
    platform: string;
    accountId: string;
    platformPostId?: string;
    status?: string;
    analytics?: {
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      saves?: number;
      reach?: number;
      impressions?: number;
      engagementRate?: number;
      clickThroughRate?: number;
    };
  }>;

  // Aggregated metrics
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  overallEngagementRate: number;

  // Metadata
  mediaUrl?: string;
  caption?: string;
}

/**
 * Platform performance summary
 */
export interface PlatformPerformance {
  platform: string;
  totalPosts: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgSaves: number;
  avgEngagementRate: number;

  // Peak times
  peakHours: Array<{
    hour: number;
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;

  peakDays: Array<{
    dayOfWeek: number;
    dayName: string;
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;

  // Trends
  trend: 'up' | 'down' | 'stable';
  weekOverWeekGrowth: number;
}

/**
 * Fetch analytics from Late API
 * Supports filtering by platform, profile, date range
 */
export async function fetchLateAnalytics(params: {
  profileId?: string;
  platform?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  page?: number;
  sortBy?: 'date' | 'engagement';
}): Promise<{ posts: EnhancedPostAnalytics[]; pagination?: any; overview?: any }> {
  const LATE_API_KEY = getLateApiKey();
  if (!LATE_API_KEY) {
    throw new Error('LATE_API_KEY not configured');
  }

  // Check rate limit before making request
  await checkRateLimit();

  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.profileId) queryParams.append('profileId', params.profileId);
    if (params.platform) queryParams.append('platform', params.platform);
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);

    console.log(`📡 Fetching Late analytics: ${queryParams.toString()}`);

    const response = await fetchWithTimeout(
      `${LATE_BASE_URL}/analytics?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      },
      TIMEOUTS.EXTERNAL_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Late API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Process posts to calculate aggregated metrics
    const posts = (data.posts || []).map((post: any) => {
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalSaves = 0;

      post.platforms?.forEach((p: any) => {
        const analytics = p.analytics || {};
        totalViews += analytics.views || 0;
        totalLikes += analytics.likes || 0;
        totalComments += analytics.comments || 0;
        totalShares += analytics.shares || 0;
        totalSaves += analytics.saves || 0;
      });

      const overallEngagementRate = totalViews > 0
        ? ((totalLikes + totalComments + totalShares) / totalViews) * 100
        : 0;

      return {
        ...post,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        overallEngagementRate
      };
    });

    return {
      posts,
      pagination: data.pagination,
      overview: data.overview
    };

  } catch (error) {
    console.error('❌ Error fetching Late analytics:', error);
    throw error;
  }
}

/**
 * Sync platform-specific analytics to Firestore
 * Stores detailed metrics per platform for analysis
 */
export async function syncPlatformAnalytics(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah',
  days: number = 7
): Promise<void> {
  console.log(`📊 Syncing ${brand} platform analytics for last ${days} days...`);

  const adminDb = await getAdminDb();
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  // Get profile ID
  const profileIdMap: Record<string, string | undefined> = {
    'carz': process.env.LATE_CARZ_PROFILE_ID,
    'ownerfi': process.env.LATE_OWNERFI_PROFILE_ID,
    'podcast': process.env.LATE_PODCAST_PROFILE_ID,
    'vassdistro': process.env.LATE_VASSDISTRO_PROFILE_ID,
    'abdullah': process.env.LATE_ABDULLAH_PROFILE_ID,
  };

  const profileId = profileIdMap[brand];
  if (!profileId) {
    throw new Error(`Profile ID not configured for ${brand}`);
  }

  // Calculate date range
  const toDate = new Date().toISOString();
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch analytics from Late
  const { posts } = await fetchLateAnalytics({
    profileId,
    fromDate,
    toDate,
    limit: 100,
    sortBy: 'date'
  });

  console.log(`   Found ${posts.length} posts with analytics`);

  // Store each post's platform-specific analytics
  for (const post of posts) {
    if (!post.platforms || post.platforms.length === 0) continue;

    for (const platformData of post.platforms) {
      const analytics = platformData.analytics;
      if (!analytics) continue;

      const docId = `${post._id}_${platformData.platform}`;

      const platformAnalytics = {
        postId: post._id,
        brand,
        platform: platformData.platform.toLowerCase(), // Normalize platform name to lowercase
        publishedAt: post.publishedAt || post.scheduledFor,

        // Metrics
        views: analytics.views || 0,
        likes: analytics.likes || 0,
        comments: analytics.comments || 0,
        shares: analytics.shares || 0,
        saves: analytics.saves || 0,
        reach: analytics.reach || 0,
        impressions: analytics.impressions || 0,
        engagementRate: analytics.engagementRate || 0,

        // Time analysis
        hour: new Date(post.publishedAt || post.scheduledFor).getHours(),
        dayOfWeek: new Date(post.publishedAt || post.scheduledFor).getDay(),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
          new Date(post.publishedAt || post.scheduledFor).getDay()
        ],

        // Content metadata
        content: post.content || post.caption || '',

        // Sync metadata
        lastUpdated: Date.now(),
        syncedAt: new Date().toISOString()
      };

      await (adminDb as any)
        .collection('platform_analytics')
        .doc(docId)
        .set(platformAnalytics, { merge: true });
    }
  }

  console.log(`✅ Synced platform analytics for ${brand}`);
}

/**
 * Analyze platform performance
 * Returns aggregated metrics and trends per platform
 */
export async function analyzePlatformPerformance(
  brand?: string,
  days: number = 7
): Promise<Map<string, PlatformPerformance>> {
  console.log(`📈 Analyzing platform performance (${brand || 'all brands'}, ${days} days)...`);

  const adminDb = await getAdminDb();
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  // Query platform analytics
  let query: any = (adminDb as any).collection('platform_analytics');

  if (brand) {
    query = query.where('brand', '==', brand);
  }

  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  query = query.where('lastUpdated', '>=', cutoffTime);

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('   No analytics data found');
    return new Map();
  }

  // Group by platform
  const platformData = new Map<string, any[]>();

  snapshot.forEach((doc: any) => {
    const data = doc.data();
    const platform = data.platform;

    if (!platformData.has(platform)) {
      platformData.set(platform, []);
    }

    platformData.get(platform)!.push(data);
  });

  // Analyze each platform
  const performance = new Map<string, PlatformPerformance>();

  for (const [platform, posts] of platformData.entries()) {
    const totalPosts = posts.length;

    // Helper function to get visibility metric based on platform
    const getVisibility = (post: any): number => {
      // Instagram uses 'reach', TikTok and YouTube use 'views'
      if (platform.toLowerCase() === 'instagram') {
        return post.reach || 0;
      }
      return post.views || 0;
    };

    // Calculate averages
    const avgViews = posts.reduce((sum, p) => sum + getVisibility(p), 0) / totalPosts;
    const avgLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0) / totalPosts;
    const avgComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0) / totalPosts;
    const avgShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0) / totalPosts;
    const avgSaves = posts.reduce((sum, p) => sum + (p.saves || 0), 0) / totalPosts;
    const avgEngagementRate = posts.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / totalPosts;

    // Analyze by hour
    const hourData = new Map<number, { totalViews: number; totalEngagement: number; count: number }>();
    posts.forEach(post => {
      const hour = post.hour;
      const existing = hourData.get(hour) || { totalViews: 0, totalEngagement: 0, count: 0 };
      existing.totalViews += getVisibility(post);
      existing.totalEngagement += post.engagementRate || 0;
      existing.count += 1;
      hourData.set(hour, existing);
    });

    const peakHours = Array.from(hourData.entries())
      .map(([hour, data]) => ({
        hour,
        avgViews: data.totalViews / data.count,
        avgEngagement: data.totalEngagement / data.count,
        postCount: data.count
      }))
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 5);

    // Analyze by day
    const dayData = new Map<number, { totalViews: number; totalEngagement: number; count: number }>();
    posts.forEach(post => {
      const day = post.dayOfWeek;
      const existing = dayData.get(day) || { totalViews: 0, totalEngagement: 0, count: 0 };
      existing.totalViews += getVisibility(post);
      existing.totalEngagement += post.engagementRate || 0;
      existing.count += 1;
      dayData.set(day, existing);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDays = Array.from(dayData.entries())
      .map(([dayOfWeek, data]) => ({
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        avgViews: data.totalViews / data.count,
        avgEngagement: data.totalEngagement / data.count,
        postCount: data.count
      }))
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 3);

    // Calculate trend (compare first half vs second half)
    const midpoint = Date.now() - ((days / 2) * 24 * 60 * 60 * 1000);
    const recentPosts = posts.filter(p => p.lastUpdated >= midpoint);
    const olderPosts = posts.filter(p => p.lastUpdated < midpoint);

    const recentAvgViews = recentPosts.length > 0
      ? recentPosts.reduce((sum, p) => sum + getVisibility(p), 0) / recentPosts.length
      : 0;

    const olderAvgViews = olderPosts.length > 0
      ? olderPosts.reduce((sum, p) => sum + getVisibility(p), 0) / olderPosts.length
      : 0;

    const weekOverWeekGrowth = olderAvgViews > 0
      ? ((recentAvgViews - olderAvgViews) / olderAvgViews) * 100
      : 0;

    const trend = weekOverWeekGrowth > 5 ? 'up' : weekOverWeekGrowth < -5 ? 'down' : 'stable';

    performance.set(platform, {
      platform,
      totalPosts,
      avgViews,
      avgLikes,
      avgComments,
      avgShares,
      avgSaves,
      avgEngagementRate,
      peakHours,
      peakDays,
      trend,
      weekOverWeekGrowth
    });
  }

  console.log(`✅ Analyzed ${performance.size} platforms`);
  return performance;
}

/**
 * Get platform-specific recommendations
 */
export async function getPlatformRecommendations(
  brand: string,
  days: number = 7
): Promise<any> {
  const performance = await analyzePlatformPerformance(brand, days);

  const recommendations: any = {
    date: new Date().toISOString(),
    brand,
    platforms: {}
  };

  for (const [platform, perf] of performance.entries()) {
    recommendations.platforms[platform] = {
      optimalTimes: perf.peakHours.slice(0, 3).map(h => `${h.hour.toString().padStart(2, '0')}:00`),
      bestDays: perf.peakDays.map(d => d.dayName),
      avgEngagement: perf.avgEngagementRate.toFixed(2) + '%',
      trend: perf.trend,
      weekOverWeekGrowth: perf.weekOverWeekGrowth.toFixed(1) + '%',

      recommendations: generatePlatformRecommendations(platform, perf)
    };
  }

  // Overall best platform
  const sortedPlatforms = Array.from(performance.entries())
    .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate);

  recommendations.overall = {
    topPlatform: sortedPlatforms[0]?.[0] || 'N/A',
    bestTimeSlot: sortedPlatforms[0]?.[1].peakHours[0]
      ? `${sortedPlatforms[0][1].peakHours[0].hour.toString().padStart(2, '0')}:00`
      : 'N/A',
    actionItems: generateOverallRecommendations(sortedPlatforms)
  };

  return recommendations;
}

/**
 * Generate platform-specific recommendations
 */
function generatePlatformRecommendations(platform: string, perf: PlatformPerformance): string[] {
  const recs: string[] = [];

  // Frequency recommendations
  if (platform === 'tiktok' && perf.totalPosts < 14) {
    recs.push('Increase posting frequency to 2-3x/day - TikTok rewards consistency');
  } else if (platform === 'instagram' && perf.totalPosts < 10) {
    recs.push('Post 1-2x/day for optimal Instagram algorithm performance');
  }

  // Trend-based recommendations
  if (perf.trend === 'up') {
    recs.push(`Performance trending up (+${perf.weekOverWeekGrowth.toFixed(0)}%) - maintain current strategy`);
  } else if (perf.trend === 'down') {
    recs.push(`Performance declining (${perf.weekOverWeekGrowth.toFixed(0)}%) - test new content styles or times`);
  }

  // Engagement recommendations
  if (perf.avgEngagementRate < 3) {
    recs.push('Low engagement rate - focus on stronger hooks and call-to-actions');
  } else if (perf.avgEngagementRate > 8) {
    recs.push('Excellent engagement! Consider increasing frequency on this platform');
  }

  // Peak time recommendations
  if (perf.peakHours.length > 0) {
    const topHour = perf.peakHours[0];
    recs.push(`Peak performance at ${topHour.hour.toString().padStart(2, '0')}:00 - schedule more content at this time`);
  }

  return recs;
}

/**
 * Generate overall recommendations
 */
function generateOverallRecommendations(sortedPlatforms: Array<[string, PlatformPerformance]>): string[] {
  const recs: string[] = [];

  if (sortedPlatforms.length === 0) return recs;

  const topPlatform = sortedPlatforms[0];
  recs.push(`Focus on ${topPlatform[0]} - highest engagement at ${topPlatform[1].avgEngagementRate.toFixed(1)}%`);

  // Check for underperforming platforms
  const underperforming = sortedPlatforms.filter(([_, perf]) => perf.avgEngagementRate < 2);
  if (underperforming.length > 0) {
    recs.push(`Consider reducing frequency on: ${underperforming.map(([p]) => p).join(', ')}`);
  }

  // Growth opportunities
  const growing = sortedPlatforms.filter(([_, perf]) => perf.trend === 'up');
  if (growing.length > 0) {
    recs.push(`Capitalize on growth momentum: ${growing.map(([p]) => p).join(', ')}`);
  }

  return recs;
}

/**
 * Sync all brands platform analytics
 */
export async function syncAllBrandsPlatformAnalytics(days: number = 7): Promise<void> {
  const brands: Array<'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah'> = [
    'ownerfi',
    'carz',
    'podcast',
    'vassdistro',
    'abdullah'
  ];

  for (const brand of brands) {
    try {
      await syncPlatformAnalytics(brand, days);
    } catch (error) {
      console.error(`❌ Error syncing ${brand}:`, error);
    }
  }
}
