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
const AVATAR_ID = '22653e70-2320-422f-84b4-348f2260cc3c';
const VOICE_ID = 'f20167ac-d1be-452c-b5a7-e48ea0ede3a9';

async function render(name: string, scene: any) {
  const payload = { video_inputs: [scene], aspect_ratio: '9x16' };
  console.log(`\nSubmitting ${name}...`);
  const res = await fetch(`${API}/lipsyncs_v2/`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (res.status !== 200 && res.status !== 201) {
    console.error(`ERROR ${name}:`, JSON.stringify(data, null, 2));
    return null;
  }
  console.log(`${name} ID: ${data.id}`);
  return data.id;
}

async function poll(id: string, name: string) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 20000));
    const res = await fetch(`${API}/lipsyncs_v2/${id}/`, { headers: HEADERS });
    const s = await res.json();
    console.log(`[${name}] ${s.status} ${s.progress}%`);
    if (s.status === 'done') {
      console.log(`[${name}] OUTPUT: ${s.output}`);
      console.log(`[${name}] THUMB: ${s.video_thumbnail}`);
      return s;
    }
    if (s.status === 'failed') {
      console.log(`[${name}] FAILED: ${s.failed_reason}`);
      return s;
    }
  }
}

async function main() {
  const cards = JSON.parse(fs.readFileSync('/tmp/ownerfi-cards.json', 'utf-8'));

  // Test: small avatar on the right side of house card
  const houseId = await render('HOUSE avatar-right scale:0.35 x:0.45 y:0.15', {
    character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.4, offset: { x: 0.25, y: 0.22 } },
    voice: { type: 'text', input_text: 'Salt Lake City, Utah. 2 bed, 1 bath, 1075 square feet. Listed at 360K.', voice_id: VOICE_ID, volume: 0.8 },
    caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 60, text_color: '#FFFFFFFF', highlight_text_color: '#10B981FF', offset: { x: 0.0, y: 0.28 }, hidden: false, override_visual_style: true },
    background: { type: 'image', url: cards[0].cardImageUrl, fit: 'contain' },
  });

  if (houseId) await poll(houseId, 'HOUSE');
}
main().catch(console.error);
