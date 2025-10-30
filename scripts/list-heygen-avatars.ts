/**
 * List all available HeyGen avatars in your account
 * Usage: npx tsx scripts/list-heygen-avatars.ts
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found in environment');
  process.exit(1);
}

async function listAvatars() {
  console.log('🔍 Fetching your HeyGen avatars...\n');

  try {
    // Try v2 API first
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY!
      }
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status}`);
      const errorText = await response.text();
      console.error(errorText);

      // Try v1 API as fallback
      console.log('\nTrying v1 API...\n');
      const v1Response = await fetch('https://api.heygen.com/v1/avatar.list', {
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY!
        }
      });

      if (!v1Response.ok) {
        throw new Error(`Both v1 and v2 API failed: ${v1Response.status}`);
      }

      const v1Data = await v1Response.json();
      console.log('✅ Available Avatars (v1):');
      console.log(JSON.stringify(v1Data, null, 2));
      return;
    }

    const data = await response.json();
    console.log('✅ Available Avatars:');
    console.log(JSON.stringify(data, null, 2));

    // Extract talking photos specifically
    if (data.data?.avatars) {
      console.log('\n📸 Talking Photos:');
      const talkingPhotos = data.data.avatars.filter((a: any) =>
        a.avatar_type === 'talking_photo' || a.type === 'talking_photo'
      );

      if (talkingPhotos.length > 0) {
        talkingPhotos.forEach((avatar: any) => {
          console.log(`  - ${avatar.avatar_name || avatar.name}: ${avatar.avatar_id || avatar.id}`);
        });
      } else {
        console.log('  No talking photos found');
      }
    }

  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

listAvatars();
