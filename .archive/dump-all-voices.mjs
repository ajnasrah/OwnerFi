#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function dumpAllVoices() {
  console.log(`🔍 Fetching all HeyGen voices...\n`);

  try {
    const response = await fetch('https://api.heygen.com/v2/voices', {
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

    // Save to file
    writeFileSync('heygen-voices.json', JSON.stringify(data, null, 2));
    console.log(`✅ Saved all voices to heygen-voices.json\n`);

    const voices = data.data?.voices || data.voices || [];
    console.log(`📊 Total voices: ${voices.length}\n`);

    // Search for the specific ID
    const targetId = '5eb1adac973c432f90e07a5807059d55';
    console.log(`🔍 Searching for ID: ${targetId}\n`);

    // Check if it appears anywhere in the data
    const dataStr = JSON.stringify(data);
    if (dataStr.includes(targetId)) {
      console.log(`✅ ID found in response! Locating...\n`);

      // Find which voice contains it
      for (const voice of voices) {
        const voiceStr = JSON.stringify(voice);
        if (voiceStr.includes(targetId)) {
          console.log('Found in voice:', JSON.stringify(voice, null, 2));
        }
      }
    } else {
      console.log(`❌ ID not found in voices response\n`);
      console.log(`💡 This might be a talking_photo_id, not a voice_id\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

dumpAllVoices().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
