/**
 * Check GetLate queue for a specific post
 */

const GETLATE_API_KEY = process.env.GETLATE_API_KEY;
const GETLATE_BASE_URL = process.env.GETLATE_BASE_URL || 'https://api.getlate.so';

async function checkGetLateQueue() {
  const searchTitle = 'Austin, TX Is America\'s Strongest Buyer\'s Market';

  console.log(`🔍 Searching GetLate queue for: ${searchTitle}\n`);

  try {
    // Fetch queue for all brands
    const brands = [
      { name: 'OwnerFi', profileId: process.env.GETLATE_OWNERFI_PROFILE_ID },
      { name: 'Late (Abdullah)', profileId: process.env.LATE_ABDULLAH_PROFILE_ID }
    ];

    for (const brand of brands) {
      if (!brand.profileId) {
        console.log(`⏭️  Skipping ${brand.name} - no profile ID`);
        continue;
      }

      console.log(`\n📋 Checking ${brand.name} queue (${brand.profileId})...`);

      const response = await fetch(
        `${GETLATE_BASE_URL}/queue/profile/${brand.profileId}`,
        {
          headers: {
            'Authorization': `Bearer ${GETLATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.log(`   ❌ Error fetching queue: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (!data.posts || data.posts.length === 0) {
        console.log(`   ℹ️  Queue is empty`);
        continue;
      }

      console.log(`   ✅ Found ${data.posts.length} posts in queue`);

      // Search for matching post
      const matchingPosts = data.posts.filter((post: any) =>
        post.content?.text?.toLowerCase().includes(searchTitle.toLowerCase()) ||
        post.content?.title?.toLowerCase().includes(searchTitle.toLowerCase())
      );

      if (matchingPosts.length > 0) {
        console.log(`\n   🎯 FOUND ${matchingPosts.length} MATCHING POST(S):\n`);
        matchingPosts.forEach((post: any) => {
          console.log(`   Post ID: ${post.id}`);
          console.log(`   Status: ${post.status}`);
          console.log(`   Title: ${post.content?.title || 'N/A'}`);
          console.log(`   Text: ${post.content?.text?.substring(0, 100)}...`);
          console.log(`   Scheduled: ${post.scheduledTime ? new Date(post.scheduledTime).toISOString() : 'N/A'}`);
          console.log(`   Platforms: ${post.platforms?.map((p: any) => p.platform).join(', ') || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log(`   ℹ️  No matching posts found`);
      }
    }

    console.log('\n💡 If the post is stuck in "pending" in GetLate:');
    console.log('   1. It might be waiting for its scheduled time');
    console.log('   2. GetLate might be processing it');
    console.log('   3. There might be an API error preventing posting');
    console.log('   4. The platforms might not be configured correctly');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkGetLateQueue().catch(console.error);
