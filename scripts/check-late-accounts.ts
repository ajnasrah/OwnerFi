/**
 * Check Late.dev connected accounts for all brands
 * This shows which social media platforms are actually connected vs configured
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();

// Brand profile mappings
const BRAND_PROFILES: Record<string, { name: string; profileId: string | undefined; expectedPlatforms: string[] }> = {
  carz: {
    name: 'Carz Inc',
    profileId: process.env.LATE_CARZ_PROFILE_ID?.trim(),
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  },
  ownerfi: {
    name: 'OwnerFi',
    profileId: process.env.LATE_OWNERFI_PROFILE_ID?.trim(),
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter', 'bluesky'],
  },
  abdullah: {
    name: 'Abdullah',
    profileId: process.env.LATE_ABDULLAH_PROFILE_ID?.trim(),
    expectedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'],
  },
  gaza: {
    name: 'Gaza Relief',
    profileId: process.env.LATE_GAZA_PROFILE_ID?.trim(),
    expectedPlatforms: ['instagram', 'tiktok', 'threads', 'bluesky'],
  },
};

async function getAccounts(profileId: string): Promise<any[]> {
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

async function checkAllBrands() {
  console.log('\n' + '='.repeat(70));
  console.log('  LATE.DEV CONNECTED ACCOUNTS CHECK');
  console.log('='.repeat(70) + '\n');

  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not configured in .env.local');
    process.exit(1);
  }

  for (const [brandId, brandConfig] of Object.entries(BRAND_PROFILES)) {
    console.log(`\n--- ${brandConfig.name} (${brandId}) ---\n`);

    if (!brandConfig.profileId) {
      console.log(`  ❌ No profile ID configured (LATE_${brandId.toUpperCase()}_PROFILE_ID)`);
      continue;
    }

    console.log(`  Profile ID: ${brandConfig.profileId}`);

    try {
      const accounts = await getAccounts(brandConfig.profileId);
      const connectedPlatforms = accounts.map(acc => acc.platform?.toLowerCase());

      console.log(`  Expected: ${brandConfig.expectedPlatforms.join(', ')}`);
      console.log(`  Connected: ${connectedPlatforms.length > 0 ? connectedPlatforms.join(', ') : '(none)'}\n`);

      // Show status for each expected platform
      for (const platform of brandConfig.expectedPlatforms) {
        const account = accounts.find(acc => acc.platform?.toLowerCase() === platform.toLowerCase());
        if (account) {
          const username = account.username || account.name || account.accountId || 'Unknown';
          console.log(`    ✅ ${platform}: ${username}`);
        } else {
          console.log(`    ❌ ${platform}: NOT CONNECTED`);
        }
      }

      // Check for unexpected connected platforms
      const unexpected = connectedPlatforms.filter(
        p => !brandConfig.expectedPlatforms.includes(p)
      );
      if (unexpected.length > 0) {
        console.log(`\n    ℹ️  Additional connected (not in config): ${unexpected.join(', ')}`);
      }

    } catch (error) {
      console.error(`  ❌ Error fetching accounts:`, error);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`
To fix missing platforms:
1. Go to https://app.getlate.dev
2. Select the profile for each brand
3. Click "Add Account" and connect the missing social media accounts
4. Make sure to authorize posting permissions

Common issues:
- TikTok: May need to reauthorize every 24 hours due to API limitations
- YouTube: Requires Google account with a YouTube channel
- Facebook: Requires a Facebook Page (not personal profile)
- LinkedIn: Requires authorization for posting
`);
}

checkAllBrands()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
