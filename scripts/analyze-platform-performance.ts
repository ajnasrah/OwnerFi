/**
 * Analyze Late.dev post performance to determine optimal posting times per platform
 *
 * This script:
 * 1. Fetches all completed posts from Late.dev
 * 2. Groups by platform
 * 3. Analyzes engagement metrics by hour of day
 * 4. Determines top 3 performing hours for each platform
 */

const LATE_API_KEY = process.env.LATE_API_KEY;

interface PostMetrics {
  postId: string;
  platform: string;
  scheduledTime: string;
  hourCST: number;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  engagementRate?: number;
}

async function analyzePlatformPerformance() {
  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not set');
    process.exit(1);
  }

  console.log('📊 Analyzing Late.dev Post Performance by Platform\n');

  // Step 1: Fetch all posts
  console.log('🔍 Fetching posts from Late.dev...');

  try {
    const response = await fetch('https://getlate.dev/api/v1/posts?limit=500', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      process.exit(1);
    }

    const data = await response.json();
    const posts = Array.isArray(data) ? data : (data.posts || data.data || []);

    console.log(`   Found ${posts.length} posts\n`);

    // Step 2: Process posts by platform
    const platformMetrics: Record<string, PostMetrics[]> = {};

    for (const post of posts) {
      // Skip posts without schedule time or platform info
      if (!post.scheduledTime && !post.publishedAt) continue;

      const platforms = post.platforms || [];
      const scheduledTime = post.scheduledTime || post.publishedAt;

      // Convert to CST and extract hour
      const date = new Date(scheduledTime);
      const hourCST = parseInt(date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        hour12: false
      }));

      // Get engagement metrics
      const metrics = post.metrics || post.analytics || {};
      const likes = metrics.likes || 0;
      const comments = metrics.comments || 0;
      const shares = metrics.shares || 0;
      const views = metrics.views || metrics.impressions || 0;

      // Calculate engagement rate
      const totalEngagement = likes + (comments * 2) + (shares * 3); // Weighted
      const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

      // Add to each platform's metrics
      for (const platform of platforms) {
        const platformName = platform.platform || platform;

        if (!platformMetrics[platformName]) {
          platformMetrics[platformName] = [];
        }

        platformMetrics[platformName].push({
          postId: post._id || post.id,
          platform: platformName,
          scheduledTime,
          hourCST,
          likes,
          comments,
          shares,
          views,
          engagementRate,
        });
      }
    }

    // Step 3: Analyze by platform and hour
    console.log('📈 Performance Analysis by Platform:\n');

    const platformSchedules: Record<string, number[]> = {};

    for (const [platform, metrics] of Object.entries(platformMetrics)) {
      console.log(`\n${platform.toUpperCase()}:`);
      console.log(`   Total posts: ${metrics.length}`);

      if (metrics.length === 0) continue;

      // Group by hour
      const hourlyStats: Record<number, {
        count: number;
        totalEngagement: number;
        avgEngagementRate: number;
        totalViews: number;
      }> = {};

      for (const metric of metrics) {
        if (!hourlyStats[metric.hourCST]) {
          hourlyStats[metric.hourCST] = {
            count: 0,
            totalEngagement: 0,
            avgEngagementRate: 0,
            totalViews: 0,
          };
        }

        const stats = hourlyStats[metric.hourCST];
        stats.count++;
        stats.totalEngagement += (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0);
        stats.avgEngagementRate += (metric.engagementRate || 0);
        stats.totalViews += (metric.views || 0);
      }

      // Calculate averages
      for (const hour in hourlyStats) {
        const stats = hourlyStats[hour];
        stats.avgEngagementRate = stats.avgEngagementRate / stats.count;
      }

      // Sort by engagement rate
      const sortedHours = Object.entries(hourlyStats)
        .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate)
        .slice(0, 10); // Top 10

      console.log('\n   Top performing hours (CST):');
      sortedHours.forEach(([hour, stats], index) => {
        const ampm = parseInt(hour) >= 12 ? 'PM' : 'AM';
        const displayHour = parseInt(hour) > 12 ? parseInt(hour) - 12 : (parseInt(hour) === 0 ? 12 : parseInt(hour));
        console.log(`   ${index + 1}. ${displayHour} ${ampm} - ${stats.count} posts, ${stats.avgEngagementRate.toFixed(2)}% engagement rate`);
      });

      // Get top 3 hours
      const top3Hours = sortedHours.slice(0, 3).map(([hour]) => parseInt(hour));
      platformSchedules[platform] = top3Hours;

      console.log(`\n   📅 Recommended schedule: ${top3Hours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${displayHour} ${ampm}`;
      }).join(', ')}`);
    }

    // Step 4: Generate configuration
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 PLATFORM SCHEDULING CONFIGURATION');
    console.log('='.repeat(80) + '\n');

    console.log('export const PLATFORM_OPTIMAL_HOURS: Record<string, number[]> = {');
    for (const [platform, hours] of Object.entries(platformSchedules)) {
      console.log(`  ${platform}: [${hours.join(', ')}], // ${hours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${displayHour} ${ampm}`;
      }).join(', ')} CST`);
    }
    console.log('};\n');

    // Step 5: Group platforms with similar schedules
    console.log('\n📊 Platform Groups with Similar Peak Times:\n');

    const scheduleGroups: Record<string, string[]> = {};
    for (const [platform, hours] of Object.entries(platformSchedules)) {
      const key = hours.join(',');
      if (!scheduleGroups[key]) {
        scheduleGroups[key] = [];
      }
      scheduleGroups[key].push(platform);
    }

    for (const [schedule, platforms] of Object.entries(scheduleGroups)) {
      const hours = schedule.split(',').map(h => parseInt(h));
      const timeStr = hours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${displayHour} ${ampm}`;
      }).join(', ');

      console.log(`${timeStr}: ${platforms.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

analyzePlatformPerformance().catch(console.error);
