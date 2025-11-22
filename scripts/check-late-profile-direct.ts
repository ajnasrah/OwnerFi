import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkLateProfileDirect() {
  console.log('='.repeat(60));
  console.log('🔍 CHECKING LATE.SO ABDULLAH PROFILE (Direct API)');
  console.log('='.repeat(60));
  console.log('');

  const LATE_ABDULLAH_PROFILE_ID = process.env.LATE_ABDULLAH_PROFILE_ID;
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📋 Environment:');
  console.log('  LATE_ABDULLAH_PROFILE_ID:', LATE_ABDULLAH_PROFILE_ID);
  console.log('  LATE_API_KEY:', LATE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('');

  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not set!');
    return;
  }

  try {
    // Check profiles endpoint
    console.log('📡 Fetching all Late.so profiles...');
    const profilesResponse = await fetch('https://getlate.dev/api/v1/profiles', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('Response status:', profilesResponse.status);
    const profilesText = await profilesResponse.text();
    console.log('Response body:', profilesText);
    console.log('');

    let profilesData;
    try {
      profilesData = JSON.parse(profilesText);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
      return;
    }

    // Handle different response formats
    const profiles = Array.isArray(profilesData) ? profilesData :
                     profilesData.profiles ? profilesData.profiles :
                     profilesData.data ? profilesData.data : [];

    console.log('Available profiles:');
    if (profiles.length === 0) {
      console.log('❌ NO PROFILES FOUND!');
    } else {
      profiles.forEach((p: any) => {
        console.log(`  - ${p.name} (ID: ${p.id || p._id})`);
      });
    }
    console.log('');

    // Find Abdullah profile
    const abdullahProfile = profiles.find((p: any) =>
      (p.id || p._id) === LATE_ABDULLAH_PROFILE_ID
    );

    if (!abdullahProfile) {
      console.log('❌ ABDULLAH PROFILE NOT FOUND!');
      console.log('');
      console.log('⚠️  The LATE_ABDULLAH_PROFILE_ID does not match any profile!');
      console.log('   Current value:', LATE_ABDULLAH_PROFILE_ID);
      console.log('   Please update it to one of the IDs above.');
      return;
    }

    console.log('✅ Abdullah profile found!');
    console.log('  Name:', abdullahProfile.name);
    console.log('  ID:', abdullahProfile.id || abdullahProfile._id);
    console.log('');

    // Check accounts
    console.log('📱 Fetching connected accounts...');
    const accountsResponse = await fetch(
      `https://getlate.dev/api/v1/accounts?profileId=${LATE_ABDULLAH_PROFILE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const accountsText = await accountsResponse.text();
    console.log('Accounts response:', accountsText);
    console.log('');

    let accountsData;
    try {
      accountsData = JSON.parse(accountsText);
    } catch (e) {
      console.error('❌ Failed to parse accounts response');
      return;
    }

    const accounts = Array.isArray(accountsData) ? accountsData :
                     accountsData.accounts ? accountsData.accounts :
                     accountsData.data ? accountsData.data : [];

    if (accounts.length === 0) {
      console.log('❌ NO ACCOUNTS CONNECTED!');
      console.log('');
      console.log('🚨 THIS IS THE PROBLEM!');
      console.log('');
      console.log('You need to connect social media accounts to Abdullah\'s Late.so profile:');
      console.log('  1. Go to https://app.getlate.dev');
      console.log('  2. Select the Abdullah profile');
      console.log('  3. Connect accounts: Instagram, TikTok, YouTube, LinkedIn, Facebook');
    } else {
      console.log(`✅ Found ${accounts.length} connected accounts:`);
      accounts.forEach((acc: any) => {
        console.log(`  - ${acc.platform}: ${acc.username || acc.name || 'Connected'}`);
        console.log(`    Account ID: ${acc._id || acc.id}`);
      });
    }

    // Check posts
    console.log('');
    console.log('📝 Checking existing posts...');
    const postsResponse = await fetch(
      `https://getlate.dev/api/v1/posts?profileId=${LATE_ABDULLAH_PROFILE_ID}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const postsText = await postsResponse.text();
    console.log('Posts response:', postsText.substring(0, 500));

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('');
  console.log('='.repeat(60));
}

checkLateProfileDirect().catch(console.error);
