import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const API_BASE = 'https://api.creatify.ai/api';
const headers = {
  'X-API-ID': process.env.CREATIFY_API_ID!,
  'X-API-KEY': process.env.CREATIFY_API_KEY!,
  'Content-Type': 'application/json',
};

const AVATAR_ID = 'fb40e95f-c907-45f9-a0ef-2d2ab981aa00'; // Carmen - News
const VOICE_ID = '570a3520-c0bf-40fe-8918-a505751ffd41';   // Olivia

// Shared scene config
function makeScene(text: string, transitionIn?: string) {
  return {
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 2.0,
      offset: { x: 0.0, y: 0.0 },
    },
    voice: {
      type: 'text',
      input_text: text,
      voice_id: VOICE_ID,
      volume: 0.8,
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 70,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#FCD34DFF',
      offset: { x: 0.0, y: 0.35 },
      hidden: false,
    },
    // Background is required by API — using a simple dark image
    // but FullAvatar visual_style should show the avatar's native news station set
    background: {
      type: 'image',
      url: 'https://placehold.co/1080x1920/111111/111111.png',
      fit: 'crop',
    },
    visual_style: 'FullAvatar',
    ...(transitionIn ? { transition_effect: { transition_in: transitionIn } } : {}),
  };
}

const payload = {
  video_inputs: [
    makeScene(
      'Stop scrolling. If you are renting right now, you need to hear this. Your rent goes up every single year, but your equity stays at zero.'
    ),
    makeScene(
      'Owner financing lets you buy a home without a bank saying no. No credit check, no twenty percent down. Follow Owner Fy for more.',
      'fade'
    ),
  ],
  aspect_ratio: '9x16',
};

async function main() {
  // Check credits first
  const creditRes = await fetch(`${API_BASE}/remaining_credits/`, { headers });
  if (creditRes.ok) {
    const credits = await creditRes.json();
    console.log(`Credits available: ${credits.remaining_credits}\n`);
  }

  console.log('Sending to Creatify API...\n');
  console.log('Config:');
  console.log('  Avatar: Carmen - News (scale 2.0, centered)');
  console.log('  Voice: Olivia');
  console.log('  Visual: FullAvatar (keeps news station background)');
  console.log('  Captions: shout-block style at y=0.35');
  console.log('  Transition: fade between scenes\n');

  const res = await fetch(`${API_BASE}/lipsyncs_v2/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (res.status !== 200 && res.status !== 201) {
    console.error('Error:', JSON.stringify(data, null, 2));
    return;
  }

  console.log('Video created!');
  console.log('ID:', data.id);
  console.log('Status:', data.status);
  console.log('Credits used:', data.credits_used || 'pending');
  console.log('');
  console.log('Check status with:');
  console.log(`  npx tsx scripts/creatify-test.ts status ${data.id}`);
}

main().catch(console.error);
