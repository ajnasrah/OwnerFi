/**
 * Analyze Platform Analytics from Firestore
 * Find optimal posting times per platform per day of week
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

interface PostData {
  postId: string;
  platform: string;
  publishedAt: string;
  dayName: string;
  dayOfWeek: number;
  hour: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  totalEngagement: number;
}

const DAYS: { [key: string]: number } = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

async function fetchAnalytics(): Promise<PostData[]> {
  console.log('📊 Fetching analytics from Firestore...\n');

  const snapshot = await db.collection('platform_analytics').get();
  console.log(`✅ Found ${snapshot.size} analytics records\n`);

  const posts: PostData[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if no published date or engagement data
    if (!data.publishedAt) continue;

    const publishedAt = new Date(data.publishedAt);
    const views = data.views || data.impressions || 0;
    const likes = data.likes || 0;
    const comments = data.comments || 0;
    const shares = data.shares || 0;
    const saves = data.saves || 0;

    // Skip posts with zero views
    if (views === 0) continue;

    const totalEngagement = likes + comments + shares + saves;
    const engagementRate = (totalEngagement / views) * 100;

    posts.push({
      postId: data.postId || doc.id,
      platform: data.platform || 'unknown',
      publishedAt: data.publishedAt,
      dayName: data.dayName || publishedAt.toLocaleDateString('en-US', { weekday: 'long' }),
      dayOfWeek: DAYS[data.dayName] !== undefined ? DAYS[data.dayName] : publishedAt.getDay(),
      hour: publishedAt.getHours(),
      views,
      likes,
      comments,
      shares,
      saves,
      engagementRate,
      totalEngagement
    });
  }

  console.log(`✅ Parsed ${posts.length} posts with engagement data\n`);
  return posts;
}

interface TimeSlotAnalytics {
  hour: number;
  avgEngagementRate: number;
  avgTotalEngagement: number;
  postCount: number;
  totalViews: number;
}

function analyzeByPlatformAndDay(posts: PostData[]) {
  const PLATFORMS = [...new Set(posts.map(p => p.platform))];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  console.log('🔍 Analyzing by platform and day of week...\n');
  console.log(`Platforms found: ${PLATFORMS.join(', ')}\n`);

  const results: any = {};

  for (const platform of PLATFORMS) {
    results[platform] = {};

    for (let day = 0; day < 7; day++) {
      const dayPosts = posts.filter(p => p.platform === platform && p.dayOfWeek === day);

      if (dayPosts.length === 0) continue;

      // Group by hour
      const hourlyData: { [hour: number]: PostData[] } = {};
      for (const post of dayPosts) {
        if (!hourlyData[post.hour]) {
          hourlyData[post.hour] = [];
        }
        hourlyData[post.hour].push(post);
      }

      // Calculate averages
      const timeSlots: TimeSlotAnalytics[] = [];
      for (const [hour, hourPosts] of Object.entries(hourlyData)) {
        const avgEngagementRate = hourPosts.reduce((sum, p) => sum + p.engagementRate, 0) / hourPosts.length;
        const avgTotalEngagement = hourPosts.reduce((sum, p) => sum + p.totalEngagement, 0) / hourPosts.length;
        const totalViews = hourPosts.reduce((sum, p) => sum + p.views, 0);

        timeSlots.push({
          hour: parseInt(hour),
          avgEngagementRate,
          avgTotalEngagement,
          postCount: hourPosts.length,
          totalViews
        });
      }

      // Get top 3 hours by engagement rate
      const top3 = timeSlots
        .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
        .slice(0, 3);

      results[platform][DAYS_FULL[day]] = {
        totalPosts: dayPosts.length,
        top3Hours: top3.map(t => ({
          hour: t.hour,
          time: formatHour(t.hour),
          avgEngagementRate: t.avgEngagementRate.toFixed(2),
          avgEngagement: Math.round(t.avgTotalEngagement),
          postCount: t.postCount,
          confidence: t.postCount >= 10 ? 'HIGH' : t.postCount >= 5 ? 'MED' : 'LOW'
        })),
        allHours: timeSlots.sort((a, b) => a.hour - b.hour)
      };
    }
  }

  return results;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

function printReport(results: any) {
  console.log('\n' + '='.repeat(100));
  console.log('📊 PLATFORM-SPECIFIC POSTING TIME ANALYSIS');
  console.log('='.repeat(100) + '\n');

  for (const [platform, days] of Object.entries(results)) {
    console.log(`\n📱 ${platform.toUpperCase()}`);
    console.log('-'.repeat(100));

    for (const [day, data] of Object.entries(days as any)) {
      console.log(`\n${day} (${data.totalPosts} posts):`);

      for (let i = 0; i < data.top3Hours.length; i++) {
        const slot = data.top3Hours[i];
        const badge = slot.confidence === 'HIGH' ? '🟢' : slot.confidence === 'MED' ? '🟡' : '🔴';
        console.log(`  ${i + 1}. ${slot.time.padEnd(10)} - ${slot.avgEngagementRate}% engagement | ${slot.avgEngagement} avg interactions | ${badge} ${slot.confidence} (${slot.postCount} posts)`);
      }
    }
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('📅 RECOMMENDED 3-POST-PER-WEEK SCHEDULE');
  console.log('='.repeat(100) + '\n');

  console.log('For each new video, schedule 3 posts at these optimal times:\n');

  for (const [platform, days] of Object.entries(results)) {
    console.log(`${platform.toUpperCase()}:`);

    // Collect all top slots across week
    const allSlots: any[] = [];
    for (const [dayName, data] of Object.entries(days as any)) {
      for (const slot of data.top3Hours) {
        allSlots.push({
          ...slot,
          dayName,
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName)
        });
      }
    }

    // Get top 3 highest engagement slots (preferring high confidence)
    const recommended = allSlots
      .filter(s => s.confidence !== 'LOW')
      .sort((a, b) => {
        // First by engagement rate
        if (parseFloat(b.avgEngagementRate) !== parseFloat(a.avgEngagementRate)) {
          return parseFloat(b.avgEngagementRate) - parseFloat(a.avgEngagementRate);
        }
        // Then by confidence
        return (b.confidence === 'HIGH' ? 2 : 1) - (a.confidence === 'HIGH' ? 2 : 1);
      })
      .slice(0, 3);

    for (let i = 0; i < recommended.length; i++) {
      const slot = recommended[i];
      console.log(`  Post ${i + 1}: ${slot.dayName} at ${slot.time} (${slot.avgEngagementRate}% engagement, ${slot.postCount} posts analyzed)`);
    }

    console.log();
  }

  console.log('='.repeat(100) + '\n');
}

async function generateSchedulingCode(results: any) {
  console.log('\n📝 GENERATING SCHEDULING CODE...\n');

  const schedules: any = {};

  for (const [platform, days] of Object.entries(results)) {
    const allSlots: any[] = [];

    for (const [dayName, data] of Object.entries(days as any)) {
      for (const slot of data.top3Hours) {
        allSlots.push({
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName),
          hour: slot.hour,
          engagementRate: parseFloat(slot.avgEngagementRate),
          postCount: slot.postCount
        });
      }
    }

    // Get top 3
    const top3 = allSlots
      .filter(s => s.postCount >= 3) // At least 3 posts for confidence
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 3);

    schedules[platform] = top3;
  }

  console.log('```typescript');
  console.log('// Auto-generated optimal posting schedule based on analytics');
  console.log('// Generated:', new Date().toISOString());
  console.log('');
  console.log('export const OPTIMAL_POSTING_SCHEDULE = ' + JSON.stringify(schedules, null, 2) + ';');
  console.log('```\n');
}

async function main() {
  const posts = await fetchAnalytics();

  if (posts.length === 0) {
    console.log('❌ No analytics data with engagement found');
    process.exit(1);
  }

  const results = analyzeByPlatformAndDay(posts);
  printReport(results);
  await generateSchedulingCode(results);

  console.log('✅ Analysis complete!\n');
  process.exit(0);
}

main();
