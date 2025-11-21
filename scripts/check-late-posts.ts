import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LATE_API_KEY = process.env.LATE_API_KEY;
const PROFILE_ID = '68f02bc0b9cd4f90fdb3ec86';

if (!LATE_API_KEY) {
  console.error('❌ LATE_API_KEY not found');
  process.exit(1);
}

async function checkLatePosts() {
  try {
    console.log('='.repeat(60));
    console.log('🔍 CHECKING LATE.SO POSTS FOR ABDULLAH');
    console.log('='.repeat(60));
    console.log('Profile ID:', PROFILE_ID);
    console.log('');

    const response = await fetch(`https://getlate.dev/api/v1/posts?profileId=${PROFILE_ID}&limit=20`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Late API error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      process.exit(1);
    }

    const data = await response.json();

    console.log('Total posts found:', data.data?.length || 0);
    console.log('');

    if (!data.data || data.data.length === 0) {
      console.log('❌ NO POSTS FOUND IN LATE.SO!');
      console.log('');
      console.log('This is the problem! Workflows show "completed" but no posts exist.');
      console.log('');
      console.log('Possible causes:');
      console.log('  1. The scheduleVideoPost() function is failing silently');
      console.log('  2. The LATE_ABDULLAH_PROFILE_ID is wrong');
      console.log('  3. The Late.so profile was deleted or disabled');
      console.log('  4. The webhook that schedules posts is not being called');
    } else {
      console.log('=== RECENT POSTS ===');
      data.data.slice(0, 15).forEach((post: any, i: number) => {
        console.log(`${i + 1}. Post ID: ${post.id}`);
        console.log(`   Status: ${post.status}`);
        console.log(`   Text: ${post.text?.substring(0, 80) || 'No text'}...`);
        console.log(`   Created: ${new Date(post.created_at).toLocaleString()}`);
        if (post.scheduled_for) {
          console.log(`   Scheduled: ${new Date(post.scheduled_for).toLocaleString()}`);
        }
        if (post.published_at) {
          console.log(`   Published: ${new Date(post.published_at).toLocaleString()}`);
        }
        console.log('');
      });

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      data.data.forEach((post: any) => {
        statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
      });

      console.log('Status Summary:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }

    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLatePosts();
