/**
 * Test Late.dev API response structure
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

async function testLateApi() {
  const LATE_API_KEY = process.env.LATE_API_KEY;
  const CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID;

  if (!LATE_API_KEY || !CARZ_PROFILE_ID) {
    console.error('❌ Missing LATE_API_KEY or LATE_CARZ_PROFILE_ID');
    return;
  }

  console.log('🧪 Testing Late.dev API response structure...\n');

  try {
    const params = new URLSearchParams({
      profileId: CARZ_PROFILE_ID,
      limit: '5', // Just get 5 posts to inspect
    });

    const response = await fetch(
      `${LATE_BASE_URL}/posts?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.error(`❌ API error: ${response.status}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = await response.json();

    console.log('✅ API Response Structure:');
    console.log('─────────────────────────────────────\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n─────────────────────────────────────\n');

    if (data.posts && data.posts.length > 0) {
      console.log('📋 First post keys:');
      console.log(Object.keys(data.posts[0]));
      console.log('\n📄 First post sample:');
      console.log(JSON.stringify(data.posts[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

testLateApi();
