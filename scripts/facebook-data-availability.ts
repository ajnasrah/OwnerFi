/**
 * Facebook Data Availability Analysis
 *
 * Check what data GetLate actually provides for Facebook posts
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

function main() {
  console.log('🔍 Facebook Data Availability Analysis\n');
  console.log('='.repeat(100));

  const posts: Post[] = JSON.parse(fs.readFileSync('./late-analytics-all.json', 'utf-8'));
  const facebookPosts = posts.filter(p => p.platform.toLowerCase() === 'facebook');

  console.log(`\n📊 TOTAL FACEBOOK POSTS: ${facebookPosts.length}\n`);

  // Check each field
  const fields = ['views', 'reach', 'impressions', 'likes', 'comments', 'shares', 'saves'];

  console.log('FIELD AVAILABILITY:');
  console.log('-'.repeat(100));

  for (const field of fields) {
    const postsWithData = facebookPosts.filter(p => {
      const value = (p.analytics as any)[field];
      return value !== undefined && value !== null && value > 0;
    });

    const percentage = ((postsWithData.length / facebookPosts.length) * 100).toFixed(1);
    const maxValue = Math.max(...facebookPosts.map(p => (p.analytics as any)[field] || 0));
    const avgValue = postsWithData.length > 0
      ? (postsWithData.reduce((sum, p) => sum + ((p.analytics as any)[field] || 0), 0) / postsWithData.length).toFixed(2)
      : 0;

    const status = postsWithData.length === 0 ? '❌' : postsWithData.length < 10 ? '⚠️' : '✅';

    console.log(`${status} ${field.toUpperCase().padEnd(15)} - ${postsWithData.length.toString().padStart(3)}/${facebookPosts.length} posts (${percentage.padStart(5)}%) | Max: ${maxValue.toString().padStart(6)} | Avg: ${avgValue.toString().padStart(6)}`);
  }

  // Show posts with the most data
  console.log('\n\n📈 TOP 10 POSTS WITH MOST ENGAGEMENT:');
  console.log('-'.repeat(100));

  const sortedByEngagement = facebookPosts
    .map(p => ({
      ...p,
      totalEngagement: (p.analytics.likes || 0) + (p.analytics.comments || 0) + (p.analytics.shares || 0)
    }))
    .filter(p => p.totalEngagement > 0)
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);

  for (let i = 0; i < sortedByEngagement.length; i++) {
    const post = sortedByEngagement[i];
    const date = new Date(post.publishedAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

    console.log(`\n${i + 1}. Published: ${dateStr}`);
    console.log(`   Total Engagement: ${post.totalEngagement} (${post.analytics.likes} likes, ${post.analytics.comments} comments, ${post.analytics.shares} shares)`);
    console.log(`   Views: ${post.analytics.views}, Reach: ${post.analytics.reach}, Impressions: ${post.analytics.impressions}`);
  }

  // Check if there's a pattern in dates
  console.log('\n\n📅 DATA AVAILABILITY BY DATE RANGE:');
  console.log('-'.repeat(100));

  const postsWithAnyData = facebookPosts.filter(p =>
    (p.analytics.views || 0) > 0 ||
    (p.analytics.reach || 0) > 0 ||
    (p.analytics.impressions || 0) > 0 ||
    (p.analytics.likes || 0) > 0 ||
    (p.analytics.comments || 0) > 0 ||
    (p.analytics.shares || 0) > 0
  );

  if (postsWithAnyData.length > 0) {
    const dates = postsWithAnyData.map(p => new Date(p.publishedAt).getTime());
    const oldestWithData = new Date(Math.min(...dates));
    const newestWithData = new Date(Math.max(...dates));

    console.log(`Oldest post with data: ${oldestWithData.toLocaleDateString()}`);
    console.log(`Newest post with data: ${newestWithData.toLocaleDateString()}`);
    console.log(`Date range: ${Math.ceil((newestWithData.getTime() - oldestWithData.getTime()) / (1000 * 60 * 60 * 24))} days`);
  }

  const allDates = facebookPosts.map(p => new Date(p.publishedAt).getTime());
  const oldestPost = new Date(Math.min(...allDates));
  const newestPost = new Date(Math.max(...allDates));

  console.log(`\nOldest post overall: ${oldestPost.toLocaleDateString()}`);
  console.log(`Newest post overall: ${newestPost.toLocaleDateString()}`);
  console.log(`Total date range: ${Math.ceil((newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60 * 24))} days`);

  // Summary
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 SUMMARY');
  console.log('='.repeat(100));

  const hasViews = facebookPosts.filter(p => (p.analytics.views || 0) > 0).length;
  const hasReach = facebookPosts.filter(p => (p.analytics.reach || 0) > 0).length;
  const hasImpressions = facebookPosts.filter(p => (p.analytics.impressions || 0) > 0).length;
  const hasEngagement = facebookPosts.filter(p =>
    (p.analytics.likes || 0) > 0 || (p.analytics.comments || 0) > 0 || (p.analytics.shares || 0) > 0
  ).length;

  console.log('\n✅ WHAT GETLATE PROVIDES FOR FACEBOOK:');
  console.log(`   - Field Structure: views, reach, impressions, likes, comments, shares, saves`);
  console.log(`   - All fields are present in the API response`);

  console.log('\n❌ WHAT DATA IS ACTUALLY AVAILABLE:');
  console.log(`   - Views: ${hasViews}/${facebookPosts.length} posts (${((hasViews/facebookPosts.length)*100).toFixed(1)}%)`);
  console.log(`   - Reach: ${hasReach}/${facebookPosts.length} posts (${((hasReach/facebookPosts.length)*100).toFixed(1)}%)`);
  console.log(`   - Impressions: ${hasImpressions}/${facebookPosts.length} posts (${((hasImpressions/facebookPosts.length)*100).toFixed(1)}%)`);
  console.log(`   - Engagement (likes/comments/shares): ${hasEngagement}/${facebookPosts.length} posts (${((hasEngagement/facebookPosts.length)*100).toFixed(1)}%)`);

  console.log('\n🔍 CONCLUSION:');
  if (hasViews === 0 && hasReach === 0 && hasImpressions === 0) {
    console.log('   ❌ GetLate provides the fields but NO viewership data for Facebook');
    console.log('   ❌ This is likely a Facebook API integration issue');
    console.log('   ⚠️  Facebook may not be sharing view/reach/impression data with GetLate');
  } else {
    console.log('   ⚠️  Some viewership data is available but coverage is very low');
  }

  console.log('\n💡 RECOMMENDATION:');
  console.log('   1. Contact GetLate support about missing Facebook viewership metrics');
  console.log('   2. Check if Facebook connection needs to be reauthorized');
  console.log('   3. Verify Facebook Page has public posts (private posts may not share metrics)');
  console.log('   4. Use Meta Business Suite as alternative for accurate Facebook analytics\n');

  process.exit(0);
}

main();
