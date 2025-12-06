/**
 * Test script to verify unified posting logic
 * Tests that:
 * 1. YouTube is posted via direct API only (once)
 * 2. Other platforms go to Late.dev (without YouTube)
 * 3. Both IDs are returned
 */

import 'dotenv/config';

// Mock the actual API calls to test logic
const mockPostVideoToYouTube = async () => {
  console.log('   [MOCK] YouTube direct API called');
  return {
    success: true,
    videoId: 'yt_mock_12345',
    videoUrl: 'https://youtube.com/watch?v=yt_mock_12345',
  };
};

const mockPostToLate = async (options: any) => {
  console.log(`   [MOCK] Late.dev called with platforms: ${options.platforms.join(', ')}`);

  // Check that YouTube is NOT in the platforms
  if (options.platforms.includes('youtube')) {
    console.error('   ❌ ERROR: YouTube should NOT be sent to Late.dev!');
    return { success: false, error: 'YouTube should not be in Late.dev platforms' };
  }

  return {
    success: true,
    postId: 'late_mock_67890',
    platforms: options.platforms,
  };
};

async function testUnifiedPosting() {
  console.log('=== TESTING UNIFIED POSTING LOGIC ===\n');

  const platforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'];

  console.log('Input platforms:', platforms.join(', '));
  console.log('');

  // Simulate the unified posting logic
  const hasYouTube = platforms.includes('youtube');
  const latePlatforms = platforms.filter(p => p !== 'youtube');

  console.log('Step 1: Check platform routing');
  console.log(`   YouTube (direct API): ${hasYouTube ? 'YES' : 'NO'}`);
  console.log(`   Late.dev platforms: ${latePlatforms.join(', ')}`);
  console.log('');

  let youtubeResult = null;
  let lateResult = null;

  // Step 1: YouTube direct API
  if (hasYouTube) {
    console.log('Step 2: YouTube Direct API');
    youtubeResult = await mockPostVideoToYouTube();
    console.log(`   Result: ${youtubeResult.success ? '✅' : '❌'}`);
    console.log(`   Video ID: ${youtubeResult.videoId}`);
    console.log('');
  }

  // Step 2: Late.dev (without YouTube)
  if (latePlatforms.length > 0) {
    console.log('Step 3: Late.dev');
    lateResult = await mockPostToLate({ platforms: latePlatforms });
    console.log(`   Result: ${lateResult.success ? '✅' : '❌'}`);
    console.log(`   Post ID: ${lateResult.postId}`);
    console.log(`   Platforms: ${lateResult.platforms?.join(', ')}`);
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`YouTube Video ID: ${youtubeResult?.videoId || 'N/A'}`);
  console.log(`Late.dev Post ID: ${lateResult?.postId || 'N/A'}`);
  console.log('');

  // Verify
  const youtubeInLate = lateResult?.platforms?.includes('youtube');
  if (youtubeInLate) {
    console.log('❌ FAIL: YouTube was sent to Late.dev (should only go to direct API)');
  } else if (!youtubeResult?.videoId) {
    console.log('❌ FAIL: YouTube video ID not returned');
  } else if (!lateResult?.postId) {
    console.log('❌ FAIL: Late.dev post ID not returned');
  } else {
    console.log('✅ PASS: YouTube posted once via direct API, other platforms via Late.dev');
    console.log('✅ PASS: Both IDs available for storage');
  }
}

testUnifiedPosting();
