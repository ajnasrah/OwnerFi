/**
 * Discover HeyGen Assets
 * Fetches all available avatars and voices from HeyGen API
 * and saves them to a JSON file for configuration
 */

import 'dotenv/config';

const HEYGEN_API_BASE = 'https://api.heygen.com';
const API_KEY = process.env.HEYGEN_API_KEY;

if (!API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found in environment');
  process.exit(1);
}

interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url?: string;
  type?: string;
}

interface HeyGenTalkingPhoto {
  talking_photo_id: string;
  talking_photo_name: string;
  preview_image_url: string;
}

interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
  support_pause?: boolean;
  emotion_support?: boolean;
}

async function fetchAvatars(): Promise<{ avatars: HeyGenAvatar[]; talking_photos: HeyGenTalkingPhoto[] }> {
  console.log('🔍 Fetching avatars from HeyGen...');

  const response = await fetch(`${HEYGEN_API_BASE}/v2/avatars`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-key': API_KEY!
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch avatars: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // HeyGen v2 API returns data nested
  const avatars = data.data?.avatars || data.avatars || [];
  const talkingPhotos = data.data?.talking_photos || data.talking_photos || [];

  console.log(`   Found ${avatars.length} avatars`);
  console.log(`   Found ${talkingPhotos.length} talking photos`);

  return { avatars, talking_photos: talkingPhotos };
}

async function fetchVoices(): Promise<HeyGenVoice[]> {
  console.log('🔍 Fetching voices from HeyGen...');

  const response = await fetch(`${HEYGEN_API_BASE}/v2/voices`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-key': API_KEY!
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch voices: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // HeyGen v2 API returns data nested
  const voices = data.data?.voices || data.voices || [];

  console.log(`   Found ${voices.length} voices`);

  return voices;
}

async function main() {
  console.log('\n🎬 HeyGen Asset Discovery\n');
  console.log('='.repeat(50));

  try {
    // Fetch all assets
    const { avatars, talking_photos } = await fetchAvatars();
    const voices = await fetchVoices();

    console.log('\n' + '='.repeat(50));
    console.log('\n📊 SUMMARY\n');

    // Group avatars by gender
    const maleAvatars = avatars.filter((a: HeyGenAvatar) => a.gender?.toLowerCase() === 'male');
    const femaleAvatars = avatars.filter((a: HeyGenAvatar) => a.gender?.toLowerCase() === 'female');

    console.log(`👤 Avatars: ${avatars.length} total`);
    console.log(`   - Male: ${maleAvatars.length}`);
    console.log(`   - Female: ${femaleAvatars.length}`);
    console.log(`📷 Talking Photos: ${talking_photos.length}`);

    // Group voices by language
    const voicesByLanguage: Record<string, HeyGenVoice[]> = {};
    voices.forEach((v: HeyGenVoice) => {
      const lang = v.language || 'unknown';
      if (!voicesByLanguage[lang]) voicesByLanguage[lang] = [];
      voicesByLanguage[lang].push(v);
    });

    console.log(`🗣️  Voices: ${voices.length} total`);
    Object.entries(voicesByLanguage)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([lang, langVoices]) => {
        console.log(`   - ${lang}: ${langVoices.length}`);
      });

    // Print detailed lists
    console.log('\n' + '='.repeat(50));
    console.log('\n🎭 AVATARS (First 20)\n');

    avatars.slice(0, 20).forEach((avatar: HeyGenAvatar, i: number) => {
      console.log(`${i + 1}. ${avatar.avatar_name || 'Unnamed'}`);
      console.log(`   ID: ${avatar.avatar_id}`);
      console.log(`   Gender: ${avatar.gender || 'N/A'}`);
      console.log(`   Preview: ${avatar.preview_image_url || 'N/A'}`);
      console.log('');
    });

    console.log('\n' + '='.repeat(50));
    console.log('\n📷 TALKING PHOTOS\n');

    talking_photos.forEach((photo: HeyGenTalkingPhoto, i: number) => {
      console.log(`${i + 1}. ${photo.talking_photo_name || 'Unnamed'}`);
      console.log(`   ID: ${photo.talking_photo_id}`);
      console.log(`   Preview: ${photo.preview_image_url || 'N/A'}`);
      console.log('');
    });

    console.log('\n' + '='.repeat(50));
    console.log('\n🗣️  ENGLISH VOICES\n');

    const englishVoices = voices.filter((v: HeyGenVoice) =>
      v.language?.startsWith('en') || v.language?.includes('English')
    );

    englishVoices.slice(0, 30).forEach((voice: HeyGenVoice, i: number) => {
      console.log(`${i + 1}. ${voice.name}`);
      console.log(`   ID: ${voice.voice_id}`);
      console.log(`   Language: ${voice.language}`);
      console.log(`   Gender: ${voice.gender || 'N/A'}`);
      console.log(`   Emotion Support: ${voice.emotion_support ? '✅' : '❌'}`);
      console.log('');
    });

    console.log('\n' + '='.repeat(50));
    console.log('\n🇪🇸 SPANISH VOICES\n');

    const spanishVoices = voices.filter((v: HeyGenVoice) =>
      v.language?.startsWith('es') || v.language?.includes('Spanish')
    );

    spanishVoices.slice(0, 20).forEach((voice: HeyGenVoice, i: number) => {
      console.log(`${i + 1}. ${voice.name}`);
      console.log(`   ID: ${voice.voice_id}`);
      console.log(`   Language: ${voice.language}`);
      console.log(`   Gender: ${voice.gender || 'N/A'}`);
      console.log('');
    });

    // Save to JSON file
    const fs = await import('fs');
    const outputPath = './heygen-assets-discovered.json';

    const output = {
      discoveredAt: new Date().toISOString(),
      summary: {
        totalAvatars: avatars.length,
        totalTalkingPhotos: talking_photos.length,
        totalVoices: voices.length,
        voicesByLanguage: Object.fromEntries(
          Object.entries(voicesByLanguage).map(([k, v]) => [k, v.length])
        )
      },
      avatars,
      talking_photos,
      voices,
      // Pre-filtered for easy use
      englishVoices,
      spanishVoices,
      maleAvatars,
      femaleAvatars
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ Full asset list saved to: ${outputPath}`);

    // Generate recommended agent configs
    console.log('\n' + '='.repeat(50));
    console.log('\n🤖 RECOMMENDED AGENT CONFIGURATIONS\n');

    // Pick diverse avatars for variety
    const recommendedAgents = [];

    // Add current Abdullah avatar
    const abdullahPhoto = talking_photos.find((p: HeyGenTalkingPhoto) =>
      p.talking_photo_id === 'd33fe3abc2914faa88309c3bdb9f47f4'
    );

    if (abdullahPhoto) {
      recommendedAgents.push({
        id: 'abdullah',
        name: 'Abdullah',
        avatarId: abdullahPhoto.talking_photo_id,
        avatarType: 'talking_photo',
        voiceId: '9070a6c2dbd54c10bb111dc8c655bff7',
        voiceLanguage: 'en',
        note: 'Current avatar - keep as primary'
      });
    }

    // Add some diverse public avatars
    const publicMaleAvatars = maleAvatars.slice(0, 3);
    const publicFemaleAvatars = femaleAvatars.slice(0, 3);

    publicMaleAvatars.forEach((avatar: HeyGenAvatar, i: number) => {
      const matchingVoice = englishVoices.find((v: HeyGenVoice) =>
        v.gender?.toLowerCase() === 'male' && v.emotion_support
      );

      recommendedAgents.push({
        id: `male-avatar-${i + 1}`,
        name: avatar.avatar_name || `Male Avatar ${i + 1}`,
        avatarId: avatar.avatar_id,
        avatarType: 'avatar',
        voiceId: matchingVoice?.voice_id || englishVoices[0]?.voice_id,
        voiceName: matchingVoice?.name || englishVoices[0]?.name,
        voiceLanguage: 'en',
        previewImage: avatar.preview_image_url
      });
    });

    publicFemaleAvatars.forEach((avatar: HeyGenAvatar, i: number) => {
      const matchingVoice = englishVoices.find((v: HeyGenVoice) =>
        v.gender?.toLowerCase() === 'female' && v.emotion_support
      );

      recommendedAgents.push({
        id: `female-avatar-${i + 1}`,
        name: avatar.avatar_name || `Female Avatar ${i + 1}`,
        avatarId: avatar.avatar_id,
        avatarType: 'avatar',
        voiceId: matchingVoice?.voice_id || englishVoices[1]?.voice_id,
        voiceName: matchingVoice?.name || englishVoices[1]?.name,
        voiceLanguage: 'en',
        previewImage: avatar.preview_image_url
      });
    });

    // Add Spanish voice agents
    if (spanishVoices.length > 0) {
      recommendedAgents.push({
        id: 'spanish-agent-1',
        name: 'Spanish Agent',
        avatarId: avatars[0]?.avatar_id || talking_photos[0]?.talking_photo_id,
        avatarType: avatars[0] ? 'avatar' : 'talking_photo',
        voiceId: spanishVoices[0]?.voice_id,
        voiceName: spanishVoices[0]?.name,
        voiceLanguage: 'es',
        note: 'For Spanish property videos'
      });
    }

    console.log(JSON.stringify(recommendedAgents, null, 2));

    // Save recommended config
    const configPath = './heygen-agents-recommended.json';
    fs.writeFileSync(configPath, JSON.stringify(recommendedAgents, null, 2));
    console.log(`\n✅ Recommended agent config saved to: ${configPath}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
