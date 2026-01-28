/**
 * Check Late.dev post status for recent posts
 * This shows which platforms actually received the video
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();

// Recent post IDs from workflows
const POST_IDS = [
  '69766f49d212e8bc52133a6b', // Carz most recent
  '6976220e178c093363db0a09', // OwnerFi most recent
];

async function getPostStatus(postId: string): Promise<any> {
  const response = await fetch(
    `${LATE_BASE_URL}/posts/${postId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Late API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function checkPosts() {
  console.log('\n' + '='.repeat(70));
  console.log('  LATE.DEV POST STATUS CHECK');
  console.log('='.repeat(70) + '\n');

  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not configured');
    process.exit(1);
  }

  for (const postId of POST_IDS) {
    console.log(`\n--- Post: ${postId} ---\n`);

    try {
      const response = await getPostStatus(postId);
      const post = response.post || response; // Handle nested or flat response

      console.log(`  Content: ${(post.content || '').substring(0, 80)}...`);
      console.log(`  Created: ${post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Unknown'}`);
      console.log(`  Status: ${post.status || 'Unknown'}`);

      // Check platforms array
      if (post.platforms && Array.isArray(post.platforms)) {
        console.log(`\n  Platform Status (${post.platforms.length} platforms):`);
        for (const platform of post.platforms) {
          const status = platform.status || platform.publishStatus || 'unknown';
          const platformName = platform.platform || 'Unknown';
          const icon = status === 'published' || status === 'success' ? '✅' :
                       status === 'failed' || status === 'error' ? '❌' :
                       status === 'queued' || status === 'scheduled' || status === 'pending' ? '⏳' : '❓';

          console.log(`    ${icon} ${platformName}: ${status}`);

          // Show error if failed
          if (status === 'failed' || status === 'error') {
            console.log(`       Error: ${platform.error || platform.errorMessage || JSON.stringify(platform)}`);
          }
        }
      } else {
        console.log(`  No platforms array found`);
      }

      // Log full raw response for debugging
      console.log(`\n  RAW POST DATA:`);
      console.log(JSON.stringify(post, null, 2));

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

checkPosts()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
