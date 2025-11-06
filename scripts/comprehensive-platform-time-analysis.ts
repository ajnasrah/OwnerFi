/**
 * Comprehensive Platform Time Analysis
 *
 * Analyzes GetLate analytics data to find optimal posting times for each platform
 * by day of week, focusing only on posts with actual engagement data.
 */

import * as fs from 'fs';

interface Post {
  platform: string;
  publishedAt: string;
  analytics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves?: number;
    impressions?: number;
    reach?: number;
  };
}

interface HourlyStats {
  hour: number;
  timeLabel: string;
  postCount: number;
  totalViews: number;
  totalEngagement: number;
  avgViews: number;
  avgEngagement: number;
  engagementRate: number;
}

interface DayAnalysis {
  dayName: string;
  dayOfWeek: number;
  totalPosts: number;
  postsWithData: number;
  topHours: HourlyStats[];
  allHourlyStats: HourlyStats[];
}

interface PlatformAnalysis {
  platform: string;
  totalPosts: number;
  postsWithData: number;
  byDay: DayAnalysis[];
  overallBestTimes: HourlyStats[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'twitter', 'threads', 'bluesky'];

function hasEngagementData(post: Post): boolean {
  const views = post.analytics.views || post.analytics.reach || post.analytics.impressions || 0;
  const engagement = (post.analytics.likes || 0) +
                    (post.analytics.comments || 0) +
                    (post.analytics.shares || 0) +
                    (post.analytics.saves || 0);

  return views > 0 || engagement > 0;
}

function getViews(post: Post): number {
  // Use views, or fallback to reach for Instagram, or impressions
  return post.analytics.views || post.analytics.reach || post.analytics.impressions || 0;
}

function getTotalEngagement(post: Post): number {
  return (post.analytics.likes || 0) +
         (post.analytics.comments || 0) +
         (post.analytics.shares || 0) +
         (post.analytics.saves || 0);
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

function calculateHourlyStats(posts: Post[]): HourlyStats[] {
  const hourlyData: { [hour: number]: Post[] } = {};

  for (const post of posts) {
    const date = new Date(post.publishedAt);
    const hour = date.getHours();

    if (!hourlyData[hour]) {
      hourlyData[hour] = [];
    }
    hourlyData[hour].push(post);
  }

  const stats: HourlyStats[] = [];

  for (const [hourStr, hourPosts] of Object.entries(hourlyData)) {
    const hour = parseInt(hourStr);
    const totalViews = hourPosts.reduce((sum, p) => sum + getViews(p), 0);
    const totalEngagement = hourPosts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
    const avgViews = totalViews / hourPosts.length;
    const avgEngagement = totalEngagement / hourPosts.length;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    stats.push({
      hour,
      timeLabel: formatHour(hour),
      postCount: hourPosts.length,
      totalViews,
      totalEngagement,
      avgViews,
      avgEngagement,
      engagementRate
    });
  }

  return stats.sort((a, b) => a.hour - b.hour);
}

function analyzePlatform(posts: Post[], platform: string): PlatformAnalysis {
  const platformPosts = posts.filter(p => p.platform.toLowerCase() === platform.toLowerCase());
  const postsWithData = platformPosts.filter(hasEngagementData);

  // Analyze by day of week
  const byDay: DayAnalysis[] = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayPosts = postsWithData.filter(p => new Date(p.publishedAt).getDay() === dayOfWeek);

    if (dayPosts.length === 0) {
      continue;
    }

    const allHourlyStats = calculateHourlyStats(dayPosts);

    // Get top 3 hours by engagement rate, but only if we have enough data (at least 2 posts)
    const topHours = allHourlyStats
      .filter(s => s.postCount >= 2)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 3);

    byDay.push({
      dayName: DAYS[dayOfWeek],
      dayOfWeek,
      totalPosts: dayPosts.length,
      postsWithData: dayPosts.length,
      topHours,
      allHourlyStats
    });
  }

  // Overall best times across all days
  const allHourlyStats = calculateHourlyStats(postsWithData);
  const overallBestTimes = allHourlyStats
    .filter(s => s.postCount >= 5) // Need at least 5 posts for overall recommendation
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 3);

  return {
    platform,
    totalPosts: platformPosts.length,
    postsWithData: postsWithData.length,
    byDay,
    overallBestTimes
  };
}

