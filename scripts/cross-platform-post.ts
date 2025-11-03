#!/usr/bin/env tsx
/**
 * Cross-Platform Post Creator
 *
 * Creates and schedules posts optimized for both YouTube and Instagram
 * based on weekly analytics insights.
 *
 * Usage:
 *   npx tsx scripts/cross-platform-post.ts --brand ownerfi --video <url> --topic "<topic>"
 *
 * Features:
 * - Auto-generates platform-optimized captions
 * - Uses data-driven hashtag recommendations
 * - Schedules at optimal times based on analytics
 * - Posts to both YouTube and Instagram simultaneously
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { generateCaptionAndComment } from '../src/lib/caption-intelligence';
import { schedulePost } from '../src/lib/late-api';
import { getAdminDb } from '../src/lib/firebase-admin';

config({ path: resolve(process.cwd(), '.env.local') });

interface PostConfig {
  brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah';
  videoUrl: string;
  topic: string;
  scheduleTime?: string; // ISO 8601, or auto-schedule based on analytics
  platforms?: ('youtube' | 'instagram')[];
}

interface OptimizationInsights {
  bestHour: number;
  bestDay: string;
  youtubeHashtagCount: number;
  instagramHashtagCount: number;
  youtubeCaptionLength: string;
  instagramCaptionLength: string;
}

async function getOptimizationInsights(brand: string): Promise<OptimizationInsights> {
  const db = await getAdminDb();

  if (!db) {
    console.log('⚠️  Failed to initialize Firebase, using defaults');
    return {
      bestHour: 12,
      bestDay: 'Monday',
      youtubeHashtagCount: 4,
      instagramHashtagCount: 6,
      youtubeCaptionLength: '200-300',
      instagramCaptionLength: '200-300'
    };
  }

  // Fetch last 7 days of analytics
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const analyticsSnapshot = await db.collection('platform_analytics')
    .where('brand', '==', brand)
    .where('syncedAt', '>=', sevenDaysAgo.toISOString())
    .get();

  const posts = analyticsSnapshot.docs.map(doc => doc.data());

  if (posts.length === 0) {
    console.log('⚠️  No analytics data available, using defaults');
    return {
      bestHour: 12, // noon default
      bestDay: 'Monday',
      youtubeHashtagCount: 4,
      instagramHashtagCount: 6,
      youtubeCaptionLength: '200-300',
      instagramCaptionLength: '200-300'
    };
  }

  // Analyze best posting time
  const hourStats = new Map<number, { totalViews: number; count: number }>();
  const dayStats = new Map<string, { totalViews: number; count: number }>();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  posts.forEach(post => {
    if (post.publishedAt) {
      const date = new Date(post.publishedAt);
      const hour = date.getHours();
      const day = dayNames[date.getDay()];
      const views = post.views || 0;

      const hourStat = hourStats.get(hour) || { totalViews: 0, count: 0 };
      hourStat.totalViews += views;
      hourStat.count += 1;
      hourStats.set(hour, hourStat);

      const dayStat = dayStats.get(day) || { totalViews: 0, count: 0 };
      dayStat.totalViews += views;
      dayStat.count += 1;
      dayStats.set(day, dayStat);
    }
  });

  const bestHourEntry = Array.from(hourStats.entries())
    .sort((a, b) => (b[1].totalViews / b[1].count) - (a[1].totalViews / a[1].count))[0];

  const bestDayEntry = Array.from(dayStats.entries())
    .sort((a, b) => (b[1].totalViews / b[1].count) - (a[1].totalViews / a[1].count))[0];

  // Platform-specific insights
  const youtubePosts = posts.filter(p => p.platform === 'youtube');
  const instagramPosts = posts.filter(p => p.platform === 'instagram');

  const youtubeTopPerformers = youtubePosts
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, Math.max(1, Math.floor(youtubePosts.length * 0.2)));

  const instagramTopPerformers = instagramPosts
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, Math.max(1, Math.floor(instagramPosts.length * 0.2)));

  const youtubeAvgHashtags = youtubeTopPerformers.length > 0
    ? youtubeTopPerformers.reduce((sum, p) => sum + ((p.content?.match(/#/g) || []).length), 0) / youtubeTopPerformers.length
    : 4;

  const instagramAvgHashtags = instagramTopPerformers.length > 0
    ? instagramTopPerformers.reduce((sum, p) => sum + ((p.content?.match(/#/g) || []).length), 0) / instagramTopPerformers.length
    : 6;

  return {
    bestHour: bestHourEntry ? bestHourEntry[0] : 12,
    bestDay: bestDayEntry ? bestDayEntry[0] : 'Monday',
    youtubeHashtagCount: Math.round(youtubeAvgHashtags),
    instagramHashtagCount: Math.round(instagramAvgHashtags),
    youtubeCaptionLength: '200-300',
    instagramCaptionLength: '200-300'
  };
}

function getNextBestPostingTime(insights: OptimizationInsights): Date {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = dayNames.indexOf(insights.bestDay);
  const currentDayIndex = now.getDay();

  // Calculate days until target day
  let daysUntilTarget = targetDayIndex - currentDayIndex;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(insights.bestHour, 0, 0, 0);

  return targetDate;
}

async function createCrossPlatformPost(config: PostConfig) {
  console.log('\n📱 CROSS-PLATFORM POST CREATOR\n');
  console.log('═'.repeat(80));

  // Step 1: Get optimization insights
  console.log('\n📊 Step 1: Fetching optimization insights...');
  const insights = await getOptimizationInsights(config.brand);

  console.log(`\n✅ Insights for ${config.brand}:`);
  console.log(`   Best posting time: ${insights.bestDay}s at ${insights.bestHour}:00`);
  console.log(`   YouTube hashtags: ${insights.youtubeHashtagCount}`);
  console.log(`   Instagram hashtags: ${insights.instagramHashtagCount}`);

  // Step 2: Generate captions
  console.log('\n📝 Step 2: Generating platform-optimized captions...');

  const captionData = await generateCaptionAndComment({
    topic: config.topic,
    brand: config.brand as any,
    platform: 'both'
  });

  console.log(`\n✅ Caption generated (${captionData.metadata.captionLength} chars):`);
  console.log(`   "${captionData.caption}"`);
  console.log(`\n✅ First comment:`);
  console.log(`   "${captionData.firstComment}"`);

  // Step 3: Determine schedule time
  let scheduleTime: string;

  if (config.scheduleTime) {
    scheduleTime = config.scheduleTime;
    console.log(`\n📅 Step 3: Using provided schedule time: ${scheduleTime}`);
  } else {
    const nextBestTime = getNextBestPostingTime(insights);
    scheduleTime = nextBestTime.toISOString();
    console.log(`\n📅 Step 3: Auto-scheduling for optimal time:`);
    console.log(`   ${nextBestTime.toLocaleString()} (${insights.bestDay} at ${insights.bestHour}:00)`);
  }

  // Step 4: Schedule posts
  console.log('\n🚀 Step 4: Scheduling cross-platform post...');

  const platforms = config.platforms || ['youtube', 'instagram'];

  try {
    const result = await schedulePost({
      videoUrl: config.videoUrl,
      caption: captionData.caption,
      platforms: platforms as any,
      scheduleTime,
      brand: config.brand,
      firstComment: captionData.firstComment,
      postTypes: {
        instagram: 'reel'
      }
    });

    if (result.success) {
      console.log('\n✅ POST SCHEDULED SUCCESSFULLY!');
      console.log(`   Post ID: ${result.postId}`);
      console.log(`   Scheduled for: ${result.scheduledFor}`);
      console.log(`   Platforms: ${result.platforms?.join(', ')}`);

      if (result.skippedPlatforms && result.skippedPlatforms.length > 0) {
        console.log(`   ⚠️  Skipped platforms: ${result.skippedPlatforms.join(', ')}`);
      }
    } else {
      console.error('\n❌ Failed to schedule post:', result.error);
    }

    console.log('\n' + '═'.repeat(80));

    // Print copyable summary
    console.log('\n📋 POST SUMMARY:\n');
    console.log(`Brand: ${config.brand}`);
    console.log(`Video: ${config.videoUrl}`);
    console.log(`Platforms: ${platforms.join(', ')}`);
    console.log(`Schedule: ${new Date(scheduleTime).toLocaleString()}`);
    console.log(`\nCaption:\n${captionData.caption}`);
    console.log(`\nFirst Comment:\n${captionData.firstComment}`);
    console.log('\n' + '═'.repeat(80));

    return result;
  } catch (error) {
    console.error('\n❌ Error scheduling post:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const config: Partial<PostConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--brand':
        config.brand = args[++i] as any;
        break;
      case '--video':
        config.videoUrl = args[++i];
        break;
      case '--topic':
        config.topic = args[++i];
        break;
      case '--schedule':
        config.scheduleTime = args[++i];
        break;
      case '--platforms':
        config.platforms = args[++i].split(',') as any;
        break;
      case '--help':
        console.log(`
Cross-Platform Post Creator

Usage:
  npx tsx scripts/cross-platform-post.ts --brand <brand> --video <url> --topic "<topic>" [options]

Required Arguments:
  --brand <brand>       Brand name (carz, ownerfi, podcast, vassdistro, abdullah)
  --video <url>         Video URL
  --topic "<topic>"     Topic/description for caption generation

Optional Arguments:
  --schedule <time>     ISO 8601 schedule time (or auto-schedule based on analytics)
  --platforms <list>    Comma-separated platforms (default: youtube,instagram)

Examples:
  # Auto-schedule based on analytics
  npx tsx scripts/cross-platform-post.ts --brand ownerfi --video "https://..." --topic "Credit myths debunked"

  # Schedule for specific time
  npx tsx scripts/cross-platform-post.ts --brand carz --video "https://..." --topic "Tesla recall" --schedule "2025-11-01T14:00:00Z"

  # Post to Instagram only
  npx tsx scripts/cross-platform-post.ts --brand ownerfi --video "https://..." --topic "Owner financing" --platforms instagram
        `);
        process.exit(0);
    }
  }

  // Validate required arguments
  if (!config.brand || !config.videoUrl || !config.topic) {
    console.error('❌ Missing required arguments. Use --help for usage information.');
    process.exit(1);
  }

  await createCrossPlatformPost(config as PostConfig);
}

main().catch(console.error);
