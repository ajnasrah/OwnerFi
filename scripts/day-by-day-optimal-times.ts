/**
 * Day-by-Day Optimal Posting Times Analysis
 *
 * For each platform, identify the single best posting time for each day of the week
 * Based on actual engagement data from GetLate Analytics
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

interface TimeSlotAnalysis {
  hour: number;
  timeLabel: string;
  postCount: number;
  avgViews: number;
  avgEngagement: number;
  engagementRate: number;
  totalViews: number;
  totalEngagement: number;
  confidence: 'high' | 'medium' | 'low';
}

interface DayTimeRecommendation {
  dayOfWeek: number;
  dayName: string;
  bestTime: TimeSlotAnalysis | null;
  allTimeSlots: TimeSlotAnalysis[];
}

interface PlatformSchedule {
  platform: string;
  schedule: DayTimeRecommendation[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'threads', 'linkedin', 'twitter', 'bluesky'];

function hasEngagementData(post: Post): boolean {
  const views = post.analytics.views || post.analytics.reach || post.analytics.impressions || 0;
  const engagement = (post.analytics.likes || 0) +
                    (post.analytics.comments || 0) +
                    (post.analytics.shares || 0) +
                    (post.analytics.saves || 0);
  return views > 0 || engagement > 0;
}

function getViews(post: Post): number {
  return post.analytics.views || post.analytics.reach || post.analytics.impressions || 0;
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

function getConfidence(postCount: number): 'high' | 'medium' | 'low' {
  if (postCount >= 5) return 'high';
  if (postCount >= 3) return 'medium';
  return 'low';
}

function analyzePlatformByDay(posts: Post[], platform: string): PlatformSchedule {
  const platformPosts = posts
    .filter(p => p.platform.toLowerCase() === platform.toLowerCase())
    .filter(hasEngagementData);

  const schedule: DayTimeRecommendation[] = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayPosts = platformPosts.filter(p => new Date(p.publishedAt).getDay() === dayOfWeek);

    if (dayPosts.length === 0) {
      schedule.push({
        dayOfWeek,
        dayName: DAYS[dayOfWeek],
        bestTime: null,
        allTimeSlots: []
      });
      continue;
    }

    // Group by hour
    const hourlyData: { [hour: number]: Post[] } = {};
    for (const post of dayPosts) {
      const hour = new Date(post.publishedAt).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(post);
    }

    // Calculate stats for each hour
    const timeSlots: TimeSlotAnalysis[] = [];
    for (const [hourStr, hourPosts] of Object.entries(hourlyData)) {
      const hour = parseInt(hourStr);
      const totalViews = hourPosts.reduce((sum, p) => sum + getViews(p), 0);
      const totalEngagement = hourPosts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
      const avgViews = totalViews / hourPosts.length;
      const avgEngagement = totalEngagement / hourPosts.length;
      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

      timeSlots.push({
        hour,
        timeLabel: formatHour(hour),
        postCount: hourPosts.length,
        avgViews,
        avgEngagement,
        engagementRate,
        totalViews,
        totalEngagement,
        confidence: getConfidence(hourPosts.length)
      });
    }

    // Sort by engagement rate, then by views as tiebreaker
    timeSlots.sort((a, b) => {
      if (Math.abs(a.engagementRate - b.engagementRate) > 0.01) {
        return b.engagementRate - a.engagementRate;
      }
      return b.avgViews - a.avgViews;
    });

    // Best time is the top slot, but prefer medium+ confidence
    let bestTime = timeSlots.find(s => s.confidence !== 'low') || timeSlots[0] || null;

    schedule.push({
      dayOfWeek,
      dayName: DAYS[dayOfWeek],
      bestTime,
      allTimeSlots: timeSlots
    });
  }

  return {
    platform,
    schedule
  };
}

function printSchedule(platformSchedule: PlatformSchedule) {
  console.log('\n' + '='.repeat(100));
  console.log(`📱 ${platformSchedule.platform.toUpperCase()} - OPTIMAL POSTING TIMES BY DAY`);
  console.log('='.repeat(100));

  for (const day of platformSchedule.schedule) {
    if (!day.bestTime) {
      console.log(`\n${day.dayName.padEnd(12)} - No data available`);
      continue;
    }

    const confidenceIcon = day.bestTime.confidence === 'high' ? '🟢' :
                          day.bestTime.confidence === 'medium' ? '🟡' : '🔴';

    console.log(`\n${day.dayName.padEnd(12)} - ${day.bestTime.timeLabel.padEnd(10)} ${confidenceIcon}`);
    console.log(`                 ${day.bestTime.engagementRate.toFixed(2)}% engagement | ${Math.round(day.bestTime.avgViews)} avg views | ${Math.round(day.bestTime.avgEngagement)} interactions | ${day.bestTime.postCount} posts`);

    // Show alternatives if available
    if (day.allTimeSlots.length > 1) {
      console.log(`                 Alternatives: ${day.allTimeSlots.slice(1, 3).map(s =>
        `${s.timeLabel} (${s.engagementRate.toFixed(2)}%)`
      ).join(', ')}`);
    }
  }
}

function generateConfigExport(schedules: PlatformSchedule[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('📅 DAY-BY-DAY CONFIGURATION EXPORT');
  console.log('='.repeat(100));
  console.log('\nOptimal posting hour for each platform on each day of the week:\n');

  console.log('export const PLATFORM_DAY_OPTIMAL_HOURS: Record<string, Record<string, number>> = {');

  for (const platformSchedule of schedules) {
    const hasData = platformSchedule.schedule.some(d => d.bestTime !== null);
    if (!hasData) continue;

    console.log(`  ${platformSchedule.platform.toLowerCase()}: {`);

    for (const day of platformSchedule.schedule) {
      if (day.bestTime) {
        console.log(`    ${day.dayName.toLowerCase()}: ${day.bestTime.hour}, // ${day.bestTime.timeLabel} (${day.bestTime.engagementRate.toFixed(2)}% engagement)`);
      }
    }

    console.log('  },');
  }

  console.log('};');
}

function generateWeeklyScheduleTable(schedules: PlatformSchedule[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 WEEKLY POSTING SCHEDULE - ALL PLATFORMS');
  console.log('='.repeat(100));
  console.log('\nBest posting time for each platform on each day:\n');

  // Header
  const platformNames = schedules.filter(s => s.schedule.some(d => d.bestTime !== null)).map(s => s.platform.toUpperCase());
  console.log('DAY'.padEnd(12) + ' | ' + platformNames.map(p => p.padEnd(15)).join(' | '));
  console.log('-'.repeat(12) + '-+-' + platformNames.map(() => '-'.repeat(15)).join('-+-'));

  // Rows for each day
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayName = DAYS[dayOfWeek];
    const times: string[] = [];

    for (const platformSchedule of schedules) {
      const hasData = platformSchedule.schedule.some(d => d.bestTime !== null);
      if (!hasData) continue;

      const dayData = platformSchedule.schedule.find(d => d.dayOfWeek === dayOfWeek);
      if (dayData && dayData.bestTime) {
        times.push(dayData.bestTime.timeLabel.padEnd(15));
      } else {
        times.push('No data'.padEnd(15));
      }
    }

    console.log(dayName.padEnd(12) + ' | ' + times.join(' | '));
  }
}

function generatePlatformSpecificSchedule(schedules: PlatformSchedule[]) {
  console.log('\n\n' + '='.repeat(100));
  console.log('🎯 PLATFORM-SPECIFIC WEEKLY SCHEDULES');
  console.log('='.repeat(100));
  console.log('\nIf posting 7 times per week (once per day), use these times:\n');

  for (const platformSchedule of schedules) {
    const hasData = platformSchedule.schedule.some(d => d.bestTime !== null);
    if (!hasData) continue;

    console.log(`\n${platformSchedule.platform.toUpperCase()}:`);

    for (const day of platformSchedule.schedule) {
      if (day.bestTime) {
        const confidenceIcon = day.bestTime.confidence === 'high' ? '🟢' :
                              day.bestTime.confidence === 'medium' ? '🟡' : '🔴';
        console.log(`  ${day.dayName}: ${day.bestTime.timeLabel} ${confidenceIcon}`);
      } else {
        console.log(`  ${day.dayName}: No data`);
      }
    }
  }
}

async function main() {
  console.log('🚀 Starting Day-by-Day Optimal Times Analysis\n');

  // Load data
  if (!fs.existsSync('./late-analytics-all.json')) {
    console.log('❌ late-analytics-all.json not found. Run fetch-late-analytics-comprehensive.ts first.');
    process.exit(1);
  }

  const posts: Post[] = JSON.parse(fs.readFileSync('./late-analytics-all.json', 'utf-8'));
  console.log(`📊 Loaded ${posts.length} posts\n`);

  const postsWithData = posts.filter(hasEngagementData);
  console.log(`✅ ${postsWithData.length} posts have engagement data\n`);

  // Analyze each platform
  const schedules: PlatformSchedule[] = [];

  for (const platform of PLATFORMS) {
    const schedule = analyzePlatformByDay(posts, platform);
    schedules.push(schedule);
    printSchedule(schedule);
  }

  // Generate various exports
  generateWeeklyScheduleTable(schedules);
  generatePlatformSpecificSchedule(schedules);
  generateConfigExport(schedules);

  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}

main();
