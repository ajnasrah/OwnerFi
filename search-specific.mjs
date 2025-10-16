#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function searchSpecific() {
  const response = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY }
  });

  const data = await response.json();
  const avatars = data.data?.avatars || data.avatars || [];

  const searches = [
    { term: 'doctor', label: 'Doctor/Sofia' },
    { term: 'medical', label: 'Medical' },
    { term: 'automotive', label: 'Automotive/Colton' },
    { term: 'mechanic', label: 'Mechanic' },
    { term: 'finance', label: 'Finance/Henry' },
    { term: 'advisor', label: 'Advisor' },
    { term: 'real estate', label: 'Real Estate/Zelena' },
    { term: 'business', label: 'Business professionals' }
  ];

  for (const { term, label } of searches) {
    const matches = avatars.filter(a => 
      a.avatar_name?.toLowerCase().includes(term.toLowerCase())
    );

    if (matches.length > 0) {
      console.log(`\n🔍 ${label} (${matches.length} found):`);
      matches.slice(0, 5).forEach(m => {
        console.log(`  - ${m.avatar_name} (${m.avatar_id})`);
      });
    }
  }

  // Also check for female avatars that might be Zelena
  console.log('\n\n🔍 Female business/professional avatars:');
  const females = avatars.filter(a => 
    a.gender === 'female' && 
    (a.avatar_name?.toLowerCase().includes('business') || 
     a.avatar_name?.toLowerCase().includes('professional'))
  );
  females.slice(0, 10).forEach(m => {
    console.log(`  - ${m.avatar_name} (${m.avatar_id})`);
  });
}

searchSpecific().catch(console.error);
