import * as dotenv from 'dotenv';
import { postVideoToYouTube } from '../src/lib/youtube-api';

dotenv.config({ path: '.env.local' });

async function testYouTubeUpload() {
  console.log('🧪 Testing YouTube Direct Upload');
  console.log('');

  // Test with a sample video URL from recent workflow
  const testVideoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/abdullah/submagic-videos/wf_1763823630751_cq59q52ma.mp4';
  const testTitle = 'Test Upload - Direct YouTube API';
  const testDescription = 'This is a test upload using direct YouTube API to bypass Late.dev quota limits. #Shorts #Test';
  const testBrand = 'abdullah';

  console.log('Test Configuration:');
  console.log('  Brand:', testBrand);
  console.log('  Video URL:', testVideoUrl.substring(0, 80) + '...');
  console.log('  Title:', testTitle);
  console.log('');

  // Check if credentials are set (supports both shared and brand-specific)
  const sharedClientId = process.env.YOUTUBE_CLIENT_ID;
  const sharedClientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const brandClientId = process.env.YOUTUBE_ABDULLAH_CLIENT_ID;
  const brandClientSecret = process.env.YOUTUBE_ABDULLAH_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_ABDULLAH_REFRESH_TOKEN;

  const clientId = sharedClientId || brandClientId;
  const clientSecret = sharedClientSecret || brandClientSecret;

  console.log('Credentials Check:');
  if (sharedClientId && sharedClientSecret) {
    console.log('  ✅ Using SHARED credentials (recommended)');
    console.log('  YOUTUBE_CLIENT_ID:', '✅ Set');
    console.log('  YOUTUBE_CLIENT_SECRET:', '✅ Set');
  } else if (brandClientId && brandClientSecret) {
    console.log('  ✅ Using BRAND-SPECIFIC credentials');
    console.log('  YOUTUBE_ABDULLAH_CLIENT_ID:', '✅ Set');
    console.log('  YOUTUBE_ABDULLAH_CLIENT_SECRET:', '✅ Set');
  } else {
    console.log('  ❌ No Client ID/Secret found');
  }
  console.log('  YOUTUBE_ABDULLAH_REFRESH_TOKEN:', refreshToken ? '✅ Set' : '❌ Missing');
  console.log('');

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing YouTube credentials!');
    console.error('');
    console.error('RECOMMENDED SETUP (Shared credentials):');
    console.error('1. Read YOUTUBE_SIMPLIFIED_SETUP.md');
    console.error('2. Add to .env.local:');
    console.error('   YOUTUBE_CLIENT_ID=your-shared-client-id');
    console.error('   YOUTUBE_CLIENT_SECRET=your-shared-secret');
    console.error('   YOUTUBE_ABDULLAH_REFRESH_TOKEN=1//your-token');
    console.error('');
    console.error('OR use per-brand credentials:');
    console.error('   YOUTUBE_ABDULLAH_CLIENT_ID=...');
    console.error('   YOUTUBE_ABDULLAH_CLIENT_SECRET=...');
    console.error('   YOUTUBE_ABDULLAH_REFRESH_TOKEN=...');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting upload...');
    console.log('');

    const result = await postVideoToYouTube(
      testVideoUrl,
      testTitle,
      testDescription,
      testBrand,
      {
        tags: ['Shorts', 'Test', 'YouTubeAPI'],
        category: 'People & Blogs',
        privacy: 'unlisted', // Use 'unlisted' for testing
        isShort: true,
      }
    );

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 UPLOAD RESULT');
    console.log('='.repeat(60));
    console.log('');

    if (result.success) {
      console.log('✅ Upload successful!');
      console.log('');
      console.log('Video ID:', result.videoId);
      console.log('Video URL:', result.videoUrl);
      console.log('');
      console.log('⚠️  Note: Video was uploaded as UNLISTED for testing');
      console.log('You can change it to PUBLIC in YouTube Studio or update the test script');
    } else {
      console.log('❌ Upload failed');
      console.log('');
      console.log('Error:', result.error);
      console.log('');

      if (result.error?.includes('quota')) {
        console.log('💡 Tip: You may have hit the daily YouTube API quota');
        console.log('   - Default limit: 10,000 units/day');
        console.log('   - Video upload: ~1,600 units');
        console.log('   - Resets at midnight Pacific Time');
        console.log('   - Request quota increase in Google Cloud Console');
      } else if (result.error?.includes('authentication') || result.error?.includes('credentials')) {
        console.log('💡 Tip: Authentication failed');
        console.log('   - Verify your Client ID and Client Secret are correct');
        console.log('   - Make sure the refresh token is from the right Google account');
        console.log('   - Check that YouTube Data API v3 is enabled');
        console.log('   - Re-generate tokens using OAuth Playground if needed');
      }
    }

    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('');
    console.error('❌ Test failed with error:', error);
    console.error('');
    process.exit(1);
  }
}

testYouTubeUpload();
