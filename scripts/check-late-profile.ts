import * as dotenv from 'dotenv';
import { getLateProfiles, getLateAccounts } from '../src/lib/late-api';

dotenv.config({ path: '.env.local' });

async function checkLateProfile() {
  console.log('='.repeat(60));
  console.log('🔍 CHECKING LATE.SO ABDULLAH PROFILE');
  console.log('='.repeat(60));
  console.log('');

  const LATE_ABDULLAH_PROFILE_ID = process.env.LATE_ABDULLAH_PROFILE_ID;
  console.log('📋 Environment:');
  console.log('  LATE_ABDULLAH_PROFILE_ID:', LATE_ABDULLAH_PROFILE_ID);
  console.log('  LATE_API_KEY:', process.env.LATE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('');

  try {
    // Get all profiles
    console.log('📡 Fetching all Late.so profiles...');
    const profiles = await getLateProfiles();
    console.log('');

    // Find Abdullah profile
    const abdullahProfile = profiles.find(p => p.id === LATE_ABDULLAH_PROFILE_ID);

    if (!abdullahProfile) {
      console.log('❌ ABDULLAH PROFILE NOT FOUND!');
      console.log('');
      console.log('Available profiles:');
      profiles.forEach(p => {
        console.log(`  - ${p.name} (ID: ${p.id})`);
      });
      console.log('');
      console.log('⚠️  The LATE_ABDULLAH_PROFILE_ID in .env.local does not match any profile!');
      console.log('   Please update it to one of the IDs above.');
      return;
    }

    console.log('✅ Abdullah profile found!');
    console.log('  Name:', abdullahProfile.name);
    console.log('  ID:', abdullahProfile.id);
    console.log('');

    // Get accounts for this profile
    console.log('📱 Checking connected accounts...');
    const accounts = await getLateAccounts(LATE_ABDULLAH_PROFILE_ID!);

    if (accounts.length === 0) {
      console.log('❌ NO ACCOUNTS CONNECTED!');
      console.log('');
      console.log('This is the problem! You need to connect social media accounts to this profile.');
      console.log('Go to https://app.getlate.dev and connect:');
      console.log('  - Instagram');
      console.log('  - TikTok');
      console.log('  - YouTube');
      console.log('  - LinkedIn');
      console.log('  - Facebook');
    } else {
      console.log(`✅ Found ${accounts.length} connected accounts:`);
      accounts.forEach(acc => {
        console.log(`  - ${acc.platform}: ${acc.username || acc.name || acc.accountId || 'Connected'}`);
      });
    }

    console.log('');

    // Check for queue configuration
    console.log('📅 Checking queue configuration...');
    try {
      const response = await fetch(
        `https://getlate.dev/api/v1/queue/slots?profileId=${LATE_ABDULLAH_PROFILE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.ok) {
        const queueData = await response.json();
        console.log('✅ Queue configured:', JSON.stringify(queueData, null, 2));
      } else {
        console.log('⚠️  Queue not configured (this might be okay)');
      }
    } catch (e) {
      console.log('⚠️  Could not check queue configuration');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('');
  console.log('='.repeat(60));
}

checkLateProfile().catch(console.error);
