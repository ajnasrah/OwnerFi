#!/usr/bin/env tsx
/**
 * Comprehensive Analytics Report
 *
 * Generate actionable insights for improving brand performance:
 * - Which platforms to focus on
 * - When to post for maximum engagement
 * - Which platforms to reduce/increase posting frequency
 * - Specific queue schedule recommendations
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

interface PostAnalytics {
  brand: string;
  platform: string;
  publishedAt: string;
  hour: number;
  dayOfWeek: number;
  dayName: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  engagementRate: number;
}

interface PlatformStats {
  platform: string;
  totalPosts: number;
  avgViews: number;
  avgEngagement: number;
  totalViews: number;
  totalEngagement: number;
  peakHour: number;
  peakDay: string;
  trend: 'growing' | 'declining' | 'stable';
  weekOverWeekGrowth: number;
}

interface BrandReport {
  brand: string;
  totalPosts: number;
  platforms: Map<string, PlatformStats>;
  overallAvgViews: number;
  overallAvgEngagement: number;
  bestPlatform: string;
  worstPlatform: string;
  recommendations: string[];
}

async function fetchAllAnalytics(days: number = 30): Promise<PostAnalytics[]> {
  const adminDb = await getAdminDb();
  if (!adminDb) throw new Error('Firebase not initialized');

  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  const snapshot = await (adminDb as any)
    .collection('platform_analytics')
    .where('lastUpdated', '>=', cutoffTime)
    .get();

  const analytics: PostAnalytics[] = [];

  snapshot.forEach((doc: any) => {
    const data = doc.data();
    analytics.push({
      brand: data.brand,
      platform: data.platform,
      publishedAt: data.publishedAt,
      hour: data.hour,
      dayOfWeek: data.dayOfWeek,
      dayName: data.dayName,
      views: data.views || 0,
      likes: data.likes || 0,
      comments: data.comments || 0,
      shares: data.shares || 0,
      saves: data.saves || 0,
      reach: data.reach || 0,
      engagementRate: data.engagementRate || 0,
    });
  });

  return analytics;
}

function analyzePlatformStats(posts: PostAnalytics[]): PlatformStats {
  const platform = posts[0].platform;
  const totalPosts = posts.length;

  // Calculate averages
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const totalEngagement = posts.reduce((sum, p) => sum + p.engagementRate, 0);
  const avgViews = totalViews / totalPosts;
  const avgEngagement = totalEngagement / totalPosts;

  // Find peak hour
  const hourCounts = new Map<number, { views: number; count: number }>();
  posts.forEach(p => {
    const existing = hourCounts.get(p.hour) || { views: 0, count: 0 };
    existing.views += p.views;
    existing.count += 1;
    hourCounts.set(p.hour, existing);
  });

  const peakHourEntry = Array.from(hourCounts.entries())
    .sort((a, b) => (b[1].views / b[1].count) - (a[1].views / a[1].count))[0];
  const peakHour = peakHourEntry?.[0] || 0;

  // Find peak day
  const dayCounts = new Map<string, { views: number; count: number }>();
  posts.forEach(p => {
    const existing = dayCounts.get(p.dayName) || { views: 0, count: 0 };
    existing.views += p.views;
    existing.count += 1;
    dayCounts.set(p.dayName, existing);
  });

  const peakDayEntry = Array.from(dayCounts.entries())
    .sort((a, b) => (b[1].views / b[1].count) - (a[1].views / a[1].count))[0];
  const peakDay = peakDayEntry?.[0] || 'Monday';

  // Calculate trend
  const midpoint = posts.length / 2;
  const recentPosts = posts.slice(0, Math.floor(midpoint));
  const olderPosts = posts.slice(Math.floor(midpoint));

  const recentAvg = recentPosts.reduce((sum, p) => sum + p.views, 0) / recentPosts.length;
  const olderAvg = olderPosts.reduce((sum, p) => sum + p.views, 0) / olderPosts.length;

  const weekOverWeekGrowth = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const trend = weekOverWeekGrowth > 10 ? 'growing' : weekOverWeekGrowth < -10 ? 'declining' : 'stable';

  return {
    platform,
    totalPosts,
    avgViews,
    avgEngagement,
    totalViews,
    totalEngagement,
    peakHour,
    peakDay,
    trend,
    weekOverWeekGrowth,
  };
}

function generateBrandReport(brand: string, posts: PostAnalytics[]): BrandReport {
  // Group by platform
  const platformGroups = new Map<string, PostAnalytics[]>();
  posts.forEach(p => {
    if (!platformGroups.has(p.platform)) {
      platformGroups.set(p.platform, []);
    }
    platformGroups.get(p.platform)!.push(p);
  });

  // Analyze each platform
  const platformStats = new Map<string, PlatformStats>();
  platformGroups.forEach((platformPosts, platform) => {
    platformStats.set(platform, analyzePlatformStats(platformPosts));
  });

  // Overall stats
  const totalPosts = posts.length;
  const overallAvgViews = posts.reduce((sum, p) => sum + p.views, 0) / totalPosts;
  const overallAvgEngagement = posts.reduce((sum, p) => sum + p.engagementRate, 0) / totalPosts;

  // Find best/worst platforms
  const sortedPlatforms = Array.from(platformStats.entries())
    .sort((a, b) => b[1].avgViews - a[1].avgViews);

  const bestPlatform = sortedPlatforms[0]?.[0] || 'N/A';
  const worstPlatform = sortedPlatforms[sortedPlatforms.length - 1]?.[0] || 'N/A';

  // Generate recommendations
  const recommendations = generateRecommendations(platformStats, brand);

  return {
    brand,
    totalPosts,
    platforms: platformStats,
    overallAvgViews,
    overallAvgEngagement,
    bestPlatform,
    worstPlatform,
    recommendations,
  };
}

function generateRecommendations(
  platformStats: Map<string, PlatformStats>,
  brand: string
): string[] {
  const recs: string[] = [];
  const platforms = Array.from(platformStats.entries()).sort((a, b) => b[1].avgViews - a[1].avgViews);

  // 1. Top performing platform
  if (platforms.length > 0) {
    const [topPlatform, topStats] = platforms[0];
    recs.push(
      `🏆 DOUBLE DOWN on ${topPlatform.toUpperCase()}: Best performer with ${topStats.avgViews.toFixed(0)} avg views. Post at ${topStats.peakHour.toString().padStart(2, '0')}:00 on ${topStats.peakDay}s`
    );
  }

  // 2. Underperforming platforms
  const underperforming = platforms.filter(([_, stats]) => stats.avgViews < 50);
  if (underperforming.length > 0) {
    underperforming.forEach(([platform, stats]) => {
      recs.push(
        `⚠️ REDUCE ${platform.toUpperCase()}: Only ${stats.avgViews.toFixed(0)} avg views. Cut posting frequency by 50% or test new content styles`
      );
    });
  }

  // 3. Growing platforms
  const growing = platforms.filter(([_, stats]) => stats.trend === 'growing');
  if (growing.length > 0) {
    growing.forEach(([platform, stats]) => {
      recs.push(
        `📈 INCREASE ${platform.toUpperCase()}: Growing ${stats.weekOverWeekGrowth.toFixed(0)}% WoW. Increase frequency by 25% and post at ${stats.peakHour.toString().padStart(2, '0')}:00`
      );
    });
  }

  // 4. Declining platforms
  const declining = platforms.filter(([_, stats]) => stats.trend === 'declining');
  if (declining.length > 0) {
    declining.forEach(([platform, stats]) => {
      recs.push(
        `📉 FIX ${platform.toUpperCase()}: Declining ${Math.abs(stats.weekOverWeekGrowth).toFixed(0)}% WoW. Test posting at different times or reduce frequency`
      );
    });
  }

  // 5. Specific time adjustments
  platforms.forEach(([platform, stats]) => {
    if (stats.avgViews > 100) {
      recs.push(
        `⏰ ${platform.toUpperCase()} SCHEDULE: Peak performance at ${stats.peakHour.toString().padStart(2, '0')}:00. Adjust queue to post 2-3x daily around this time`
      );
    }
  });

  return recs;
}

async function main() {
  console.log('═'.repeat(100));
  console.log('📊 COMPREHENSIVE ANALYTICS REPORT - ACTIONABLE INSIGHTS FOR QUEUE OPTIMIZATION');
  console.log('═'.repeat(100));
  console.log('');

  const days = 30;
  console.log(`Analyzing last ${days} days of data...\n`);

  // Fetch all analytics
  const allAnalytics = await fetchAllAnalytics(days);
  console.log(`✅ Loaded ${allAnalytics.length} posts across all brands\n`);

  // Group by brand
  const brandGroups = new Map<string, PostAnalytics[]>();
  allAnalytics.forEach(p => {
    if (!brandGroups.has(p.brand)) {
      brandGroups.set(p.brand, []);
    }
    brandGroups.get(p.brand)!.push(p);
  });

  console.log('═'.repeat(100));
  console.log('BRAND-BY-BRAND ANALYSIS');
  console.log('═'.repeat(100));
  console.log('');

  const brands = ['carz', 'podcast', 'abdullah', 'ownerfi', 'vassdistro'];
  const reports: BrandReport[] = [];

  for (const brand of brands) {
    const posts = brandGroups.get(brand) || [];

    if (posts.length === 0) {
      console.log(`❌ ${brand.toUpperCase()}: No data (run sync script first)\n`);
      continue;
    }

    const report = generateBrandReport(brand, posts);
    reports.push(report);

    console.log(`\n${'━'.repeat(100)}`);
    console.log(`📱 ${brand.toUpperCase()} - ${report.totalPosts} posts`);
    console.log(`${'━'.repeat(100)}`);
    console.log(`Overall Performance: ${report.overallAvgViews.toFixed(0)} avg views | ${report.overallAvgEngagement.toFixed(2)}% engagement`);
    console.log('');

    // Platform breakdown
    console.log('Platform Performance:');
    const sortedPlatforms = Array.from(report.platforms.entries())
      .sort((a, b) => b[1].avgViews - a[1].avgViews);

    sortedPlatforms.forEach(([platform, stats], index) => {
      const icon = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const trendIcon = stats.trend === 'growing' ? '📈' : stats.trend === 'declining' ? '📉' : '➡️';

      console.log(
        `  ${icon} ${platform.padEnd(12)} | ` +
        `${stats.totalPosts.toString().padStart(3)} posts | ` +
        `${stats.avgViews.toFixed(0).padStart(6)} avg views | ` +
        `${stats.avgEngagement.toFixed(2)}% engagement | ` +
        `${trendIcon} ${stats.weekOverWeekGrowth >= 0 ? '+' : ''}${stats.weekOverWeekGrowth.toFixed(0)}% WoW | ` +
        `Peak: ${stats.peakHour.toString().padStart(2, '0')}:00 on ${stats.peakDay}s`
      );
    });

    console.log('');
    console.log('🎯 ACTIONABLE RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    console.log('');
  }

  // Cross-brand comparison
  console.log('\n' + '═'.repeat(100));
  console.log('CROSS-BRAND PLATFORM COMPARISON');
  console.log('═'.repeat(100));
  console.log('');

  const allPlatforms = new Set<string>();
  reports.forEach(r => {
    r.platforms.forEach((_, platform) => allPlatforms.add(platform));
  });

  allPlatforms.forEach(platform => {
    console.log(`\n${platform.toUpperCase()}:`);
    reports.forEach(report => {
      const stats = report.platforms.get(platform);
      if (stats) {
        console.log(
          `  ${report.brand.padEnd(12)} | ` +
          `${stats.avgViews.toFixed(0).padStart(6)} avg views | ` +
          `${stats.avgEngagement.toFixed(2)}% engagement | ` +
          `${stats.totalPosts} posts`
        );
      }
    });
  });

  // Overall recommendations
  console.log('\n' + '═'.repeat(100));
  console.log('🎯 TOP PRIORITY ACTIONS');
  console.log('═'.repeat(100));
  console.log('');

  const allRecs: Array<{ brand: string; rec: string; priority: number }> = [];

  reports.forEach(report => {
    report.recommendations.forEach(rec => {
      let priority = 0;
      if (rec.includes('DOUBLE DOWN')) priority = 5;
      else if (rec.includes('INCREASE')) priority = 4;
      else if (rec.includes('FIX')) priority = 3;
      else if (rec.includes('REDUCE')) priority = 2;
      else priority = 1;

      allRecs.push({ brand: report.brand, rec, priority });
    });
  });

  allRecs.sort((a, b) => b.priority - a.priority);

  allRecs.slice(0, 15).forEach((item, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. [${item.brand.toUpperCase()}] ${item.rec}`);
  });

  console.log('\n' + '═'.repeat(100));
  console.log('💡 NEXT STEPS');
  console.log('═'.repeat(100));
  console.log(`
1. Review top priority actions above
2. Adjust Late.dev queue schedules based on peak times
3. Increase posting frequency on high-performing platforms
4. Reduce or pause underperforming platforms
5. Test new content formats on declining platforms
6. Re-run this script weekly to track improvements
7. Use: npx tsx scripts/setup-late-queues-optimized.ts to update schedules
  `);

  console.log('═'.repeat(100));
}

main().catch(console.error);
