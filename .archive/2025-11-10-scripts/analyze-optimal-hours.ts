/**
 * Analyze Late.dev analytics to determine top 3 performing hours per platform
 *
 * Fetches all historical post analytics and groups by:
 * 1. Platform
 * 2. Hour of day (in CST)
 * 3. Calculates engagement metrics
 * 4. Outputs top 3 hours for each platform
 */

const LATE_API_KEY = process.env.LATE_API_KEY;

interface AnalyticsEntry {
  postId: string;
  platform: string;
  publishedAt: string;
  hourCST: number;
  metrics: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    impressions?: number;
    engagementRate?: number;
    [key: string]: any;
  };
}

interface HourlyStats {
  hour: number;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews: number;
  avgEngagementRate: number;
  totalEngagement: number;
}

async function fetchAllAnalytics(): Promise<any[]> {
  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not set');
    process.exit(1);
  }

  const allAnalytics: any[] = [];
  let page = 1;
  const limit = 100;

  // Fetch last 90 days
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  console.log('📊 Fetching analytics from Late.dev...');
  console.log(`   Date range: ${fromDateStr} to now`);
  console.log(`   Rate limit: 30 requests/hour\n`);

  while (true) {
    const url = `https://getlate.dev/api/v1/analytics?fromDate=${fromDateStr}&limit=${limit}&page=${page}&sortBy=date&order=desc`;

    console.log(`   Fetching page ${page}...`);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      // Check rate limits
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');

      console.log(`      Rate limit remaining: ${rateLimitRemaining || 'N/A'}`);

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 402) {
          console.error('\n❌ Analytics add-on not enabled on your Late.dev account');
          console.error('   Visit https://getlate.dev to enable analytics');
          process.exit(1);
        }

        console.error(`\n❌ API Error (${response.status}): ${errorText}`);
        break;
      }

      const data = await response.json();

      // Handle different response structures
      const analytics = Array.isArray(data)
        ? data
        : (data.analytics || data.data || data.items || []);

      if (analytics.length === 0) {
        console.log('      No more data\n');
        break;
      }

      allAnalytics.push(...analytics);
      console.log(`      Fetched ${analytics.length} records (total: ${allAnalytics.length})`);

      // Check if we should continue
      if (analytics.length < limit) {
        console.log('      Last page reached\n');
        break;
      }

      page++;

      // Rate limit safety - wait if we're running low
      if (rateLimitRemaining && parseInt(rateLimitRemaining) < 5) {
        console.log('\n⚠️  Approaching rate limit, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }

    } catch (error) {
      console.error(`\n❌ Error fetching page ${page}:`, error instanceof Error ? error.message : 'Unknown');
      break;
    }
  }

  return allAnalytics;
}

