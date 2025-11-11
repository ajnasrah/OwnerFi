#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const { getAdminDb } = require('../src/lib/firebase-admin');

async function analyzeTopPerformers() {
  const db = await getAdminDb();
  if (!db) {
    console.error('Failed to initialize Firebase');
    return;
  }

  console.log('📊 ANALYZING TOP PERFORMING VIDEOS\n');
  console.log('═'.repeat(80));

  // Get all analytics data
  const snap = await (db as any).collection('workflow_analytics').get();
  const posts: any[] = [];

  snap.forEach((doc: any) => {
    posts.push({ id: doc.id, ...doc.data() });
  });

  console.log(`\nTotal Posts Analyzed: ${posts.length}`);

  // Calculate totals
  const totalViews = posts.reduce((sum, p) => sum + (p.totalViews || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.totalLikes || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.totalComments || 0), 0);

  console.log(`Total Views: ${totalViews.toLocaleString()}`);
  console.log(`Total Likes: ${totalLikes.toLocaleString()}`);
  console.log(`Total Comments: ${totalComments.toLocaleString()}`);

  // Sort by views
  const sorted = posts.filter(p => p.totalViews > 0).sort((a, b) => b.totalViews - a.totalViews);

  console.log('\n' + '═'.repeat(80));
  console.log('🏆 TOP 20 PERFORMING VIDEOS');
  console.log('═'.repeat(80));

  sorted.slice(0, 20).forEach((post, idx) => {
    console.log(`\n#${idx + 1} - ${post.totalViews.toLocaleString()} views`);
    console.log(`   Engagement: ${post.overallEngagementRate?.toFixed(2) || 0}%`);
    console.log(`   Likes: ${post.totalLikes || 0} | Comments: ${post.totalComments || 0}`);
    console.log(`   Time: ${post.timeSlot || 'N/A'} | Day: ${post.dayOfWeek || 'N/A'}`);
    console.log(`   Caption: ${(post.caption || '').substring(0, 100)}...`);

    if (post.platformMetrics) {
      const platforms = Object.entries(post.platformMetrics)
        .map(([platform, metrics]: [string, any]) => `${platform}: ${metrics.views || 0}`)
        .join(' | ');
      console.log(`   Platforms: ${platforms}`);
    }
  });

  // TREND ANALYSIS
  console.log('\n' + '═'.repeat(80));
  console.log('📈 TREND ANALYSIS');
  console.log('═'.repeat(80));

  // 1. Best Time Slots
  const timeSlotPerformance: Map<string, { views: number; count: number }> = new Map();
  sorted.forEach(post => {
    const slot = post.timeSlot || 'Unknown';
    const existing = timeSlotPerformance.get(slot) || { views: 0, count: 0 };
    existing.views += post.totalViews || 0;
    existing.count += 1;
    timeSlotPerformance.set(slot, existing);
  });

  console.log('\n🕐 BEST TIME SLOTS:');
  Array.from(timeSlotPerformance.entries())
    .map(([slot, data]) => ({ slot, avgViews: data.views / data.count, count: data.count }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5)
    .forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.slot} - ${Math.round(item.avgViews).toLocaleString()} avg views (${item.count} posts)`);
    });

  // 2. Best Days
  const dayPerformance: Map<string, { views: number; count: number }> = new Map();
  sorted.forEach(post => {
    const day = post.dayOfWeek || 'Unknown';
    const existing = dayPerformance.get(day) || { views: 0, count: 0 };
    existing.views += post.totalViews || 0;
    existing.count += 1;
    dayPerformance.set(day, existing);
  });

  console.log('\n📅 BEST DAYS OF WEEK:');
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dayOrder
    .map(day => {
      const data = dayPerformance.get(day);
      return data ? { day, avgViews: data.views / data.count, count: data.count } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.avgViews - a.avgViews)
    .forEach((item: any, idx) => {
      console.log(`   ${idx + 1}. ${item.day} - ${Math.round(item.avgViews).toLocaleString()} avg views (${item.count} posts)`);
    });

  // 3. Platform Performance
  const platformPerformance: Map<string, { views: number; count: number }> = new Map();
  sorted.forEach(post => {
    if (post.platformMetrics) {
      Object.entries(post.platformMetrics).forEach(([platform, metrics]: [string, any]) => {
        const views = metrics.views || 0;
        if (views > 0) {
          const existing = platformPerformance.get(platform) || { views: 0, count: 0 };
          existing.views += views;
          existing.count += 1;
          platformPerformance.set(platform, existing);
        }
      });
    }
  });

  console.log('\n📱 PLATFORM PERFORMANCE:');
  Array.from(platformPerformance.entries())
    .map(([platform, data]) => ({ platform, avgViews: data.views / data.count, count: data.count }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.platform} - ${Math.round(item.avgViews).toLocaleString()} avg views (${item.count} posts)`);
    });

  // 4. Engagement Rate Analysis
  const topEngagement = sorted
    .filter(p => p.totalViews > 50) // Only posts with meaningful views
    .sort((a, b) => (b.overallEngagementRate || 0) - (a.overallEngagementRate || 0))
    .slice(0, 10);

  console.log('\n💬 HIGHEST ENGAGEMENT RATE (min 50 views):');
  topEngagement.forEach((post, idx) => {
    console.log(`   ${idx + 1}. ${post.overallEngagementRate?.toFixed(2)}% - ${post.totalViews} views`);
    console.log(`      ${(post.caption || '').substring(0, 80)}...`);
  });

  // 5. Common patterns in top performers
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 KEY INSIGHTS FROM TOP PERFORMERS');
  console.log('═'.repeat(80));

  const top20 = sorted.slice(0, 20);

  // Most common time slot in top 20
  const topTimeSlots = new Map<string, number>();
  top20.forEach(p => {
    const slot = p.timeSlot || 'Unknown';
    topTimeSlots.set(slot, (topTimeSlots.get(slot) || 0) + 1);
  });
  const mostCommonTime = Array.from(topTimeSlots.entries()).sort((a, b) => b[1] - a[1])[0];

  // Most common day in top 20
  const topDays = new Map<string, number>();
  top20.forEach(p => {
    const day = p.dayOfWeek || 'Unknown';
    topDays.set(day, (topDays.get(day) || 0) + 1);
  });
  const mostCommonDay = Array.from(topDays.entries()).sort((a, b) => b[1] - a[1])[0];

  // Best platform for top performers
  const topPlatforms = new Map<string, number>();
  top20.forEach(p => {
    if (p.platformMetrics) {
      Object.entries(p.platformMetrics).forEach(([platform, metrics]: [string, any]) => {
        if (metrics.views > 0) {
          topPlatforms.set(platform, (topPlatforms.get(platform) || 0) + metrics.views);
        }
      });
    }
  });
  const bestPlatform = Array.from(topPlatforms.entries()).sort((a, b) => b[1] - a[1])[0];

  console.log(`\n✅ Top performers most commonly posted at: ${mostCommonTime[0]} (${mostCommonTime[1]}/20 posts)`);
  console.log(`✅ Top performers most commonly posted on: ${mostCommonDay[0]} (${mostCommonDay[1]}/20 posts)`);
  console.log(`✅ Best performing platform: ${bestPlatform[0]} (${bestPlatform[1].toLocaleString()} total views in top 20)`);
  console.log(`✅ Average views in top 20: ${Math.round(top20.reduce((sum, p) => sum + p.totalViews, 0) / 20).toLocaleString()}`);
  console.log(`✅ Average engagement in top 20: ${(top20.reduce((sum, p) => sum + (p.overallEngagementRate || 0), 0) / 20).toFixed(2)}%`);

  console.log('\n' + '═'.repeat(80));
}

analyzeTopPerformers().catch(console.error);
