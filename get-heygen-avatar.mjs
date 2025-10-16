#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function searchAvatars(searchTerm) {
  console.log(`🔍 Searching HeyGen avatars for: "${searchTerm}"\n`);

  try {
    // Get all avatars
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const avatars = data.data?.avatars || data.avatars || [];

    console.log(`📊 Total avatars: ${avatars.length}\n`);

    // Search for matching avatars
    const matches = avatars.filter(avatar => {
      const nameMatch = avatar.avatar_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = avatar.avatar_id?.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || idMatch;
    });

    if (matches.length === 0) {
      console.log(`❌ No avatars found matching "${searchTerm}"\n`);

      // Show similar names for debugging
      console.log('💡 Available avatar names containing "oxana":');
      const oxanaAvatars = avatars.filter(a => a.avatar_name?.toLowerCase().includes('oxana'));
      oxanaAvatars.forEach(a => {
        console.log(`   - ${a.avatar_name} (ID: ${a.avatar_id})`);
      });

      console.log('\n💡 Available avatar names containing "yoga":');
      const yogaAvatars = avatars.filter(a => a.avatar_name?.toLowerCase().includes('yoga'));
      yogaAvatars.forEach(a => {
        console.log(`   - ${a.avatar_name} (ID: ${a.avatar_id})`);
      });

      return;
    }

    console.log(`✅ Found ${matches.length} matching avatar(s):\n`);

    matches.forEach((avatar, index) => {
      console.log(`═══════════════════════════════════════`);
      console.log(`Avatar ${index + 1}:`);
      console.log(`═══════════════════════════════════════`);
      console.log(`Name: ${avatar.avatar_name}`);
      console.log(`ID: ${avatar.avatar_id}`);
      console.log(`Type: ${avatar.avatar_type || 'N/A'}`);
      console.log(`Gender: ${avatar.gender || 'N/A'}`);
      console.log(`Preview Image: ${avatar.preview_image_url || avatar.image_url || 'N/A'}`);
      console.log(`Preview Video: ${avatar.preview_video_url || avatar.video_url || 'N/A'}`);

      if (avatar.talking_photo) {
        console.log(`\nTalking Photo Info:`);
        console.log(`  - Talking Photo ID: ${avatar.talking_photo.talking_photo_id || 'N/A'}`);
        console.log(`  - Style: ${avatar.talking_photo.style || 'N/A'}`);
      }

      console.log(`\nFull JSON:`);
      console.log(JSON.stringify(avatar, null, 2));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Get search term from command line or use default
const searchTerm = process.argv[2] || 'oxana_yoga_front_2';

searchAvatars(searchTerm).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
