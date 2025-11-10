// List all available HeyGen avatars
require('dotenv').config({ path: '.env.local' });

async function listAvatars() {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found');
    process.exit(1);
  }

  console.log('📋 Fetching available avatars from HeyGen...\n');

  try {
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', data);
      process.exit(1);
    }

    const avatars = data.data.avatars || [];

    console.log(`Found ${avatars.length} avatars\n`);
    console.log('First 30 avatars:\n');

    avatars.slice(0, 30).forEach((avatar, i) => {
      console.log(`${i + 1}. ${avatar.avatar_name}`);
      console.log(`   ID: ${avatar.avatar_id}`);
      console.log(`   Gender: ${avatar.gender || 'N/A'}`);
      console.log(`   Preview: ${avatar.preview_image_url || 'N/A'}`);
      console.log();
    });

    console.log('\n💡 To use an avatar, copy its ID to podcast/config/guest-profiles.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listAvatars();
