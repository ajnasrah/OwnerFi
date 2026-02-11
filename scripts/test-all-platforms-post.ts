/**
 * Test posting to ALL platforms to see exactly what Late.dev does
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();
const CARZ_PROFILE_ID = process.env.LATE_CARZ_PROFILE_ID?.trim();

async function getAccounts(profileId: string): Promise<any[]> {
  const response = await fetch(
    `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
    {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  const data = await response.json();
  return Array.isArray(data) ? data : data.accounts || data.data || [];
}

async function testPost() {
  console.log('\n' + '='.repeat(70));
  console.log('  TEST: POST TO ALL PLATFORMS');
  console.log('='.repeat(70));

  if (!LATE_API_KEY || !CARZ_PROFILE_ID) {
    console.error('Missing LATE_API_KEY or LATE_CARZ_PROFILE_ID');
    process.exit(1);
  }

  // Get all accounts
  const accounts = await getAccounts(CARZ_PROFILE_ID);
  console.log(`\nFound ${accounts.length} accounts:`);
  accounts.forEach((acc: any) => {
    console.log(`  - ${acc.platform}: ${acc.username || acc.displayName} (${acc._id})`);
  });

  // Build platforms array from ALL connected accounts
  const platforms = accounts.map((acc: any) => {
    const platform = acc.platform.toLowerCase();
    const config: any = {
      platform,
      accountId: acc._id,
      platformSpecificData: {}
    };

    if (platform === 'instagram') {
      config.platformSpecificData.contentType = 'reel';
    }
    if (platform === 'tiktok') {
      config.platformSpecificData.privacy = 'public';
    }
    if (platform === 'facebook') {
      config.platformSpecificData.contentType = 'feed';
    }

    return config;
  });

  console.log(`\nBuilding post with ${platforms.length} platforms:`);
  platforms.forEach(p => console.log(`  - ${p.platform}`));

  // Test video URL (known working video)
  const testVideoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/submagic-1769369408438-h58lxo.mp4';

  // Build request body - WITHOUT queue (to see raw behavior)
  const requestBodyDirect = {
    content: 'TEST POST - DELETE ME - Testing all platforms WITHOUT queue',
    platforms: platforms,
    mediaItems: [
      {
        type: 'video',
        url: testVideoUrl
      }
    ],
    publishNow: true, // Immediate posting, no queue
  };

  console.log('\n' + '='.repeat(70));
  console.log('  TEST 1: DIRECT POST (NO QUEUE)');
  console.log('='.repeat(70));
  console.log('Request body (platforms):');
  console.log(JSON.stringify(platforms.map(p => p.platform), null, 2));

  console.log('\nSending request...');

  const response1 = await fetch(
    `${LATE_BASE_URL}/posts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBodyDirect)
    }
  );

  console.log(`Response status: ${response1.status}`);
  const data1 = await response1.json();
  console.log('Response:');
  console.log(JSON.stringify(data1, null, 2));

  // Check platforms in response
  const post1 = data1.post || data1;
  if (post1.platforms) {
    console.log(`\n✅ RESULT: Sent ${platforms.length} platforms, received ${post1.platforms.length}`);
    console.log(`   Sent: ${platforms.map(p => p.platform).join(', ')}`);
    console.log(`   Got:  ${post1.platforms.map((p: any) => p.platform).join(', ')}`);

    if (post1.platforms.length !== platforms.length) {
      console.log('\n⚠️  PLATFORM COUNT MISMATCH - Late.dev filtered platforms!');
      const sentSet = new Set(platforms.map(p => p.platform));
      const gotSet = new Set(post1.platforms.map((p: any) => p.platform));
      const missing = [...sentSet].filter(p => !gotSet.has(p));
      console.log(`   Missing: ${missing.join(', ')}`);
    }
  }

  // Now test with queue
  console.log('\n' + '='.repeat(70));
  console.log('  TEST 2: POST WITH QUEUE');
  console.log('='.repeat(70));

  const requestBodyQueued = {
    content: 'TEST POST - DELETE ME - Testing all platforms WITH queue',
    platforms: platforms,
    mediaItems: [
      {
        type: 'video',
        url: testVideoUrl
      }
    ],
    queuedFromProfile: CARZ_PROFILE_ID,
    timezone: 'America/Chicago'
  };

  console.log('Sending queued request...');

  const response2 = await fetch(
    `${LATE_BASE_URL}/posts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBodyQueued)
    }
  );

  console.log(`Response status: ${response2.status}`);
  const data2 = await response2.json();
  console.log('Response:');
  console.log(JSON.stringify(data2, null, 2));

  // Check platforms in response
  const post2 = data2.post || data2;
  if (post2.platforms) {
    console.log(`\n✅ RESULT: Sent ${platforms.length} platforms, received ${post2.platforms.length}`);
    console.log(`   Sent: ${platforms.map(p => p.platform).join(', ')}`);
    console.log(`   Got:  ${post2.platforms.map((p: any) => p.platform).join(', ')}`);

    if (post2.platforms.length !== platforms.length) {
      console.log('\n⚠️  PLATFORM COUNT MISMATCH - Queue filtered platforms!');
      const sentSet = new Set(platforms.map(p => p.platform));
      const gotSet = new Set(post2.platforms.map((p: any) => p.platform));
      const missing = [...sentSet].filter(p => !gotSet.has(p));
      console.log(`   Missing with queue: ${missing.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  const direct = (data1.post || data1).platforms?.length || 0;
  const queued = (data2.post || data2).platforms?.length || 0;
  console.log(`  Direct post platforms: ${direct}`);
  console.log(`  Queued post platforms: ${queued}`);
  if (direct !== queued) {
    console.log(`  ⚠️  QUEUE IS FILTERING PLATFORMS!`);
  }
}

testPost()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
