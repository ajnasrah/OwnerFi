#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const { getAdminDb } = require('../src/lib/firebase-admin');

async function deepAnalysis() {
  const db = await getAdminDb();
  if (!db) return;

  console.log('🔬 DEEP ANALYTICS ANALYSIS - DECISION-MAKING INSIGHTS\n');
  console.log('═'.repeat(100));

  // Get ALL analytics data
  const snap = await (db as any).collection('workflow_analytics').get();
  const posts: any[] = [];
  snap.forEach((doc: any) => posts.push({ id: doc.id, ...doc.data() }));

  const postsWithViews = posts.filter(p => p.totalViews > 0);

  console.log(`\n📊 DATASET OVERVIEW:`);
  console.log(`   Total Posts: ${posts.length}`);
  console.log(`   Posts with Views: ${postsWithViews.length}`);
  console.log(`   Posts with 0 Views: ${posts.length - postsWithViews.length}`);
  console.log(`   Total Views: ${postsWithViews.reduce((sum, p) => sum + p.totalViews, 0).toLocaleString()}`);

  // ============================================================================
  // ANALYSIS 1: CAPTION/CONTENT ANALYSIS
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('📝 CAPTION & CONTENT PATTERN ANALYSIS');
  console.log('═'.repeat(100));

  const captionPatterns: Map<string, { count: number; avgViews: number; totalViews: number }> = new Map();

  postsWithViews.forEach(post => {
    const caption = post.caption || '';

    // Analyze patterns
    const patterns = {
      'Has Emoji': /[\u{1F300}-\u{1F9FF}]/u.test(caption),
      'Has Question': caption.includes('?'),
      'Has Exclamation': caption.includes('!'),
      'Has Numbers': /\d/.test(caption),
      'Mentions EV/Electric': /electric|ev|battery|charge/i.test(caption),
      'Mentions Tesla/Luxury': /tesla|cadillac|mercedes|luxury|supercar/i.test(caption),
      'Mentions Price/Money': /price|cost|\$|cheap|expensive|deal/i.test(caption),
      'Mentions Owner Finance': /owner financ|rent|credit|mortgage/i.test(caption),
      'Has Urgency': /new|now|breaking|alert|just|today/i.test(caption),
      'Has Controversy': /problem|issue|concern|warning|recall|dangerous/i.test(caption),
      'Length < 100 chars': caption.length < 100,
      'Length 100-200 chars': caption.length >= 100 && caption.length < 200,
      'Length > 200 chars': caption.length >= 200,
    };

    Object.entries(patterns).forEach(([pattern, hasIt]) => {
      if (hasIt) {
        const existing = captionPatterns.get(pattern) || { count: 0, avgViews: 0, totalViews: 0 };
        existing.count += 1;
        existing.totalViews += post.totalViews;
        existing.avgViews = existing.totalViews / existing.count;
        captionPatterns.set(pattern, existing);
      }
    });
  });

  console.log('\n🎯 CAPTION PATTERNS (sorted by avg views):');
  Array.from(captionPatterns.entries())
    .sort((a, b) => b[1].avgViews - a[1].avgViews)
    .forEach(([pattern, data]) => {
      const adoption = ((data.count / postsWithViews.length) * 100).toFixed(1);
      console.log(`   ${pattern.padEnd(30)} | ${Math.round(data.avgViews).toString().padStart(5)} avg views | ${data.count.toString().padStart(3)} posts (${adoption}% adoption)`);
    });

  // ============================================================================
  // ANALYSIS 2: TIMING DEEP DIVE
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('⏰ TIMING OPTIMIZATION ANALYSIS');
  console.log('═'.repeat(100));

  // Hour-by-hour analysis
  const hourlyData: Map<number, { views: number; count: number; engagement: number }> = new Map();
  postsWithViews.forEach(post => {
    const hour = parseInt(post.timeSlot?.split(':')[0] || '0');
    const existing = hourlyData.get(hour) || { views: 0, count: 0, engagement: 0 };
    existing.views += post.totalViews;
    existing.count += 1;
    existing.engagement += post.overallEngagementRate || 0;
    hourlyData.set(hour, existing);
  });

  console.log('\n⏰ HOUR-BY-HOUR PERFORMANCE:');
  for (let hour = 0; hour < 24; hour++) {
    const data = hourlyData.get(hour);
    if (data) {
      const avgViews = Math.round(data.views / data.count);
      const avgEngagement = (data.engagement / data.count).toFixed(2);
      const bar = '█'.repeat(Math.round(avgViews / 50));
      console.log(`   ${hour.toString().padStart(2, '0')}:00 | ${avgViews.toString().padStart(5)} avg views | ${avgEngagement}% engagement | ${data.count.toString().padStart(2)} posts | ${bar}`);
    }
  }

  // Day + Time combo analysis
  const dayTimeCombo: Map<string, { views: number; count: number }> = new Map();
  postsWithViews.forEach(post => {
    const key = `${post.dayOfWeek}-${post.timeSlot}`;
    const existing = dayTimeCombo.get(key) || { views: 0, count: 0 };
    existing.views += post.totalViews;
    existing.count += 1;
    dayTimeCombo.set(key, existing);
  });

  console.log('\n📅 TOP 10 DAY+TIME COMBINATIONS:');
  Array.from(dayTimeCombo.entries())
    .filter(([_, data]) => data.count >= 2) // At least 2 posts
    .map(([combo, data]) => ({ combo, avgViews: data.views / data.count, count: data.count }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10)
    .forEach((item, idx) => {
      console.log(`   ${(idx + 1).toString().padStart(2)}. ${item.combo.padEnd(30)} | ${Math.round(item.avgViews).toString().padStart(5)} avg views | ${item.count} posts`);
    });

  // ============================================================================
  // ANALYSIS 3: PLATFORM DEEP DIVE
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('📱 PLATFORM PERFORMANCE ANALYSIS');
  console.log('═'.repeat(100));

  const platformStats = new Map<string, {
    totalViews: number;
    posts: number;
    engagement: number;
    topPost: { views: number; caption: string };
  }>();

  postsWithViews.forEach(post => {
    if (post.platformMetrics) {
      Object.entries(post.platformMetrics).forEach(([platform, metrics]: [string, any]) => {
        const views = metrics.views || 0;
        if (views > 0) {
          const existing = platformStats.get(platform) || {
            totalViews: 0,
            posts: 0,
            engagement: 0,
            topPost: { views: 0, caption: '' }
          };

          existing.totalViews += views;
          existing.posts += 1;
          existing.engagement += metrics.engagementRate || 0;

          if (views > existing.topPost.views) {
            existing.topPost = { views, caption: (post.caption || '').substring(0, 60) };
          }

          platformStats.set(platform, existing);
        }
      });
    }
  });

  console.log('\n📊 PLATFORM BREAKDOWN:');
  Array.from(platformStats.entries())
    .sort((a, b) => b[1].totalViews - a[1].totalViews)
    .forEach(([platform, data]) => {
      const avgViews = Math.round(data.totalViews / data.posts);
      const avgEngagement = (data.engagement / data.posts).toFixed(2);
      const share = ((data.totalViews / postsWithViews.reduce((sum, p) => sum + p.totalViews, 0)) * 100).toFixed(1);

      console.log(`\n   ${platform.toUpperCase()}`);
      console.log(`      Total Views: ${data.totalViews.toLocaleString()} (${share}% of all views)`);
      console.log(`      Avg Views: ${avgViews.toLocaleString()}`);
      console.log(`      Posts: ${data.posts}`);
      console.log(`      Avg Engagement: ${avgEngagement}%`);
      console.log(`      Top Post: ${data.topPost.views} views - "${data.topPost.caption}..."`);
    });

  // ============================================================================
  // ANALYSIS 4: ENGAGEMENT ANALYSIS
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('💬 ENGAGEMENT RATE ANALYSIS');
  console.log('═'.repeat(100));

  const engagementBuckets = [
    { name: '0-0.5%', min: 0, max: 0.5, posts: [] as any[] },
    { name: '0.5-1%', min: 0.5, max: 1, posts: [] as any[] },
    { name: '1-2%', min: 1, max: 2, posts: [] as any[] },
    { name: '2%+', min: 2, max: 100, posts: [] as any[] },
  ];

  postsWithViews.forEach(post => {
    const engagement = post.overallEngagementRate || 0;
    const bucket = engagementBuckets.find(b => engagement >= b.min && engagement < b.max);
    if (bucket) bucket.posts.push(post);
  });

  console.log('\n📊 ENGAGEMENT DISTRIBUTION:');
  engagementBuckets.forEach(bucket => {
    const avgViews = bucket.posts.length > 0
      ? Math.round(bucket.posts.reduce((sum, p) => sum + p.totalViews, 0) / bucket.posts.length)
      : 0;
    console.log(`   ${bucket.name.padEnd(10)} | ${bucket.posts.length.toString().padStart(3)} posts | ${avgViews.toString().padStart(5)} avg views`);
  });

  // What drives high engagement?
  const highEngagement = postsWithViews
    .filter(p => p.overallEngagementRate > 1)
    .sort((a, b) => b.overallEngagementRate - a.overallEngagementRate);

  console.log('\n🔥 HIGH ENGAGEMENT POSTS (>1%) - WHAT DO THEY HAVE IN COMMON?');
  const highEngPatterns = new Map<string, number>();

  highEngagement.forEach(post => {
    const caption = post.caption || '';
    if (/[\u{1F300}-\u{1F9FF}]/u.test(caption)) highEngPatterns.set('Has Emoji', (highEngPatterns.get('Has Emoji') || 0) + 1);
    if (caption.includes('?')) highEngPatterns.set('Has Question', (highEngPatterns.get('Has Question') || 0) + 1);
    if (/tesla|recall|warning|problem/i.test(caption)) highEngPatterns.set('Controversial', (highEngPatterns.get('Controversial') || 0) + 1);
    if (caption.length < 100) highEngPatterns.set('Short (<100 chars)', (highEngPatterns.get('Short (<100 chars)') || 0) + 1);
  });

  Array.from(highEngPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      const percentage = ((count / highEngagement.length) * 100).toFixed(0);
      console.log(`   ${pattern.padEnd(25)} | ${count}/${highEngagement.length} posts (${percentage}%)`);
    });

  // ============================================================================
  // ANALYSIS 5: CONTENT TOPIC CLUSTERING
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('🎯 CONTENT TOPIC PERFORMANCE');
  console.log('═'.repeat(100));

  const topics = {
    'Electric Vehicles': { keywords: /electric|ev|battery|charge|tesla/i, posts: [] as any[] },
    'Luxury/Supercars': { keywords: /luxury|supercar|cadillac|porsche|ferrari|lamborghini/i, posts: [] as any[] },
    'Owner Financing': { keywords: /owner financ|rent|credit|mortgage|housing|real estate/i, posts: [] as any[] },
    'Car Recalls/Safety': { keywords: /recall|safety|warning|problem|issue|defect/i, posts: [] as any[] },
    'New Models/Releases': { keywords: /new|unveiled|reveal|concept|2024|2025|2026/i, posts: [] as any[] },
    'Technology/Innovation': { keywords: /technology|innovation|autonomous|self-driving|hydrogen/i, posts: [] as any[] },
    'Pricing/Deals': { keywords: /price|cost|deal|cheap|expensive|afford|\$/i, posts: [] as any[] },
  };

  postsWithViews.forEach(post => {
    const caption = post.caption || '';
    Object.entries(topics).forEach(([topic, data]) => {
      if (data.keywords.test(caption)) {
        data.posts.push(post);
      }
    });
  });

  console.log('\n📈 TOPIC PERFORMANCE (sorted by avg views):');
  Object.entries(topics)
    .map(([topic, data]) => ({
      topic,
      count: data.posts.length,
      avgViews: data.posts.length > 0
        ? Math.round(data.posts.reduce((sum: number, p: any) => sum + p.totalViews, 0) / data.posts.length)
        : 0,
      totalViews: data.posts.reduce((sum: number, p: any) => sum + p.totalViews, 0),
      avgEngagement: data.posts.length > 0
        ? (data.posts.reduce((sum: number, p: any) => sum + (p.overallEngagementRate || 0), 0) / data.posts.length).toFixed(2)
        : '0.00',
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .forEach(item => {
      if (item.count > 0) {
        console.log(`   ${item.topic.padEnd(30)} | ${item.avgViews.toString().padStart(5)} avg views | ${item.count.toString().padStart(3)} posts | ${item.avgEngagement}% engagement`);
      }
    });

  // ============================================================================
  // ANALYSIS 6: VIDEO LENGTH (if available)
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('⏱️ VIDEO LENGTH ANALYSIS');
  console.log('═'.repeat(100));

  const lengthData = {
    '15sec': postsWithViews.filter(p => p.variant === '15sec'),
    '30sec': postsWithViews.filter(p => p.variant === '30sec'),
    'Unknown': postsWithViews.filter(p => !p.variant),
  };

  Object.entries(lengthData).forEach(([length, posts]) => {
    if (posts.length > 0) {
      const avgViews = Math.round(posts.reduce((sum, p) => sum + p.totalViews, 0) / posts.length);
      const avgEngagement = (posts.reduce((sum, p) => sum + (p.overallEngagementRate || 0), 0) / posts.length).toFixed(2);
      console.log(`   ${length.padEnd(10)} | ${posts.length.toString().padStart(3)} posts | ${avgViews.toString().padStart(5)} avg views | ${avgEngagement}% engagement`);
    }
  });

  // ============================================================================
  // FINAL RECOMMENDATIONS
  // ============================================================================
  console.log('\n' + '═'.repeat(100));
  console.log('🎯 ACTIONABLE INSIGHTS & RECOMMENDATIONS');
  console.log('═'.repeat(100));

  const recommendations: string[] = [];

  // Best time
  const bestHour = Array.from(hourlyData.entries())
    .sort((a, b) => (b[1].views / b[1].count) - (a[1].views / a[1].count))[0];
  recommendations.push(`⏰ SCHEDULE: Post at ${bestHour[0]}:00 (${Math.round(bestHour[1].views / bestHour[1].count)} avg views)`);

  // Best platform
  const bestPlatform = Array.from(platformStats.entries())
    .sort((a, b) => (b[1].totalViews / b[1].posts) - (a[1].totalViews / a[1].posts))[0];
  recommendations.push(`📱 PLATFORM: Focus on ${bestPlatform[0]} (${Math.round(bestPlatform[1].totalViews / bestPlatform[1].posts)} avg views)`);

  // Best topic
  const bestTopic = Object.entries(topics)
    .map(([topic, data]) => ({
      topic,
      avgViews: data.posts.length > 0 ? data.posts.reduce((sum, p) => sum + p.totalViews, 0) / data.posts.length : 0
    }))
    .sort((a, b) => b.avgViews - a.avgViews)[0];
  recommendations.push(`🎯 CONTENT: Create more "${bestTopic.topic}" content (${Math.round(bestTopic.avgViews)} avg views)`);

  // Caption insights
  const topCaptionPattern = Array.from(captionPatterns.entries())
    .sort((a, b) => b[1].avgViews - a[1].avgViews)[0];
  recommendations.push(`📝 CAPTION: ${topCaptionPattern[0]} (${Math.round(topCaptionPattern[1].avgViews)} avg views)`);

  console.log('\n');
  recommendations.forEach((rec, idx) => {
    console.log(`   ${idx + 1}. ${rec}`);
  });

  console.log('\n' + '═'.repeat(100));
}

deepAnalysis().catch(console.error);
