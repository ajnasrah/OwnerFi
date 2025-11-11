#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkInstagramDetailed() {
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📸 CHECKING INSTAGRAM DATA IN DETAIL\n');
  console.log('═'.repeat(80));

  let allPosts: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`https://getlate.dev/api/v1/analytics?limit=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    allPosts = allPosts.concat(data.posts || []);

    if (data.pagination && page < data.pagination.pages) {
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total posts: ${allPosts.length}\n`);

  // Check Instagram specifically
  let igTotalViews = 0;
  let igTotalLikes = 0;
  let igTotalComments = 0;
  let igPostCount = 0;
  let igPostsWithData: any[] = [];

  allPosts.forEach(post => {
    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        if (p.platform === 'instagram') {
          igPostCount++;
          const analytics = p.analytics || {};

          const views = analytics.views || 0;
          const likes = analytics.likes || 0;
          const comments = analytics.comments || 0;

          igTotalViews += views;
          igTotalLikes += likes;
          igTotalComments += comments;

          if (views > 0 || likes > 0 || comments > 0) {
            igPostsWithData.push({
              postId: post._id,
              caption: (post.content || '').substring(0, 60),
              publishedAt: post.publishedAt,
              views,
              likes,
              comments,
              shares: analytics.shares || 0,
              reach: analytics.reach || 0,
              impressions: analytics.impressions || 0,
            });
          }
        }
      });
    }
  });

  console.log('📊 INSTAGRAM SUMMARY:');
  console.log(`   Total Instagram posts: ${igPostCount}`);
  console.log(`   Total Views: ${igTotalViews.toLocaleString()}`);
  console.log(`   Total Likes: ${igTotalLikes.toLocaleString()}`);
  console.log(`   Total Comments: ${igTotalComments.toLocaleString()}`);
  console.log(`   Posts with any data: ${igPostsWithData.length}\n`);

  if (igPostsWithData.length > 0) {
    console.log('✅ INSTAGRAM POSTS WITH DATA:\n');
    igPostsWithData
      .sort((a, b) => b.likes - a.likes)
      .forEach((post, idx) => {
        console.log(`${idx + 1}. Views: ${post.views} | Likes: ${post.likes} | Comments: ${post.comments}`);
        console.log(`   Caption: ${post.caption}...`);
        console.log(`   Reach: ${post.reach} | Impressions: ${post.impressions}`);
        console.log(`   Published: ${post.publishedAt || 'N/A'}\n`);
      });
  }

  // Also check the overall analytics object
  console.log('═'.repeat(80));
  console.log('🔍 CHECKING TOP-LEVEL ANALYTICS VS PLATFORM-LEVEL\n');

  const postsWithMismatch: any[] = [];

  allPosts.forEach(post => {
    const topLevelViews = post.analytics?.views || 0;
    let platformViews = 0;

    if (post.platforms) {
      post.platforms.forEach((p: any) => {
        platformViews += (p.analytics?.views || 0);
      });
    }

    if (topLevelViews !== platformViews) {
      postsWithMismatch.push({
        id: post._id,
        topLevel: topLevelViews,
        platformTotal: platformViews,
        platforms: post.platforms?.map((p: any) => ({
          platform: p.platform,
          views: p.analytics?.views || 0,
          likes: p.analytics?.likes || 0,
          comments: p.analytics?.comments || 0,
        }))
      });
    }
  });

  if (postsWithMismatch.length > 0) {
    console.log(`Found ${postsWithMismatch.length} posts with view count mismatches:\n`);
    postsWithMismatch.slice(0, 5).forEach(post => {
      console.log(`Post ${post.id}:`);
      console.log(`   Top-level views: ${post.topLevel}`);
      console.log(`   Platform total: ${post.platformTotal}`);
      console.log(`   Platform breakdown:`, JSON.stringify(post.platforms, null, 2));
      console.log('');
    });
  } else {
    console.log('No mismatches found between top-level and platform-level analytics\n');
  }

  console.log('═'.repeat(80));
}

checkInstagramDetailed().catch(console.error);
