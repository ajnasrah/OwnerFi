/**
 * Fetch Analytics from Late.dev API
 * Pull all historical post analytics to analyze optimal posting times
 */

const LATE_API_KEY = process.env.LATE_API_KEY;

if (!LATE_API_KEY) {
  throw new Error('LATE_API_KEY not configured');
}

interface Analytics {
  postId: string;
  platform: string;
  publishedAt: string;
  scheduledFor: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  engagementRate?: number;
  [key: string]: any;
}

async function fetchAllAnalytics(): Promise<Analytics[]> {
  console.log('📊 Fetching analytics from Late.dev API...\n');

  const allAnalytics: Analytics[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    console.log(`  Fetching page ${page}...`);

    try {
      const response = await fetch(
        `https://getlate.dev/api/v1/analytics?limit=${limit}&page=${page}&sortBy=date&order=desc`,
        {
          headers: {
            'Authorization': `Bearer ${LATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Check rate limit headers
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');

      console.log(`    Rate limit remaining: ${rateLimitRemaining}`);

      if (!response.ok) {
        if (response.status === 402) {
          console.error('\\n❌ Analytics addon not enabled on Late.dev account');
          console.error('   Visit https://getlate.dev to enable analytics\\n');
          break;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        console.log('    No more data');
        break;
      }

      console.log(`    Got ${data.data.length} records`);
      allAnalytics.push(...data.data);

      // Check if there are more pages
      if (data.data.length < limit) {
        console.log('    Last page reached');
        break;
      }

      page++;

      // Respect rate limits - wait 2 seconds between requests
      if (rateLimitRemaining && parseInt(rateLimitRemaining) < 5) {
        console.log(`    ⏳ Low rate limit, waiting 10s...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`\\n❌ Error fetching page ${page}:`, error);
      break;
    }
  }

  console.log(`\\n✅ Fetched ${allAnalytics.length} total analytics records\\n`);
  return allAnalytics;
}

async function main() {
  const analytics = await fetchAllAnalytics();

  if (analytics.length === 0) {
    console.log('❌ No analytics data found');
    process.exit(1);
  }

  // Print summary
  console.log('📊 ANALYTICS SUMMARY\\n');

  const platforms = [...new Set(analytics.map(a => a.platform))];
  console.log(`Platforms: ${platforms.join(', ')}\\n`);

  for (const platform of platforms) {
    const platformData = analytics.filter(a => a.platform === platform);
    const totalViews = platformData.reduce((sum, a) => sum + (a.views || 0), 0);
    const totalLikes = platformData.reduce((sum, a) => sum + (a.likes || 0), 0);
    const totalComments = platformData.reduce((sum, a) => sum + (a.comments || 0), 0);
    const avgEngagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : '0.00';

    console.log(`${platform}: ${platformData.length} posts, ${totalViews} views, ${avgEngagement}% engagement`);
  }

  // Save to file
  const fs = await import('fs');
  const outputPath = './late-analytics-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(analytics, null, 2));
  console.log(`\\n✅ Saved to ${outputPath}\\n`);

  // Show sample record
  console.log('Sample record:');
  console.log(JSON.stringify(analytics[0], null, 2));

  process.exit(0);
}

main();
