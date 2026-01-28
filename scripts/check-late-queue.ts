/**
 * Check Late.dev queue configuration for all brands
 * This shows which platforms are configured in the queue
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY?.trim();

const PROFILES = [
  { name: 'Carz', id: process.env.LATE_CARZ_PROFILE_ID?.trim() },
  { name: 'OwnerFi', id: process.env.LATE_OWNERFI_PROFILE_ID?.trim() },
  { name: 'Abdullah', id: process.env.LATE_ABDULLAH_PROFILE_ID?.trim() },
  { name: 'Gaza', id: process.env.LATE_GAZA_PROFILE_ID?.trim() },
];

async function getQueueSlots(profileId: string): Promise<any> {
  const response = await fetch(
    `${LATE_BASE_URL}/queue/slots?profileId=${profileId}`,
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

  return response.json();
}

async function getQueueConfig(profileId: string): Promise<any> {
  const response = await fetch(
    `${LATE_BASE_URL}/profiles/${profileId}`,
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

  return response.json();
}

async function checkQueues() {
  console.log('\n' + '='.repeat(70));
  console.log('  LATE.DEV QUEUE CONFIGURATION CHECK');
  console.log('='.repeat(70) + '\n');

  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not configured');
    process.exit(1);
  }

  for (const profile of PROFILES) {
    console.log(`\n--- ${profile.name} Queue ---\n`);

    if (!profile.id) {
      console.log(`  ❌ Profile ID not configured`);
      continue;
    }

    try {
      // Get queue slots
      const slots = await getQueueSlots(profile.id);
      console.log(`  Queue Slots:`);
      console.log(JSON.stringify(slots, null, 2));

      // Get profile config (might include queue platforms)
      const profileConfig = await getQueueConfig(profile.id);
      console.log(`\n  Profile Config:`);
      console.log(JSON.stringify(profileConfig, null, 2).substring(0, 1000));

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`
TO FIX THE PLATFORM ISSUE:

The issue is that Late.dev's queue system only posts to platforms
configured in the QUEUE SCHEDULE - not all connected accounts.

Go to https://app.getlate.dev for each profile and:
1. Click on the profile (Carz, OwnerFi, etc.)
2. Go to "Queue" tab
3. Add ALL platforms you want to post to in the queue schedule
4. Make sure Instagram, TikTok, Facebook, LinkedIn, Threads, Twitter
   are ALL included in the queue times

Currently only Instagram and TikTok are in the queue schedule,
which is why only those platforms are receiving posts.
`);
}

checkQueues()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
