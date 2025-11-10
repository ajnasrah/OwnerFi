#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const { getAdminDb } = require('../src/lib/firebase-admin');

async function syncLateAnalytics() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const db = await getAdminDb();

  if (!db) {
    console.error('Failed to initialize Firebase');
    return;
  }

  console.log('🔄 Syncing analytics from Late.dev to Firestore...\n');

  // Fetch ALL analytics from Late.dev
  const response = await fetch('https://getlate.dev/api/v1/analytics?limit=100', {
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  console.log(`📊 Found ${data.posts?.length || 0} posts with analytics\n`);

  let synced = 0;
  let totalViews = 0;

  for (const post of (data.posts || [])) {
    const analytics = post.analytics || {};
    const views = analytics.views || 0;
    totalViews += views;

    // Build platform metrics
    const platformMetrics: any = {};
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        platformMetrics[p.platform] = p.analytics || {};
      });
    }

    // Determine brand from post or use 'unknown'
    const brand = post.brand || 'carz'; // Default to carz for now

    // Save to Firestore
    const analyticsDoc = {
      latePostId: post._id,
      brand,
      contentType: 'viral', // Default

      // Timing
      scheduledTime: post.scheduledFor,
      postedTime: post.publishedAt,
      timeSlot: extractTimeSlot(post.scheduledFor),
      dayOfWeek: extractDayOfWeek(post.scheduledFor),

      // Platform metrics
      platformMetrics,

      // Totals from Late.dev
      totalViews: analytics.views || 0,
      totalLikes: analytics.likes || 0,
      totalComments: analytics.comments || 0,
      totalShares: analytics.shares || 0,
      totalSaves: analytics.saves || 0,
      overallEngagementRate: calculateEngagementRate(analytics),

      // Metadata
      caption: post.content,
      lastUpdated: Date.now(),
      syncedAt: Date.now(),
      dataSource: 'late_analytics_api'
    };

    await (db as any).collection('workflow_analytics')
      .doc(post._id)
      .set(analyticsDoc, { merge: true });

    if (views > 0) {
      console.log(`✅ ${post._id}: ${views.toLocaleString()} views`);
    }
    synced++;
  }

  console.log(`\n✅ Synced ${synced} posts`);
  console.log(`📈 Total Views: ${totalViews.toLocaleString()}`);
}

function extractTimeSlot(timestamp: string): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const nextHour = (hour + 1) % 24;
  return `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
}

function extractDayOfWeek(timestamp: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(timestamp);
  return days[date.getDay()];
}

function calculateEngagementRate(analytics: any): number {
  const views = analytics.views || 0;
  if (views === 0) return 0;
  const engagement = (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);
  return (engagement / views) * 100;
}

syncLateAnalytics().catch(console.error);
