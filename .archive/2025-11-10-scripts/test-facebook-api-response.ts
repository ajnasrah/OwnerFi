/**
 * Test Facebook Analytics API Response
 *
 * Fetch raw response from GetLate to see actual structure
 */

const LATE_API_KEY = process.env.LATE_API_KEY;

if (!LATE_API_KEY) {
  throw new Error('LATE_API_KEY not configured');
}

async function testFacebookAnalytics() {
  console.log('🔍 Testing Facebook Analytics API Response\n');
  console.log('='.repeat(100));

  try {
    // Fetch just Facebook posts
    console.log('\n📡 Fetching Facebook analytics from GetLate API...\n');

    const response = await fetch(
      'https://getlate.dev/api/v1/analytics?platform=facebook&limit=5&sortBy=engagement&order=desc',
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`\nResponse Headers:`);
    console.log(`  X-RateLimit-Limit: ${response.headers.get('X-RateLimit-Limit')}`);
    console.log(`  X-RateLimit-Remaining: ${response.headers.get('X-RateLimit-Remaining')}`);
    console.log(`  X-RateLimit-Reset: ${response.headers.get('X-RateLimit-Reset')}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`\n❌ Error Response:`);
      console.log(errorText);

      if (response.status === 402) {
        console.log('\n🚨 HTTP 402: Analytics add-on required!');
        console.log('This account may not have the Analytics add-on enabled.');
      }

      process.exit(1);
    }

    const data = await response.json();

    console.log('\n📊 RAW API RESPONSE STRUCTURE:\n');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n\n📋 RESPONSE ANALYSIS:\n');
    console.log(`Total posts returned: ${data.posts?.length || 0}`);

    if (data.overview) {
      console.log('\nOverview data:');
      console.log(JSON.stringify(data.overview, null, 2));
    }

    if (data.pagination) {
      console.log('\nPagination data:');
      console.log(JSON.stringify(data.pagination, null, 2));
    }

    if (data.posts && data.posts.length > 0) {
      console.log('\n\n🔍 FIRST POST DETAILED STRUCTURE:\n');
      const firstPost = data.posts[0];
      console.log(JSON.stringify(firstPost, null, 2));

      console.log('\n\n📊 ANALYTICS FIELD STRUCTURE:\n');
      if (firstPost.analytics) {
        console.log('Post-level analytics:', JSON.stringify(firstPost.analytics, null, 2));
      }

      if (firstPost.platforms) {
        console.log('\n\nPlatform-specific analytics:');
        for (const platform of firstPost.platforms) {
          console.log(`\n${platform.platform}:`);
          console.log(JSON.stringify(platform.analytics, null, 2));
        }
      }

      // Check all posts for any non-zero values
      console.log('\n\n📈 CHECKING FOR NON-ZERO VALUES:\n');

      const metrics = ['views', 'reach', 'impressions', 'likes', 'comments', 'shares'];
      for (const metric of metrics) {
        const postsWithMetric = data.posts.filter((p: any) => {
          // Check both post.analytics and post.platforms[].analytics
          const postLevel = p.analytics?.[metric] || 0;
          const platformLevel = p.platforms?.some((pl: any) => (pl.analytics?.[metric] || 0) > 0);
          return postLevel > 0 || platformLevel;
        });

        console.log(`${metric}: ${postsWithMetric.length}/${data.posts.length} posts have data`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testFacebookAnalytics();
