#!/usr/bin/env tsx
/**
 * Sync Platform-Specific Analytics
 *
 * Fetches analytics from Late API and stores platform-specific metrics
 * for analysis and optimization
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import {
  syncAllBrandsPlatformAnalytics,
  analyzePlatformPerformance,
  getPlatformRecommendations
} from '../src/lib/late-analytics-v2';

async function main() {
  console.log('═'.repeat(80));
  console.log('📊 PLATFORM-SPECIFIC ANALYTICS SYNC');
  console.log('═'.repeat(80));
  console.log('');

  const days = 30; // Sync last 30 days

  try {
    // Step 1: Sync analytics from Late API
    console.log('Step 1: Syncing analytics from Late API...\n');
    await syncAllBrandsPlatformAnalytics(days);

    console.log('\n' + '═'.repeat(80));
    console.log('Step 2: Analyzing platform performance...\n');

    // Step 2: Analyze each brand
    const brands = ['ownerfi', 'carz', 'podcast', 'vassdistro', 'abdullah'];

    for (const brand of brands) {
      console.log(`\n📈 ${brand.toUpperCase()} ANALYSIS\n`);

      // Get performance analysis
      const performance = await analyzePlatformPerformance(brand, days);

      if (performance.size === 0) {
        console.log(`   No data found for ${brand}\n`);
        continue;
      }

      // Sort platforms by engagement
      const sortedPlatforms = Array.from(performance.entries())
        .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate);

      // Display platform summary
      console.log('   Platform Performance:');
      sortedPlatforms.forEach(([platform, perf], index) => {
        const icon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        const trend = perf.trend === 'up' ? '📈' : perf.trend === 'down' ? '📉' : '➡️';

        console.log(`   ${icon} ${platform.padEnd(12)} | ${perf.avgViews.toFixed(0).padStart(8)} views | ${perf.avgEngagementRate.toFixed(2)}% engagement | ${trend} ${perf.weekOverWeekGrowth >= 0 ? '+' : ''}${perf.weekOverWeekGrowth.toFixed(0)}%`);

        // Show peak times for top 3 platforms
        if (index < 3 && perf.peakHours.length > 0) {
          const topHours = perf.peakHours.slice(0, 3).map(h =>
            `${h.hour.toString().padStart(2, '0')}:00 (${h.avgViews.toFixed(0)} views)`
          );
          console.log(`      └─ Peak times: ${topHours.join(', ')}`);
        }
      });

      // Get recommendations
      console.log('\n   🎯 Recommendations:');
      const recommendations = await getPlatformRecommendations(brand, days);

      recommendations.overall.actionItems.forEach((item: string, index: number) => {
        console.log(`   ${index + 1}. ${item}`);
      });

      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('✅ SYNC AND ANALYSIS COMPLETE');
    console.log('═'.repeat(80));

    // Summary statistics
    console.log('\n📊 OVERALL SUMMARY\n');

    const allPerformance = await analyzePlatformPerformance(undefined, days);

    if (allPerformance.size > 0) {
      const sortedAll = Array.from(allPerformance.entries())
        .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate);

      console.log('   Top Platforms Across All Brands:');
      sortedAll.slice(0, 5).forEach(([platform, perf], index) => {
        console.log(`   ${index + 1}. ${platform.padEnd(12)} - ${perf.avgEngagementRate.toFixed(2)}% engagement | ${perf.totalPosts} posts`);
      });

      // Calculate total metrics
      const totalPosts = Array.from(allPerformance.values()).reduce((sum, p) => sum + p.totalPosts, 0);
      const totalViews = Array.from(allPerformance.values()).reduce((sum, p) => sum + (p.avgViews * p.totalPosts), 0);
      const avgEngagement = Array.from(allPerformance.values()).reduce((sum, p) => sum + p.avgEngagementRate, 0) / allPerformance.size;

      console.log('\n   Overall Metrics:');
      console.log(`   📝 Total Posts: ${totalPosts}`);
      console.log(`   👀 Total Views: ${totalViews.toFixed(0)}`);
      console.log(`   💬 Avg Engagement: ${avgEngagement.toFixed(2)}%`);

      // Best time slots overall
      console.log('\n   ⏰ Best Posting Hours (All Platforms):');
      const allHours = new Map<number, { totalViews: number; count: number }>();

      for (const [_, perf] of allPerformance.entries()) {
        perf.peakHours.forEach(h => {
          const existing = allHours.get(h.hour) || { totalViews: 0, count: 0 };
          existing.totalViews += h.avgViews * h.postCount;
          existing.count += h.postCount;
          allHours.set(h.hour, existing);
        });
      }

      const topHours = Array.from(allHours.entries())
        .map(([hour, data]) => ({
          hour,
          avgViews: data.totalViews / data.count
        }))
        .sort((a, b) => b.avgViews - a.avgViews)
        .slice(0, 5);

      topHours.forEach(({ hour, avgViews }, index) => {
        console.log(`   ${index + 1}. ${hour.toString().padStart(2, '0')}:00 - ${avgViews.toFixed(0)} avg views`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('💡 Next Steps:');
    console.log('   1. Review recommendations above');
    console.log('   2. Adjust queue schedules based on peak times');
    console.log('   3. Increase frequency on high-performing platforms');
    console.log('   4. Test new content strategies on underperforming platforms');
    console.log('   5. Run this script daily to track trends');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
