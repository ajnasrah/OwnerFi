// List all available HeyGen voices
require('dotenv').config({ path: '.env.local' });

async function listVoices() {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found');
    process.exit(1);
  }

  console.log('🎤 Fetching available voices from HeyGen...\n');

  try {
    const response = await fetch('https://api.heygen.com/v2/voices', {
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

    const voices = data.data.voices || [];

    console.log(`Found ${voices.length} voices\n`);

    // Group by language and gender
    const englishVoices = voices.filter(v => 
      v.language && v.language.toLowerCase().includes('english')
    );

    console.log(`English voices: ${englishVoices.length}\n`);

    // Show all voice properties for first voice to understand structure
    console.log('\n=== SAMPLE VOICE STRUCTURE ===\n');
    if (englishVoices.length > 0) {
      console.log(JSON.stringify(englishVoices[0], null, 2));
    }

    // Show female voices
    const femaleVoices = englishVoices.filter(v => v.gender === 'female');
    console.log(`\n=== FEMALE VOICES (${femaleVoices.length}) ===\n`);
    femaleVoices.slice(0, 30).forEach((voice, i) => {
      const name = voice.display_name || voice.voice_name || voice.name || 'Unnamed';
      console.log(`${i + 1}. ${name}`);
      console.log(`   ID: ${voice.voice_id}`);
      console.log(`   Accent: ${voice.accent || 'N/A'}`);
      console.log(`   Style: ${voice.voice_style || 'N/A'}`);
      console.log();
    });

    // Show male voices
    const maleVoices = englishVoices.filter(v => v.gender === 'male');
    console.log(`\n=== MALE VOICES (${maleVoices.length}) ===\n`);
    maleVoices.slice(0, 30).forEach((voice, i) => {
      const name = voice.display_name || voice.voice_name || voice.name || 'Unnamed';
      console.log(`${i + 1}. ${name}`);
      console.log(`   ID: ${voice.voice_id}`);
      console.log(`   Accent: ${voice.accent || 'N/A'}`);
      console.log(`   Style: ${voice.voice_style || 'N/A'}`);
      console.log();
    });

    console.log('\n💡 To use a voice, copy its ID to podcast/config/guest-profiles.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listVoices();
