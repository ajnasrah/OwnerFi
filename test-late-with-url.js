/**
 * Test Late API with a Video URL
 *
 * Paste a Submagic or R2 video URL to test Late API
 */

require('dotenv').config();

const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_OWNERFI_PROFILE_ID = process.env.LATE_OWNERFI_PROFILE_ID;

// ⬇️ PASTE YOUR VIDEO URL HERE ⬇️
const VIDEO_URL = process.argv[2] || 'PASTE_VIDEO_URL_HERE';

async function testLateWithUrl() {
  console.log('🧪 Testing Late API with Video URL\n');

  if (VIDEO_URL === 'PASTE_VIDEO_URL_HERE') {
    console.error('❌ Please provide a video URL as an argument:');
    console.log('   node test-late-with-url.js "https://your-video-url.mp4"\n');
    console.log('Or paste the Submagic/R2 URL from your latest video webhook.\n');
    process.exit(1);
  }

  if (!LATE_API_KEY || !LATE_OWNERFI_PROFILE_ID) {
    console.error('❌ Late API credentials not configured');
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
      console.log('Go to https://getlate.dev/dashboard and connect social accounts\n');
      process.exit(1);
    }

    console.log('✅ Connected accounts:');
    accounts.forEach(account => {
      console.log(`   - ${account.platform}: ${account.username || account.name || account.id}`);
    });

    // Step 2: Create test post to Late
    console.log('\n📤 Step 2: Creating test post to Late...\n');

    const platforms = accounts.map(account => ({
      platform: account.platform,
      accountId: account._id, // Use _id from Late API
      platformSpecificData: {}
    }));

    // Add platform-specific configuration
    platforms.forEach(p => {
      if (p.platform === 'instagram') {
        p.platformSpecificData.contentType = 'reel';
      }
      if (p.platform === 'facebook') {
        p.platformSpecificData.contentType = 'feed';
      }
      if (p.platform === 'youtube') {
        p.platformSpecificData = {
          title: 'Test: Video URL to Late',
          category: 'News & Politics',
          privacy: 'public',
          madeForKids: false,
          short: true
        };
      }
      if (p.platform === 'tiktok') {
        p.platformSpecificData.privacy = 'public';
      }
    });

    const scheduledTime = new Date(Date.now() + 7200000); // 2 hours from now

    const requestBody = {
      content: '🧪 Test post: Video URL to Late API\n\nTesting direct video URL posting.',
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
    console.log('   Video URL type:', VIDEO_URL.includes('submagic') ? 'Submagic' : VIDEO_URL.includes('r2.dev') ? 'R2' : 'Other');

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

      if (VIDEO_URL.includes('submagic')) {
        console.log('\n💡 Submagic URL failed. This could mean:');
        console.log('   - URL is expired or temporary');
        console.log('   - Late cannot access Submagic download URLs');
        console.log('   → Recommendation: Use R2 storage instead\n');
      }
      process.exit(1);
    }

    const result = await response.json();

    console.log('\n✅ SUCCESS! Post created in Late!\n');
    console.log('📊 Response:');
    console.log('   Post ID:', result.id || result.postId);
    console.log('   Scheduled for:', result.scheduledFor);

    console.log('\n🎉 RESULT:');
    if (VIDEO_URL.includes('submagic')) {
      console.log('   ✅ Late ACCEPTS Submagic URLs!');
      console.log('   ✅ You can skip R2 upload!\n');
    } else if (VIDEO_URL.includes('r2.dev')) {
      console.log('   ✅ Late accepts R2 URLs (as expected)\n');
    }

    console.log('📱 Next steps:');
    console.log('   1. Check https://getlate.dev/dashboard');
    console.log('   2. Wait for scheduled time to verify video posts correctly');
    console.log('   3. You can delete this test post from Late dashboard\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLateWithUrl();
