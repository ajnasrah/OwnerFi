#!/usr/bin/env tsx
/**
 * Weekly Social Media Optimization Report
 *
 * Analyzes YouTube and Instagram performance across all brands and provides
 * actionable recommendations for:
 * - Caption optimization (type, length, format)
 * - Hashtag performance
 * - Video duration sweet spots
 * - Peak posting times
 *
 * Run: npx tsx scripts/weekly-optimization-report.ts [brand]
 * Example: npx tsx scripts/weekly-optimization-report.ts ownerfi
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { getAdminDb } from '../src/lib/firebase-admin';

config({ path: resolve(process.cwd(), '.env.local') });

interface PlatformMetrics {
  platform: string;
  totalPosts: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgEngagementRate: number;
  bestPerformer: any;
}

interface CaptionAnalysis {
  avgLength: number;
  optimalRange: string;
  hashtagCount: number;
  hasQuestion: number;
  hasExclamation: number;
  topPerformingLength: string;
}

interface TimingAnalysis {
  bestHours: Array<{ hour: number; avgViews: number; count: number }>;
  bestDays: Array<{ day: string; avgViews: number; count: number }>;
  worstHours: Array<{ hour: number; avgViews: number; count: number }>;
}

interface WeeklyReport {
  brand: string;
  period: string;
  summary: {
    totalPosts: number;
    totalViews: number;
    avgEngagementRate: number;
    weekOverWeekGrowth: number;
  };
  platforms: {
    youtube: PlatformMetrics;
    instagram: PlatformMetrics;
  };
  captions: {
    youtube: CaptionAnalysis;
    instagram: CaptionAnalysis;
  };
  timing: TimingAnalysis;
  recommendations: {
    captions: string[];
    hashtags: string[];
    duration: string[];
    scheduling: string[];
  };
}

async function generateWeeklyReport(brand?: string): Promise<WeeklyReport[]> {
  const db = await getAdminDb();

  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return [];
  }

  // Date range: last 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const brands = brand ? [brand] : ['carz', 'ownerfi', 'podcast', 'vassdistro', 'abdullah'];
  const reports: WeeklyReport[] = [];

  for (const currentBrand of brands) {
    console.log(`\n📊 Analyzing ${currentBrand}...`);

    // Fetch analytics from platform_analytics collection
    const analyticsSnapshot = await db.collection('platform_analytics')
      .where('brand', '==', currentBrand)
      .where('syncedAt', '>=', sevenDaysAgo.toISOString())
      .get();

    const posts = analyticsSnapshot.docs.map(doc => doc.data());

    if (posts.length === 0) {
      console.log(`   No data for ${currentBrand} in the last 7 days`);
      continue;
    }

    // Separate by platform
    const youtubePosts = posts.filter(p => p.platform === 'youtube');
    const instagramPosts = posts.filter(p => p.platform === 'instagram');

    // Calculate platform metrics
    const youtubeMetrics = calculatePlatformMetrics('youtube', youtubePosts);
    const instagramMetrics = calculatePlatformMetrics('instagram', instagramPosts);

    // Analyze captions
    const youtubeCaptions = analyzeCaptions(youtubePosts);
    const instagramCaptions = analyzeCaptions(instagramPosts);

    // Analyze timing
    const timingAnalysis = analyzePostingTimes(posts);

    // Generate recommendations
    const recommendations = generateRecommendations({
      youtube: { metrics: youtubeMetrics, captions: youtubeCaptions },
      instagram: { metrics: instagramMetrics, captions: instagramCaptions },
      timing: timingAnalysis
    });

    // Week-over-week comparison
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const previousWeekSnapshot = await db.collection('platform_analytics')
      .where('brand', '==', currentBrand)
      .where('syncedAt', '>=', fourteenDaysAgo.toISOString())
      .where('syncedAt', '<', sevenDaysAgo.toISOString())
      .get();

    const previousPosts = previousWeekSnapshot.docs.map(doc => doc.data());
    const currentViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const previousViews = previousPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    const weekOverWeekGrowth = previousViews > 0
      ? ((currentViews - previousViews) / previousViews) * 100
      : 0;

    const report: WeeklyReport = {
      brand: currentBrand,
      period: `${sevenDaysAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      summary: {
        totalPosts: posts.length,
        totalViews: currentViews,
        avgEngagementRate: posts.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / posts.length,
        weekOverWeekGrowth
      },
      platforms: {
        youtube: youtubeMetrics,
        instagram: instagramMetrics
      },
      captions: {
        youtube: youtubeCaptions,
        instagram: instagramCaptions
      },
      timing: timingAnalysis,
      recommendations
    };

    reports.push(report);
  }

  return reports;
}

function calculatePlatformMetrics(platform: string, posts: any[]): PlatformMetrics {
  if (posts.length === 0) {
    return {
      platform,
      totalPosts: 0,
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      avgEngagementRate: 0,
      bestPerformer: null
    };
  }

  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
  const totalEngagement = posts.reduce((sum, p) => sum + (p.engagementRate || 0), 0);

  const bestPerformer = posts.reduce((best, current) => {
    return (current.views || 0) > (best.views || 0) ? current : best;
  }, posts[0]);

  return {
    platform,
    totalPosts: posts.length,
    avgViews: Math.round(totalViews / posts.length),
    avgLikes: Math.round(totalLikes / posts.length),
    avgComments: Math.round(totalComments / posts.length),
    avgEngagementRate: totalEngagement / posts.length,
    bestPerformer: {
      content: bestPerformer.content?.substring(0, 100) || '',
      views: bestPerformer.views,
      engagementRate: bestPerformer.engagementRate,
      publishedAt: bestPerformer.publishedAt
    }
  };
}

function analyzeCaptions(posts: any[]): CaptionAnalysis {
  if (posts.length === 0) {
    return {
      avgLength: 0,
      optimalRange: 'N/A',
      hashtagCount: 0,
      hasQuestion: 0,
      hasExclamation: 0,
      topPerformingLength: 'N/A'
    };
  }

  // Sort by views to analyze top performers
  const sortedByViews = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0));
  const top20Percent = sortedByViews.slice(0, Math.max(1, Math.floor(posts.length * 0.2)));

  const totalLength = top20Percent.reduce((sum, p) => sum + (p.content?.length || 0), 0);
  const avgLength = Math.round(totalLength / top20Percent.length);

  const hashtagCount = top20Percent.reduce((sum, p) => {
    return sum + ((p.content?.match(/#/g) || []).length);
  }, 0) / top20Percent.length;

  const hasQuestion = top20Percent.filter(p => p.content?.includes('?')).length;
  const hasExclamation = top20Percent.filter(p => p.content?.includes('!')).length;

  // Determine optimal length range based on top performers
  let optimalRange = '200-300';
  if (avgLength < 150) optimalRange = '100-200';
  else if (avgLength > 300) optimalRange = '250-350';

  const lengthBuckets = {
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
    avgLength,
    optimalRange,
    hashtagCount: Math.round(hashtagCount),
    hasQuestion: Math.round((hasQuestion / top20Percent.length) * 100),
    hasExclamation: Math.round((hasExclamation / top20Percent.length) * 100),
    topPerformingLength
  };
}

function analyzePostingTimes(posts: any[]): TimingAnalysis {
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

  const bestHours = Array.from(hourStats.entries())
    .map(([hour, stats]) => ({
      hour,
      avgViews: Math.round(stats.totalViews / stats.count),
      count: stats.count
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5);

  const worstHours = Array.from(hourStats.entries())
    .map(([hour, stats]) => ({
      hour,
      avgViews: Math.round(stats.totalViews / stats.count),
      count: stats.count
    }))
    .filter(h => h.count >= 2) // Only include hours with at least 2 posts
    .sort((a, b) => a.avgViews - b.avgViews)
    .slice(0, 3);

  const bestDays = Array.from(dayStats.entries())
    .map(([day, stats]) => ({
      day,
      avgViews: Math.round(stats.totalViews / stats.count),
      count: stats.count
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  return { bestHours, bestDays, worstHours };
}

function generateRecommendations(data: any): {
  captions: string[];
  hashtags: string[];
  duration: string[];
  scheduling: string[];
} {
  const recommendations = {
    captions: [] as string[],
    hashtags: [] as string[],
    duration: [] as string[],
    scheduling: [] as string[]
  };

  // Caption recommendations
  if (data.youtube.captions.avgLength > 0) {
    recommendations.captions.push(
      `YouTube: Target ${data.youtube.captions.optimalRange} characters (current avg: ${data.youtube.captions.avgLength})`
    );
  }

  if (data.instagram.captions.avgLength > 0) {
    recommendations.captions.push(
      `Instagram: Target ${data.instagram.captions.optimalRange} characters (current avg: ${data.instagram.captions.avgLength})`
    );
  }

  if (data.youtube.captions.hasQuestion < 50) {
    recommendations.captions.push(
      `YouTube: Add questions to captions (only ${data.youtube.captions.hasQuestion}% of top posts have questions)`
    );
  }

  if (data.instagram.captions.hasQuestion < 50) {
    recommendations.captions.push(
      `Instagram: Add questions to captions (only ${data.instagram.captions.hasQuestion}% of top posts have questions)`
    );
  }

  // Hashtag recommendations
  if (data.youtube.captions.hashtagCount < 3) {
    recommendations.hashtags.push(
      `YouTube: Increase hashtags to 3-5 (current avg: ${data.youtube.captions.hashtagCount})`
    );
  }

  if (data.instagram.captions.hashtagCount < 5) {
    recommendations.hashtags.push(
      `Instagram: Use 5-8 hashtags for better reach (current avg: ${data.instagram.captions.hashtagCount})`
    );
  }

  // Duration recommendations (based on platform best practices)
  recommendations.duration.push(
    'YouTube Shorts: Keep videos 15-30 seconds for maximum retention'
  );
  recommendations.duration.push(
    'Instagram Reels: 15-30 seconds optimal, test 7-15 seconds for viral potential'
  );

  // Scheduling recommendations
  if (data.timing.bestHours.length > 0) {
    const topHours = data.timing.bestHours.slice(0, 3).map(h => {
      const period = h.hour >= 12 ? 'PM' : 'AM';
      const displayHour = h.hour > 12 ? h.hour - 12 : (h.hour === 0 ? 12 : h.hour);
      return `${displayHour}${period}`;
    });
    recommendations.scheduling.push(
      `Best posting times: ${topHours.join(', ')}`
    );
  }

  if (data.timing.worstHours.length > 0) {
    const worstHours = data.timing.worstHours.slice(0, 2).map(h => {
      const period = h.hour >= 12 ? 'PM' : 'AM';
      const displayHour = h.hour > 12 ? h.hour - 12 : (h.hour === 0 ? 12 : h.hour);
      return `${displayHour}${period}`;
    });
    recommendations.scheduling.push(
      `Avoid posting: ${worstHours.join(', ')} (lowest average views)`
    );
  }

  if (data.timing.bestDays.length > 0) {
    const topDays = data.timing.bestDays.slice(0, 3).map(d => d.day);
    recommendations.scheduling.push(
      `Focus on: ${topDays.join(', ')}`
    );
  }

  return recommendations;
}

function printReport(report: WeeklyReport) {
  console.log('\n' + '═'.repeat(80));
  console.log(`📊 WEEKLY OPTIMIZATION REPORT - ${report.brand.toUpperCase()}`);
  console.log('═'.repeat(80));

  console.log(`\n📅 Period: ${report.period}\n`);

  // Summary
  console.log('📈 SUMMARY');
  console.log(`   Total Posts: ${report.summary.totalPosts}`);
  console.log(`   Total Views: ${report.summary.totalViews.toLocaleString()}`);
  console.log(`   Avg Engagement Rate: ${report.summary.avgEngagementRate.toFixed(2)}%`);
  console.log(`   Week-over-Week Growth: ${report.summary.weekOverWeekGrowth > 0 ? '+' : ''}${report.summary.weekOverWeekGrowth.toFixed(1)}%`);

  // YouTube
  console.log('\n📺 YOUTUBE PERFORMANCE');
  console.log(`   Posts: ${report.platforms.youtube.totalPosts}`);
  console.log(`   Avg Views: ${report.platforms.youtube.avgViews.toLocaleString()}`);
  console.log(`   Avg Likes: ${report.platforms.youtube.avgLikes}`);
  console.log(`   Avg Comments: ${report.platforms.youtube.avgComments}`);
  console.log(`   Engagement Rate: ${report.platforms.youtube.avgEngagementRate.toFixed(2)}%`);

  if (report.platforms.youtube.bestPerformer) {
    console.log(`\n   🏆 Best Performer (${report.platforms.youtube.bestPerformer.views.toLocaleString()} views):`);
    console.log(`      "${report.platforms.youtube.bestPerformer.content}..."`);
  }

  console.log('\n   📝 Caption Analysis:');
  console.log(`      Avg Length: ${report.captions.youtube.avgLength} chars`);
  console.log(`      Optimal Range: ${report.captions.youtube.optimalRange} chars`);
  console.log(`      Top Length: ${report.captions.youtube.topPerformingLength}`);
  console.log(`      Has Question: ${report.captions.youtube.hasQuestion}% of top posts`);
  console.log(`      Has Exclamation: ${report.captions.youtube.hasExclamation}% of top posts`);
  console.log(`      Avg Hashtags: ${report.captions.youtube.hashtagCount}`);

  // Instagram
  console.log('\n📸 INSTAGRAM PERFORMANCE');
  console.log(`   Posts: ${report.platforms.instagram.totalPosts}`);
  console.log(`   Avg Views: ${report.platforms.instagram.avgViews.toLocaleString()}`);
  console.log(`   Avg Likes: ${report.platforms.instagram.avgLikes}`);
  console.log(`   Avg Comments: ${report.platforms.instagram.avgComments}`);
  console.log(`   Engagement Rate: ${report.platforms.instagram.avgEngagementRate.toFixed(2)}%`);

  if (report.platforms.instagram.bestPerformer) {
    console.log(`\n   🏆 Best Performer (${report.platforms.instagram.bestPerformer.views.toLocaleString()} views):`);
    console.log(`      "${report.platforms.instagram.bestPerformer.content}..."`);
  }

  console.log('\n   📝 Caption Analysis:');
  console.log(`      Avg Length: ${report.captions.instagram.avgLength} chars`);
  console.log(`      Optimal Range: ${report.captions.instagram.optimalRange} chars`);
  console.log(`      Top Length: ${report.captions.instagram.topPerformingLength}`);
  console.log(`      Has Question: ${report.captions.instagram.hasQuestion}% of top posts`);
  console.log(`      Has Exclamation: ${report.captions.instagram.hasExclamation}% of top posts`);
  console.log(`      Avg Hashtags: ${report.captions.instagram.hashtagCount}`);

  // Timing
  console.log('\n⏰ BEST POSTING TIMES');
  report.timing.bestHours.forEach((h, idx) => {
    const period = h.hour >= 12 ? 'PM' : 'AM';
    const displayHour = h.hour > 12 ? h.hour - 12 : (h.hour === 0 ? 12 : h.hour);
    console.log(`   ${idx + 1}. ${displayHour}:00 ${period} - ${h.avgViews.toLocaleString()} avg views (${h.count} posts)`);
  });

  console.log('\n📅 BEST POSTING DAYS');
  report.timing.bestDays.forEach((d, idx) => {
    console.log(`   ${idx + 1}. ${d.day} - ${d.avgViews.toLocaleString()} avg views (${d.count} posts)`);
  });

  // Recommendations
  console.log('\n✅ ACTIONABLE RECOMMENDATIONS\n');

  console.log('📝 CAPTIONS:');
  report.recommendations.captions.forEach(rec => {
    console.log(`   • ${rec}`);
  });

  console.log('\n#️⃣  HASHTAGS:');
  report.recommendations.hashtags.forEach(rec => {
    console.log(`   • ${rec}`);
  });

  console.log('\n⏱️  DURATION:');
  report.recommendations.duration.forEach(rec => {
    console.log(`   • ${rec}`);
  });

  console.log('\n📅 SCHEDULING:');
  report.recommendations.scheduling.forEach(rec => {
    console.log(`   • ${rec}`);
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

// Generate copyable command template
function generateCommandTemplate(report: WeeklyReport) {
  const template = `
# Weekly Optimization Command for ${report.brand}
# Copy and paste these settings into your content workflow

CAPTION_LENGTH_YOUTUBE="${report.captions.youtube.optimalRange.split('-')[0]}-${report.captions.youtube.optimalRange.split('-')[1]}"
CAPTION_LENGTH_INSTAGRAM="${report.captions.instagram.optimalRange.split('-')[0]}-${report.captions.instagram.optimalRange.split('-')[1]}"
HASHTAG_COUNT_YOUTUBE="${Math.max(3, report.captions.youtube.hashtagCount)}"
HASHTAG_COUNT_INSTAGRAM="${Math.max(5, report.captions.instagram.hashtagCount)}"
VIDEO_DURATION="15-30"  # seconds (optimal for both platforms)
BEST_POSTING_HOURS="${report.timing.bestHours.slice(0, 3).map(h => h.hour).join(',')}"
BEST_POSTING_DAYS="${report.timing.bestDays.slice(0, 3).map(d => d.day).join(',')}"
`;

  console.log('📋 COPYABLE CONFIGURATION:');
  console.log(template);
}

// Main execution
async function main() {
  const brand = process.argv[2]; // Optional brand filter

  console.log('🚀 Generating Weekly Optimization Report...\n');

  const reports = await generateWeeklyReport(brand);

  if (reports.length === 0) {
    console.log('❌ No data available for the specified period');
    return;
  }

  reports.forEach(report => {
    printReport(report);
    generateCommandTemplate(report);
  });

  console.log('✅ Report generation complete!\n');
}

main().catch(console.error);
