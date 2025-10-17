const LATE_API_KEY = 'sk_8b3848b528de06570fcfdb9dcd80c453f51f4509552ef4091a0279fdc3d33b0f';
const OWNERFI_PROFILE_ID = '68f02bc0b9cd4f90fdb3ec86';
const CARZ_PROFILE_ID = '68f02c51a024412721e3cf95';
const PODCAST_PROFILE_ID = '68f02fc6a36fc81959f5d178';

async function verifyAllIds() {
  console.log('='.repeat(70));
  console.log('VERIFYING ALL LATE IDS AND CONFIGURATION');
  console.log('='.repeat(70));
  console.log();

  // Step 1: Test API Key by fetching profiles
  console.log('Step 1: Testing Late API Key...');
  try {
    const response = await fetch('https://getlate.dev/api/v1/profiles', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ API Key INVALID! Status: ${response.status}`);
      const text = await response.text();
      console.error(`   Response: ${text}`);
      return;
    }

    const profiles = await response.json();
    console.log(`✅ API Key VALID! Found ${profiles.length} profiles\n`);

    // Step 2: Verify each profile ID
    console.log('Step 2: Verifying Profile IDs...\n');

    const profilesMap = {};
    profiles.forEach(p => {
      profilesMap[p._id || p.id] = p;
      console.log(`📋 Profile: ${p.name}`);
      console.log(`   ID: ${p._id || p.id}`);
      console.log(`   User ID: ${p.userId}`);
      console.log();
    });

    // Check OwnerFi Profile
    console.log('--- OwnerFi Profile Check ---');
    console.log(`Expected ID: ${OWNERFI_PROFILE_ID}`);
    if (profilesMap[OWNERFI_PROFILE_ID]) {
      console.log(`✅ VALID - Profile name: ${profilesMap[OWNERFI_PROFILE_ID].name}`);
    } else {
      console.log(`❌ INVALID - Profile ID not found!`);
      console.log(`   Available profiles:`);
      profiles.forEach(p => console.log(`   - ${p.name}: ${p._id || p.id}`));
    }
    console.log();

    // Check Carz Profile
    console.log('--- Carz Profile Check ---');
    console.log(`Expected ID: ${CARZ_PROFILE_ID}`);
    if (profilesMap[CARZ_PROFILE_ID]) {
      console.log(`✅ VALID - Profile name: ${profilesMap[CARZ_PROFILE_ID].name}`);
    } else {
      console.log(`❌ INVALID - Profile ID not found!`);
      console.log(`   Available profiles:`);
      profiles.forEach(p => console.log(`   - ${p.name}: ${p._id || p.id}`));
    }
    console.log();

    // Check Podcast Profile
    console.log('--- Podcast Profile Check ---');
    console.log(`Expected ID: ${PODCAST_PROFILE_ID}`);
    if (profilesMap[PODCAST_PROFILE_ID]) {
      console.log(`✅ VALID - Profile name: ${profilesMap[PODCAST_PROFILE_ID].name}`);
    } else {
      console.log(`❌ INVALID - Profile ID not found!`);
      console.log(`   Available profiles:`);
      profiles.forEach(p => console.log(`   - ${p.name}: ${p._id || p.id}`));
    }
    console.log();

    // Step 3: Get accounts for OwnerFi profile and verify structure
    console.log('Step 3: Verifying OwnerFi Accounts and IDs...\n');

    const accountsResponse = await fetch(`https://getlate.dev/api/v1/accounts?profileId=${OWNERFI_PROFILE_ID}`, {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      console.error(`❌ Failed to fetch accounts for OwnerFi`);
      return;
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || accountsData.data || accountsData;

    console.log(`Found ${accounts.length} connected accounts for OwnerFi:\n`);

    accounts.forEach(acc => {
      console.log(`Platform: ${acc.platform}`);
      console.log(`  Account ID (_id): ${acc._id}`);
      console.log(`  Username: ${acc.username || acc.displayName}`);
      console.log(`  Active: ${acc.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`  Platform User ID: ${acc.platformUserId}`);
      console.log();
    });

    // Step 4: Check if account IDs are in correct format
    console.log('Step 4: Checking Account ID Format...\n');

    const testPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook'];
    testPlatforms.forEach(platform => {
      const account = accounts.find(acc => acc.platform.toLowerCase() === platform);
      if (account) {
        console.log(`${platform}:`);
        console.log(`  ✅ Connected`);
        console.log(`  Account ID to use in API: ${account._id}`);
      } else {
        console.log(`${platform}:`);
        console.log(`  ❌ Not connected`);
      }
      console.log();
    });

    console.log('='.repeat(70));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error during verification:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

verifyAllIds();
