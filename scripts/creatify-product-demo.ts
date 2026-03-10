/**
 * Direct Buyer Pipeline — Product Demo Video
 *
 * Takes the branded property card images from generate-property-cards.ts
 * and creates a Creatify video where the avatar narrates over them.
 *
 * Layout:
 *   - Intro: Amir on dark bg, captions visible below him
 *   - Houses: Card fills screen, avatar hidden, captions hidden (card IS the visual)
 *   - CTA: Amir on dark bg, captions visible below him
 *
 * Usage:
 *   1. npx tsx scripts/generate-property-cards.ts  (generates cards → /tmp/ownerfi-cards.json)
 *   2. npx tsx scripts/creatify-product-demo.ts    (generates video from those cards)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import OpenAI from 'openai';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const CREATIFY_API = 'https://api.creatify.ai/api';
const CREATIFY_HEADERS = {
  'X-API-ID': process.env.CREATIFY_API_ID || '',
  'X-API-KEY': process.env.CREATIFY_API_KEY || '',
  'Content-Type': 'application/json',
};

const AVATAR_ID = '22653e70-2320-422f-84b4-348f2260cc3c'; // Amir - Kitchen
const VOICE_ID = 'f20167ac-d1be-452c-b5a7-e48ea0ede3a9';  // Amir - Arabic accent

interface CardData {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  monthly?: number;
  cardImageUrl: string;
  rawImageUrl: string;
}

async function main() {
  console.log('=== Direct Buyer Pipeline — Product Demo ===\n');

  // Load card data
  const cardsPath = '/tmp/ownerfi-cards.json';
  if (!fs.existsSync(cardsPath)) {
    console.error('No card data found. Run generate-property-cards.ts first.');
    return;
  }

  const cards: CardData[] = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));
  console.log(`Loaded ${cards.length} property cards.\n`);

  // Sort by price ascending for narrative flow
  cards.sort((a, b) => a.price - b.price);

  // Generate script with GPT
  const lowestPrice = cards[0].price;
  const highestPrice = cards[cards.length - 1].price;
  const cities = cards.map(c => c.city).join(', ');
  const stateName = cards[0].state;

  console.log('Generating script with GPT...');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const scriptResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.9,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `You write punchy short-form video scripts for OwnerFi — a platform that helps renters find homes where sellers would consider owner financing.

TARGET AUDIENCE: 20-35 year olds currently renting who can't buy through traditional mortgages.

VOICE: Real, raw, conversational. Like a friend who found a cheat code and is sharing it. No corporate speak. No exclamation marks. No "don't miss out" or "it's time for a change" — those are cringe.

COMPLIANCE — NEVER SAY:
- "no credit check", "guaranteed approval", "no bank needed", "everyone qualifies"
- "don't miss out", "act now", "limited time"
Instead say: "only some sellers require a credit check", "outside traditional lending"

CONTEXT:
- These are homes where sellers MAY consider owner financing
- Owner financing = the seller IS the bank, you pay them directly instead of a mortgage company
- This is real, legal, and increasingly common

OUTPUT FORMAT (JSON):
{
  "hook": "A raw, punchy opening line (max 12 words). NO generic hooks like 'stop scrolling' or 'listen up'. Hit a SPECIFIC pain point: rent went up again, landlord won't fix anything, bank denied you, saving for a down payment that keeps getting bigger, watching friends buy homes while you're stuck. Make it feel personal. Different every single time.",
  "intro": "2-3 short sentences. Introduce the homes naturally. Mention the lowest price. Under 35 words total. Conversational tone.",
  "cta": "One sentence. Tell them to follow OwnerFi. Mention link in bio. Under 15 words. Casual."
}`,
      },
      {
        role: 'user',
        content: `Generate a script for today's product demo video. We have ${cards.length} ${stateName} homes ranging from $${Math.round(lowestPrice / 1000)}K to $${Math.round(highestPrice / 1000)}K in: ${cities}. Mention ${stateName} in the intro.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const script = JSON.parse(scriptResponse.choices[0].message.content || '{}');
  const intro = `${script.hook} ${script.intro}`;
  const cta = script.cta || 'Follow OwnerFi for new deals every day. Link in bio.';

  const houseNarrations = cards.map((c) => {
    const priceStr = c.price >= 1000 ? `${Math.round(c.price / 1000)}K` : `${c.price}`;
    const details = [
      c.beds ? `${c.beds} bed` : '',
      c.baths ? `${c.baths} bath` : '',
      c.sqft ? `${c.sqft.toLocaleString()} square feet` : '',
    ].filter(Boolean).join(', ');
    const monthlyStr = c.monthly && c.monthly > 0 ? ` Estimated ${Math.round(c.monthly)} a month.` : '';
    return `${c.city}, ${c.state}. ${details}. Listed at ${priceStr}.${monthlyStr}`;
  });

  console.log('Script:');
  console.log(`  Intro: "${intro}"`);
  houseNarrations.forEach((h, i) => console.log(`  House ${i + 1}: "${h}"`));
  console.log(`  CTA: "${cta}"\n`);

  // Build Creatify scenes
  const scenes: any[] = [];

  // Scene 1: Intro — Amir on dark background, captions visible
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 0.8,
      offset: { x: 0.25, y: -0.1 },
    },
    voice: {
      type: 'text',
      input_text: intro,
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
      url: cards[0].cardImageUrl,
      fit: 'contain',
    },
  });

  // Scenes 2-6: Each property card — avatar hidden, captions hidden
  // Card IS the visual content. Voice narrates. No avatar, no captions needed.
  cards.forEach((card, i) => {
    const transitions = ['leftSwipe', 'rightSwipe', 'fade', 'topSwipe', 'bottomSwipe'];

    scenes.push({
      character: {
        type: 'avatar',
        avatar_id: AVATAR_ID,
        avatar_style: 'normal',
        scale: 0.4,
        offset: { x: 0.25, y: 0.22 },
      },
      voice: {
        type: 'text',
        input_text: houseNarrations[i],
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
        url: card.cardImageUrl,
        fit: 'contain',
      },
      transition_effect: {
        transition_in: transitions[i % transitions.length],
      },
    });
  });

  // Scene 7: CTA — Amir on dark background, captions visible
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 0.8,
      offset: { x: 0.25, y: -0.1 },
    },
    voice: {
      type: 'text',
      input_text: cta,
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
      url: cards[cards.length - 1].cardImageUrl,
      fit: 'contain',
    },
    transition_effect: { transition_in: 'fade' },
  });

  const payload = {
    video_inputs: scenes,
    aspect_ratio: '9x16' as const,
  };

  const sceneCount = payload.video_inputs.length;
  const estimatedCredits = sceneCount * 5;
  console.log(`${sceneCount} scenes (1 intro + ${cards.length} houses + 1 CTA) — ~${estimatedCredits} credits\n`);

  // Check credits — abort if not enough
  const creditRes = await fetch(`${CREATIFY_API}/remaining_credits/`, { headers: CREATIFY_HEADERS });
  if (creditRes.ok) {
    const credits = await creditRes.json();
    const remaining = credits.remaining_credits;
    console.log(`Credits remaining: ${remaining}`);
    if (remaining < estimatedCredits) {
      console.error(`Not enough credits. Need ~${estimatedCredits}, have ${remaining}. Aborting.`);
      return;
    }
  }

  // Submit
  console.log('\nSubmitting to Creatify...\n');
  const res = await fetch(`${CREATIFY_API}/lipsyncs_v2/`, {
    method: 'POST',
    headers: CREATIFY_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (res.status !== 200 && res.status !== 201) {
    console.error('Error:', JSON.stringify(data, null, 2));
    return;
  }

  console.log('Video submitted!');
  console.log('ID:', data.id);
  console.log('Status:', data.status);
  console.log('');

  // Poll until done or failed
  console.log('Polling for completion...\n');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 20000));
    const pollRes = await fetch(`${CREATIFY_API}/lipsyncs_v2/${data.id}/`, { headers: CREATIFY_HEADERS });
    const status = await pollRes.json();
    console.log(`[${i + 1}] ${status.status} — ${Math.round((status.progress || 0) * 100)}%`);

    if (status.status === 'done') {
      console.log(`\nVideo ready!`);
      console.log(`Output: ${status.output}`);
      console.log(`Thumbnail: ${status.video_thumbnail || 'none'}`);
      return;
    }

    if (status.status === 'failed') {
      console.error(`\nVideo FAILED: ${status.failed_reason || 'unknown'}`);
      return;
    }
  }

  console.error('Timed out after 10 minutes. Check manually:');
  console.log(`  npx tsx scripts/creatify-test.ts status ${data.id}`);
}

main().catch(console.error);