function printAnalysis(analysis: PlatformAnalysis) {
  console.log('\n' + '='.repeat(100));
  console.log(`📱 ${analysis.platform.toUpperCase()}`);
  console.log('='.repeat(100));
  console.log(`Total Posts: ${analysis.totalPosts} | Posts with Data: ${analysis.postsWithData}`);

  if (analysis.postsWithData === 0) {
    console.log('\n⚠️  No engagement data available for this platform\n');
    return;
  }

  // Overall best times
  console.log('\n🏆 OVERALL BEST POSTING TIMES (across all days):');
  console.log('-'.repeat(100));

  if (analysis.overallBestTimes.length === 0) {
    console.log('   Insufficient data (need at least 5 posts per time slot)');
  } else {
    for (let i = 0; i < analysis.overallBestTimes.length; i++) {
      const stat = analysis.overallBestTimes[i];
      console.log(`   ${i + 1}. ${stat.timeLabel.padEnd(10)} - ${stat.engagementRate.toFixed(2)}% engagement | ${Math.round(stat.avgViews)} avg views | ${Math.round(stat.avgEngagement)} avg interactions | ${stat.postCount} posts`);
    }
  }

  // By day of week
  console.log('\n📅 BEST TIMES BY DAY OF WEEK:');
  console.log('-'.repeat(100));

  if (analysis.byDay.length === 0) {
    console.log('   No data available');
  } else {
    for (const day of analysis.byDay) {
      console.log(`\n   ${day.dayName} (${day.postsWithData} posts):`);

      if (day.topHours.length === 0) {
        console.log('      Insufficient data (need at least 2 posts per time slot)');
      } else {
        for (let i = 0; i < day.topHours.length; i++) {
          const stat = day.topHours[i];
          console.log(`      ${i + 1}. ${stat.timeLabel.padEnd(10)} - ${stat.engagementRate.toFixed(2)}% engagement | ${Math.round(stat.avgViews)} avg views | ${stat.postCount} posts`);
        }
      }
    }
  }
}

function generateRecommendations(analyses: PlatformAnalysis[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 POSTING TIME RECOMMENDATIONS SUMMARY');
  console.log('='.repeat(100));

  for (const analysis of analyses) {
    if (analysis.postsWithData === 0 || analysis.overallBestTimes.length === 0) {
      continue;
    }

    console.log(`\n${analysis.platform.toUpperCase()}:`);
    console.log(`   Recommended times: ${analysis.overallBestTimes.map(h => h.timeLabel).join(', ')}`);

    // Find best day
    const bestDay = analysis.byDay
      .filter(d => d.topHours.length > 0)
      .sort((a, b) => {
        const aAvgEngagement = a.topHours.reduce((sum, h) => sum + h.engagementRate, 0) / a.topHours.length;
        const bAvgEngagement = b.topHours.reduce((sum, h) => sum + h.engagementRate, 0) / b.topHours.length;
        return bAvgEngagement - aAvgEngagement;
      })[0];

    if (bestDay) {
      console.log(`   Best day: ${bestDay.dayName} at ${bestDay.topHours[0].timeLabel}`);
    }
  }

  console.log('\n' + '='.repeat(100));
}

function exportToConfig(analyses: PlatformAnalysis[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('💾 CONFIGURATION EXPORT');
  console.log('='.repeat(100));
  console.log('\nOptimal posting times for platform-optimal-times.ts:\n');

  console.log('export const PLATFORM_OPTIMAL_HOURS: Record<string, number[]> = {');

  for (const analysis of analyses) {
    if (analysis.overallBestTimes.length > 0) {
      const hours = analysis.overallBestTimes.map(h => h.hour);
      console.log(`  ${analysis.platform.toLowerCase()}: [${hours.join(', ')}], // ${analysis.overallBestTimes.map(h => h.timeLabel).join(', ')}`);
    }
  }

  console.log('};');
  console.log('\n' + '='.repeat(100));
}

async function main() {
  console.log('🚀 Starting Comprehensive Platform Time Analysis\n');

  // Load data
  if (!fs.existsSync('./late-analytics-all.json')) {
    console.log('❌ late-analytics-all.json not found. Run fetch-late-analytics-comprehensive.ts first.');
    process.exit(1);
  }

  const posts: Post[] = JSON.parse(fs.readFileSync('./late-analytics-all.json', 'utf-8'));
  console.log(`📊 Loaded ${posts.length} posts\n`);

  // Filter to posts with engagement data
  const postsWithData = posts.filter(hasEngagementData);
  console.log(`✅ ${postsWithData.length} posts have engagement data (${((postsWithData.length / posts.length) * 100).toFixed(1)}%)\n`);

  // Analyze each platform
  const analyses: PlatformAnalysis[] = [];

  for (const platform of PLATFORMS) {
    const analysis = analyzePlatform(posts, platform);
    analyses.push(analysis);
    printAnalysis(analysis);
  }

  // Generate recommendations
  generateRecommendations(analyses);

  // Export configuration
  exportToConfig(analyses);

  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}

main();
