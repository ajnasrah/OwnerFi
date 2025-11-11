/**
 * Find Universal Peak Times Across All Platforms
 *
 * Identify 5 times that perform well across Instagram, TikTok, and YouTube
 * where you can post the SAME content at the SAME time to all platforms
 */

import * as fs from 'fs';

interface Post {
  platform: string;
  publishedAt: string;
  analytics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves?: number;
    impressions?: number;
    reach?: number;
  };
}

interface HourPerformance {
  hour: number;
  timeLabel: string;
  platforms: {
    [platform: string]: {
      postCount: number;
      avgEngagement: number;
      avgViews: number;
      engagementRate: number;
    };
  };
  overallScore: number;
  platformCoverage: number; // How many platforms have data for this hour
}

const PLATFORMS = ['instagram', 'tiktok', 'youtube'];

function hasEngagementData(post: Post): boolean {
  const views = post.analytics.views || post.analytics.reach || post.analytics.impressions || 0;
  const engagement = (post.analytics.likes || 0) +
                    (post.analytics.comments || 0) +
                    (post.analytics.shares || 0) +
                    (post.analytics.saves || 0);
  return views > 0 || engagement > 0;
}

function getViews(post: Post): number {
  // Instagram uses reach, others use views
  if (post.platform.toLowerCase() === 'instagram') {
    return post.analytics.reach || 0;
  }
  return post.analytics.views || 0;
}

