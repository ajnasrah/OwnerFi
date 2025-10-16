#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

const searchIds = [
  '5eb1adac973c432f90e07a5807059d55', // Oxana Yoga
  'c308729a2d444a09a98cb29baee73d88', // Zelena
  '1732832799', // Sofia
  '711a1d390a2a4634b5b515d44a631ab3', // Colton
  '1727676442', // Vince
  '1375223b2cc24ff0a21830fbf5cb45ba'  // Henry
];

async function searchAllTalkingPhotos() {
  console.log('🔍 Fetching all talking photos from HeyGen...\n');

  const response = await fetch('https://api.heygen.com/v1/talking_photo.list', {
    headers: { 'accept': 'application/json', 'x-api-key': HEYGEN_API_KEY }
  });

  const data = await response.json();
  const photos = data.data || [];

  console.log(`📊 Total talking photos: ${photos.length}\n`);

  for (const searchId of searchIds) {
    const found = photos.find(p => p.id === searchId);
    
    if (found) {
      console.log(`✅ FOUND: ${searchId}`);
      console.log(`   Image URL: ${found.image_url?.substring(0, 80)}...`);
    } else {
      console.log(`❌ NOT FOUND: ${searchId}`);
    }
  }

  console.log('\n📋 Summary:');
  const foundCount = searchIds.filter(id => photos.find(p => p.id === id)).length;
  console.log(`   Found: ${foundCount}/${searchIds.length}`);
  console.log(`   Missing: ${searchIds.length - foundCount}/${searchIds.length}`);
}

searchAllTalkingPhotos().catch(console.error);
