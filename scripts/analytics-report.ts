#!/usr/bin/env tsx
/**
 * Analytics Performance Report
 *
 * Generates comprehensive performance reports analyzing:
 * - Time slot performance
 * - Content type effectiveness
 * - Hook performance
 * - Platform comparisons
 * - Day of week trends
 *
 * Usage:
 *   npx tsx scripts/analytics-report.ts
 *   npx tsx scripts/analytics-report.ts --brand carz
 *   npx tsx scripts/analytics-report.ts --metric engagement
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const { adminDb } = require('../src/lib/firebase-admin');

interface AnalyticsReport {
  timeSlotPerformance: Map<string, {
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  dayOfWeekPerformance: Map<string, {
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  contentTypePerformance: Map<string, {
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  hookTypePerformance: Map<string, {
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  platformPerformance: Map<string, {
    avgViews: number;
    avgEngagement: number;
    postCount: number;
  }>;
  topPerformers: any[];
  bottomPerformers: any[];
}

async function generateReport(
  brand?: string,
  days: number = 7
): Promise<AnalyticsReport> {
  console.log(`\n📊 Generating analytics report...`);
  if (brand) {
    console.log(`   Brand: ${brand.toUpperCase()}`);
  } else {
    console.log(`   Brand: ALL`);
  }
  console.log(`   Period: Last ${days} days\n`);

  // Query analytics collection
  let query: any = adminDb.collection('workflow_analytics');

  // Filter by brand if specified
  if (brand) {
    query = query.where('brand', '==', brand);
  }

  // Filter by date
  const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
  query = query.where('lastUpdated', '>=', cutoffDate);

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('⚠️  No analytics data found. Run: npx tsx scripts/collect-analytics-data.ts');
    process.exit(0);
  }

  console.log(`   Found ${snapshot.size} posts with analytics data\n`);

  // Initialize aggregators
  const timeSlots = new Map<string, { totalViews: number; totalEngagement: number; count: number }>();
  const daysOfWeek = new Map<string, { totalViews: number; totalEngagement: number; count: number }>();
  const contentTypes = new Map<string, { totalViews: number; totalEngagement: number; count: number }>();
  const hookTypes = new Map<string, { totalViews: number; totalEngagement: number; count: number }>();
  const platforms = new Map<string, { totalViews: number; totalEngagement: number; count: number }>();

  const allPosts: any[] = [];

  // Process each post
  snapshot.forEach(doc => {
    const data = doc.data();
    allPosts.push({ id: doc.id, ...data });

    // Time slot aggregation
    if (data.timeSlot) {
      const slot = timeSlots.get(data.timeSlot) || { totalViews: 0, totalEngagement: 0, count: 0 };
      slot.totalViews += data.totalViews || 0;
      slot.totalEngagement += data.overallEngagementRate || 0;
      slot.count++;
      timeSlots.set(data.timeSlot, slot);
    }

    // Day of week aggregation
    if (data.dayOfWeek) {
      const day = daysOfWeek.get(data.dayOfWeek) || { totalViews: 0, totalEngagement: 0, count: 0 };
      day.totalViews += data.totalViews || 0;
      day.totalEngagement += data.overallEngagementRate || 0;
      day.count++;
      daysOfWeek.set(data.dayOfWeek, day);
    }

    // Content type aggregation
    if (data.contentType) {
      const type = contentTypes.get(data.contentType) || { totalViews: 0, totalEngagement: 0, count: 0 };
      type.totalViews += data.totalViews || 0;
      type.totalEngagement += data.overallEngagementRate || 0;
      type.count++;
      contentTypes.set(data.contentType, type);
    }

    // Hook type aggregation
    if (data.hookType) {
      const hook = hookTypes.get(data.hookType) || { totalViews: 0, totalEngagement: 0, count: 0 };
      hook.totalViews += data.totalViews || 0;
      hook.totalEngagement += data.overallEngagementRate || 0;
      hook.count++;
      hookTypes.set(data.hookType, hook);
    }

    // Platform aggregation
    if (data.platformMetrics) {
      Object.entries(data.platformMetrics).forEach(([platform, metrics]: [string, any]) => {
        const p = platforms.get(platform) || { totalViews: 0, totalEngagement: 0, count: 0 };
        p.totalViews += metrics.views || 0;
        p.totalEngagement += metrics.engagement_rate || 0;
        p.count++;
        platforms.set(platform, p);
      });
    }
  });

  // Calculate averages
  const timeSlotPerformance = new Map();
  timeSlots.forEach((value, key) => {
    timeSlotPerformance.set(key, {
      avgViews: value.totalViews / value.count,
      avgEngagement: value.totalEngagement / value.count,
      postCount: value.count
    });
  });

  const dayOfWeekPerformance = new Map();
  daysOfWeek.forEach((value, key) => {
    dayOfWeekPerformance.set(key, {
      avgViews: value.totalViews / value.count,
      avgEngagement: value.totalEngagement / value.count,
      postCount: value.count
    });
  });

  const contentTypePerformance = new Map();
  contentTypes.forEach((value, key) => {
    contentTypePerformance.set(key, {
      avgViews: value.totalViews / value.count,
      avgEngagement: value.totalEngagement / value.count,
      postCount: value.count
    });
  });

  const hookTypePerformance = new Map();
  hookTypes.forEach((value, key) => {
    hookTypePerformance.set(key, {
      avgViews: value.totalViews / value.count,
      avgEngagement: value.totalEngagement / value.count,
      postCount: value.count
    });
  });

  const platformPerformance = new Map();
  platforms.forEach((value, key) => {
    platformPerformance.set(key, {
      avgViews: value.totalViews / value.count,
      avgEngagement: value.totalEngagement / value.count,
      postCount: value.count
    });
  });

  // Top and bottom performers
  const sortedByViews = [...allPosts].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));
  const topPerformers = sortedByViews.slice(0, 10);
  const bottomPerformers = sortedByViews.slice(-10).reverse();

  return {
    timeSlotPerformance,
    dayOfWeekPerformance,
    contentTypePerformance,
    hookTypePerformance,
    platformPerformance,
    topPerformers,
    bottomPerformers
  };
}

function printReport(report: AnalyticsReport) {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('                    ANALYTICS PERFORMANCE REPORT');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Time Slot Performance
  console.log('⏰ TIME SLOT PERFORMANCE\n');
  console.log('Time Slot       | Avg Views | Avg Engagement | Posts');
  console.log('─'.repeat(70));
  const sortedTimeSlots = Array.from(report.timeSlotPerformance.entries())
    .sort((a, b) => b[1].avgViews - a[1].avgViews);

  sortedTimeSlots.forEach(([slot, metrics]) => {
    console.log(
      `${slot.padEnd(15)} | ${Math.round(metrics.avgViews).toString().padStart(9)} | ${metrics.avgEngagement.toFixed(2).padStart(14)}% | ${metrics.postCount.toString().padStart(5)}`
    );
  });

  // Day of Week Performance
  console.log('\n\n📅 DAY OF WEEK PERFORMANCE\n');
  console.log('Day         | Avg Views | Avg Engagement | Posts');
  console.log('─'.repeat(70));
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dayOrder.forEach(day => {
    const metrics = report.dayOfWeekPerformance.get(day);
    if (metrics) {
      console.log(
        `${day.padEnd(11)} | ${Math.round(metrics.avgViews).toString().padStart(9)} | ${metrics.avgEngagement.toFixed(2).padStart(14)}% | ${metrics.postCount.toString().padStart(5)}`
      );
    }
  });

  // Content Type Performance
  console.log('\n\n🎬 CONTENT TYPE PERFORMANCE\n');
  console.log('Type        | Avg Views | Avg Engagement | Posts');
  console.log('─'.repeat(70));
  Array.from(report.contentTypePerformance.entries())
    .sort((a, b) => b[1].avgViews - a[1].avgViews)
    .forEach(([type, metrics]) => {
      console.log(
        `${type.padEnd(11)} | ${Math.round(metrics.avgViews).toString().padStart(9)} | ${metrics.avgEngagement.toFixed(2).padStart(14)}% | ${metrics.postCount.toString().padStart(5)}`
      );
    });

  // Hook Type Performance
  if (report.hookTypePerformance.size > 0) {
    console.log('\n\n🎯 HOOK TYPE PERFORMANCE\n');
    console.log('Hook Type        | Avg Views | Avg Engagement | Posts');
    console.log('─'.repeat(70));
    Array.from(report.hookTypePerformance.entries())
      .sort((a, b) => b[1].avgViews - a[1].avgViews)
      .forEach(([type, metrics]) => {
        console.log(
          `${type.substring(0, 16).padEnd(16)} | ${Math.round(metrics.avgViews).toString().padStart(9)} | ${metrics.avgEngagement.toFixed(2).padStart(14)}% | ${metrics.postCount.toString().padStart(5)}`
        );
      });
  }

  // Platform Performance
  console.log('\n\n📱 PLATFORM PERFORMANCE\n');
  console.log('Platform    | Avg Views | Avg Engagement | Posts');
  console.log('─'.repeat(70));
  Array.from(report.platformPerformance.entries())
    .sort((a, b) => b[1].avgViews - a[1].avgViews)
    .forEach(([platform, metrics]) => {
      console.log(
        `${platform.padEnd(11)} | ${Math.round(metrics.avgViews).toString().padStart(9)} | ${metrics.avgEngagement.toFixed(2).padStart(14)}% | ${metrics.postCount.toString().padStart(5)}`
      );
    });

  // Top Performers
  console.log('\n\n🏆 TOP 10 PERFORMING POSTS\n');
  console.log('Rank | Views  | Engagement | Time Slot     | Type     | Hook');
  console.log('─'.repeat(70));
  report.topPerformers.forEach((post, index) => {
    const hook = (post.hook || '').substring(0, 30);
    console.log(
      `${(index + 1).toString().padStart(4)} | ${Math.round(post.totalViews || 0).toString().padStart(6)} | ${(post.overallEngagementRate || 0).toFixed(2).padStart(10)}% | ${(post.timeSlot || 'N/A').padEnd(13)} | ${(post.contentType || 'N/A').padEnd(8)} | ${hook}`
    );
  });

  console.log('\n\n══════════════════════════════════════════════════════════════════');
  console.log('                         END OF REPORT');
  console.log('══════════════════════════════════════════════════════════════════\n');
}

async function main() {
  const args = process.argv.slice(2);
  const brandArg = args.find(arg => arg.startsWith('--brand='));
  const daysArg = args.find(arg => arg.startsWith('--days='));

  const brand = brandArg?.split('=')[1];
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

  const report = await generateReport(brand, days);
  printReport(report);

  console.log('💡 Action Items:\n');
  console.log('  1. Identify best performing time slots → Schedule more posts there');
  console.log('  2. Review top performing hooks → Replicate similar styles');
  console.log('  3. Check platform differences → Optimize content per platform');
  console.log('  4. Analyze day-of-week trends → Adjust posting frequency');
  console.log('  5. Export data for deeper analysis: npx tsx scripts/export-analytics.ts\n');
}

main().catch(console.error);
