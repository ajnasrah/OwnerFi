#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkLatePublishedPosts() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

  console.log('Fetching posts from Late.dev API...\n');

  try {
    const response = await fetch(`https://getlate.dev/api/v1/posts?profileId=${CARZ_PROFILE_ID}&limit=50`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Late API error:', response.status);
      return;
    }

    const data = await response.json();
    const posts = data.posts || [];

    console.log(`Found ${posts.length} posts\n`);
    console.log('─'.repeat(80));

    // Group by status
    const byStatus: Record<string, any[]> = {};
    posts.forEach((post: any) => {
      const status = post.status || 'unknown';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(post);
    });

    console.log('\nPosts by status:');
    Object.entries(byStatus).forEach(([status, statusPosts]) => {
      console.log(`  ${status}: ${statusPosts.length} posts`);
    });

    // Check for any posts with analytics
    console.log('\n' + '─'.repeat(80));
    console.log('\nPosts with analytics data:\n');

    let foundData = false;
    posts.forEach((post: any) => {
      const totalViews = post.analytics?.views || 0;
      const totalLikes = post.analytics?.likes || 0;
      const totalComments = post.analytics?.comments || 0;

      if (totalViews > 0 || totalLikes > 0 || totalComments > 0) {
        foundData = true;
        console.log(`Post ID: ${post._id}`);
        console.log(`  Status: ${post.status}`);
        console.log(`  Scheduled: ${post.scheduledFor}`);
        console.log(`  Posted: ${post.postedAt || 'N/A'}`);
        console.log(`  Views: ${totalViews}`);
        console.log(`  Likes: ${totalLikes}`);
        console.log(`  Comments: ${totalComments}`);
        console.log('');
      }
    });

    if (!foundData) {
      console.log('❌ NO POSTS WITH ANALYTICS DATA FOUND\n');
      console.log('This means:');
      console.log('  1. Posts are scheduled but not yet published');
      console.log('  2. OR Late.dev has not fetched analytics from platforms yet');
      console.log('  3. OR the posts were just published and analytics haven\'t updated\n');
    }

    // Show next few scheduled posts
    console.log('─'.repeat(80));
    console.log('\nNext 5 scheduled posts:\n');

    const scheduled = posts
      .filter((p: any) => p.status === 'scheduled')
      .sort((a: any, b: any) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .slice(0, 5);

    const now = Date.now();
    scheduled.forEach((post: any) => {
      const scheduledTime = new Date(post.scheduledFor);
      const minutesUntil = Math.round((scheduledTime.getTime() - now) / (1000 * 60));

      console.log(`Post ID: ${post._id}`);
      console.log(`  Scheduled: ${scheduledTime.toLocaleString()}`);
      console.log(`  Time until post: ${minutesUntil} minutes`);
      console.log(`  Platforms: ${post.platforms?.map((p: any) => p.platform).join(', ')}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkLatePublishedPosts().catch(console.error);
