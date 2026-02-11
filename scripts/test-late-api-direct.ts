/**
 * Direct test of Late API to see exactly what's sent and returned
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

async function testDirectPost() {
  console.log('\n' + '='.repeat(70));
  console.log('  DIRECT LATE API TEST');
  console.log('='.repeat(70) + '\n');

  if (!LATE_API_KEY || !CARZ_PROFILE_ID) {
    console.error('Missing LATE_API_KEY or LATE_CARZ_PROFILE_ID');
    process.exit(1);
  }

  // Get accounts
  const accounts = await getAccounts(CARZ_PROFILE_ID);
  console.log(`Found ${accounts.length} accounts:`);
  accounts.forEach((acc: any) => {
    console.log(`  - ${acc.platform}: ${acc.username || acc.displayName} (${acc._id})`);
  });

  // Build platforms array EXACTLY like our code does
  const requestedPlatforms = ['instagram', 'tiktok', 'facebook', 'linkedin', 'threads'];

  const platformAccounts = requestedPlatforms
    .map(platform => {
      const account = accounts.find((acc: any) =>
        acc.platform.toLowerCase() === platform.toLowerCase()
      );
      if (!account) {
        console.log(`  ❌ No account for ${platform}`);
        return null;
      }
      return { platform, accountId: account._id };
    })
    .filter(Boolean) as { platform: string; accountId: string }[];

  console.log(`\nMatched ${platformAccounts.length} platforms:`);
  platformAccounts.forEach(p => console.log(`  - ${p.platform}: ${p.accountId}`));

  // Build platforms config
  const platforms = platformAccounts.map(p => {
    const config: any = {
      platform: p.platform,
      accountId: p.accountId,
      platformSpecificData: {}
    };

    if (p.platform === 'instagram') {
      config.platformSpecificData.contentType = 'reel';
    }
    if (p.platform === 'tiktok') {
      config.platformSpecificData.privacy = 'public';
    }
    if (p.platform === 'facebook') {
      config.platformSpecificData.contentType = 'feed';
    }

    return config;
  });

  // Build request body
  const requestBody = {
    content: 'TEST POST - PLEASE IGNORE - Testing platform selection',
    platforms: platforms,
    mediaItems: [
      {
        type: 'video',
        url: 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/submagic-1769369408438-h58lxo.mp4'
      }
    ],
    queuedFromProfile: CARZ_PROFILE_ID,
    timezone: 'America/Chicago'
  };

  console.log('\n' + '='.repeat(70));
  console.log('  REQUEST BODY');
  console.log('='.repeat(70));
  console.log(JSON.stringify(requestBody, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('  SENDING TO LATE API...');
  console.log('='.repeat(70));

  const response = await fetch(
    `${LATE_BASE_URL}/posts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }
  );

  console.log(`\nResponse Status: ${response.status} ${response.statusText}`);

  const responseText = await response.text();
  console.log('\n' + '='.repeat(70));
  console.log('  RESPONSE BODY');
  console.log('='.repeat(70));

  try {
    const data = JSON.parse(responseText);
    console.log(JSON.stringify(data, null, 2));

    // Check how many platforms in response
    const post = data.post || data;
    if (post.platforms) {
      console.log('\n' + '='.repeat(70));
      console.log('  PLATFORMS IN RESPONSE');
      console.log('='.repeat(70));
      console.log(`Sent ${platforms.length} platforms, received ${post.platforms.length}:`);
      post.platforms.forEach((p: any) => {
        console.log(`  - ${p.platform}: ${p.status || 'pending'}`);
      });

      if (post.platforms.length !== platforms.length) {
        console.log('\n⚠️  PLATFORM COUNT MISMATCH!');
        console.log(`   Sent: ${platforms.map(p => p.platform).join(', ')}`);
        console.log(`   Got: ${post.platforms.map((p: any) => p.platform).join(', ')}`);
      }
    }
  } catch (e) {
    console.log(responseText);
  }
}

testDirectPost()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
