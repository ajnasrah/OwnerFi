// Search for specific avatars
require('dotenv').config({ path: '.env.local' });

const searchTerm = process.argv[2] || 'sophia';

async function searchAvatars() {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  const response = await fetch('https://api.heygen.com/v2/avatars', {
    headers: {
      'accept': 'application/json',
      'x-api-key': HEYGEN_API_KEY
    }
  });

  const data = await response.json();
  const avatars = data.data.avatars || [];

  console.log(`Searching for "${searchTerm}"...\n`);

  const matches = avatars.filter(a =>
    a.avatar_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.avatar_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (matches.length === 0) {
    console.log('No matches found.');
    return;
  }

  console.log(`Found ${matches.length} matches:\n`);

  matches.forEach((avatar, i) => {
    console.log(`${i + 1}. ${avatar.avatar_name}`);
    console.log(`   ID: ${avatar.avatar_id}`);
    console.log(`   Gender: ${avatar.gender || 'N/A'}`);
    console.log();
  });
}

searchAvatars();