function getTotalEngagement(post: Post): number {
  return (post.analytics.likes || 0) +
         (post.analytics.comments || 0) +
         (post.analytics.shares || 0) +
         (post.analytics.saves || 0);
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

function analyzeUniversalTimes(posts: Post[]): HourPerformance[] {
  const hourlyData: { [hour: number]: { [platform: string]: Post[] } } = {};

  // Group posts by hour and platform
  for (const post of posts.filter(hasEngagementData)) {
    if (!PLATFORMS.includes(post.platform.toLowerCase())) continue;

    const hour = new Date(post.publishedAt).getHours();

    if (!hourlyData[hour]) {
      hourlyData[hour] = {};
    }

    const platform = post.platform.toLowerCase();
    if (!hourlyData[hour][platform]) {
      hourlyData[hour][platform] = [];
    }

    hourlyData[hour][platform].push(post);
  }

  // Calculate performance for each hour
  const hourPerformances: HourPerformance[] = [];

  for (let hour = 0; hour < 24; hour++) {
    if (!hourlyData[hour]) continue;

    const hourData: HourPerformance = {
      hour,
      timeLabel: formatHour(hour),
      platforms: {},
      overallScore: 0,
      platformCoverage: 0
    };

    let totalScore = 0;
    let platformsWithData = 0;

    for (const platform of PLATFORMS) {
      if (!hourlyData[hour][platform] || hourlyData[hour][platform].length === 0) {
        continue;
      }

      const platformPosts = hourlyData[hour][platform];
      const totalViews = platformPosts.reduce((sum, p) => sum + getViews(p), 0);
      const totalEngagement = platformPosts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
      const avgViews = totalViews / platformPosts.length;
      const avgEngagement = totalEngagement / platformPosts.length;
      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

      hourData.platforms[platform] = {
        postCount: platformPosts.length,
        avgViews,
        avgEngagement,
        engagementRate
      };

      // Score calculation: engagement rate * sqrt(post count) to favor reliable data
      const score = engagementRate * Math.sqrt(platformPosts.length);
      totalScore += score;
      platformsWithData++;
    }

    hourData.platformCoverage = platformsWithData;
    hourData.overallScore = platformsWithData > 0 ? totalScore / platformsWithData : 0;

    if (platformsWithData >= 2) { // Only include hours with at least 2 platforms
      hourPerformances.push(hourData);
    }
  }

  // Sort by overall score (best performing hours across platforms)
  return hourPerformances.sort((a, b) => b.overallScore - a.overallScore);
}

function printResults(performances: HourPerformance[]) {
  console.log('\n' + '='.repeat(100));
  console.log('🎯 UNIVERSAL PEAK TIMES - SAME TIME FOR ALL PLATFORMS');
  console.log('='.repeat(100));
  console.log('\nThese times perform well across multiple platforms (Instagram, TikTok, YouTube)\n');

  console.log('TOP 10 UNIVERSAL TIMES:\n');
  console.log('-'.repeat(100));

  for (let i = 0; i < Math.min(10, performances.length); i++) {
    const perf = performances[i];

    console.log(`\n${i + 1}. ${perf.timeLabel.padEnd(10)} - Score: ${perf.overallScore.toFixed(2)} | Platforms: ${perf.platformCoverage}/3`);

    for (const platform of PLATFORMS) {
      if (perf.platforms[platform]) {
        const p = perf.platforms[platform];
        console.log(`   ${platform.padEnd(12)} - ${p.engagementRate.toFixed(2)}% engagement | ${Math.round(p.avgViews)} avg views | ${p.postCount} posts`);
      } else {
        console.log(`   ${platform.padEnd(12)} - No data`);
      }
    }
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('🏆 RECOMMENDED 5 TIMES FOR DAILY POSTING');
  console.log('='.repeat(100));
  console.log('\nPost the SAME content to ALL platforms at these times:\n');

  const top5 = performances.slice(0, 5);

  for (let i = 0; i < top5.length; i++) {
    const perf = top5[i];
    const coverage = perf.platformCoverage === 3 ? '✅ All 3' : `⚠️ ${perf.platformCoverage}/3`;

    console.log(`${i + 1}. ${perf.timeLabel.padEnd(10)} ${coverage}`);

    const platformDetails: string[] = [];
    for (const platform of PLATFORMS) {
      if (perf.platforms[platform]) {
        const p = perf.platforms[platform];
        platformDetails.push(`${platform}: ${p.engagementRate.toFixed(2)}%`);
      }
    }
    console.log(`   Performance: ${platformDetails.join(' | ')}`);
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('📋 POSTING SCHEDULE FOR 5x/DAY');
  console.log('='.repeat(100));

  console.log('\nDaily schedule (all platforms receive same content at these times):\n');

  for (let i = 0; i < top5.length; i++) {
    const perf = top5[i];
    console.log(`Post ${i + 1}: ${perf.timeLabel}`);
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('📊 PERFORMANCE BREAKDOWN');
  console.log('='.repeat(100));

  console.log('\nExpected engagement by platform:\n');

  for (const platform of PLATFORMS) {
    const platformAvgs = top5
      .filter(p => p.platforms[platform])
      .map(p => p.platforms[platform].engagementRate);

    if (platformAvgs.length > 0) {
      const avgEngagement = platformAvgs.reduce((sum, rate) => sum + rate, 0) / platformAvgs.length;
      const coverage = platformAvgs.length;

      console.log(`${platform.toUpperCase().padEnd(15)} - ${avgEngagement.toFixed(2)}% avg engagement | ${coverage}/5 times have data`);
    } else {
      console.log(`${platform.toUpperCase().padEnd(15)} - No data for recommended times`);
    }
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('⚠️  ALTERNATIVE STRATEGY');
  console.log('='.repeat(100));

  console.log('\nIf you want MAXIMUM performance per platform (different times):');
  console.log('Consider using platform-specific optimal times instead.');
  console.log('See OPTIMAL_POSTING_SCHEDULE.md for platform-specific recommendations.\n');

  console.log('Trade-off:');
  console.log('  ✅ Same time posting: Easier workflow, consistent scheduling');
  console.log('  ✅ Platform-specific times: Higher engagement per platform');
}

function exportConfig(performances: HourPerformance[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('💾 CONFIGURATION EXPORT');
  console.log('='.repeat(100));

  const top5 = performances.slice(0, 5);

  console.log('\nexport const UNIVERSAL_POSTING_TIMES = [');
  for (const perf of top5) {
    console.log(`  ${perf.hour}, // ${perf.timeLabel} - Score: ${perf.overallScore.toFixed(2)}`);
  }
  console.log('];\n');

  console.log('export const UNIVERSAL_POSTING_SCHEDULE = {');
  console.log('  times: [');
  for (let i = 0; i < top5.length; i++) {
    const perf = top5[i];
    console.log(`    { hour: ${perf.hour}, label: "${perf.timeLabel}", slot: ${i + 1} },`);
  }
  console.log('  ],');
  console.log('  platforms: ["instagram", "tiktok", "youtube"],');
  console.log('  postsPerDay: 5');
  console.log('};\n');
}

async function main() {
  console.log('🚀 Finding Universal Peak Times Across Platforms\n');

  if (!fs.existsSync('./late-analytics-all.json')) {
    console.log('❌ late-analytics-all.json not found. Run fetch-late-analytics-comprehensive.ts first.');
    process.exit(1);
  }

  const posts: Post[] = JSON.parse(fs.readFileSync('./late-analytics-all.json', 'utf-8'));
  console.log(`📊 Loaded ${posts.length} posts\n`);

  const postsWithData = posts.filter(hasEngagementData);
  console.log(`✅ ${postsWithData.length} posts have engagement data\n`);

  console.log('🔍 Analyzing performance across Instagram, TikTok, and YouTube...\n');

  const performances = analyzeUniversalTimes(posts);

  printResults(performances);
  exportConfig(performances);

  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}

main();
