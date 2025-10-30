#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function inspectPublishedPost() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

  console.log('Fetching published posts from Late.dev...\n');

  try {
    const response = await fetch(`https://getlate.dev/api/v1/posts?profileId=${CARZ_PROFILE_ID}&limit=50`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const posts = data.posts || [];

    // Find a published post
    const publishedPost = posts.find((p: any) => p.status === 'published');

    if (!publishedPost) {
      console.log('No published posts found');
      return;
    }

    console.log('PUBLISHED POST DETAILS:');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(publishedPost, null, 2));
    console.log('═'.repeat(80));

    console.log('\n\nKEY FINDINGS:');
    console.log('─'.repeat(80));
    console.log(`Post ID: ${publishedPost._id}`);
    console.log(`Status: ${publishedPost.status}`);
    console.log(`Scheduled For: ${publishedPost.scheduledFor}`);
    console.log(`Posted At: ${publishedPost.postedAt || 'N/A'}`);
    console.log(`\nTop-level analytics:`);
    console.log(JSON.stringify(publishedPost.analytics, null, 2));

    console.log(`\nPer-platform analytics:`);
    if (publishedPost.platforms) {
      publishedPost.platforms.forEach((platform: any) => {
        console.log(`\n  ${platform.platform}:`);
        console.log(`    Status: ${platform.status}`);
        console.log(`    Platform Post ID: ${platform.platformPostId || 'N/A'}`);
        console.log(`    Analytics: ${JSON.stringify(platform.analytics || {}, null, 2)}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

inspectPublishedPost().catch(console.error);
