#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

const searchNames = [
  'oxana yoga',
  'zelena',
  'sofia',
  'colton',
  'vince',
  'henry'
];

async function searchByName() {
  console.log('🔍 Fetching all HeyGen avatars...\n');

  const response = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY }
  });

  const data = await response.json();
  const avatars = data.data?.avatars || data.avatars || [];

  console.log(`📊 Total avatars: ${avatars.length}\n`);

  for (const searchName of searchNames) {
    console.log(`\n🔍 Searching for: "${searchName}"`);
    console.log('═'.repeat(60));
    
    const matches = avatars.filter(a => 
      a.avatar_name?.toLowerCase().includes(searchName.toLowerCase()) ||
      a.name?.toLowerCase().includes(searchName.toLowerCase())
    );

    if (matches.length > 0) {
      console.log(`✅ Found ${matches.length} match(es):\n`);
      matches.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.avatar_name || m.name}`);
        console.log(`     Avatar ID: ${m.avatar_id}`);
        console.log(`     Type: ${m.avatar_type || 'N/A'}`);
        console.log(`     Gender: ${m.gender || 'N/A'}`);
        if (m.talking_photo_id) {
          console.log(`     Talking Photo ID: ${m.talking_photo_id}`);
        }
        console.log('');
      });
    } else {
      console.log(`❌ No matches found\n`);
    }
  }
}

searchByName().catch(console.error);
