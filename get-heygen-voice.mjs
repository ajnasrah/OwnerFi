#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function getVoiceInfo(voiceId) {
  console.log(`🔍 Fetching HeyGen voice: "${voiceId}"\n`);

  try {
    // Get all voices
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
    const voices = data.data?.voices || data.voices || [];

    console.log(`📊 Total voices: ${voices.length}\n`);

    // Find matching voice by ID
    let voice = voices.find(v => v.voice_id === voiceId);

    // If not found, try searching by name "oxana" or "lifelike"
    if (!voice && (voiceId.includes('5eb1adac') || voiceId === '5eb1adac973c432f90e07a5807059d55')) {
      console.log('🔍 Searching for Oxana/Lifelike voices...\n');
      const oxanaVoices = voices.filter(v =>
        v.display_name?.toLowerCase().includes('oxana') ||
        v.name?.toLowerCase().includes('oxana') ||
        v.display_name?.toLowerCase().includes('lifelike') ||
        v.voice_id === voiceId
      );

      console.log(`Found ${oxanaVoices.length} Oxana/Lifelike voices:`);
      oxanaVoices.forEach(v => {
        console.log(`  - ${v.display_name || v.name} (ID: ${v.voice_id})`);
      });
      console.log('');

      // Try exact match again with different field names
      voice = voices.find(v =>
        v.voice_id === voiceId ||
        v.id === voiceId ||
        v.uuid === voiceId
      );
    }

    if (!voice) {
      console.log(`❌ Voice not found: ${voiceId}\n`);
      console.log('💡 Showing all available voice ID formats:');
      voices.slice(0, 5).forEach(v => {
        console.log(`  Sample: ${JSON.stringify({
          voice_id: v.voice_id,
          id: v.id,
          uuid: v.uuid,
          name: v.display_name || v.name
        }, null, 2)}`);
      });
      return;
    }

    console.log(`✅ Found voice:\n`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Name: ${voice.display_name || voice.name}`);
    console.log(`ID: ${voice.voice_id}`);
    console.log(`Gender: ${voice.gender || 'N/A'}`);
    console.log(`Language: ${voice.language || 'N/A'}`);
    console.log(`Accent: ${voice.accent || 'N/A'}`);
    console.log(`Age: ${voice.age || 'N/A'}`);
    console.log(`Preview URL: ${voice.preview_audio_url || voice.preview_audio || 'N/A'}`);
    console.log(`\nFull JSON:`);
    console.log(JSON.stringify(voice, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

const voiceId = process.argv[2] || '5eb1adac973c432f90e07a5807059d55';

getVoiceInfo(voiceId).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
