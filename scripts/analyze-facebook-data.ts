/**
 * Facebook Analytics Deep Dive
 *
 * Analyze the 26 Facebook posts that have engagement data
 * to understand posting patterns despite missing view counts
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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getTotalEngagement(post: Post): number {
  return (post.analytics.likes || 0) +
         (post.analytics.comments || 0) +
         (post.analytics.shares || 0) +
         (post.analytics.saves || 0);
}

function main() {
  console.log('🔍 Facebook Analytics Deep Dive\n');
  console.log('='.repeat(100));

  // Load data
  const posts: Post[] = JSON.parse(fs.readFileSync('./late-analytics-all.json', 'utf-8'));

  const facebookPosts = posts.filter(p => p.platform.toLowerCase() === 'facebook');
  const postsWithEngagement = facebookPosts.filter(p => getTotalEngagement(p) > 0);

  console.log(`\n📊 FACEBOOK DATA OVERVIEW`);
  console.log('-'.repeat(100));
  console.log(`Total Facebook posts: ${facebookPosts.length}`);
  console.log(`Posts with engagement data: ${postsWithEngagement.length} (${((postsWithEngagement.length / facebookPosts.length) * 100).toFixed(1)}%)`);
  console.log(`Posts with zero engagement: ${facebookPosts.length - postsWithEngagement.length}`);

  // Analyze view data issue
  const postsWithViews = facebookPosts.filter(p => (p.analytics.views || 0) > 0);
  const postsWithReach = facebookPosts.filter(p => (p.analytics.reach || 0) > 0);
  const postsWithImpressions = facebookPosts.filter(p => (p.analytics.impressions || 0) > 0);

  console.log(`\nPosts with views: ${postsWithViews.length}`);
  console.log(`Posts with reach: ${postsWithReach.length}`);
  console.log(`Posts with impressions: ${postsWithImpressions.length}`);

  console.log('\n⚠️  ISSUE IDENTIFIED: Facebook posts have engagement (likes/comments/shares) but no view/reach/impression data');
  console.log('This suggests the GetLate API is not receiving viewership metrics from Facebook.\n');

  if (postsWithEngagement.length === 0) {
    console.log('❌ No engagement data to analyze');
    process.exit(1);
  }

  // Group by hour and day
  const hourlyData: { [hour: number]: Post[] } = {};
  const dailyData: { [day: number]: Post[] } = {};

  for (const post of postsWithEngagement) {
    const date = new Date(post.publishedAt);
    const hour = date.getHours();
    const day = date.getDay();

    if (!hourlyData[hour]) hourlyData[hour] = [];
    if (!dailyData[day]) dailyData[day] = [];

    hourlyData[hour].push(post);
    dailyData[day].push(post);
  }

  // Analyze by hour
  console.log('\n📅 ENGAGEMENT BY HOUR (based on likes + comments + shares)');
  console.log('-'.repeat(100));

  const hourlyStats = Object.entries(hourlyData)
    .map(([hour, posts]) => {
      const totalEngagement = posts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
      const avgEngagement = totalEngagement / posts.length;
      const avgLikes = posts.reduce((sum, p) => sum + (p.analytics.likes || 0), 0) / posts.length;
      const avgComments = posts.reduce((sum, p) => sum + (p.analytics.comments || 0), 0) / posts.length;
      const avgShares = posts.reduce((sum, p) => sum + (p.analytics.shares || 0), 0) / posts.length;

      return {
        hour: parseInt(hour),
        postCount: posts.length,
        avgEngagement,
        avgLikes,
        avgComments,
        avgShares,
        totalEngagement
      };
    })
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  console.log('\nTop 5 Hours by Engagement:');
  for (let i = 0; i < Math.min(5, hourlyStats.length); i++) {
    const stat = hourlyStats[i];
    const period = stat.hour >= 12 ? 'PM' : 'AM';
    const displayHour = stat.hour === 0 ? 12 : stat.hour > 12 ? stat.hour - 12 : stat.hour;
    const timeLabel = `${displayHour}:00 ${period}`;

    console.log(`  ${i + 1}. ${timeLabel.padEnd(10)} - ${stat.avgEngagement.toFixed(2)} avg interactions (${stat.avgLikes.toFixed(1)} likes, ${stat.avgComments.toFixed(1)} comments, ${stat.avgShares.toFixed(1)} shares) | ${stat.postCount} posts`);
  }

  // Analyze by day
  console.log('\n\n📅 ENGAGEMENT BY DAY OF WEEK');
  console.log('-'.repeat(100));

  const dailyStats = Object.entries(dailyData)
    .map(([day, posts]) => {
      const totalEngagement = posts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
      const avgEngagement = totalEngagement / posts.length;
      const avgLikes = posts.reduce((sum, p) => sum + (p.analytics.likes || 0), 0) / posts.length;
      const avgComments = posts.reduce((sum, p) => sum + (p.analytics.comments || 0), 0) / posts.length;
      const avgShares = posts.reduce((sum, p) => sum + (p.analytics.shares || 0), 0) / posts.length;

      return {
        day: parseInt(day),
        dayName: DAYS[parseInt(day)],
        postCount: posts.length,
        avgEngagement,
        avgLikes,
        avgComments,
        avgShares,
        totalEngagement
      };
    })
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  console.log('\nRanked by Average Engagement:');
  for (const stat of dailyStats) {
    console.log(`  ${stat.dayName.padEnd(12)} - ${stat.avgEngagement.toFixed(2)} avg interactions (${stat.avgLikes.toFixed(1)} likes, ${stat.avgComments.toFixed(1)} comments, ${stat.avgShares.toFixed(1)} shares) | ${stat.postCount} posts`);
  }

  // Day + Hour combinations
  console.log('\n\n📅 BEST TIME BY DAY OF WEEK');
  console.log('-'.repeat(100));

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayPosts = postsWithEngagement.filter(p => new Date(p.publishedAt).getDay() === dayOfWeek);

    if (dayPosts.length === 0) {
      console.log(`\n${DAYS[dayOfWeek]}: No data`);
      continue;
    }

    // Group by hour for this day
    const dayHourlyData: { [hour: number]: Post[] } = {};
    for (const post of dayPosts) {
      const hour = new Date(post.publishedAt).getHours();
      if (!dayHourlyData[hour]) dayHourlyData[hour] = [];
      dayHourlyData[hour].push(post);
    }

    const dayHourlyStats = Object.entries(dayHourlyData)
      .map(([hour, posts]) => {
        const totalEngagement = posts.reduce((sum, p) => sum + getTotalEngagement(p), 0);
        return {
          hour: parseInt(hour),
          postCount: posts.length,
          avgEngagement: totalEngagement / posts.length,
          totalEngagement
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    const best = dayHourlyStats[0];
    const period = best.hour >= 12 ? 'PM' : 'AM';
    const displayHour = best.hour === 0 ? 12 : best.hour > 12 ? best.hour - 12 : best.hour;
    const timeLabel = `${displayHour}:00 ${period}`;

    console.log(`\n${DAYS[dayOfWeek].padEnd(12)} - ${timeLabel.padEnd(10)} (${best.avgEngagement.toFixed(2)} avg interactions, ${best.postCount} posts)`);

    if (dayHourlyStats.length > 1) {
      console.log(`              Alternatives: ${dayHourlyStats.slice(1, 3).map(s => {
        const p = s.hour >= 12 ? 'PM' : 'AM';
        const h = s.hour === 0 ? 12 : s.hour > 12 ? s.hour - 12 : s.hour;
        return `${h}:00 ${p} (${s.avgEngagement.toFixed(2)})`;
      }).join(', ')}`);
    }
  }

  // Summary recommendations
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 FACEBOOK RECOMMENDATIONS (BASED ON ENGAGEMENT ONLY)');
  console.log('='.repeat(100));

  console.log('\n⚠️  IMPORTANT LIMITATIONS:');
  console.log('- Facebook analytics do NOT include view/reach/impression data');
  console.log('- Only 26 out of 432 posts (6%) have any engagement data');
  console.log('- Recommendations are based solely on likes + comments + shares');
  console.log('- This data is NOT reliable for making posting time decisions');

  console.log('\n🎯 TOP 3 TIMES (based on limited data):');
  for (let i = 0; i < Math.min(3, hourlyStats.length); i++) {
    const stat = hourlyStats[i];
    const period = stat.hour >= 12 ? 'PM' : 'AM';
    const displayHour = stat.hour === 0 ? 12 : stat.hour > 12 ? stat.hour - 12 : stat.hour;
    console.log(`  ${i + 1}. ${displayHour}:00 ${period} (${stat.avgEngagement.toFixed(2)} avg interactions, ${stat.postCount} posts)`);
  }

  console.log('\n🚨 ACTION REQUIRED:');
  console.log('1. Investigate why Facebook view/reach/impression data is missing from GetLate API');
  console.log('2. Check Facebook Graph API integration and permissions');
  console.log('3. Verify Facebook Page access token has required permissions (pages_read_engagement, pages_show_list)');
  console.log('4. Consider using Facebook native analytics (Meta Business Suite) for accurate data');
  console.log('5. Contact GetLate support to understand Facebook analytics limitations\n');

  // Export config anyway
  console.log('\n💾 CONFIGURATION EXPORT (USE WITH CAUTION):');
  console.log('\nfacebook: {');
  for (const stat of dailyStats) {
    const dayPosts = postsWithEngagement.filter(p => new Date(p.publishedAt).getDay() === stat.day);
    const dayHourly: { [hour: number]: Post[] } = {};
    for (const post of dayPosts) {
      const hour = new Date(post.publishedAt).getHours();
      if (!dayHourly[hour]) dayHourly[hour] = [];
      dayHourly[hour].push(post);
    }
    const bestHour = Object.entries(dayHourly)
      .map(([hour, posts]) => ({
        hour: parseInt(hour),
        engagement: posts.reduce((sum, p) => sum + getTotalEngagement(p), 0) / posts.length
      }))
      .sort((a, b) => b.engagement - a.engagement)[0];

    if (bestHour) {
      console.log(`  ${stat.dayName.toLowerCase()}: ${bestHour.hour}, // ${stat.avgEngagement.toFixed(2)} avg interactions`);
    }
  }
  console.log('},\n');

  process.exit(0);
}

main();
