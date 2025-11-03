/**
 * Test Late API with single platform to isolate the issue
 */

import { postToLate } from '../src/lib/late-api';

const VIDEO_URL = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/submagic-1762200023407-kc2cxs.mp4';

async function testSinglePlatform() {
  console.log('🔬 Testing Late API with single platform (Instagram)...\n');

  const startTime = Date.now();

  const result = await postToLate({
    videoUrl: VIDEO_URL,
    caption: 'Single platform test',
    title: 'Test Video',
    platforms: ['instagram'], // Just Instagram
    brand: 'carz',
    useQueue: false,
  });

  const duration = Date.now() - startTime;

  console.log(`\n⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
  console.log('\n📊 Result:');
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    console.log('\n❌ SINGLE PLATFORM FAILED');
    console.log(`This means the issue is NOT about posting to 6 platforms`);
    console.log(`Something else is wrong with the Late API`);
  } else {
    console.log('\n✅ SINGLE PLATFORM SUCCEEDED');
    console.log(`Now testing with all 6 platforms...`);

    // Test with all platforms
    const startTime2 = Date.now();
    const result2 = await postToLate({
      videoUrl: VIDEO_URL,
      caption: 'Multi platform test',
      title: 'Test Video',
      platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
      brand: 'carz',
      useQueue: false,
    });
    const duration2 = Date.now() - startTime2;

    console.log(`\n⏱️  Duration: ${duration2}ms (${(duration2 / 1000).toFixed(1)}s)`);
    console.log('\n📊 Result:');
    console.log(JSON.stringify(result2, null, 2));

    if (!result2.success) {
      console.log('\n❌ MULTI PLATFORM FAILED');
      console.log(`The issue IS posting to multiple platforms at once`);
    } else {
      console.log('\n✅ BOTH TESTS PASSED');
      console.log(`The timeout increase should fix the issue`);
    }
  }
}

testSinglePlatform().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
