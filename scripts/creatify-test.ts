/**
 * Creatify Test Script
 *
 * Step 1: Browse avatars & voices (FREE — no credits used)
 * Step 2: Generate a test OwnerFi video (5 credits for ≤30 sec)
 * Step 3: Poll until done, download result
 *
 * Usage:
 *   npx tsx scripts/creatify-test.ts browse-avatars
 *   npx tsx scripts/creatify-test.ts browse-voices
 *   npx tsx scripts/creatify-test.ts check-credits
 *   npx tsx scripts/creatify-test.ts generate-test
 *   npx tsx scripts/creatify-test.ts status <video-id>
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = 'https://api.creatify.ai/api';

function getHeaders(): Record<string, string> {
  const apiId = process.env.CREATIFY_API_ID;
  const apiKey = process.env.CREATIFY_API_KEY;
  if (!apiId || !apiKey) {
    console.error('Missing CREATIFY_API_ID or CREATIFY_API_KEY in .env.local');
    process.exit(1);
  }
  return {
    'X-API-ID': apiId,
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Browse Avatars (FREE)
// ============================================================================
async function browseAvatars() {
  console.log('\n🎭 Browsing Creatify Avatars (FREE — no credits used)\n');

  const res = await fetch(`${API_BASE}/personas/?page=1`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    console.error(`Error ${res.status}:`, await res.text());
    return;
  }

  const data = await res.json();
  console.log(`Found ${data.count} total avatars (showing first page)\n`);

  const personas = data.results || data;
  const list = Array.isArray(personas) ? personas : [];

  list.slice(0, 30).forEach((p: any, i: number) => {
    console.log(`${i + 1}. ${p.persona_name || p.creator_name || 'Unnamed'}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Gender: ${p.gender || 'unknown'}`);
    if (p.thumbnail_url) console.log(`   Preview: ${p.thumbnail_url}`);
    console.log('');
  });

  console.log(`\nShowing ${Math.min(list.length, 30)} of ${data.count} avatars.`);
  console.log('Use avatar IDs above in your video config.');
}

// ============================================================================
// Browse Voices (FREE)
// ============================================================================
async function browseVoices() {
  console.log('\n🎤 Browsing Creatify Voices (FREE — no credits used)\n');

  const res = await fetch(`${API_BASE}/voices/`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    console.error(`Error ${res.status}:`, await res.text());
    return;
  }

  const voices = await res.json();
  const list = Array.isArray(voices) ? voices : [];

  // Filter for English voices
  let count = 0;
  for (const voice of list) {
    const accents = voice.accents || [];
    const englishAccents = accents.filter((a: any) =>
      (a.accent_name || '').toLowerCase().includes('english') ||
      (a.accent_name || '').toLowerCase().includes('american') ||
      (a.accent_name || '').toLowerCase().includes('british')
    );

    if (englishAccents.length > 0) {
      count++;
      console.log(`${count}. ${voice.name || 'Unnamed'} (${voice.gender || '?'})`);
      console.log(`   Voice ID: ${voice.id}`);
      englishAccents.forEach((a: any) => {
        console.log(`   Accent: "${a.accent_name}" → accent_id: ${a.id}`);
        if (a.preview_url) console.log(`   Preview: ${a.preview_url}`);
      });
      console.log('');

      if (count >= 20) {
        console.log(`... showing first 20 English voices of ${list.length} total`);
        break;
      }
    }
  }

  console.log(`\nTotal voices available: ${list.length}`);
  console.log('Use the accent_id (not voice.id) as voice_id in video requests.');
}

// ============================================================================
// Check Credits (FREE)
// ============================================================================
async function checkCredits() {
  console.log('\n💰 Checking Creatify Credits\n');

  const res = await fetch(`${API_BASE}/remaining_credits/`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    console.error(`Error ${res.status}:`, await res.text());
    return;
  }

  const data = await res.json();
  console.log(`Remaining credits: ${data.remaining_credits}`);
  console.log(`\nCredit costs:`);
  console.log(`  AI Avatar v2 (15 sec video): 5 credits`);
  console.log(`  AI Avatar v2 (30 sec video): 5 credits`);
  console.log(`  AI Avatar v2 (45 sec video): 10 credits`);
  console.log(`  Aurora (15 sec): 20 credits`);
  console.log(`\nYou can generate ${Math.floor(data.remaining_credits / 5)} videos at ≤30 sec each.`);
}

// ============================================================================
// Generate Test Video (COSTS 5 CREDITS for ≤30 sec)
// ============================================================================
async function generateTest() {
  console.log('\n🎬 Generating OwnerFi Test Video (5 credits)\n');

  // First check credits
  const creditRes = await fetch(`${API_BASE}/remaining_credits/`, {
    headers: getHeaders(),
  });
  if (creditRes.ok) {
    const credits = await creditRes.json();
    console.log(`Credits available: ${credits.remaining_credits}`);
    if (credits.remaining_credits < 5) {
      console.error('Not enough credits! Need 5, have', credits.remaining_credits);
      return;
    }
  }

  // OwnerFi test video — 2 scenes, ~15 seconds total
  // Target audience: 20-35 year old renters
  const payload = {
    video_inputs: [
      {
        // Scene 1: Hook + Problem (7 sec)
        character: {
          type: 'avatar',
          avatar_id: '18fccce8-86e7-5f31-abc8-18915cb872be', // Default — replace after browsing
          avatar_style: 'normal',
          scale: 1.0,
          offset: { x: 0.0, y: 0.0 },
        },
        voice: {
          type: 'text',
          input_text: 'Stop scrolling. If you\'re renting right now, you need to hear this. Your rent goes up every single year, but your equity stays at zero.',
          voice_id: '', // Will be set after browsing voices
          volume: 0.8,
        },
        caption_setting: {
          style: 'normal-black',
          font_family: 'Montserrat',
          font_size: 70,
          text_color: '#FFFFFF',
          highlight_text_color: '#FCD34D',
          offset: { x: 0.0, y: 0.45 },
          hidden: false,
        },
      },
      {
        // Scene 2: Solution + CTA (8 sec)
        character: {
          type: 'avatar',
          avatar_id: '18fccce8-86e7-5f31-abc8-18915cb872be', // Replace after browsing
          avatar_style: 'normal',
          scale: 1.0,
          offset: { x: 0.0, y: 0.0 },
        },
        voice: {
          type: 'text',
          input_text: 'Owner financing lets you buy a home without a bank saying no. No credit check, no twenty percent down. Follow Owner Fy for more.',
          voice_id: '', // Will be set after browsing voices
          volume: 0.8,
        },
        caption_setting: {
          style: 'normal-black',
          font_family: 'Montserrat',
          font_size: 70,
          text_color: '#FFFFFF',
          highlight_text_color: '#FCD34D',
          offset: { x: 0.0, y: 0.45 },
          hidden: false,
        },
      },
    ],
    aspect_ratio: '9x16',
  };

  // Check if avatar/voice IDs are set
  const needsConfig = payload.video_inputs.some(
    (s) => !s.voice.voice_id || s.character.avatar_id === '18fccce8-86e7-5f31-abc8-18915cb872be'
  );

  if (needsConfig) {
    console.log('⚠️  Using default avatar. For better results:');
    console.log('   1. Run: npx tsx scripts/creatify-test.ts browse-avatars');
    console.log('   2. Run: npx tsx scripts/creatify-test.ts browse-voices');
    console.log('   3. Update avatar_id and voice_id in this script');
    console.log('');

    if (payload.video_inputs.some((s) => !s.voice.voice_id)) {
      console.log('❌ voice_id is empty. Run browse-voices first and set it.');
      console.log('   Edit scripts/creatify-test.ts → voice_id field');
      return;
    }
  }

  console.log('Sending to Creatify API...\n');

  const res = await fetch(`${API_BASE}/lipsyncs_v2/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`Error ${res.status}:`, error);
    return;
  }

  const data = await res.json();
  console.log('✅ Video created!');
  console.log(`   ID: ${data.id}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Credits used: ${data.credits_used || 'pending'}`);
  console.log('');
  console.log(`To check status:`);
  console.log(`   npx tsx scripts/creatify-test.ts status ${data.id}`);
  console.log('');
  console.log('Video typically takes 3-5 minutes to render.');
}

// ============================================================================
// Check Status + Download
// ============================================================================
async function checkStatus(videoId: string) {
  console.log(`\n📊 Checking status for: ${videoId}\n`);

  const res = await fetch(`${API_BASE}/lipsyncs_v2/${videoId}/`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    console.error(`Error ${res.status}:`, await res.text());
    return;
  }

  const data = await res.json();
  console.log(`Status: ${data.status}`);
  console.log(`Progress: ${data.progress !== undefined ? `${(data.progress * 100).toFixed(0)}%` : 'unknown'}`);
  console.log(`Credits used: ${data.credits_used || 'pending'}`);

  if (data.status === 'done') {
    console.log('');
    console.log('✅ Video is DONE!');
    console.log(`   Download: ${data.output}`);
    if (data.video_thumbnail) {
      console.log(`   Thumbnail: ${data.video_thumbnail}`);
    }
  } else if (data.status === 'failed') {
    console.log('');
    console.log('❌ Video FAILED');
    console.log(`   Reason: ${data.failed_reason || 'unknown'}`);
  } else {
    console.log('');
    console.log('⏳ Still processing... check again in 1-2 minutes.');
    console.log(`   npx tsx scripts/creatify-test.ts status ${videoId}`);
  }
}

// ============================================================================
// Main
// ============================================================================
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'browse-avatars':
    browseAvatars().catch(console.error);
    break;
  case 'browse-voices':
    browseVoices().catch(console.error);
    break;
  case 'check-credits':
    checkCredits().catch(console.error);
    break;
  case 'generate-test':
    generateTest().catch(console.error);
    break;
  case 'status':
    if (!arg) {
      console.error('Usage: npx tsx scripts/creatify-test.ts status <video-id>');
      process.exit(1);
    }
    checkStatus(arg).catch(console.error);
    break;
  default:
    console.log(`
Creatify Test Script — OwnerFi Pipeline

Commands (FREE — no credits):
  npx tsx scripts/creatify-test.ts browse-avatars    Browse 1500+ avatars
  npx tsx scripts/creatify-test.ts browse-voices     Browse voices & accents
  npx tsx scripts/creatify-test.ts check-credits     Check remaining credits

Commands (COSTS CREDITS):
  npx tsx scripts/creatify-test.ts generate-test     Generate test video (5 credits)
  npx tsx scripts/creatify-test.ts status <id>       Check video status
    `);
}
