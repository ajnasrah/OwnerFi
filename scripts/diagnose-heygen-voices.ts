/**
 * Diagnose HeyGen Voice Issues
 *
 * Calls the HeyGen API to list all available voices and compares
 * against our configured voice IDs to find which ones are invalid.
 * Then suggests replacement voices.
 *
 * Usage: npx tsx scripts/diagnose-heygen-voices.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

// Our currently configured voice IDs (from src/config/heygen-agents.ts)
const CONFIGURED_VOICES: Record<string, { name: string; usedBy: string[] }> = {
  '9070a6c2dbd54c10bb111dc8c655bff7': {
    name: 'Abdullah Original Voice',
    usedBy: ['abdullah-primary (DISABLED)', 'benefit fallback', 'abdullah fallback', 'realtors fallback']
  },
  '33e77b383694491db3160af5a9f9e0ab': {
    name: 'Abdullah Voice Clone',
    usedBy: ['abdullah-avatar (DISABLED)']
  },
  '35659e86ce244d8389d525a9648d9c4a': {
    name: 'Carter Lee',
    usedBy: ['aditya-brown-blazer', 'gaza-correspondent', 'edward-business (DISABLED)']
  },
  'f38a635bee7a4d1f9b0a654a31d050d2': {
    name: 'Chill Brian',
    usedBy: ['adrian-blue-sweater', 'gaza-newsreader-male', 'josh-casual (DISABLED)', 'tyler-hoodie']
  },
  '3a4114d2ebe542409df872a3323b7574': {
    name: 'Adventure Alex - Friendly',
    usedBy: ['abigail-expressive', 'kayla-casual (DISABLED)', 'anna-teacher']
  },
  '3e3193831b9e4e39afabb803696868d4': {
    name: 'Adventure Alex (base)',
    usedBy: ['gaza-humanitarian']
  },
  '42d00d4aac5441279d8536cd6b52c53c': {
    name: 'Hope',
    usedBy: ['adriana-biztalk', 'gaza-newsreader-female', 'susan-professional']
  }
};

interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
  emotion_support?: boolean;
  support_pause?: boolean;
}

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 HEYGEN VOICE DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log();

  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log(`✅ API Key: ${HEYGEN_API_KEY.substring(0, 8)}...${HEYGEN_API_KEY.substring(HEYGEN_API_KEY.length - 4)}`);
  console.log();

  // Step 1: Fetch all available voices
  console.log('📡 Fetching available voices from HeyGen API...');
  console.log();

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
      console.error(`❌ HeyGen API error: ${response.status}`);
      console.error(`   Response: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();

    // Handle different response formats
    const voices: HeyGenVoice[] = data.data?.voices || data.voices || data.data || data || [];

    console.log(`📊 Total available voices: ${voices.length}`);
    console.log();

    // Step 2: Check each configured voice ID
    console.log('='.repeat(70));
    console.log('🔎 CHECKING CONFIGURED VOICE IDs');
    console.log('='.repeat(70));
    console.log();

    const voiceMap = new Map<string, HeyGenVoice>();
    for (const voice of voices) {
      voiceMap.set(voice.voice_id, voice);
    }

    const validVoices: string[] = [];
    const invalidVoices: string[] = [];

    for (const [voiceId, config] of Object.entries(CONFIGURED_VOICES)) {
      const found = voiceMap.get(voiceId);

      if (found) {
        console.log(`✅ VALID: ${config.name}`);
        console.log(`   Voice ID: ${voiceId}`);
        console.log(`   API Name: ${found.name}`);
        console.log(`   Language: ${found.language}, Gender: ${found.gender}`);
        console.log(`   Emotion Support: ${found.emotion_support ? 'YES' : 'NO'}`);
        console.log(`   Used by: ${config.usedBy.join(', ')}`);
        validVoices.push(voiceId);
      } else {
        console.log(`❌ INVALID/REMOVED: ${config.name}`);
        console.log(`   Voice ID: ${voiceId}`);
        console.log(`   Used by: ${config.usedBy.join(', ')}`);
        console.log(`   ⚠️  THIS VOICE NO LONGER EXISTS IN HEYGEN`);
        invalidVoices.push(voiceId);
      }
      console.log();
    }

    // Step 3: Summary
    console.log('='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log();
    console.log(`Valid voices:   ${validVoices.length}/${Object.keys(CONFIGURED_VOICES).length}`);
    console.log(`Invalid voices: ${invalidVoices.length}/${Object.keys(CONFIGURED_VOICES).length}`);
    console.log();

    if (invalidVoices.length > 0) {
      console.log('❌ INVALID VOICES (causing failures):');
      for (const voiceId of invalidVoices) {
        const config = CONFIGURED_VOICES[voiceId];
        console.log(`   - ${config.name} (${voiceId})`);
        console.log(`     Affects: ${config.usedBy.join(', ')}`);
      }
      console.log();

      // Step 4: Suggest replacements
      console.log('='.repeat(70));
      console.log('💡 SUGGESTED REPLACEMENT VOICES');
      console.log('='.repeat(70));
      console.log();

      // Find English voices with emotion support
      const englishVoices = voices.filter((v: HeyGenVoice) =>
        v.language?.toLowerCase().includes('english') ||
        v.language?.toLowerCase() === 'en'
      );
      const emotionVoices = englishVoices.filter((v: HeyGenVoice) => v.emotion_support);

      console.log(`English voices available: ${englishVoices.length}`);
      console.log(`With emotion support: ${emotionVoices.length}`);
      console.log();

      // Show top male voices
      const maleVoices = emotionVoices.filter((v: HeyGenVoice) =>
        v.gender?.toLowerCase() === 'male'
      );
      const femaleVoices = emotionVoices.filter((v: HeyGenVoice) =>
        v.gender?.toLowerCase() === 'female'
      );

      console.log('🔵 Top Male Voices (English, with emotion):');
      for (const voice of maleVoices.slice(0, 10)) {
        console.log(`   ${voice.name} → ${voice.voice_id}`);
      }
      console.log();

      console.log('🔴 Top Female Voices (English, with emotion):');
      for (const voice of femaleVoices.slice(0, 10)) {
        console.log(`   ${voice.name} → ${voice.voice_id}`);
      }
      console.log();

      // Show ALL voices for reference
      console.log('='.repeat(70));
      console.log('📋 ALL ENGLISH VOICES WITH EMOTION SUPPORT');
      console.log('='.repeat(70));
      console.log();
      for (const voice of emotionVoices) {
        console.log(`${voice.gender?.padEnd(8)} | ${voice.name?.padEnd(40)} | ${voice.voice_id}`);
      }
    } else {
      console.log('✅ All configured voices are valid!');
      console.log();
      console.log('If videos are still failing, the issue may be:');
      console.log('  1. HeyGen credits/quota exhausted');
      console.log('  2. Avatar IDs invalid (not voice issue)');
      console.log('  3. Script text too long (>5000 chars)');
      console.log('  4. Rate limiting');
    }

    // Step 5: Also check quota
    console.log();
    console.log('='.repeat(70));
    console.log('💳 CHECKING HEYGEN QUOTA');
    console.log('='.repeat(70));
    console.log();

    try {
      const quotaResponse = await fetch('https://api.heygen.com/v2/user/remaining_quota', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY
        }
      });

      if (quotaResponse.ok) {
        const quotaData = await quotaResponse.json();
        const remainingQuota = quotaData.data?.remaining_quota || quotaData.remaining_quota || 0;
        const remainingCredits = Math.floor(remainingQuota / 60);

        console.log(`Raw quota units: ${remainingQuota}`);
        console.log(`Credits remaining: ${remainingCredits}`);

        if (remainingCredits <= 0) {
          console.log('⚠️  NO CREDITS REMAINING - This would also cause failures!');
        } else if (remainingCredits < 10) {
          console.log('⚠️  Very low credits - running out soon');
        } else {
          console.log('✅ Credits look healthy');
        }
      } else {
        console.error(`❌ Quota check failed: ${quotaResponse.status}`);
      }
    } catch (quotaError) {
      console.error('❌ Error checking quota:', quotaError);
    }

    // Step 6: Test a video generation (dry run)
    console.log();
    console.log('='.repeat(70));
    console.log('🧪 TEST VIDEO GENERATION (test mode)');
    console.log('='.repeat(70));
    console.log();

    if (validVoices.length > 0) {
      const testVoiceId = validVoices[0];
      console.log(`Testing with voice: ${CONFIGURED_VOICES[testVoiceId].name} (${testVoiceId})`);

      const testRequest = {
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: 'Aditya_public_4',
            scale: 1.5,
            talking_style: 'expressive'
          },
          voice: {
            type: 'text',
            voice_id: testVoiceId,
            input_text: 'This is a test of the voice system.',
            speed: 1.0,
            emotion: 'Friendly'
          },
          background: {
            type: 'color',
            value: '#1a1a2e'
          }
        }],
        dimension: { width: 1080, height: 1920 },
        test: true // Test mode - won't consume credits
      };

      try {
        const testResponse = await fetch('https://api.heygen.com/v2/video/generate', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': HEYGEN_API_KEY
          },
          body: JSON.stringify(testRequest)
        });

        const testData = await testResponse.json();

        if (testResponse.ok && testData.data?.video_id) {
          console.log(`✅ Test video created: ${testData.data.video_id}`);
          console.log('   Voice configuration is working!');
        } else {
          console.log(`❌ Test video FAILED: ${testResponse.status}`);
          console.log(`   Response: ${JSON.stringify(testData, null, 2)}`);
          console.log();
          console.log('   This confirms the voice/avatar configuration issue.');
        }
      } catch (testError) {
        console.error('❌ Test request error:', testError);
      }
    }

    console.log();
    console.log('='.repeat(70));
    console.log('Done! Review the output above to identify the issue.');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
