/**
 * Creatify RENDER Test — actual video render to verify caption positioning
 * Preview player doesn't respect caption offsets, only rendered videos do.
 * Uses full render endpoint (5 credits) instead of preview (1 credit).
 *
 * Amir avatar + Amir voice, caption y:0.28, override_visual_style:true
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const API = 'https://api.creatify.ai/api';
const HEADERS = {
  'X-API-ID': process.env.CREATIFY_API_ID || '',
  'X-API-KEY': process.env.CREATIFY_API_KEY || '',
  'Content-Type': 'application/json',
};

const AVATAR_ID = '22653e70-2320-422f-84b4-348f2260cc3c'; // Amir - Kitchen
const VOICE_ID = 'f20167ac-d1be-452c-b5a7-e48ea0ede3a9';  // Amir - Arabic accent

async function main() {
  const cards = JSON.parse(fs.readFileSync('/tmp/ownerfi-cards.json', 'utf-8'));
  const cardUrl = cards[0].cardImageUrl;

  const mode = process.argv[2] || 'house';

  let scene: any;

  if (mode === 'intro') {
    console.log('Rendering INTRO scene (Amir on dark bg)...');
    scene = {
      character: {
        type: 'avatar',
        avatar_id: AVATAR_ID,
        avatar_style: 'normal',
        scale: 0.8,
        offset: { x: 0.25, y: -0.1 },
      },
      voice: {
        type: 'text',
        input_text: 'Your rent just went up again. Here are five homes where the seller is the bank.',
        voice_id: VOICE_ID,
        volume: 0.8,
      },
      caption_setting: {
        style: 'shout-block',
        font_family: 'Montserrat',
        font_size: 60,
        text_color: '#FFFFFFFF',
        highlight_text_color: '#10B981FF',
        offset: { x: 0.0, y: 0.28 },
        hidden: false,
        override_visual_style: true,
      },
      background: {
        type: 'image',
        url: 'https://placehold.co/1080x1920/0f172a/0f172a.png',
        fit: 'cover',
      },
    };
  } else {
    console.log('Rendering HOUSE scene (card bg, avatar hidden)...');
    scene = {
      character: {
        type: 'avatar',
        avatar_id: AVATAR_ID,
        avatar_style: 'normal',
        scale: 0.01,
        offset: { x: 0.0, y: 0.0 },
        hidden: true,
      },
      voice: {
        type: 'text',
        input_text: 'Houston Texas. 3 bed, 2 bath, 1292 square feet. Listed at 150K.',
        voice_id: VOICE_ID,
        volume: 0.8,
      },
      caption_setting: {
        style: 'shout-block',
        font_family: 'Montserrat',
        font_size: 60,
        text_color: '#FFFFFFFF',
        highlight_text_color: '#10B981FF',
        offset: { x: 0.0, y: 0.28 },
        hidden: false,
        override_visual_style: true,
      },
      background: {
        type: 'image',
        url: cardUrl,
        fit: 'contain',
      },
    };
  }

  const payload = { video_inputs: [scene], aspect_ratio: '9x16' as const };

  console.log('Caption offset y: 0.28, override_visual_style: true');
  console.log('Submitting FULL RENDER (5 credits)...\n');

  const res = await fetch(`${API}/lipsyncs_v2/`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (res.status !== 200 && res.status !== 201) {
    console.error('Error:', JSON.stringify(data, null, 2));
    return;
  }

  console.log('Render started!');
  console.log('ID:', data.id);
  console.log('Status:', data.status);
  console.log('Credits:', data.credits_used);
  console.log('\nPolling for completion...\n');

  // Poll until done
  let attempts = 0;
  while (attempts < 30) {
    await new Promise(r => setTimeout(r, 20000)); // 20 sec
    attempts++;

    const statusRes = await fetch(`${API}/lipsyncs_v2/${data.id}/`, { headers: HEADERS });
    const status = await statusRes.json();

    console.log(`[${attempts}] Status: ${status.status} | Progress: ${status.progress}%`);

    if (status.status === 'done') {
      console.log('\nVIDEO READY!');
      console.log('Output:', status.output);
      console.log('Thumbnail:', status.video_thumbnail);
      return;
    }

    if (status.status === 'failed') {
      console.error('\nFAILED:', status.failed_reason);
      return;
    }
  }

  console.log('\nTimed out after 10 minutes. Check manually:');
  console.log(`  npx tsx scripts/creatify-test.ts status ${data.id}`);
}

main().catch(console.error);
