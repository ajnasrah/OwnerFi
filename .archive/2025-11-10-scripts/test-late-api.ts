#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function testLateApi() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

  if (!LATE_API_KEY || !CARZ_PROFILE_ID) {
    console.error('Missing LATE_API_KEY or LATE_CARZ_PROFILE_ID');
    process.exit(1);
  }

  const toDate = new Date().toISOString();
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = `https://getlate.dev/api/v1/analytics?profileId=${CARZ_PROFILE_ID}&fromDate=${fromDate}&toDate=${toDate}&limit=2&sortBy=date`;

  console.log('📡 Testing Late Analytics API');
  console.log('Profile ID:', CARZ_PROFILE_ID);
  console.log('URL:', url);
  console.log('');

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('Status:', response.status);

  if (!response.ok) {
    console.error('❌ Error:', await response.text());
    process.exit(1);
  }

  const data = await response.json();

  console.log('\n✅ Response structure:');
  console.log(JSON.stringify(data, null, 2));

  if (data.posts && data.posts.length > 0) {
    console.log('\n📊 First post details:');
    const post = data.posts[0];
    console.log('Post ID:', post._id);
    console.log('Status:', post.status);
    console.log('Platforms:', post.platforms?.length);

    if (post.platforms && post.platforms.length > 0) {
      console.log('\n🎯 Platform details:');
      post.platforms.forEach((platform: any) => {
        console.log(`\n  Platform: ${platform.platform}`);
        console.log(`  Status: ${platform.status}`);
        console.log(`  Analytics:`, JSON.stringify(platform.analytics, null, 4));
      });
    }
  }
}

testLateApi().catch(console.error);
