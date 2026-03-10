/**
 * Creatify House Demo Generator
 *
 * Pulls 5 random owner-finance properties from Typesense,
 * builds a multi-scene Creatify video with house photos as backgrounds,
 * and avatar narrating over them.
 *
 * Usage: npx tsx scripts/creatify-house-demo.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import Typesense from 'typesense';

// ============================================================================
// Config
// ============================================================================

const CREATIFY_API = 'https://api.creatify.ai/api';
const CREATIFY_HEADERS = {
  'X-API-ID': process.env.CREATIFY_API_ID!,
  'X-API-KEY': process.env.CREATIFY_API_KEY!,
  'Content-Type': 'application/json',
};

const AVATAR_ID = 'fb40e95f-c907-45f9-a0ef-2d2ab981aa00'; // Carmen - News
const VOICE_ID = '570a3520-c0bf-40fe-8918-a505751ffd41';   // Olivia

// ============================================================================
// Step 1: Pull properties from Typesense
// ============================================================================

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  primaryImage: string;
  galleryImages?: string[];
  monthlyPayment?: number;
  downPaymentAmount?: number;
  dealType?: string[];
}

async function getRandomProperties(count: number = 5): Promise<Property[]> {
  const client = new Typesense.Client({
    nodes: [{
      host: process.env.TYPESENSE_HOST!,
      port: parseInt(process.env.TYPESENSE_PORT || '443'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'https',
    }],
    apiKey: process.env.TYPESENSE_API_KEY!,
    connectionTimeoutSeconds: 5,
  });

  // Get owner-finance properties with images
  const result = await client.collections('properties').documents().search({
    q: '*',
    query_by: 'address,city,state',
    filter_by: 'isActive:=true && bedrooms:>0 && propertyType:!land && dealType:=[owner_finance, both]',
    sort_by: 'createdAt:desc',
    per_page: 50,
    include_fields: 'id,address,city,state,listPrice,bedrooms,bathrooms,squareFeet,primaryImage,galleryImages,monthlyPayment,downPaymentAmount,dealType',
  });

  const hits = (result.hits || [])
    .map((h: any) => h.document as Property)
    .filter((p: Property) => p.primaryImage && p.listPrice > 0);

  // Shuffle and pick random ones
  const shuffled = hits.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ============================================================================
// Step 2: Generate script with property data
// ============================================================================

function generateScript(properties: Property[]): { intro: string; houses: string[]; cta: string } {
  const lowestPayment = properties
    .filter(p => p.monthlyPayment && p.monthlyPayment > 0)
    .sort((a, b) => (a.monthlyPayment || 0) - (b.monthlyPayment || 0))[0];

  const lowestPrice = properties
    .sort((a, b) => a.listPrice - b.listPrice)[0];

  const cities = [...new Set(properties.map(p => p.city))];

  // Hook intro — avatar visible
  const intro = lowestPayment?.monthlyPayment
    ? `Homes starting at ${Math.round(lowestPayment.monthlyPayment)} dollars a month with no bank needed. Here are five owner finance deals available right now.`
    : `Owner finance deals starting at ${Math.round(lowestPrice.listPrice / 1000)}K with no credit check. Here are five homes you can buy today.`;

  // Per-house narration
  const houses = properties.map((p, i) => {
    const price = p.listPrice >= 1000 ? `${Math.round(p.listPrice / 1000)}K` : `${p.listPrice}`;
    const details = [
      p.bedrooms ? `${p.bedrooms} bed` : '',
      p.bathrooms ? `${p.bathrooms} bath` : '',
      p.squareFeet ? `${p.squareFeet.toLocaleString()} square feet` : '',
    ].filter(Boolean).join(', ');

    const payment = p.monthlyPayment && p.monthlyPayment > 0
      ? ` Only ${Math.round(p.monthlyPayment)} a month.`
      : '';

    return `${p.city}, ${p.state}. ${details}. Listed at ${price}.${payment}`;
  });

  // CTA — avatar visible again
  const cta = 'Follow Owner Fy to see new deals like these every single day. Link in bio.';

  return { intro, houses, cta };
}

// ============================================================================
// Step 3: Build Creatify payload
// ============================================================================

function buildPayload(properties: Property[], script: { intro: string; houses: string[]; cta: string }) {
  const scenes: any[] = [];

  // Scene 1: Avatar intro with hook (GreenScreenEffect over first house)
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 1.8,
      offset: { x: 0.0, y: 0.3 },
    },
    voice: {
      type: 'text',
      input_text: script.intro,
      voice_id: VOICE_ID,
      volume: 0.8,
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 70,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#10B981FF',
      offset: { x: 0.0, y: -0.15 },
      hidden: false,
    },
    background: {
      type: 'image',
      url: properties[0].primaryImage,
      fit: 'crop',
      effect: 'imageZoomIn',
    },
    visual_style: 'GreenScreenEffect',
  });

  // Scenes 2-6: Each house — avatar hidden, house photo fills screen
  properties.forEach((property, i) => {
    // Pick best image — try gallery first for variety
    const image = (property.galleryImages && property.galleryImages.length > 1)
      ? property.galleryImages[Math.floor(Math.random() * property.galleryImages.length)]
      : property.primaryImage;

    const effects = ['imageZoomIn', 'imageZoomOut', 'imageSlideLeft', 'imageWobbling', 'imageThrob'];

    scenes.push({
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
        input_text: script.houses[i],
        voice_id: VOICE_ID,
        volume: 0.8,
      },
      caption_setting: {
        style: 'shout-block',
        font_family: 'Montserrat',
        font_size: 70,
        text_color: '#FFFFFFFF',
        highlight_text_color: '#10B981FF',
        offset: { x: 0.0, y: 0.40 },
        hidden: false,
      },
      background: {
        type: 'image',
        url: image,
        fit: 'crop',
        effect: effects[i % effects.length],
      },
      transition_effect: {
        transition_in: i === 0 ? 'leftSwipe' : ['fade', 'leftSwipe', 'rightSwipe', 'topSwipe'][i % 4],
      },
    });
  });

  // Scene 7: CTA with avatar
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 1.8,
      offset: { x: 0.0, y: 0.3 },
    },
    voice: {
      type: 'text',
      input_text: script.cta,
      voice_id: VOICE_ID,
      volume: 0.8,
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 70,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#10B981FF',
      offset: { x: 0.0, y: -0.15 },
      hidden: false,
    },
    background: {
      type: 'image',
      url: properties[properties.length - 1].primaryImage,
      fit: 'crop',
      effect: 'imageZoomOut',
    },
    visual_style: 'GreenScreenEffect',
    transition_effect: {
      transition_in: 'fade',
    },
  });

  return {
    video_inputs: scenes,
    aspect_ratio: '9x16' as const,
  };
}

// ============================================================================
// Step 4: Send to Creatify
// ============================================================================

async function main() {
  console.log('=== OwnerFi House Demo Generator ===\n');

  // 1. Pull properties
  console.log('Step 1: Pulling properties from Typesense...');
  const properties = await getRandomProperties(5);

  if (properties.length < 5) {
    console.error(`Only found ${properties.length} properties with images. Need 5.`);
    if (properties.length === 0) return;
  }

  console.log(`Found ${properties.length} properties:\n`);
  properties.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
    console.log(`     $${p.listPrice.toLocaleString()} | ${p.bedrooms}bd/${p.bathrooms}ba | ${p.squareFeet?.toLocaleString() || '?'} sqft`);
    if (p.monthlyPayment) console.log(`     Monthly: $${Math.round(p.monthlyPayment)}/mo`);
    console.log(`     Image: ${p.primaryImage?.substring(0, 80)}...`);
    console.log('');
  });

  // 2. Generate script
  console.log('Step 2: Generating script...');
  const script = generateScript(properties);
  console.log(`  Intro: "${script.intro}"`);
  script.houses.forEach((h, i) => console.log(`  House ${i + 1}: "${h}"`));
  console.log(`  CTA: "${script.cta}"\n`);

  // 3. Build payload
  console.log('Step 3: Building Creatify payload...');
  const payload = buildPayload(properties, script);
  console.log(`  ${payload.video_inputs.length} scenes (1 intro + ${properties.length} houses + 1 CTA)\n`);

  // 4. Check credits
  const creditRes = await fetch(`${CREATIFY_API}/remaining_credits/`, { headers: CREATIFY_HEADERS });
  if (creditRes.ok) {
    const credits = await creditRes.json();
    console.log(`Credits available: ${credits.remaining_credits}\n`);
  }

  // 5. Submit
  console.log('Step 4: Submitting to Creatify API...\n');
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

  console.log('Video created!');
  console.log('ID:', data.id);
  console.log('Status:', data.status);
  console.log('Credits used:', data.credits_used || 'pending');
  console.log('');
  console.log('Check status:');
  console.log(`  npx tsx scripts/creatify-test.ts status ${data.id}`);
}

main().catch(console.error);
