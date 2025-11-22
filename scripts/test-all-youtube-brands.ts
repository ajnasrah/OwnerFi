import * as dotenv from 'dotenv';
import { postVideoToYouTube } from '../src/lib/youtube-api';

dotenv.config({ path: '.env.local' });

const testVideoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/abdullah/submagic-videos/wf_1763823630751_cq59q52ma.mp4';

async function testBrand(brand: 'ownerfi' | 'carz' | 'abdullah') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing ${brand.toUpperCase()} YouTube Upload`);
  console.log('='.repeat(60));

  try {
    const result = await postVideoToYouTube(
      testVideoUrl,
      `Test - ${brand} Brand`,
      `Test upload for ${brand} brand using direct YouTube API #Shorts`,
      brand,
      { privacy: 'unlisted', isShort: true }
    );

    if (result.success) {
      console.log(`✅ ${brand.toUpperCase()} upload successful!`);
      console.log(`   Video ID: ${result.videoId}`);
      console.log(`   Video URL: ${result.videoUrl}`);
    } else {
      console.log(`❌ ${brand.toUpperCase()} upload failed:`, result.error);
    }
  } catch (error) {
    console.log(`❌ ${brand.toUpperCase()} error:`, error instanceof Error ? error.message : error);
  }
}

async function testAllBrands() {
  console.log('🚀 Testing YouTube Direct API for All Brands');
  console.log('Each brand will upload a test video to its YouTube channel\n');

  // Test each brand sequentially
  await testBrand('ownerfi');
  await testBrand('carz');
  await testBrand('abdullah');

  console.log('\n' + '='.repeat(60));
  console.log('✅ All brand tests completed!');
  console.log('='.repeat(60));
  console.log('\nCheck the URLs above to verify each video uploaded correctly.');
  console.log('Videos are unlisted for testing - you can delete them from YouTube Studio.');
}

testAllBrands();
