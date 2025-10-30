#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkLateRawData() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📊 Fetching RAW data from Late.dev Analytics API\n');
  console.log('═'.repeat(80));

  let allPosts: any[] = [];
  let page = 1;
  let hasMore = true;

  // Fetch ALL pages
  while (hasMore) {
    const response = await fetch(`https://getlate.dev/api/v1/analytics?limit=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const posts = data.posts || [];

    console.log(`Page ${page}: ${posts.length} posts`);
    allPosts = allPosts.concat(posts);

    if (data.pagination && page < data.pagination.pages) {
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✅ Total posts fetched: ${allPosts.length}\n`);
  console.log('═'.repeat(80));

  // Analyze the data
  const postsWithViews = allPosts.filter(p => (p.analytics?.views || 0) > 0);
  const postsWithZeroViews = allPosts.filter(p => (p.analytics?.views || 0) === 0);

  console.log(`\n📊 VIEW DISTRIBUTION:`);
  console.log(`   Posts with views: ${postsWithViews.length} (${((postsWithViews.length / allPosts.length) * 100).toFixed(1)}%)`);
  console.log(`   Posts with 0 views: ${postsWithZeroViews.length} (${((postsWithZeroViews.length / allPosts.length) * 100).toFixed(1)}%)`);

  const totalViews = allPosts.reduce((sum, p) => sum + (p.analytics?.views || 0), 0);
  console.log(`   Total views: ${totalViews.toLocaleString()}`);
  console.log(`   Average views per post: ${Math.round(totalViews / allPosts.length)}`);

  // Top 20 performers
  const sorted = allPosts
    .filter(p => (p.analytics?.views || 0) > 0)
    .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0));

  console.log(`\n🏆 TOP 20 POSTS:`);
  sorted.slice(0, 20).forEach((post, idx) => {
    const views = post.analytics?.views || 0;
    const likes = post.analytics?.likes || 0;
    const comments = post.analytics?.comments || 0;
    const engagement = views > 0 ? (((likes + comments) / views) * 100).toFixed(2) : '0.00';

    console.log(`\n#${idx + 1} - ${views.toLocaleString()} views | ${engagement}% engagement`);
    console.log(`   Caption: ${(post.content || '').substring(0, 80)}...`);
    console.log(`   Published: ${post.publishedAt || 'N/A'}`);
    console.log(`   Platforms: ${post.platforms?.map((p: any) => p.platform).join(', ') || 'N/A'}`);
  });

  // Platform breakdown
  console.log(`\n\n📱 PLATFORM BREAKDOWN:`);
  const platformViews = new Map<string, number>();

  allPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        const views = p.analytics?.views || 0;
        platformViews.set(p.platform, (platformViews.get(p.platform) || 0) + views);
      });
    }
  });

  Array.from(platformViews.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([platform, views]) => {
      console.log(`   ${platform}: ${views.toLocaleString()} views`);
    });

  console.log('\n═'.repeat(80));
}

checkLateRawData().catch(console.error);
