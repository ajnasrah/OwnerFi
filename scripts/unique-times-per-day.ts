/**
 * Unique Optimal Times Per Day of Week
 *
 * Find 5 best posting times for each day (Mon-Sun) where all platforms perform well
 * Each day gets different optimal times based on actual performance data
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
  platformCoverage: number;
}

interface DaySchedule {
  dayName: string;
  dayOfWeek: number;
  topTimes: HourPerformance[];
}

const PLATFORMS = ['instagram', 'tiktok', 'youtube'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hasEngagementData(post: Post): boolean {
  const views = post.analytics.views || post.analytics.reach || post.analytics.impressions || 0;
  const engagement = (post.analytics.likes || 0) +
                    (post.analytics.comments || 0) +
                    (post.analytics.shares || 0) +
                    (post.analytics.saves || 0);
  return views > 0 || engagement > 0;
}

function getViews(post: Post): number {
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

function analyzeByDayAndHour(posts: Post[]): Map<number, HourPerformance[]> {
  const dayHourData: Map<number, Map<number, Map<string, Post[]>>> = new Map();

  // Group posts by day of week, hour, and platform
  for (const post of posts.filter(hasEngagementData)) {
    if (!PLATFORMS.includes(post.platform.toLowerCase())) continue;

    const date = new Date(post.publishedAt);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    const platform = post.platform.toLowerCase();

    if (!dayHourData.has(dayOfWeek)) {
      dayHourData.set(dayOfWeek, new Map());
    }

    if (!dayHourData.get(dayOfWeek)!.has(hour)) {
      dayHourData.get(dayOfWeek)!.set(hour, new Map());
    }

    if (!dayHourData.get(dayOfWeek)!.get(hour)!.has(platform)) {
      dayHourData.get(dayOfWeek)!.get(hour)!.set(platform, []);
    }

    dayHourData.get(dayOfWeek)!.get(hour)!.get(platform)!.push(post);
  }

  // Calculate performance for each day
  const results = new Map<number, HourPerformance[]>();

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayData = dayHourData.get(dayOfWeek);
    if (!dayData) continue;

    const hourPerformances: HourPerformance[] = [];

    for (const [hour, platformData] of dayData.entries()) {
      const hourPerf: HourPerformance = {
        hour,
        timeLabel: formatHour(hour),
        platforms: {},
        overallScore: 0,
        platformCoverage: 0
      };

      let totalScore = 0;
      let platformsWithData = 0;

      for (const platform of PLATFORMS) {
        const platformPosts = platformData.get(platform);
        if (!platformPosts || platformPosts.length === 0) continue;

        const totalViews = platformPosts.reduce((sum, p) => sum + getViews(p), 0);
        const totalEngagement = platformPosts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
        const avgViews = totalViews / platformPosts.length;
        const avgEngagement = totalEngagement / platformPosts.length;
        const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

        hourPerf.platforms[platform] = {
          postCount: platformPosts.length,
          avgViews,
          avgEngagement,
          engagementRate
        };

        const score = engagementRate * Math.sqrt(platformPosts.length);
        totalScore += score;
        platformsWithData++;
      }

      hourPerf.platformCoverage = platformsWithData;
      hourPerf.overallScore = platformsWithData > 0 ? totalScore / platformsWithData : 0;

      if (platformsWithData >= 2) {
        hourPerformances.push(hourPerf);
      }
    }

    // Sort by score and take top 10 for each day
    hourPerformances.sort((a, b) => b.overallScore - a.overallScore);
    results.set(dayOfWeek, hourPerformances);
  }

  return results;
}

function printDaySchedules(daySchedules: DaySchedule[]) {
  console.log('\n' + '='.repeat(100));
  console.log('📅 UNIQUE POSTING TIMES FOR EACH DAY OF THE WEEK');
  console.log('='.repeat(100));
  console.log('\n5 optimal times per day - Each day has different times based on performance\n');

  for (const schedule of daySchedules) {
    console.log('\n' + '='.repeat(100));
    console.log(`📆 ${schedule.dayName.toUpperCase()}`);
    console.log('='.repeat(100));

    console.log('\nPost 5 times at these hours:\n');

    for (let i = 0; i < Math.min(5, schedule.topTimes.length); i++) {
      const perf = schedule.topTimes[i];
      const coverage = perf.platformCoverage === 3 ? '✅' : `⚠️ ${perf.platformCoverage}/3`;

      console.log(`${i + 1}. ${perf.timeLabel.padEnd(10)} ${coverage} - Score: ${perf.overallScore.toFixed(2)}`);

      for (const platform of PLATFORMS) {
        if (perf.platforms[platform]) {
          const p = perf.platforms[platform];
          console.log(`   ${platform.padEnd(12)} - ${p.engagementRate.toFixed(2)}% engagement | ${Math.round(p.avgViews)} avg views | ${p.postCount} posts`);
        } else {
          console.log(`   ${platform.padEnd(12)} - No data`);
        }
      }
    }

    // Summary line
    const times = schedule.topTimes.slice(0, 5).map(t => t.timeLabel).join(', ');
    console.log(`\n📋 ${schedule.dayName} posting times: ${times}`);
  }
}

function printWeekOverview(daySchedules: DaySchedule[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 WEEKLY POSTING SCHEDULE OVERVIEW');
  console.log('='.repeat(100));
  console.log('\n5 posts per day, different times each day:\n');

  for (const schedule of daySchedules) {
    const times = schedule.topTimes.slice(0, 5).map(t => t.timeLabel).join(', ');
    console.log(`${schedule.dayName.padEnd(12)} - ${times}`);
  }
}

function printQuickReference(daySchedules: DaySchedule[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('⚡ QUICK REFERENCE - COPY & PASTE');
  console.log('='.repeat(100));
  console.log('\n');

  for (const schedule of daySchedules) {
    console.log(`**${schedule.dayName}:**`);
    const times = schedule.topTimes.slice(0, 5);
    for (let i = 0; i < times.length; i++) {
      console.log(`  ${i + 1}. ${times[i].timeLabel}`);
    }
    console.log();
  }
}

function exportConfig(daySchedules: DaySchedule[]) {
  console.log('\n' + '='.repeat(100));
  console.log('💾 CONFIGURATION EXPORT');
  console.log('='.repeat(100));
  console.log('\n');

  console.log('export const DAY_SPECIFIC_POSTING_TIMES: Record<string, number[]> = {');

  for (const schedule of daySchedules) {
    const hours = schedule.topTimes.slice(0, 5).map(t => t.hour);
    const labels = schedule.topTimes.slice(0, 5).map(t => t.timeLabel);
    console.log(`  ${schedule.dayName.toLowerCase()}: [${hours.join(', ')}], // ${labels.join(', ')}`);
  }

  console.log('};\n');

  console.log('// Get posting times for a specific day of week (0 = Sunday, 6 = Saturday)');
  console.log('export function getPostingTimesForDay(dayOfWeek: number): number[] {');
  console.log('  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];');
  console.log('  return DAY_SPECIFIC_POSTING_TIMES[days[dayOfWeek]] || [];');
  console.log('}\n');
}

function analyzeVariety(daySchedules: DaySchedule[]) {
  console.log('\n' + '='.repeat(100));
  console.log('🎨 SCHEDULE VARIETY ANALYSIS');
  console.log('='.repeat(100));
  console.log('\n');

  // Collect all unique times
  const allTimes = new Set<number>();
  const timeFrequency = new Map<number, number>();

  for (const schedule of daySchedules) {
    const times = schedule.topTimes.slice(0, 5);
    for (const time of times) {
      allTimes.add(time.hour);
      timeFrequency.set(time.hour, (timeFrequency.get(time.hour) || 0) + 1);
    }
  }

  console.log(`Total unique times used across the week: ${allTimes.size}`);
  console.log(`\nMost common posting times:\n`);

  const sorted = Array.from(timeFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [hour, count] of sorted) {
    console.log(`  ${formatHour(hour).padEnd(10)} - Used ${count}/7 days`);
  }

  console.log('\n');
}

async function main() {
  console.log('🚀 Finding Unique Optimal Times for Each Day of the Week\n');

  if (!fs.existsSync('./late-analytics-all.json')) {
    console.log('❌ late-analytics-all.json not found.');
    process.exit(1);
  }

  const posts: Post[] = JSON.parse(fs.readFileSync('./late-analytics-all.json', 'utf-8'));
  console.log(`📊 Loaded ${posts.length} posts\n`);

  const postsWithData = posts.filter(hasEngagementData);
  console.log(`✅ ${postsWithData.length} posts have engagement data\n`);

  console.log('🔍 Analyzing performance by day of week and hour...\n');

  const dayHourPerformances = analyzeByDayAndHour(posts);

  const daySchedules: DaySchedule[] = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const performances = dayHourPerformances.get(dayOfWeek);
    if (!performances || performances.length === 0) continue;

    daySchedules.push({
      dayName: DAYS[dayOfWeek],
      dayOfWeek,
      topTimes: performances
    });
  }

  printDaySchedules(daySchedules);
  printWeekOverview(daySchedules);
  analyzeVariety(daySchedules);
  printQuickReference(daySchedules);
  exportConfig(daySchedules);

  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}

main();
