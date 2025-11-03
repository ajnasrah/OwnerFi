/**
 * Fetch ALL Analytics from Late.dev API
 * Analyze best posting HOUR for each platform for each DAY OF WEEK
 *
 * Goal: Find optimal hour to post on each platform for Monday, Tuesday, etc.
 * So all platforms can post SAME VIDEO on SAME DAY at different optimal hours
 */

const LATE_API_KEY = process.env.LATE_API_KEY;

if (!LATE_API_KEY) {
  throw new Error('LATE_API_KEY not configured');
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

async function fetchAllAnalytics(): Promise<Post[]> {
  console.log('📊 Fetching ALL analytics from Late.dev API (1060 posts)...\n');

  const allPosts: Post[] = [];
  let page = 1;
  const limit = 50;
  const totalPages = 212; // 1060 / 50 = ~21 pages, but API said 212

  while (page <= totalPages) {
    console.log(`  Fetching page ${page}/${totalPages}...`);

    try {
      const response = await fetch(
        `https://getlate.dev/api/v1/analytics?limit=${limit}&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${LATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error(`\n❌ API error: ${response.status} ${response.statusText}`);
        break;
      }

      const data = await response.json();

      if (!data.posts || data.posts.length === 0) {
        console.log('    No more data');
        break;
      }

      console.log(`    Got ${data.posts.length} posts`);

      // Extract posts with platform-level analytics
      for (const post of data.posts) {
        allPosts.push({
          platform: post.platform,
          publishedAt: post.publishedAt,
          analytics: {
            views: post.analytics?.views || 0,
            likes: post.analytics?.likes || 0,
            comments: post.analytics?.comments || 0,
            shares: post.analytics?.shares || 0,
            saves: post.analytics?.saves || 0,
            impressions: post.analytics?.impressions || 0,
            reach: post.analytics?.reach || 0
          }
        });
      }

      // Check if we've reached the last page
      if (!data.pagination || page >= data.pagination.pages) {
        console.log('    Last page reached');
        break;
      }

      page++;

      // Rate limit: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`\n❌ Error fetching page ${page}:`, error);
      break;
    }
  }

  console.log(`\n✅ Fetched ${allPosts.length} total posts\n`);
  return allPosts;
}

function analyzePosts(posts: Post[]) {
  console.log('='.repeat(80));
  console.log('📊 ANALYZING OPTIMAL POSTING HOURS PER PLATFORM PER DAY\n');

  const platforms = [...new Set(posts.map(p => p.platform))];

  for (const platform of platforms) {
    const platformPosts = posts.filter(p => p.platform === platform);

    // Filter posts with engagement data
    const postsWithData = platformPosts.filter(p => {
      const views = p.analytics.views || p.analytics.impressions || 0;
      const engagement = (p.analytics.likes || 0) + (p.analytics.comments || 0) + (p.analytics.shares || 0);
      return views > 0 || engagement > 0;
    });

    console.log(`\n📱 ${platform.toUpperCase()}`);
    console.log(`   Total posts: ${platformPosts.length}`);
    console.log(`   Posts with data: ${postsWithData.length}`);
    console.log('-'.repeat(80));

    if (postsWithData.length === 0) {
      console.log('   ⚠️  No engagement data available for this platform\n');
      continue;
    }

    // Group by day of week and hour
    const byDayAndHour: Record<string, Record<number, Post[]>> = {};

    for (const post of postsWithData) {
      const date = new Date(post.publishedAt);
      const dayOfWeek = date.getDay();
      const dayName = DAYS[dayOfWeek];
      const hour = date.getHours();

      if (!byDayAndHour[dayName]) byDayAndHour[dayName] = {};
      if (!byDayAndHour[dayName][hour]) byDayAndHour[dayName][hour] = [];

      byDayAndHour[dayName][hour].push(post);
    }

    // Find best hour for each day
    console.log('\n   📅 BEST HOUR FOR EACH DAY:\n');

    for (const dayName of DAYS) {
      if (!byDayAndHour[dayName]) {
        console.log(`   ${dayName}: No data`);
        continue;
      }

      const hours = byDayAndHour[dayName];
      const hourlyStats = Object.entries(hours).map(([hour, posts]) => {
        const totalViews = posts.reduce((sum, p) => sum + (p.analytics.views || p.analytics.impressions || 0), 0);
        const totalEngagement = posts.reduce((sum, p) =>
          sum + (p.analytics.likes || 0) + (p.analytics.comments || 0) + (p.analytics.shares || 0) + (p.analytics.saves || 0)
        , 0);
        const engagementRate = totalViews > 0 ? (totalEngagement / totalViews * 100) : 0;

        return {
          hour: parseInt(hour),
          count: posts.length,
          totalViews,
          totalEngagement,
          engagementRate,
          avgViews: totalViews / posts.length,
          avgEngagement: totalEngagement / posts.length
        };
      });

      // Sort by engagement rate (best indicator of performance)
      hourlyStats.sort((a, b) => b.engagementRate - a.engagementRate);

      const best = hourlyStats[0];
      if (best && best.count >= 2) { // Need at least 2 posts for confidence
        const time = `${best.hour % 12 || 12}:00 ${best.hour >= 12 ? 'PM' : 'AM'}`;
        console.log(`   ${dayName.padEnd(10)} ${time.padEnd(9)} - ${best.engagementRate.toFixed(2)}% engagement (${best.count} posts, ${Math.round(best.avgViews)} avg views)`);
      } else if (best) {
        const time = `${best.hour % 12 || 12}:00 ${best.hour >= 12 ? 'PM' : 'AM'}`;
        console.log(`   ${dayName.padEnd(10)} ${time.padEnd(9)} - ${best.engagementRate.toFixed(2)}% engagement (only ${best.count} post - low confidence)`);
      } else {
        console.log(`   ${dayName.padEnd(10)} No data`);
      }
    }

    console.log();
  }

  console.log('='.repeat(80));
  console.log('\n✅ Analysis Complete\n');
}

async function main() {
  const posts = await fetchAllAnalytics();

  if (posts.length === 0) {
    console.log('❌ No posts found');
    process.exit(1);
  }

  // Save raw data
  const fs = await import('fs');
  fs.writeFileSync('./late-analytics-all.json', JSON.stringify(posts, null, 2));
  console.log('💾 Saved raw data to late-analytics-all.json\n');

  // Analyze
  analyzePosts(posts);

  process.exit(0);
}

main();
