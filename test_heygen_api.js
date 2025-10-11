// Test HeyGen API connectivity and credentials

require('dotenv').config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function testHeyGenAPI() {
  console.log('🧪 Testing HeyGen API...\n');

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env.local');
    return;
  }

  console.log('✅ API Key found:', HEYGEN_API_KEY.substring(0, 20) + '...\n');

  // Test 1: Get account info
  console.log('📊 Test 1: Getting account info...');
  try {
    const response = await fetch('https://api.heygen.com/v1/user.info', {
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Account info retrieved successfully');
      console.log('   Email:', data.data?.email || 'N/A');
      console.log('   Credits:', data.data?.remaining_quota || 'N/A');
      console.log('   Status:', response.status, '\n');
    } else {
      console.log('❌ Failed:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2), '\n');
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message, '\n');
  }

  // Test 2: List avatars
  console.log('👤 Test 2: Listing avatars...');
  try {
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    const data = await response.json();

    if (response.ok && data.data) {
      console.log(`✅ Found ${data.data.avatars?.length || 0} avatars`);
      if (data.data.avatars && data.data.avatars.length > 0) {
        console.log('   First avatar:', data.data.avatars[0].avatar_name);
      }
      console.log();
    } else {
      console.log('❌ Failed:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2), '\n');
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message, '\n');
  }

  // Test 3: List recent videos
  console.log('🎥 Test 3: Listing recent videos...');
  try {
    const response = await fetch('https://api.heygen.com/v1/video.list', {
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    const data = await response.json();

    if (response.ok && data.data) {
      console.log(`✅ Found ${data.data.videos?.length || 0} videos`);
      if (data.data.videos && data.data.videos.length > 0) {
        data.data.videos.slice(0, 3).forEach((v, i) => {
          console.log(`   ${i + 1}. ID: ${v.video_id}, Status: ${v.status}`);
        });
      }
      console.log();
    } else {
      console.log('❌ Failed:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2), '\n');
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message, '\n');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('                  SUMMARY                          ');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('If all tests passed, your HeyGen API is working correctly.');
  console.log('If tests failed, check:');
  console.log('  1. API key is correct in .env.local');
  console.log('  2. HeyGen account has credits');
  console.log('  3. API key hasn\'t expired\n');
}

testHeyGenAPI();
