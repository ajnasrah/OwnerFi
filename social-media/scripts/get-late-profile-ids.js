/**
 * Get Late Profile IDs
 *
 * This script fetches all your Late profiles and displays their IDs.
 * You'll need these IDs to configure your .env file for each brand.
 *
 * Usage:
 *   1. Set LATE_API_KEY in your .env file
 *   2. Run: node social-media/scripts/get-late-profile-ids.js
 *   3. Copy the profile IDs to your .env:
 *      LATE_OWNERFI_PROFILE_ID="your_ownerfi_profile_id"
 *      LATE_CARZ_PROFILE_ID="your_carz_profile_id"
 *      LATE_PODCAST_PROFILE_ID="your_podcast_profile_id"
 */

require('dotenv').config();

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY;

async function getLateProfiles() {
  if (!LATE_API_KEY) {
    console.error('❌ Error: LATE_API_KEY not found in .env file');
    console.log('\n📝 To fix this:');
    console.log('1. Sign up at https://getlate.dev');
    console.log('2. Get your API key from the dashboard');
    console.log('3. Add it to your .env file:');
    console.log('   LATE_API_KEY=your_api_key_here\n');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching your Late profiles...\n');

    const response = await fetch(
      `${LATE_BASE_URL}/profiles`,
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

    const profiles = await response.json();

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  No Late profiles found.');
      console.log('Make sure you have created profiles in your Late dashboard.');
      console.log('Go to: https://getlate.dev/dashboard\n');
      process.exit(1);
    }

    console.log('✅ Found', profiles.length, 'Late profile(s):\n');
    console.log('═'.repeat(80));

    for (const profile of profiles) {
      console.log(`\n📁 ${profile.name || 'Unnamed Profile'}`);
      console.log('   Profile ID:', profile.id);

      // Fetch accounts for this profile
      try {
        const accountsResponse = await fetch(
          `${LATE_BASE_URL}/accounts?profileId=${profile.id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${LATE_API_KEY}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (accountsResponse.ok) {
          const accounts = await accountsResponse.json();

          if (accounts && accounts.length > 0) {
            console.log('   Connected Accounts:');
            accounts.forEach(account => {
              const platform = (account.platform || 'unknown').toUpperCase();
              const username = account.username || account.name || account.id;
              console.log(`     • ${platform}: ${username}`);
            });
          } else {
            console.log('   ⚠️  No connected accounts');
          }
        }
      } catch (err) {
        console.log('   (Could not fetch accounts)');
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n📋 Environment Variables to Add:\n');

    // Try to match profiles to brands based on name
    const ownerfi = profiles.find(p =>
      p.name?.toLowerCase().includes('ownerfi') ||
      p.name?.toLowerCase().includes('owner')
    );
    const carz = profiles.find(p =>
      p.name?.toLowerCase().includes('carz') ||
      p.name?.toLowerCase().includes('car')
    );
    const podcast = profiles.find(p =>
      p.name?.toLowerCase().includes('podcast') ||
      p.name?.toLowerCase().includes('pod')
    );

    if (ownerfi) {
      console.log(`LATE_OWNERFI_PROFILE_ID="${ownerfi.id}"`);
    } else {
      console.log('# LATE_OWNERFI_PROFILE_ID="profile_id_here"  # ⚠️  Create OwnerFi profile in Late');
    }

    if (carz) {
      console.log(`LATE_CARZ_PROFILE_ID="${carz.id}"`);
    } else {
      console.log('# LATE_CARZ_PROFILE_ID="profile_id_here"  # ⚠️  Create Carz profile in Late');
    }

    if (podcast) {
      console.log(`LATE_PODCAST_PROFILE_ID="${podcast.id}"`);
    } else {
      console.log('# LATE_PODCAST_PROFILE_ID="profile_id_here"  # ⚠️  Create Podcast profile in Late');
    }

    console.log('\n📝 Copy the above lines to your .env file\n');

    if (!ownerfi || !carz || !podcast) {
      console.log('⚠️  Warning: Some brand profiles are missing.');
      console.log('To create profiles:');
      console.log('1. Go to https://getlate.dev/dashboard');
      console.log('2. Create a new profile for each brand');
      console.log('3. Connect social media accounts to each profile');
      console.log('4. Run this script again to get the profile IDs\n');
    }

    console.log('💡 Tip: Each profile can connect to one account per platform.');
    console.log('   Example: OwnerFi profile → OwnerFi Instagram + OwnerFi TikTok + OwnerFi YouTube...\n');

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Your API key may be invalid or expired.');
      console.log('Get a new key at: https://getlate.dev/dashboard\n');
    }
  }
}

getLateProfiles();
