/**
 * Comprehensive Analysis of Existing Platform Analytics
 * Extract optimal 3-post schedule per platform per week
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = getFirestore();

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function analyzeAllData() {
  console.log('📊 Fetching ALL platform analytics from Firestore...\n');

  const snapshot = await db.collection('platform_analytics').get();
  console.log(`✅ Found ${snapshot.size} analytics records\n`);

  const posts: any[] = [];
  const platformStats: any = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    posts.push(data);

    // Track platform distribution
    const platform = data.platform || 'unknown';
    if (!platformStats[platform]) {
      platformStats[platform] = { total: 0, withViews: 0, withEngagement: 0 };
    }
    platformStats[platform].total++;

    const views = data.views || data.impressions || 0;
    const engagement = (data.likes || 0) + (data.comments || 0) + (data.shares || 0) + (data.saves || 0);

    if (views > 0) platformStats[platform].withViews++;
    if (engagement > 0) platformStats[platform].withEngagement++;
  }

  console.log('📈 Platform Distribution:\n');
  for (const [platform, stats] of Object.entries(platformStats)) {
    console.log(`${platform}:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  With Views: ${stats.withViews}`);
    console.log(`  With Engagement: ${stats.withEngagement}\n`);
  }

  // Now analyze by platform, day, and hour
  console.log('='.repeat(80));
  console.log('🔍 ANALYZING OPTIMAL POSTING TIMES\n');

  const platforms = Object.keys(platformStats);

  for (const platform of platforms) {
    const platformPosts = posts.filter(p => p.platform === platform);
    console.log(`\n📱 ${platform.toUpperCase()} (${platformPosts.length} posts)`);
    console.log('-'.repeat(80));

    // Group by day of week
    const byDay: any = {};

    for (const post of platformPosts) {
      if (!post.publishedAt) continue;

      const date = new Date(post.publishedAt);
      const dayOfWeek = date.getDay();
      const dayName = DAYS[dayOfWeek];
      const hour = date.getHours();

      const views = post.views || post.impressions || 0;
      const likes = post.likes || 0;
      const comments = post.comments || 0;
      const shares = post.shares || 0;
      const saves = post.saves || 0;

      if (views === 0) continue; // Skip posts with no views

      const engagement = likes + comments + shares + saves;
      const engagementRate = (engagement / views) * 100;

      if (!byDay[dayName]) byDay[dayName] = {};
      if (!byDay[dayName][hour]) byDay[dayName][hour] = [];

      byDay[dayName][hour].push({
        views,
        engagement,
        engagementRate,
        publishedAt: post.publishedAt
      });
    }

    // Calculate top times per day
    for (const [dayName, hours] of Object.entries(byDay)) {
      console.log(`\n  ${dayName}:`);

      const hourlyAvgs = Object.entries(hours).map(([hour, posts]: any) => {
        const avgEngagementRate = posts.reduce((sum: number, p: any) => sum + p.engagementRate, 0) / posts.length;
        const avgEngagement = posts.reduce((sum: number, p: any) => sum + p.engagement, 0) / posts.length;
        const totalViews = posts.reduce((sum: number, p: any) => sum + p.views, 0);

        return {
          hour: parseInt(hour),
          count: posts.length,
          avgEngagementRate,
          avgEngagement,
          totalViews
        };
      });

      // Sort by engagement rate
      hourlyAvgs.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

      // Show top 3
      hourlyAvgs.slice(0, 3).forEach((slot, i) => {
        const time = `${slot.hour % 12 || 12}:00 ${slot.hour >= 12 ? 'PM' : 'AM'}`;
        console.log(`    ${i + 1}. ${time.padEnd(8)} - ${slot.avgEngagementRate.toFixed(2)}% engagement (${slot.count} posts, ${slot.totalViews} views)`);
      });
    }

    // Recommend weekly schedule (3 posts)
    console.log(`\n  📅 RECOMMENDED WEEKLY SCHEDULE (3 posts):`);

    // Get all time slots across the week
    const allSlots: any[] = [];
    for (const [dayName, hours] of Object.entries(byDay)) {
      for (const [hour, posts] of Object.entries(hours as any)) {
        const avgEngagementRate = posts.reduce((sum: number, p: any) => sum + p.engagementRate, 0) / posts.length;
        allSlots.push({
          day: dayName,
          hour: parseInt(hour),
          avgEngagementRate,
          count: posts.length
        });
      }
    }

    // Get top 3 slots (spread across different days if possible)
    allSlots.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

    const selectedSlots = [];
    const usedDays = new Set();

    // Try to get different days
    for (const slot of allSlots) {
      if (selectedSlots.length >= 3) break;
      if (slot.count < 2) continue; // Need at least 2 posts for confidence

      // Prefer different days
      if (!usedDays.has(slot.day) || selectedSlots.length >= 2) {
        selectedSlots.push(slot);
        usedDays.add(slot.day);
      }
    }

    // Fill remaining slots if needed
    for (const slot of allSlots) {
      if (selectedSlots.length >= 3) break;
      if (slot.count < 2) continue;
      if (!selectedSlots.includes(slot)) {
        selectedSlots.push(slot);
      }
    }

    selectedSlots.forEach((slot, i) => {
      const time = `${slot.hour % 12 || 12}:00 ${slot.hour >= 12 ? 'PM' : 'AM'}`;
      console.log(`    Post ${i + 1}: ${slot.day} at ${time} (${slot.avgEngagementRate.toFixed(2)}% engagement)`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis Complete\n');

  process.exit(0);
}

analyzeAllData();
