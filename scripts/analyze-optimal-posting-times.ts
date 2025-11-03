/**
 * Analyze Optimal Posting Times Per Platform Per Day of Week
 *
 * This script:
 * 1. Fetches all historical posts from Late.dev with analytics
 * 2. Groups by platform and day of week
 * 3. Analyzes engagement rates by hour
 * 4. Finds top 3 posting times for each platform/day combination
 * 5. Outputs comprehensive scheduling recommendations
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Missing Firebase environment variables');
  }

  initializeApp({
    credential: cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = getFirestore();

interface PostAnalytics {
  postId: string;
  platform: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23 (CST)
  scheduledFor: Date;
  publishedAt?: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  totalEngagement: number; // likes + comments + shares + saves
}

interface TimeSlot {
  hour: number;
  avgEngagementRate: number;
  avgTotalEngagement: number;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
}

interface PlatformDayAnalysis {
  platform: string;
  dayOfWeek: number;
  dayName: string;
  topHours: Array<{
    hour: number;
    timeLabel: string;
    avgEngagementRate: number;
    avgTotalEngagement: number;
    postCount: number;
    confidence: 'high' | 'medium' | 'low'; // Based on post count
  }>;
  allHours: TimeSlot[];
  totalPosts: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'twitter', 'bluesky', 'threads'];

async function fetchLatePosts() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  if (!LATE_API_KEY) {
    throw new Error('LATE_API_KEY not configured');
  }

  console.log('📊 Fetching all historical posts from Late.dev...\n');

  try {
    const response = await fetch('https://getlate.dev/api/v1/posts', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Late API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.data?.length || 0} posts\n`);

    return data.data || [];
  } catch (error) {
    console.error('❌ Error fetching Late posts:', error);
    return [];
  }
}

function parsePostData(posts: any[]): PostAnalytics[] {
  const analytics: PostAnalytics[] = [];

  for (const post of posts) {
    // Only analyze posts that have been published
    if (post.status !== 'posted' || !post.publishedAt) continue;

    const publishedAt = new Date(post.publishedAt);
    const dayOfWeek = publishedAt.getDay();
    const hour = publishedAt.getHours();

    // Process each platform
    for (const platform of post.platforms || []) {
      if (!platform.analytics) continue;

      const views = platform.analytics.views || 0;
      const likes = platform.analytics.likes || 0;
      const comments = platform.analytics.comments || 0;
      const shares = platform.analytics.shares || 0;
      const saves = platform.analytics.saves || 0;

      const totalEngagement = likes + comments + shares + saves;
      const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

      analytics.push({
        postId: post._id,
        platform: platform.platform,
        dayOfWeek,
        hour,
        scheduledFor: new Date(post.scheduledFor),
        publishedAt,
        views,
        likes,
        comments,
        shares,
        saves,
        engagementRate,
        totalEngagement
      });
    }
  }

  return analytics;
}

function analyzeByPlatformAndDay(analytics: PostAnalytics[]): PlatformDayAnalysis[] {
  const results: PlatformDayAnalysis[] = [];

  for (const platform of PLATFORMS) {
    for (let day = 0; day < 7; day++) {
      const dayPosts = analytics.filter(p => p.platform === platform && p.dayOfWeek === day);

      if (dayPosts.length === 0) {
        continue; // Skip if no data for this platform/day
      }

      // Group by hour
      const hourlyData: { [hour: number]: PostAnalytics[] } = {};
      for (const post of dayPosts) {
        if (!hourlyData[post.hour]) {
          hourlyData[post.hour] = [];
        }
        hourlyData[post.hour].push(post);
      }

      // Calculate averages for each hour
      const allHours: TimeSlot[] = [];
      for (const hour of Object.keys(hourlyData).map(Number)) {
        const posts = hourlyData[hour];
        const avgEngagementRate = posts.reduce((sum, p) => sum + p.engagementRate, 0) / posts.length;
        const avgTotalEngagement = posts.reduce((sum, p) => sum + p.totalEngagement, 0) / posts.length;

        allHours.push({
          hour,
          avgEngagementRate,
          avgTotalEngagement,
          postCount: posts.length,
          totalViews: posts.reduce((sum, p) => sum + p.views, 0),
          totalLikes: posts.reduce((sum, p) => sum + p.likes, 0),
          totalComments: posts.reduce((sum, p) => sum + p.comments, 0),
          totalShares: posts.reduce((sum, p) => sum + p.shares, 0),
          totalSaves: posts.reduce((sum, p) => sum + p.saves, 0)
        });
      }

      // Sort by engagement rate and get top 3
      const topHours = allHours
        .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
        .slice(0, 3)
        .map(slot => ({
          hour: slot.hour,
          timeLabel: formatHour(slot.hour),
          avgEngagementRate: slot.avgEngagementRate,
          avgTotalEngagement: slot.avgTotalEngagement,
          postCount: slot.postCount,
          confidence: getConfidence(slot.postCount)
        }));

      results.push({
        platform,
        dayOfWeek: day,
        dayName: DAYS[day],
        topHours,
        allHours: allHours.sort((a, b) => a.hour - b.hour),
        totalPosts: dayPosts.length
      });
    }
  }

  return results;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

function getConfidence(postCount: number): 'high' | 'medium' | 'low' {
  if (postCount >= 10) return 'high';
  if (postCount >= 5) return 'medium';
  return 'low';
}

async function saveToFirestore(analyses: PlatformDayAnalysis[]) {
  console.log('\n💾 Saving analysis to Firestore...\n');

  const batch = db.batch();
  const timestamp = Date.now();

  for (const analysis of analyses) {
    const docId = `${analysis.platform}_${analysis.dayOfWeek}`;
    const ref = db.collection('posting_time_analytics').doc(docId);

    batch.set(ref, {
      platform: analysis.platform,
      dayOfWeek: analysis.dayOfWeek,
      dayName: analysis.dayName,
      topHours: analysis.topHours,
      totalPosts: analysis.totalPosts,
      analyzedAt: timestamp,
      updatedAt: new Date().toISOString()
    });
  }

  await batch.commit();
  console.log(`✅ Saved ${analyses.length} platform/day analyses to Firestore\n`);
}

function printReport(analyses: PlatformDayAnalysis[]) {
  console.log('\n' + '='.repeat(100));
  console.log('📊 OPTIMAL POSTING TIMES ANALYSIS REPORT');
  console.log('='.repeat(100) + '\n');

  // Group by platform
  const byPlatform: { [key: string]: PlatformDayAnalysis[] } = {};
  for (const analysis of analyses) {
    if (!byPlatform[analysis.platform]) {
      byPlatform[analysis.platform] = [];
    }
    byPlatform[analysis.platform].push(analysis);
  }

  for (const [platform, platformAnalyses] of Object.entries(byPlatform)) {
    console.log(`\n📱 ${platform.toUpperCase()}`);
    console.log('-'.repeat(100));

    // Sort by day of week
    platformAnalyses.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    for (const analysis of platformAnalyses) {
      console.log(`\n${analysis.dayName} (${analysis.totalPosts} posts analyzed):`);

      for (let i = 0; i < analysis.topHours.length; i++) {
        const slot = analysis.topHours[i];
        const rank = i + 1;
        const confidenceBadge = slot.confidence === 'high' ? '🟢' : slot.confidence === 'medium' ? '🟡' : '🔴';

        console.log(`  ${rank}. ${slot.timeLabel.padEnd(10)} - ${slot.avgEngagementRate.toFixed(2)}% engagement | ${slot.avgTotalEngagement.toFixed(0)} avg interactions | ${confidenceBadge} ${slot.confidence} confidence (${slot.postCount} posts)`);
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('📋 WEEKLY SCHEDULE RECOMMENDATIONS');
  console.log('='.repeat(100) + '\n');

  console.log('Post each video 3 times per week using these optimal times:\n');

  for (const [platform, platformAnalyses] of Object.entries(byPlatform)) {
    console.log(`${platform.toUpperCase()}:`);

    // Get top 3 time slots across the entire week
    const allTopSlots = platformAnalyses.flatMap(a =>
      a.topHours.map(h => ({
        ...h,
        dayOfWeek: a.dayOfWeek,
        dayName: a.dayName
      }))
    );

    // Sort by engagement rate and pick top 3 high-confidence slots
    const recommendedSlots = allTopSlots
      .filter(s => s.confidence !== 'low')
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
      .slice(0, 3);

    for (let i = 0; i < recommendedSlots.length; i++) {
      const slot = recommendedSlots[i];
      console.log(`  ${i + 1}. ${slot.dayName} at ${slot.timeLabel} (${slot.avgEngagementRate.toFixed(2)}% engagement)`);
    }

    console.log();
  }

  console.log('='.repeat(100) + '\n');
}

async function main() {
  console.log('🚀 Starting Optimal Posting Times Analysis\n');

  // Step 1: Fetch data from Late.dev
  const posts = await fetchLatePosts();

  if (posts.length === 0) {
    console.log('❌ No posts found. Cannot perform analysis.');
    process.exit(1);
  }

  // Step 2: Parse and structure data
  console.log('📈 Parsing post analytics data...\n');
  const analytics = parsePostData(posts);
  console.log(`✅ Parsed ${analytics.length} platform-specific post analytics\n`);

  // Step 3: Analyze by platform and day
  console.log('🔍 Analyzing optimal times by platform and day of week...\n');
  const analyses = analyzeByPlatformAndDay(analytics);
  console.log(`✅ Analyzed ${analyses.length} platform/day combinations\n`);

  // Step 4: Save to Firestore
  await saveToFirestore(analyses);

  // Step 5: Print report
  printReport(analyses);

  console.log('✅ Analysis complete!\n');
  process.exit(0);
}

main();