async function analyzeOptimalHours() {
  console.log('=' .repeat(80));
  console.log('LATE.DEV ANALYTICS - OPTIMAL POSTING HOURS ANALYSIS');
  console.log('='.repeat(80) + '\n');

  const analytics = await fetchAllAnalytics();

  if (analytics.length === 0) {
    console.log('❌ No analytics data found');
    console.log('\nPossible reasons:');
    console.log('  - Analytics add-on not enabled (requires payment)');
    console.log('  - No posts have been published yet');
    console.log('  - Posts too recent (analytics need 24-48h to populate)');
    process.exit(0);
  }

  console.log(`✅ Fetched ${analytics.length} total analytics records\n`);

  // Log first entry to understand structure
  console.log('📋 Sample Analytics Entry:');
  console.log(JSON.stringify(analytics[0], null, 2));
  console.log('\n' + '='.repeat(80) + '\n');

  // Process analytics by platform
  const platformData: Record<string, AnalyticsEntry[]> = {};

  for (const entry of analytics) {
    // Extract platform - handle different possible structures
    const platform = entry.platform || entry.platformName || entry.account?.platform;
    if (!platform) continue;

    // Extract published time
    const publishedAt = entry.publishedAt || entry.scheduledTime || entry.createdAt;
    if (!publishedAt) continue;

    // Convert to CST and get hour
    const date = new Date(publishedAt);
    const hourCST = parseInt(date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hour12: false
    }));

    // Extract metrics - handle different possible structures
    const metrics = entry.metrics || entry.analytics || entry.stats || {};

    if (!platformData[platform]) {
      platformData[platform] = [];
    }

    platformData[platform].push({
      postId: entry._id || entry.id || entry.postId,
      platform,
      publishedAt,
      hourCST,
      metrics,
    });
  }

  console.log(`📊 Platforms found: ${Object.keys(platformData).join(', ')}\n`);
  console.log('='.repeat(80) + '\n');

  // Analyze each platform
  const platformSchedules: Record<string, number[]> = {};

  for (const [platform, entries] of Object.entries(platformData)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${platform.toUpperCase()} - ${entries.length} posts`);
    console.log('='.repeat(80) + '\n');

    // Group by hour
    const hourlyStats: Record<number, HourlyStats> = {};

    for (const entry of entries) {
      const hour = entry.hourCST;

      if (!hourlyStats[hour]) {
        hourlyStats[hour] = {
          hour,
          postCount: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalViews: 0,
          avgEngagementRate: 0,
          totalEngagement: 0,
        };
      }

      const stats = hourlyStats[hour];
      stats.postCount++;

      // Extract metrics - try multiple field names
      const likes = entry.metrics.likes || entry.metrics.likeCount || 0;
      const comments = entry.metrics.comments || entry.metrics.commentCount || 0;
      const shares = entry.metrics.shares || entry.metrics.shareCount || entry.metrics.retweets || 0;
      const views = entry.metrics.views || entry.metrics.impressions || entry.metrics.reach || 0;

      stats.totalLikes += likes;
      stats.totalComments += comments;
      stats.totalShares += shares;
      stats.totalViews += views;

      // Calculate weighted engagement
      const engagement = likes + (comments * 2) + (shares * 3);
      stats.totalEngagement += engagement;

      if (views > 0) {
        stats.avgEngagementRate += (engagement / views) * 100;
      }
    }

    // Calculate averages
    for (const stats of Object.values(hourlyStats)) {
      if (stats.postCount > 0) {
        stats.avgEngagementRate = stats.avgEngagementRate / stats.postCount;
      }
    }

    // Sort by total engagement
    const sortedHours = Object.values(hourlyStats)
      .filter(stats => stats.postCount >= 2) // Only include hours with 2+ posts for statistical significance
      .sort((a, b) => b.totalEngagement - a.totalEngagement);

    console.log('All Hours Performance:\n');
    console.log('Hour | Posts | Likes | Comments | Shares | Views | Engagement | Eng Rate');
    console.log('-'.repeat(80));

    for (const stats of sortedHours) {
      const hour = stats.hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);

      console.log(
        `${String(displayHour).padStart(2)} ${ampm} | ` +
        `${String(stats.postCount).padStart(5)} | ` +
        `${String(stats.totalLikes).padStart(5)} | ` +
        `${String(stats.totalComments).padStart(8)} | ` +
        `${String(stats.totalShares).padStart(6)} | ` +
        `${String(stats.totalViews).padStart(5)} | ` +
        `${String(stats.totalEngagement).padStart(10)} | ` +
        `${stats.avgEngagementRate.toFixed(2)}%`
      );
    }

    // Get top 3 hours
    const top3 = sortedHours.slice(0, 3);
    const top3Hours = top3.map(s => s.hour);

    platformSchedules[platform] = top3Hours;

    console.log(`\n📅 TOP 3 OPTIMAL HOURS:`);
    top3.forEach((stats, i) => {
      const hour = stats.hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      console.log(`   ${i + 1}. ${displayHour} ${ampm} CST - ${stats.postCount} posts, ${stats.totalEngagement} total engagement`);
    });
  }

  // Generate TypeScript config
  console.log('\n\n' + '='.repeat(80));
  console.log('TYPESCRIPT CONFIGURATION');
  console.log('='.repeat(80) + '\n');

  console.log('export const PLATFORM_OPTIMAL_HOURS: Record<string, number[]> = {');
  for (const [platform, hours] of Object.entries(platformSchedules)) {
    const timesStr = hours.map(h => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour} ${ampm}`;
    }).join(', ');

    console.log(`  ${platform}: [${hours.join(', ')}], // ${timesStr} CST`);
  }
  console.log('};\n');

  console.log('='.repeat(80));
}

analyzeOptimalHours().catch(console.error);
