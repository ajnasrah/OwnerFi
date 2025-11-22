import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkAbdullahLateProfile() {
  console.log('='.repeat(60));
  console.log('🔍 CHECKING ABDULLAH LATE.SO PROFILE');
  console.log('='.repeat(60));
  console.log('');

  const LATE_ABDULLAH_PROFILE_ID = process.env.LATE_ABDULLAH_PROFILE_ID;
  const LATE_API_KEY = process.env.LATE_API_KEY;

  console.log('📋 Configuration:');
  console.log('  LATE_ABDULLAH_PROFILE_ID:', LATE_ABDULLAH_PROFILE_ID);
  console.log('  LATE_API_KEY:', LATE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('');

  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not set!');
    return;
  }

  try {
    // Get profile details
    console.log('📡 Fetching Abdullah profile from Late.so...');
    const profilesResponse = await fetch('https://getlate.dev/api/v1/profiles', {
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const profilesData = await profilesResponse.json();
    const profiles = Array.isArray(profilesData) ? profilesData :
                     profilesData.profiles ? profilesData.profiles :
                     profilesData.data ? profilesData.data : [];

    const abdullahProfile = profiles.find((p: any) =>
      (p.id || p._id) === LATE_ABDULLAH_PROFILE_ID
    );

    if (!abdullahProfile) {
      console.log('❌ PROFILE NOT FOUND!');
      console.log('Available profiles:');
      profiles.forEach((p: any) => {
        console.log(`  - ${p.name} (ID: ${p.id || p._id})`);
      });
      return;
    }

    console.log('✅ Profile found!');
    console.log('  Name:', abdullahProfile.name);
    console.log('  ID:', abdullahProfile.id || abdullahProfile._id);
    console.log('  Description:', abdullahProfile.description || 'N/A');
    console.log('');

    // Get connected accounts
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

    const accountsData = await accountsResponse.json();
    const accounts = Array.isArray(accountsData) ? accountsData :
                     accountsData.accounts ? accountsData.accounts :
                     accountsData.data ? accountsData.data : [];

    if (accounts.length === 0) {
      console.log('❌ NO ACCOUNTS CONNECTED!');
      console.log('');
      console.log('🚨 ACTION REQUIRED:');
      console.log('   You need to connect Abdullah\'s social media accounts.');
      console.log('   Steps:');
      console.log('   1. Go to https://app.getlate.dev');
      console.log('   2. Select the "Abdullah personal" profile');
      console.log('   3. Connect social media accounts:');
      console.log('      - Instagram (personal account)');
      console.log('      - TikTok (personal account)');
      console.log('      - YouTube (personal channel)');
      console.log('      - LinkedIn (personal profile)');
      console.log('      - Facebook (personal page)');
      console.log('      - Twitter/X (personal account)');
    } else {
      console.log(`✅ Found ${accounts.length} connected accounts:`);
      accounts.forEach((acc: any) => {
        console.log(`  - ${acc.platform}: ${acc.username || acc.displayName || acc.name || 'Connected'}`);
        console.log(`    Status: ${acc.isActive ? '✅ Active' : '❌ Inactive'}`);
      });
    }

    // Check queue configuration
    console.log('');
    console.log('📅 Checking queue configuration...');
    const queueResponse = await fetch(
      `https://getlate.dev/api/v1/queue/slots?profileId=${LATE_ABDULLAH_PROFILE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      if (queueData.slots && queueData.slots.length > 0) {
        console.log(`✅ Queue configured with ${queueData.slots.length} time slots`);
        console.log(`   Timezone: ${queueData.timezone || 'N/A'}`);
        console.log(`   Active: ${queueData.active ? 'Yes' : 'No'}`);
      } else {
        console.log('⚠️  Queue exists but no time slots configured');
        console.log('   Posts will be queued but need manual scheduling');
      }
    } else {
      console.log('⚠️  No queue configuration found');
      console.log('   Posts will need to be scheduled manually or use immediate posting');
    }

    // Check recent posts
    console.log('');
    console.log('📝 Checking recent posts...');
    const postsResponse = await fetch(
      `https://getlate.dev/api/v1/posts?profileId=${LATE_ABDULLAH_PROFILE_ID}&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      const posts = Array.isArray(postsData) ? postsData :
                    postsData.posts ? postsData.posts :
                    postsData.data ? postsData.data : [];

      if (posts.length === 0) {
        console.log('📭 No posts found yet');
        console.log('   This is expected if the environment variable was just updated');
      } else {
        console.log(`✅ Found ${posts.length} recent posts:`);
        posts.forEach((post: any, i: number) => {
          console.log(`  ${i + 1}. ${post.content?.substring(0, 50) || 'N/A'}...`);
          console.log(`     Status: ${post.status || 'N/A'}`);
          console.log(`     Created: ${post.createdAt || 'N/A'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('');
  console.log('='.repeat(60));
}

checkAbdullahLateProfile().catch(console.error);
