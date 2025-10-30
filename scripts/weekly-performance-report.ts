#!/usr/bin/env tsx
/**
 * Weekly Performance Report Generator
 *
 * Generates comprehensive weekly analytics report with actionable insights
 * and strategic recommendations for content optimization
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { analyzePlatformPerformance, getPlatformRecommendations } from '../src/lib/late-analytics-v2';
import { getAdminDb } from '../src/lib/firebase-admin';

interface WeeklyReport {
  week: string;
  dateRange: { start: string; end: string };
  summary: {
    totalPosts: number;
    totalViews: number;
    totalEngagement: number;
    avgEngagementRate: number;
    growthRate: number;
    topPost: any;
  };
  platformBreakdown: Map<string, any>;
  insights: string[];
  recommendations: string[];
  alerts: string[];
}

/**
 * Get week number and year
 */
function getWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * Generate weekly performance report
 */
async function generateWeeklyReport(brand?: string): Promise<WeeklyReport> {
  const now = new Date();
  const { year, week } = getWeekNumber(now);

  // Calculate date range (last 7 days)
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  console.log(`📊 Generating report for Week ${week}, ${year}`);
  console.log(`   Date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);

  // Get platform performance
  const currentPerformance = await analyzePlatformPerformance(brand, 7);
  const previousPerformance = await analyzePlatformPerformance(brand, 14); // Compare with previous week

  // Calculate summary metrics
  let totalPosts = 0;
  let totalViews = 0;
  let totalEngagement = 0;

  for (const [_, perf] of currentPerformance.entries()) {
    totalPosts += perf.totalPosts;
    totalViews += perf.avgViews * perf.totalPosts;
    totalEngagement += perf.avgEngagementRate * perf.totalPosts;
  }

  const avgEngagementRate = totalPosts > 0 ? totalEngagement / totalPosts : 0;

  // Calculate growth rate (compare with previous period)
  let previousTotalViews = 0;
  let previousTotalPosts = 0;

  for (const [_, perf] of previousPerformance.entries()) {
    previousTotalViews += perf.avgViews * perf.totalPosts;
    previousTotalPosts += perf.totalPosts;
  }

  // Only count posts from the first 7 days of the 14-day period for fair comparison
  const previousWeekAvg = previousTotalPosts > 0
    ? (previousTotalViews / previousTotalPosts) * (totalPosts / 2) // Normalize
    : 0;

  const growthRate = previousWeekAvg > 0
    ? ((totalViews - previousWeekAvg) / previousWeekAvg) * 100
    : 0;

  // Get top performing post
  const adminDb = await getAdminDb();
  let topPost = null;

  if (adminDb) {
    const cutoffTime = startDate.getTime();
    const query = (adminDb as any).collection('platform_analytics')
      .where('lastUpdated', '>=', cutoffTime)
      .orderBy('views', 'desc')
      .limit(1);

    if (brand) {
      query.where('brand', '==', brand);
    }

    const snapshot = await query.get();
    if (!snapshot.empty) {
      topPost = snapshot.docs[0].data();
    }
  }

  // Generate insights
  const insights = generateInsights(currentPerformance, previousPerformance, growthRate);

  // Generate recommendations
  const recommendations = generateRecommendations(currentPerformance, growthRate);

  // Generate alerts
  const alerts = generateAlerts(currentPerformance, growthRate);

  return {
    week: `${year}-W${week}`,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    summary: {
      totalPosts,
      totalViews: Math.round(totalViews),
      totalEngagement: Math.round(totalEngagement),
      avgEngagementRate,
      growthRate,
      topPost
    },
    platformBreakdown: currentPerformance,
    insights,
    recommendations,
    alerts
  };
}

/**
 * Generate actionable insights
 */
function generateInsights(
  current: Map<string, any>,
  previous: Map<string, any>,
  growthRate: number
): string[] {
  const insights: string[] = [];

  // Overall growth insight
  if (growthRate > 20) {
    insights.push(`🚀 Exceptional growth! Views up ${growthRate.toFixed(0)}% - momentum is strong`);
  } else if (growthRate > 10) {
    insights.push(`📈 Solid growth of ${growthRate.toFixed(0)}% - keep up the good work`);
  } else if (growthRate < -10) {
    insights.push(`⚠️ Views down ${Math.abs(growthRate).toFixed(0)}% - time to pivot strategy`);
  } else {
    insights.push(`➡️ Performance stable (${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(0)}%)`);
  }

  // Platform-specific insights
  const sortedPlatforms = Array.from(current.entries())
    .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate);

  if (sortedPlatforms.length > 0) {
    const topPlatform = sortedPlatforms[0];
    insights.push(`👑 ${topPlatform[0]} is your star platform with ${topPlatform[1].avgEngagementRate.toFixed(1)}% engagement`);
  }

  // Identify trending platforms
  for (const [platform, perf] of current.entries()) {
    if (perf.trend === 'up' && perf.weekOverWeekGrowth > 20) {
      insights.push(`🔥 ${platform} is on fire - up ${perf.weekOverWeekGrowth.toFixed(0)}% this week`);
    }
  }

  // Identify best time slots
  const allPeakHours = new Map<number, number>();
  for (const [_, perf] of current.entries()) {
    perf.peakHours.forEach((h: any) => {
      allPeakHours.set(h.hour, (allPeakHours.get(h.hour) || 0) + h.avgViews);
    });
  }

  const topHour = Array.from(allPeakHours.entries())
    .sort((a, b) => b[1] - a[1])[0];

  if (topHour) {
    insights.push(`⏰ ${topHour[0].toString().padStart(2, '0')}:00 is your golden hour across all platforms`);
  }

  return insights;
}

/**
 * Generate strategic recommendations
 */
function generateRecommendations(
  performance: Map<string, any>,
  growthRate: number
): string[] {
  const recs: string[] = [];

  // Frequency recommendations
  const sortedByEngagement = Array.from(performance.entries())
    .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate);

  if (sortedByEngagement.length > 0) {
    const topPlatform = sortedByEngagement[0];
    if (topPlatform[1].avgEngagementRate > 8) {
      recs.push(`Increase posting frequency on ${topPlatform[0]} - high engagement indicates audience demand`);
    }
  }

  // Time optimization
  const platformsNeedingOptimization = Array.from(performance.entries())
    .filter(([_, perf]) => perf.avgEngagementRate < 4);

  if (platformsNeedingOptimization.length > 0) {
    recs.push(`Test different posting times for: ${platformsNeedingOptimization.map(([p]) => p).join(', ')}`);
  }

  // Growth opportunities
  const growingPlatforms = Array.from(performance.entries())
    .filter(([_, perf]) => perf.trend === 'up');

  if (growingPlatforms.length > 0) {
    recs.push(`Double down on ${growingPlatforms.map(([p]) => p).join(', ')} - showing positive momentum`);
  }

  // Declining platforms
  const decliningPlatforms = Array.from(performance.entries())
    .filter(([_, perf]) => perf.trend === 'down');

  if (decliningPlatforms.length > 0) {
    recs.push(`Revamp content strategy for ${decliningPlatforms.map(([p]) => p).join(', ')} - engagement declining`);
  }

  // Overall strategy
  if (growthRate < 0) {
    recs.push('Focus on stronger hooks - first 3 seconds are critical for retention');
    recs.push('Test different content formats - try educational vs entertainment');
  }

  return recs;
}

/**
 * Generate performance alerts
 */
function generateAlerts(
  performance: Map<string, any>,
  growthRate: number
): string[] {
  const alerts: string[] = [];

  // Critical decline alert
  if (growthRate < -20) {
    alerts.push('🚨 URGENT: Views declined significantly - immediate strategy review needed');
  }

  // Low engagement alerts
  for (const [platform, perf] of performance.entries()) {
    if (perf.avgEngagementRate < 2) {
      alerts.push(`⚠️ ${platform} engagement critically low (${perf.avgEngagementRate.toFixed(1)}%) - consider pausing or pivoting`);
    }
  }

  // Opportunity alerts
  for (const [platform, perf] of performance.entries()) {
    if (perf.weekOverWeekGrowth > 50) {
      alerts.push(`🎯 OPPORTUNITY: ${platform} surging (+${perf.weekOverWeekGrowth.toFixed(0)}%) - scale up immediately`);
    }
  }

  return alerts;
}

/**
 * Format and print report
 */
function printReport(report: WeeklyReport, brand?: string) {
  console.log('\n' + '═'.repeat(80));
  console.log(`📊 WEEKLY PERFORMANCE REPORT - ${report.week}`);
  if (brand) {
    console.log(`   Brand: ${brand.toUpperCase()}`);
  }
  console.log(`   ${report.dateRange.start} to ${report.dateRange.end}`);
  console.log('═'.repeat(80));

  // Summary
  console.log('\n📈 SUMMARY\n');
  console.log(`   Total Posts:       ${report.summary.totalPosts}`);
  console.log(`   Total Views:       ${report.summary.totalViews.toLocaleString()}`);
  console.log(`   Avg Engagement:    ${report.summary.avgEngagementRate.toFixed(2)}%`);
  console.log(`   Growth Rate:       ${report.summary.growthRate >= 0 ? '+' : ''}${report.summary.growthRate.toFixed(1)}%`);

  if (report.summary.topPost) {
    console.log(`\n   🌟 Top Post:`);
    console.log(`      Platform: ${report.summary.topPost.platform}`);
    console.log(`      Views: ${report.summary.topPost.views?.toLocaleString() || 'N/A'}`);
    console.log(`      Engagement: ${report.summary.topPost.engagementRate?.toFixed(2) || 'N/A'}%`);
  }

  // Platform Breakdown
  console.log('\n' + '─'.repeat(80));
  console.log('📱 PLATFORM BREAKDOWN\n');

  const sortedPlatforms = Array.from(report.platformBreakdown.entries())
    .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate);

  sortedPlatforms.forEach(([platform, perf], index) => {
    const icon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    const trend = perf.trend === 'up' ? '📈' : perf.trend === 'down' ? '📉' : '➡️';

    console.log(`   ${icon} ${platform.toUpperCase().padEnd(12)}`);
    console.log(`      Views: ${Math.round(perf.avgViews).toLocaleString().padStart(10)} avg | Engagement: ${perf.avgEngagementRate.toFixed(2)}%`);
    console.log(`      Trend: ${trend} ${perf.weekOverWeekGrowth >= 0 ? '+' : ''}${perf.weekOverWeekGrowth.toFixed(0)}% | Posts: ${perf.totalPosts}`);

    if (perf.peakHours.length > 0) {
      const topHour = perf.peakHours[0];
      console.log(`      Best time: ${topHour.hour.toString().padStart(2, '0')}:00 (${Math.round(topHour.avgViews).toLocaleString()} views)`);
    }

    console.log('');
  });

  // Insights
  if (report.insights.length > 0) {
    console.log('─'.repeat(80));
    console.log('💡 KEY INSIGHTS\n');
    report.insights.forEach((insight, i) => {
      console.log(`   ${i + 1}. ${insight}`);
    });
    console.log('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('─'.repeat(80));
    console.log('🎯 STRATEGIC RECOMMENDATIONS\n');
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    console.log('');
  }

  // Alerts
  if (report.alerts.length > 0) {
    console.log('─'.repeat(80));
    console.log('⚠️  PERFORMANCE ALERTS\n');
    report.alerts.forEach(alert => {
      console.log(`   ${alert}`);
    });
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('🚀 ACTION ITEMS FOR THIS WEEK:');
  console.log('═'.repeat(80));
  console.log('\n1. Implement top 3 recommendations above');
  console.log('2. Run queue optimization: npx tsx scripts/auto-optimize-queues.ts');
  console.log('3. Test new hooks on underperforming platforms');
  console.log('4. Monitor alerts daily and adjust quickly');
  console.log('5. Share top-performing content to other platforms');
  console.log('\n' + '═'.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const brandArg = args.find(arg => !arg.startsWith('--'));

  const validBrands = ['ownerfi', 'carz', 'podcast', 'vassdistro', 'abdullah'];
  const brand = brandArg && validBrands.includes(brandArg) ? brandArg : undefined;

  if (brand) {
    console.log(`Generating report for: ${brand}`);
    const report = await generateWeeklyReport(brand);
    printReport(report, brand);
  } else {
    console.log('Generating reports for all brands...\n');

    for (const b of validBrands) {
      try {
        const report = await generateWeeklyReport(b);
        printReport(report, b);
        console.log('\n');
      } catch (error) {
        console.error(`Error generating report for ${b}:`, error);
      }
    }
  }

  console.log('\n📧 Want this report emailed weekly? Set up a cron job:');
  console.log('   0 9 * * 1 cd /path/to/ownerfi && npx tsx scripts/weekly-performance-report.ts');
  console.log('   (Runs every Monday at 9 AM)\n');
}

main().catch(console.error);
