/**
 * Test Late API with R2 Video
 *
 * This tests posting an R2 video URL to Late API
 */

require('dotenv').config();

const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_OWNERFI_PROFILE_ID = process.env.LATE_OWNERFI_PROFILE_ID;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Provide an R2 video URL as argument, or use a test URL
const VIDEO_URL = process.argv[2] || `${R2_PUBLIC_URL}/test-video.mp4`;

async function testLateWithR2() {
  console.log('🧪 Testing Late API with R2 Video\n');

  if (!LATE_API_KEY || !LATE_OWNERFI_PROFILE_ID) {
    console.error('❌ Late API credentials not configured');
    process.exit(1);
  }

  if (!VIDEO_URL.includes('r2.dev')) {
    console.error('❌ Please provide an R2 video URL');
    console.log('Usage: node test-late-r2.js "https://pub-xxx.r2.dev/video.mp4"\n');
    process.exit(1);
  }

  try {
    console.log('📋 Video URL:', VIDEO_URL, '\n');

    // Step 1: Get Late accounts
    console.log('📡 Step 1: Fetching Late accounts...\n');

    const accountsResponse = await fetch(
      `https://getlate.dev/api/v1/accounts?profileId=${LATE_OWNERFI_PROFILE_ID}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      throw new Error(`Late API error: ${accountsResponse.status} - ${errorText}`);
    }

    let accountsData = await accountsResponse.json();

    // Handle both array and object responses
    const accounts = Array.isArray(accountsData) ? accountsData :
                     accountsData.accounts ? accountsData.accounts :
                     accountsData.data ? accountsData.data : [];

    if (!accounts || accounts.length === 0) {
      console.error('❌ No connected accounts found in Late');
      console.log('Response:', JSON.stringify(accountsData, null, 2));
      process.exit(1);
    }

    console.log('✅ Connected accounts:');
    accounts.forEach(account => {
      console.log(`   - ${account.platform}: ${account.username || account.name || account.id}`);
    });

    // Step 2: Create test post to Late
    console.log('\n📤 Step 2: Creating test post to Late...\n');

    // All platforms for OwnerFi (including Bluesky)
    const allPlatforms = ['facebook', 'instagram', 'tiktok', 'linkedin', 'threads', 'twitter', 'youtube', 'bluesky'];

    const platforms = accounts
      .filter(account => allPlatforms.includes(account.platform))
      .map(account => {
        const platformConfig = {
          platform: account.platform,
          accountId: account._id,
          platformSpecificData: {}
        };

        // Platform-specific configuration
        if (account.platform === 'instagram') {
          platformConfig.platformSpecificData.contentType = 'reel';
        }
        if (account.platform === 'facebook') {
          platformConfig.platformSpecificData.contentType = 'feed';
        }
        if (account.platform === 'youtube') {
          platformConfig.platformSpecificData = {
            title: 'Test: R2 Video to Late API',
            category: 'News & Politics',
            privacy: 'public',
            madeForKids: false,
            short: true
          };
        }
        if (account.platform === 'tiktok') {
          platformConfig.platformSpecificData.privacy = 'public';
        }

        return platformConfig;
      });

    const scheduledTime = new Date(Date.now() + 7200000); // 2 hours from now

    const requestBody = {
      content: '🧪 Test post: R2 Video to Late API\n\nTesting R2 storage video URL posting to all platforms.',
      platforms: platforms,
      mediaItems: [
        {
          type: 'video',
          url: VIDEO_URL
        }
      ],
      scheduledFor: scheduledTime.toISOString(),
      timezone: 'America/New_York'
    };

    console.log('📋 Request details:');
    console.log('   Platforms:', platforms.map(p => p.platform).join(', '));
    console.log('   Scheduled for:', scheduledTime.toLocaleString());
    console.log('   Video URL:', VIDEO_URL.substring(0, 60) + '...');

    const response = await fetch('https://getlate.dev/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Late API error:', response.status);
      console.error('Response:', errorText);
      process.exit(1);
    }

    const result = await response.json();

    console.log('\n✅ SUCCESS! Post created in Late!\n');
    console.log('📊 Response:');
    console.log('   Post ID:', result.id || result.postId);
    console.log('   Scheduled for:', result.scheduledFor);

    console.log('\n🎉 RESULT:');
    console.log('   ✅ Late accepts R2 URLs!');
    console.log('   ✅ All platforms configured correctly!\n');

    console.log('📱 Next steps:');
    console.log('   1. Check https://getlate.dev/dashboard');
    console.log('   2. Wait for scheduled time to verify video posts correctly');
    console.log('   3. You can delete this test post from Late dashboard\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLateWithR2();
