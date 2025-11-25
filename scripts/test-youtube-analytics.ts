/**
 * Test YouTube Analytics Integration
 *
 * Run: npx tsx scripts/test-youtube-analytics.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  getChannelInfo,
  getRecentVideos,
  getAnalyticsSummary,
  analyzeContentPatterns,
} from '../src/lib/youtube-analytics';

async function main() {
  console.log('🎬 Testing YouTube Analytics Integration\n');

  const brand = process.argv[2] || 'abdullah';
  console.log(`📊 Testing for brand: ${brand}\n`);

  // Check credentials
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env[`YOUTUBE_${brand.toUpperCase()}_REFRESH_TOKEN`];

  console.log('🔑 Credentials check:');
  console.log(`   YOUTUBE_CLIENT_ID: ${clientId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   YOUTUBE_CLIENT_SECRET: ${clientSecret ? '✅ Set' : '❌ Missing'}`);
  console.log(`   YOUTUBE_${brand.toUpperCase()}_REFRESH_TOKEN: ${refreshToken ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing required credentials. Please check .env.local');
    process.exit(1);
  }

  // Test 1: Get channel info
  console.log('📺 Test 1: Getting channel info...');
  const channelInfo = await getChannelInfo(brand);

  if (channelInfo) {
    console.log(`   ✅ Channel: ${channelInfo.channelTitle}`);
    console.log(`   📊 Subscribers: ${channelInfo.subscriberCount.toLocaleString()}`);
    console.log(`   🎬 Total Videos: ${channelInfo.videoCount.toLocaleString()}`);
    console.log(`   👁️  Total Views: ${channelInfo.viewCount.toLocaleString()}`);
  } else {
    console.error('   ❌ Failed to get channel info');
    process.exit(1);
  }
  console.log('');

  // Test 2: Get recent videos
  console.log('🎬 Test 2: Getting recent videos...');
  const recentVideos = await getRecentVideos(brand, 10);

  if (recentVideos.length > 0) {
    console.log(`   ✅ Found ${recentVideos.length} recent videos\n`);

    console.log('   Top 5 by views:');
    const topByViews = [...recentVideos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);

    for (const video of topByViews) {
      console.log(`   📹 ${video.title.substring(0, 50)}...`);
      console.log(`      Views: ${video.viewCount.toLocaleString()} | Likes: ${video.likeCount.toLocaleString()} | Engagement: ${video.engagementRate.toFixed(2)}%`);
      console.log(`      URL: https://youtube.com/shorts/${video.videoId}`);
      console.log('');
    }
  } else {
    console.log('   ⚠️  No recent videos found');
  }
  console.log('');

  // Test 3: Full analytics summary
  console.log('📊 Test 3: Getting full analytics summary...');
  const summary = await getAnalyticsSummary(brand);

  if (summary) {
    console.log(`   ✅ Analytics summary retrieved`);
    console.log(`   📊 Avg Views/Video: ${summary.avgViewsPerVideo.toFixed(0)}`);
    console.log(`   💬 Avg Engagement: ${summary.avgEngagementRate.toFixed(2)}%`);
    console.log(`   👁️  Total Recent Views: ${summary.totalRecentViews.toLocaleString()}`);
    console.log(`   ❤️  Total Recent Likes: ${summary.totalRecentLikes.toLocaleString()}`);
    console.log('');

    // Analyze patterns
    console.log('🔍 Content Patterns Analysis:');
    const patterns = analyzeContentPatterns(summary.recentVideos);

    console.log('\n   📌 Best Hooks (from top performing videos):');
    patterns.bestHooks.slice(0, 5).forEach((hook, i) => {
      console.log(`      ${i + 1}. "${hook}..."`);
    });

    console.log('\n   ⏰ Best Posting Times (by avg views):');
    patterns.bestPostingTimes.forEach(({ hour, avgViews }) => {
      console.log(`      ${hour}:00 - Avg ${avgViews.toFixed(0)} views`);
    });

    console.log('\n   📹 Shorts vs Long Form:');
    console.log(`      Shorts: ${patterns.shortsVsLongForm.shorts.count} videos, avg ${patterns.shortsVsLongForm.shorts.avgViews.toFixed(0)} views`);
    console.log(`      Long Form: ${patterns.shortsVsLongForm.longForm.count} videos, avg ${patterns.shortsVsLongForm.longForm.avgViews.toFixed(0)} views`);
  } else {
    console.error('   ❌ Failed to get analytics summary');
  }

  console.log('\n✅ YouTube Analytics test complete!');
  console.log('\n💡 To use the API:');
  console.log(`   GET  /api/analytics/youtube?brand=${brand}`);
  console.log(`   POST /api/analytics/youtube (body: { "brand": "${brand}" })`);
}

main().catch(console.error);
