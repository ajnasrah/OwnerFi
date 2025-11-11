#!/usr/bin/env tsx
/**
 * Platform Optimization Roadmap
 *
 * Analyze what's working and what needs to change to improve ALL platforms:
 * - Current performance baseline
 * - Peak posting times for each platform
 * - Posting frequency analysis
 * - Content timing optimization
 * - Specific actions to improve each platform
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

interface PostData {
  brand: string;
  platform: string;
  hour: number;
  dayOfWeek: number;
  dayName: string;
  publishedAt: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

interface PlatformInsights {
  platform: string;
  brand: string;
  totalPosts: number;
  avgReach: number;
  avgViews: number;
  avgEngagement: number;
  engagementRate: number;

  // Time analysis
  bestHours: Array<{ hour: number; avgScore: number; posts: number }>;
  worstHours: Array<{ hour: number; avgScore: number; posts: number }>;
  bestDays: Array<{ day: string; avgScore: number; posts: number }>;
  worstDays: Array<{ day: string; avgScore: number; posts: number }>;

  // Trends
  recentPerformance: number;
  olderPerformance: number;
  trend: string;

  // Recommendations
  currentSchedule: string[];
  recommendedSchedule: string[];
  frequencyChange: string;
  specificActions: string[];
}

async function fetchAllData(days: number = 30): Promise<PostData[]> {
  const adminDb = await getAdminDb();
  if (!adminDb) throw new Error('Firebase not initialized');

  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  const snapshot = await (adminDb as any)
    .collection('platform_analytics')
    .where('lastUpdated', '>=', cutoffTime)
    .get();

  const posts: PostData[] = [];

  snapshot.forEach((doc: any) => {
    const d = doc.data();
    posts.push({
      brand: d.brand,
      platform: d.platform,
      hour: d.hour,
      dayOfWeek: d.dayOfWeek,
      dayName: d.dayName,
      publishedAt: d.publishedAt,
      views: d.views || 0,
      reach: d.reach || 0,
      likes: d.likes || 0,
      comments: d.comments || 0,
      shares: d.shares || 0,
      saves: d.saves || 0,
      engagementRate: d.engagementRate || 0,
    });
  });

  return posts;
}

function calculatePerformanceScore(post: PostData): number {
  // Use views if available, otherwise reach
  const visibility = post.views > 0 ? post.views : post.reach;

  // Engagement = likes + comments + shares + saves
  const engagement = post.likes + post.comments + post.shares + post.saves;

  // Combined score (weighted)
  return visibility + (engagement * 10); // Weight engagement higher
}

function analyzePlatform(posts: PostData[]): PlatformInsights {
  const platform = posts[0].platform;
  const brand = posts[0].brand;
  const totalPosts = posts.length;

  // Calculate averages
  const avgReach = posts.reduce((sum, p) => sum + p.reach, 0) / totalPosts;
  const avgViews = posts.reduce((sum, p) => sum + p.views, 0) / totalPosts;
  const totalEngagement = posts.reduce((sum, p) => sum + p.likes + p.comments + p.shares + p.saves, 0);
  const avgEngagement = totalEngagement / totalPosts;
  const engagementRate = avgReach > 0 ? (avgEngagement / avgReach) * 100 : 0;

  // Analyze by hour
  const hourMap = new Map<number, { scores: number[]; posts: number }>();
  posts.forEach(p => {
    const score = calculatePerformanceScore(p);
    if (!hourMap.has(p.hour)) {
      hourMap.set(p.hour, { scores: [], posts: 0 });
    }
    hourMap.get(p.hour)!.scores.push(score);
    hourMap.get(p.hour)!.posts++;
  });

  const hourStats = Array.from(hourMap.entries()).map(([hour, data]) => ({
    hour,
    avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    posts: data.posts,
  }));

  const bestHours = [...hourStats].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
  const worstHours = [...hourStats].sort((a, b) => a.avgScore - b.avgScore).slice(0, 3);

  // Analyze by day
  const dayMap = new Map<string, { scores: number[]; posts: number }>();
  posts.forEach(p => {
    const score = calculatePerformanceScore(p);
    if (!dayMap.has(p.dayName)) {
      dayMap.set(p.dayName, { scores: [], posts: 0 });
    }
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

  const recentPerformance = recentPosts.reduce((sum, p) => sum + calculatePerformanceScore(p), 0) / recentPosts.length;
  const olderPerformance = olderPosts.reduce((sum, p) => sum + calculatePerformanceScore(p), 0) / olderPosts.length;

  const trendPercent = olderPerformance > 0 ? ((recentPerformance - olderPerformance) / olderPerformance) * 100 : 0;
  const trend = trendPercent > 10 ? 'IMPROVING' : trendPercent < -10 ? 'DECLINING' : 'STABLE';

  // Current schedule (what hours are we posting at?)
  const currentHours = Array.from(hourMap.keys()).sort((a, b) => a - b);
  const currentSchedule = currentHours.map(h => `${h.toString().padStart(2, '0')}:00`);

  // Recommended schedule (best performing hours)
  const recommendedSchedule = bestHours.map(h => `${h.hour.toString().padStart(2, '0')}:00`);

  // Frequency recommendations
  let frequencyChange = 'MAINTAIN';
  if (avgEngagement > 2 && totalPosts < 30) {
    frequencyChange = 'INCREASE (good engagement, low volume)';
  } else if (avgEngagement < 0.5 && totalPosts > 50) {
    frequencyChange = 'DECREASE (low engagement, high volume)';
  } else if (trend === 'IMPROVING' && avgEngagement > 1) {
    frequencyChange = 'INCREASE (trending up)';
  } else if (trend === 'DECLINING') {
    frequencyChange = 'TEST NEW APPROACH (declining performance)';
  }

  // Specific actions
  const specificActions: string[] = [];

  // Action 1: Time optimization
  if (bestHours.length > 0 && worstHours.length > 0) {
    const bestTime = bestHours[0].hour;
    const worstTime = worstHours[0].hour;
    specificActions.push(
      `⏰ TIMING: Post at ${bestTime.toString().padStart(2, '0')}:00 (${bestHours[0].avgScore.toFixed(0)} score) instead of ${worstTime.toString().padStart(2, '0')}:00 (${worstHours[0].avgScore.toFixed(0)} score)`
    );
  }

  // Action 2: Day optimization
  if (bestDays.length > 0 && worstDays.length > 0) {
    specificActions.push(
      `📅 DAYS: Focus on ${bestDays.map(d => d.day).join(', ')}. Reduce posting on ${worstDays.map(d => d.day).join(', ')}`
    );
  }

  // Action 3: Frequency
  if (totalPosts < 20) {
    specificActions.push(`📈 VOLUME: Only ${totalPosts} posts in 30 days. Increase to 1-2 posts/day`);
  } else if (avgEngagement < 1 && totalPosts > 60) {
    specificActions.push(`📉 VOLUME: ${totalPosts} posts but low engagement (${avgEngagement.toFixed(2)}). Reduce frequency, focus on quality`);
  }

  // Action 4: Trend-based
  if (trend === 'DECLINING') {
    specificActions.push(`⚠️ TREND: Performance declining ${Math.abs(trendPercent).toFixed(0)}%. Test new content formats or posting times`);
  } else if (trend === 'IMPROVING') {
    specificActions.push(`✅ TREND: Performance improving ${trendPercent.toFixed(0)}%. Double down on current strategy`);
  }

  // Action 5: Platform-specific
  if (platform === 'instagram' && avgReach > 0 && avgEngagement < 1) {
    specificActions.push(`💡 INSTAGRAM: Good reach (${avgReach.toFixed(0)}) but low engagement. Try stronger CTAs, questions, polls`);
  } else if (platform === 'youtube' && avgViews > 100 && avgEngagement < 2) {
    specificActions.push(`💡 YOUTUBE: Good views (${avgViews.toFixed(0)}) but low engagement. Improve hooks, add CTAs, ask for comments`);
  } else if (platform === 'tiktok' && avgReach === 0 && avgEngagement === 0) {
    specificActions.push(`💡 TIKTOK: No data. Either API issue or account not connected. Verify account status`);
  } else if (platform === 'twitter' && avgEngagement === 0) {
    specificActions.push(`💡 TWITTER: No engagement. Test hashtags, mentions, engagement pods, or pause posting`);
  }

  return {
    platform,
    brand,
    totalPosts,
    avgReach,
    avgViews,
    avgEngagement,
    engagementRate,
    bestHours,
    worstHours,
    bestDays,
    worstDays,
    recentPerformance,
    olderPerformance,
    trend,
    currentSchedule,
    recommendedSchedule,
    frequencyChange,
    specificActions,
  };
}

async function main() {
  console.log('═'.repeat(120));
  console.log('🎯 PLATFORM OPTIMIZATION ROADMAP - SYSTEMATIC IMPROVEMENT PLAN FOR ALL PLATFORMS');
  console.log('═'.repeat(120));
  console.log('');

  const posts = await fetchAllData(30);
  console.log(`✅ Loaded ${posts.length} posts from last 30 days\n`);

  // Group by brand and platform
  const groups = new Map<string, PostData[]>();
  posts.forEach(p => {
    const key = `${p.brand}:${p.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  const insights: PlatformInsights[] = [];
  groups.forEach((posts, key) => {
    insights.push(analyzePlatform(posts));
  });

  // Sort by brand, then platform
  insights.sort((a, b) => {
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return a.platform.localeCompare(b.platform);
  });

  // Display detailed analysis per brand
  const brands = Array.from(new Set(insights.map(i => i.brand)));

  for (const brand of brands) {
    const brandInsights = insights.filter(i => i.brand === brand);

    console.log('\n' + '═'.repeat(120));
    console.log(`📱 ${brand.toUpperCase()} - OPTIMIZATION PLAN`);
    console.log('═'.repeat(120));

    brandInsights.forEach(insight => {
      console.log(`\n${'━'.repeat(120)}`);
      console.log(`${insight.platform.toUpperCase()}`);
      console.log('━'.repeat(120));

      // Current state
      console.log(`\n📊 CURRENT PERFORMANCE:`);
      console.log(`   Posts: ${insight.totalPosts} over 30 days (${(insight.totalPosts / 30).toFixed(1)} posts/day)`);
      console.log(`   Reach: ${insight.avgReach.toFixed(0)} avg`);
      console.log(`   Views: ${insight.avgViews.toFixed(0)} avg`);
      console.log(`   Engagement: ${insight.avgEngagement.toFixed(2)} interactions/post`);
      console.log(`   Engagement Rate: ${insight.engagementRate.toFixed(2)}%`);
      console.log(`   Trend: ${insight.trend} (${insight.recentPerformance.toFixed(0)} recent vs ${insight.olderPerformance.toFixed(0)} older)`);

      // Time analysis
      console.log(`\n⏰ POSTING TIME ANALYSIS:`);
      console.log(`   Currently posting at: ${insight.currentSchedule.join(', ')}`);
      console.log(`   Best performing hours:`);
      insight.bestHours.forEach((h, i) => {
        const icon = i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉';
        console.log(`      ${icon} ${h.hour.toString().padStart(2, '0')}:00 - Score: ${h.avgScore.toFixed(0)} (${h.posts} posts)`);
      });
      console.log(`   Worst performing hours:`);
      insight.worstHours.forEach(h => {
        console.log(`      ❌ ${h.hour.toString().padStart(2, '0')}:00 - Score: ${h.avgScore.toFixed(0)} (${h.posts} posts)`);
      });

      // Day analysis
      console.log(`\n📅 DAY OF WEEK ANALYSIS:`);
      console.log(`   Best days: ${insight.bestDays.map(d => `${d.day} (${d.avgScore.toFixed(0)})`).join(', ')}`);
      console.log(`   Worst days: ${insight.worstDays.map(d => `${d.day} (${d.avgScore.toFixed(0)})`).join(', ')}`);

      // Recommendations
      console.log(`\n🎯 SPECIFIC ACTIONS TO IMPROVE:`);
      insight.specificActions.forEach((action, i) => {
        console.log(`   ${i + 1}. ${action}`);
      });

      console.log(`\n📈 FREQUENCY RECOMMENDATION: ${insight.frequencyChange}`);
      console.log(`💡 RECOMMENDED SCHEDULE: Post at ${insight.recommendedSchedule.slice(0, 3).join(', ')}`);
    });

    console.log('\n');
  }

  // Overall summary
  console.log('\n' + '═'.repeat(120));
  console.log('📋 IMPLEMENTATION PRIORITY');
  console.log('═'.repeat(120));
  console.log('');

  // Categorize platforms
  const improving = insights.filter(i => i.trend === 'IMPROVING');
  const declining = insights.filter(i => i.trend === 'DECLINING');
  const stable = insights.filter(i => i.trend === 'STABLE');
  const highEngagement = insights.filter(i => i.avgEngagement > 2);
  const lowEngagement = insights.filter(i => i.avgEngagement < 0.5);
  const noData = insights.filter(i => i.avgReach === 0 && i.avgViews === 0);

  console.log('🚨 URGENT - Fix These First:');
  if (declining.length > 0) {
    declining.forEach(i => {
      console.log(`   • ${i.brand.toUpperCase()} ${i.platform}: Declining ${((i.olderPerformance - i.recentPerformance) / i.olderPerformance * 100).toFixed(0)}%`);
    });
  }
  if (noData.length > 0) {
    console.log(`   • No data platforms: ${noData.map(i => `${i.brand} ${i.platform}`).join(', ')}`);
  }

  console.log('\n✅ DOUBLE DOWN - Keep Doing What Works:');
  if (improving.length > 0) {
    improving.forEach(i => {
      console.log(`   • ${i.brand.toUpperCase()} ${i.platform}: Improving, ${i.avgEngagement.toFixed(2)} engagement/post`);
    });
  }

  console.log('\n⚙️ OPTIMIZE - Make Small Adjustments:');
  if (stable.length > 0) {
    stable.forEach(i => {
      if (i.avgEngagement > 1) {
        console.log(`   • ${i.brand.toUpperCase()} ${i.platform}: Stable performance, adjust posting times for better results`);
      }
    });
  }

  console.log('\n🔍 TEST - Need More Data:');
  if (lowEngagement.length > 0) {
    lowEngagement.forEach(i => {
      if (i.totalPosts < 20) {
        console.log(`   • ${i.brand.toUpperCase()} ${i.platform}: Only ${i.totalPosts} posts, increase frequency to gather data`);
      }
    });
  }

  console.log('\n' + '═'.repeat(120));
  console.log('📝 NEXT STEPS');
  console.log('═'.repeat(120));
  console.log(`
1. Review the specific actions for each platform above
2. Update Late.dev queue schedules with recommended posting times
3. Adjust posting frequency based on recommendations
4. Test new content formats on declining platforms
5. Re-run this analysis weekly to track progress
6. Focus on time optimization first (easiest wins)
7. Then test frequency adjustments
8. Finally, experiment with content formats

Run weekly: npx tsx scripts/optimization-roadmap.ts
  `);
}

main().catch(console.error);
