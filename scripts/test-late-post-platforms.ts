/**
 * Test Late.dev posting flow to debug platform issue
 * This simulates exactly what happens during a real post
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();

// Brand config (copied from brand-configs.ts)
const BRAND_PLATFORMS: Record<string, string[]> = {
  carz: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  ownerfi: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
};

const PROFILE_IDS: Record<string, string | undefined> = {
  carz: process.env.LATE_CARZ_PROFILE_ID?.trim(),
  ownerfi: process.env.LATE_OWNERFI_PROFILE_ID?.trim(),
};

async function getLateAccounts(profileId: string): Promise<any[]> {
  const response = await fetch(
    `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Late API error: ${response.status} - ${errorText}`);
  }

  const accountsData = await response.json();
  return Array.isArray(accountsData) ? accountsData :
         accountsData.accounts ? accountsData.accounts :
         accountsData.data ? accountsData.data : [];
}

async function testPlatformFlow(brand: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Testing ${brand.toUpperCase()} Platform Flow`);
  console.log(`${'='.repeat(70)}\n`);

  const profileId = PROFILE_IDS[brand];
  if (!profileId) {
    console.error(`❌ No profile ID for ${brand}`);
    return;
  }

  const requestedPlatforms = BRAND_PLATFORMS[brand];
  console.log(`1. Requested platforms from config: ${requestedPlatforms.join(', ')}`);
  console.log(`   Total: ${requestedPlatforms.length} platforms\n`);

  // Get connected accounts from Late API
  const accounts = await getLateAccounts(profileId);
  console.log(`2. Connected accounts from Late API:`);
  accounts.forEach((acc: any) => {
    console.log(`   - ${acc.platform}: ${acc.username || acc.displayName || acc._id}`);
  });
  console.log(`   Total: ${accounts.length} accounts\n`);

  // Simulate the platform matching logic from late-api.ts
  const missingPlatforms: string[] = [];
  const platformAccounts = requestedPlatforms
    .map(platform => {
      const account = accounts.find((acc: any) =>
        acc.platform.toLowerCase() === platform.toLowerCase()
      );
      if (!account) {
        missingPlatforms.push(platform);
        return null;
      }
      return {
        platform: platform,
        accountId: account._id
      };
    })
    .filter(Boolean) as { platform: string; accountId: string }[];

  console.log(`3. Platform matching results:`);
  console.log(`   Matched: ${platformAccounts.map(p => p.platform).join(', ')}`);
  console.log(`   Missing: ${missingPlatforms.length > 0 ? missingPlatforms.join(', ') : '(none)'}`);
  console.log(`   Total matched: ${platformAccounts.length} platforms\n`);

  // Build the platforms array as late-api.ts does
  const platforms = platformAccounts.map(p => {
    const platformConfig: any = {
      platform: p.platform,
      accountId: p.accountId,
      platformSpecificData: {}
    };

    if (p.platform === 'instagram') {
      platformConfig.platformSpecificData.contentType = 'reel';
    }
    if (p.platform === 'tiktok') {
      platformConfig.platformSpecificData.privacy = 'public';
    }
    if (p.platform === 'youtube') {
      platformConfig.platformSpecificData = {
        title: 'Test Video',
        category: 'Autos & Vehicles',
        privacy: 'public',
        madeForKids: false,
        short: true
      };
    }
    if (p.platform === 'facebook') {
      platformConfig.platformSpecificData.contentType = 'feed';
    }

    return platformConfig;
  });

  console.log(`4. Final platforms array for Late API request:`);
  platforms.forEach(p => {
    console.log(`   - ${p.platform} (accountId: ${p.accountId.substring(0, 10)}...)`);
  });
  console.log(`   Total: ${platforms.length} platforms\n`);

  // Build the actual request body
  const requestBody: any = {
    content: 'Test caption for debugging platform issue',
    platforms: platforms,
    mediaItems: [
      {
        type: 'video',
        url: 'https://example.com/test.mp4' // Fake URL - won't actually post
      }
    ],
    queuedFromProfile: profileId,
    timezone: 'America/Chicago'
  };

  console.log(`5. Full request body that would be sent to Late API:`);
  console.log(JSON.stringify(requestBody, null, 2));

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  SUMMARY for ${brand.toUpperCase()}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`
  Requested: ${requestedPlatforms.length} platforms
  Connected: ${accounts.length} accounts
  Matched:   ${platformAccounts.length} platforms

  ${platformAccounts.length === requestedPlatforms.length - missingPlatforms.length ? '✅ Platform matching is working correctly!' : '❌ Platform matching issue detected!'}

  If Late.dev only posts to ${accounts.length > 2 ? 'fewer platforms' : '2 platforms'},
  the issue is on Late.dev's side, not in our code.
  `);
}

async function main() {
  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not configured');
    process.exit(1);
  }

  await testPlatformFlow('carz');
  await testPlatformFlow('ownerfi');
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
