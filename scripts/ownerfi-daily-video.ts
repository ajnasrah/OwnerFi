/**
 * Ownerfi Daily Video Pipeline
 *
 * Full end-to-end cron: generates property cards, creates video,
 * polls until done, posts directly to Late.dev.
 *
 * Usage:
 *   npx tsx scripts/ownerfi-daily-video.ts --lang en          (EN only — generates cards + EN video)
 *   npx tsx scripts/ownerfi-daily-video.ts --lang es          (ES only — reads existing cards + ES video)
 *   npx tsx scripts/ownerfi-daily-video.ts                    (both EN + ES in parallel)
 *   npx tsx scripts/ownerfi-daily-video.ts --dry-run          (cards + script preview, no video/post)
 *   npx tsx scripts/ownerfi-daily-video.ts --lang en --dry-run
 *
 * Cron: EN at 11am CDT, ES at 11:30am CDT
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import OpenAI from 'openai';
import { execSync } from 'child_process';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// Constants
// ============================================================================

const CREATIFY_API = 'https://api.creatify.ai/api';
const CREATIFY_HEADERS = {
  'X-API-ID': process.env.CREATIFY_API_ID || '',
  'X-API-KEY': process.env.CREATIFY_API_KEY || '',
  'Content-Type': 'application/json',
};
const AVATAR_ID = '22653e70-2320-422f-84b4-348f2260cc3c'; // Amir - Kitchen
const VOICE_ID = 'f20167ac-d1be-452c-b5a7-e48ea0ede3a9';  // Amir - Arabic accent (works for EN + ES)

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const DRY_RUN = process.argv.includes('--dry-run');

// Parse --lang flag: 'en', 'es', or 'both' (default)
function parseLang(): 'en' | 'es' | 'both' {
  const idx = process.argv.indexOf('--lang');
  if (idx === -1 || idx + 1 >= process.argv.length) return 'both';
  const val = process.argv[idx + 1].toLowerCase();
  if (val === 'en' || val === 'es') return val;
  return 'both';
}
const LANG = parseLang();

const CARDS_PATH = '/tmp/ownerfi-cards.json';
const R2_CARDS_KEY = 'property-cards/latest-cards.json';

function getR2() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

const R2_BUCKET = process.env.R2_BUCKET_NAME || '';

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

// ============================================================================
// Step 1: Generate Property Cards (calls generate-property-cards.ts)
// ============================================================================

async function generateCards(): Promise<CardData[]> {
  console.log('\n=== STEP 1: Generate Property Cards ===\n');

  // Delete stale output so we never accidentally read old data
  if (fs.existsSync(CARDS_PATH)) fs.unlinkSync(CARDS_PATH);

  const dryFlag = DRY_RUN ? ' --dry-run' : '';
  const scriptPath = path.resolve(__dirname, 'generate-property-cards.ts');
  execSync(`npx tsx ${scriptPath}${dryFlag}`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  if (!fs.existsSync(CARDS_PATH)) throw new Error('Card generation failed — no output file');
  const cards: CardData[] = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf-8'));

  // Upload cards JSON to R2 so the ES job (separate runner) can fetch it
  try {
    const r2 = getR2();
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_CARDS_KEY,
      Body: fs.readFileSync(CARDS_PATH),
      ContentType: 'application/json',
    }));
    console.log('Cards JSON uploaded to R2 for ES job.\n');
  } catch (err) {
    console.warn('Failed to upload cards JSON to R2 (ES job may need manual run):', err);
  }

  return cards;
}

async function loadExistingCards(): Promise<CardData[]> {
  console.log('\n=== STEP 1: Load Existing Cards (from R2) ===\n');

  // Try local first (same-runner case)
  if (fs.existsSync(CARDS_PATH)) {
    const cards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf-8'));
    console.log(`Loaded ${cards.length} cards from local ${CARDS_PATH}`);
    return cards;
  }

  // Download from R2 (separate-runner case — e.g. GitHub Actions)
  try {
    const r2 = getR2();
    const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: R2_CARDS_KEY }));
    const body = await res.Body?.transformToString();
    if (!body) throw new Error('Empty response from R2');
    const cards: CardData[] = JSON.parse(body);
    // Save locally so the rest of the pipeline can reference it
    fs.writeFileSync(CARDS_PATH, body);
    console.log(`Downloaded ${cards.length} cards from R2`);
    return cards;
  } catch (err) {
    console.error('Failed to load cards from R2:', err);
    process.exit(1);
  }
}

// ============================================================================
// Step 2: Generate Script with GPT
// ============================================================================

interface VideoScript {
  hook: string;
  intro: string;
  cta: string;
  houseNarrations: string[];
  postCaption: string;  // suspenseful, under 150 chars
  postTitle: string;    // under 150 chars
}

interface PostMeta {
  caption: string;
  title: string;
  hashtags: string;
}

async function generateScript(cards: CardData[], lang: 'en' | 'es'): Promise<VideoScript> {
  cards.sort((a, b) => a.price - b.price);
  const lowestPrice = cards[0].price;
  const highestPrice = cards[cards.length - 1].price;
  const cities = cards.map(c => c.city).join(', ');
  const stateName = cards[0].state;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = lang === 'en'
    ? `You write punchy short-form video scripts for Ownerfi — a platform that helps renters find homes where sellers would consider owner financing.

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
  "hook": "A raw, punchy opening line (max 12 words). Hit a SPECIFIC pain point. Different every time.",
  "intro": "2-3 short sentences. Introduce the homes naturally. Mention the lowest price. Under 35 words total.",
  "cta": "One sentence. Tell them to follow Ownerfi. Mention link in bio. Under 15 words. Casual.",
  "postCaption": "Suspenseful social media caption under 150 characters. Make people NEED to watch. Hint at what they'll see without giving it away. Mention the state. No hashtags here.",
  "postTitle": "Short punchy title under 150 characters for YouTube/TikTok. Create curiosity about these specific homes. Mention the state."
}`
    : `Escribes guiones cortos y directos para videos de Ownerfi — una plataforma que ayuda a personas que rentan a encontrar casas donde los vendedores podrían considerar financiamiento directo (owner financing).

AUDIENCIA: Latinos de 20-35 años rentando en EE.UU. que no califican para hipotecas tradicionales.

VOZ: Real, directa, como un amigo que encontró un truco y lo comparte. Sin lenguaje corporativo. Sin signos de exclamación.

CUMPLIMIENTO — NUNCA DIGAS:
- "sin verificación de crédito", "aprobación garantizada", "todos califican"
- "no te lo pierdas", "actúa ahora", "tiempo limitado"
En su lugar di: "solo algunos vendedores requieren verificación de crédito", "fuera del sistema bancario tradicional"

CONTEXTO:
- Estas son casas donde los vendedores PODRÍAN considerar owner financing
- Owner financing = el vendedor ES el banco, le pagas directo en vez de a una hipotecaria
- Es real, legal, y cada vez más común

FORMATO DE SALIDA (JSON):
{
  "hook": "Línea inicial directa y fuerte (max 12 palabras). Un dolor específico. Diferente cada vez.",
  "intro": "2-3 oraciones cortas. Presenta las casas naturalmente. Menciona el precio más bajo. Menos de 35 palabras.",
  "cta": "Una oración. Que sigan a Ownerfi. Mencionar link en bio. Menos de 15 palabras.",
  "postCaption": "Pie de publicación en español, menos de 150 caracteres. Que genere suspenso y curiosidad. Menciona el estado. Sin hashtags.",
  "postTitle": "Título corto en español, menos de 150 caracteres. Genera curiosidad sobre estas casas específicas. Menciona el estado."
}`;

  const userPrompt = lang === 'en'
    ? `Generate a script for today's product demo video. We have ${cards.length} ${stateName} homes ranging from $${Math.round(lowestPrice / 1000)}K to $${Math.round(highestPrice / 1000)}K in: ${cities}. Mention ${stateName} in the intro.`
    : `Genera un guión para el video de hoy. Tenemos ${cards.length} casas en ${stateName} desde $${Math.round(lowestPrice / 1000)}K hasta $${Math.round(highestPrice / 1000)}K en: ${cities}. Menciona ${stateName} en la intro.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0.9, max_tokens: 500,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(res.choices[0].message.content || '{}');

  function buildNarrations(cards: CardData[], lang: 'en' | 'es'): string[] {
    return cards.map(c => {
      const priceStr = c.price >= 1000 ? `${Math.round(c.price / 1000)}K` : `${c.price}`;
      if (lang === 'en') {
        const details = [c.beds ? `${c.beds} bed` : '', c.baths ? `${c.baths} bath` : '', c.sqft ? `${c.sqft.toLocaleString()} square feet` : ''].filter(Boolean).join(', ');
        const monthly = c.monthly && c.monthly > 0 ? ` Estimated $${Math.round(c.monthly).toLocaleString()} a month.` : '';
        const detailsPart = details ? `${details}. ` : '';
        return `${c.city}, ${c.state}. ${detailsPart}Listed at ${priceStr}.${monthly}`;
      } else {
        const details = [c.beds ? `${c.beds} cuartos` : '', c.baths ? `${c.baths} baños` : '', c.sqft ? `${c.sqft.toLocaleString()} pies cuadrados` : ''].filter(Boolean).join(', ');
        const monthly = c.monthly && c.monthly > 0 ? ` Estimado $${Math.round(c.monthly).toLocaleString()} al mes.` : '';
        const detailsPart = details ? `${details}. ` : '';
        return `${c.city}, ${c.state}. ${detailsPart}Precio ${priceStr}.${monthly}`;
      }
    });
  }

  const defaultHook = lang === 'en' ? 'Check out these owner finance homes.' : 'Mira estas casas con owner financing.';
  const defaultIntro = lang === 'en' ? `We found ${cards.length} homes in ${stateName}.` : `Encontramos ${cards.length} casas en ${stateName}.`;
  const defaultCta = lang === 'en' ? 'Follow Ownerfi for new deals every day. Link in bio.' : 'Sigue a Ownerfi para nuevas casas cada día. Link en bio.';
  const defaultCaption = lang === 'en' ? `These ${stateName} homes don't need a bank to say yes` : `Estas casas en ${stateName} no necesitan banco para comprarlas`;
  const defaultTitle = lang === 'en' ? `Owner finance homes in ${stateName} starting at $${Math.round(lowestPrice / 1000)}K` : `Casas con owner financing en ${stateName} desde $${Math.round(lowestPrice / 1000)}K`;

  const script: VideoScript = {
    hook: parsed.hook || defaultHook,
    intro: parsed.intro || defaultIntro,
    cta: parsed.cta || defaultCta,
    houseNarrations: buildNarrations(cards, lang),
    postCaption: parsed.postCaption || defaultCaption,
    postTitle: parsed.postTitle || defaultTitle,
  };

  console.log(`${lang.toUpperCase()} Script:`);
  console.log(`  Hook: "${script.hook}"`);
  console.log(`  Intro: "${script.intro}"`);
  console.log(`  CTA: "${script.cta}"`);
  console.log(`  Caption: "${script.postCaption}" (${script.postCaption.length} chars)`);
  console.log(`  Title: "${script.postTitle}" (${script.postTitle.length} chars)`);

  return script;
}

// ============================================================================
// Step 3: Submit Creatify Video
// ============================================================================

function buildScenes(cards: CardData[], script: VideoScript): any[] {
  const introText = `${script.hook} ${script.intro}`;
  const scenes: any[] = [];

  // Intro: Amir on first card bg (same position as house scenes)
  scenes.push({
    character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.4, offset: { x: 0.25, y: 0.22 } },
    voice: { type: 'text', input_text: introText, voice_id: VOICE_ID, volume: 0.8 },
    caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 60, text_color: '#FFFFFFFF', highlight_text_color: '#00BC7DFF', offset: { x: 0.0, y: 0.28 }, hidden: false, override_visual_style: true },
    background: { type: 'image', url: cards[0].cardImageUrl, fit: 'contain' },
  });

  // House scenes: Amir small on right, captions visible
  const transitions = ['leftSwipe', 'rightSwipe', 'fade', 'topSwipe', 'bottomSwipe'];
  cards.forEach((card, i) => {
    scenes.push({
      character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.4, offset: { x: 0.25, y: 0.22 } },
      voice: { type: 'text', input_text: script.houseNarrations[i], voice_id: VOICE_ID, volume: 0.8 },
      caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 60, text_color: '#FFFFFFFF', highlight_text_color: '#00BC7DFF', offset: { x: 0.0, y: 0.28 }, hidden: false, override_visual_style: true },
      background: { type: 'image', url: card.cardImageUrl, fit: 'contain' },
      transition_effect: { transition_in: transitions[i % transitions.length] },
    });
  });

  // CTA: Amir on last card bg (same position as house scenes)
  scenes.push({
    character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.4, offset: { x: 0.25, y: 0.22 } },
    voice: { type: 'text', input_text: script.cta, voice_id: VOICE_ID, volume: 0.8 },
    caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 60, text_color: '#FFFFFFFF', highlight_text_color: '#00BC7DFF', offset: { x: 0.0, y: 0.28 }, hidden: false, override_visual_style: true },
    background: { type: 'image', url: cards[cards.length - 1].cardImageUrl, fit: 'contain' },
    transition_effect: { transition_in: 'fade' },
  });

  return scenes;
}

async function submitVideo(label: string, scenes: any[]): Promise<string | null> {
  const payload = { video_inputs: scenes, aspect_ratio: '9x16' };
  console.log(`\nSubmitting ${label} (${scenes.length} scenes, ~${scenes.length * 5} credits)...`);

  const res = await fetch(`${CREATIFY_API}/lipsyncs_v2/`, {
    method: 'POST', headers: CREATIFY_HEADERS, body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (res.status !== 200 && res.status !== 201) {
    console.error(`${label} ERROR:`, JSON.stringify(data, null, 2));
    return null;
  }

  console.log(`${label} submitted — ID: ${data.id}`);
  return data.id;
}

async function pollVideo(id: string, label: string): Promise<string | null> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 20000));
    try {
      const res = await fetch(`${CREATIFY_API}/lipsyncs_v2/${id}/`, { headers: CREATIFY_HEADERS });
      if (!res.ok) {
        console.warn(`[${label}] Poll HTTP ${res.status} — retrying...`);
        continue;
      }
      const s = await res.json();
      console.log(`[${label}] ${s.status} — ${Math.round((s.progress || 0) * 100)}%`);

      if (s.status === 'done') {
        console.log(`[${label}] DONE: ${s.output}`);
        return s.output;
      }
      if (s.status === 'failed') {
        console.error(`[${label}] FAILED: ${s.failed_reason || 'unknown'}`);
        return null;
      }
    } catch (err) {
      console.warn(`[${label}] Poll error (attempt ${i + 1}/30):`, err);
    }
  }
  console.error(`[${label}] Timed out after 10 minutes`);
  return null;
}

// ============================================================================
// Step 4: Post to Late.dev
// ============================================================================

async function postToLate(videoUrl: string, caption: string, title?: string): Promise<boolean> {
  const apiKey = process.env.LATE_API_KEY?.trim();
  const profileId = process.env.LATE_OWNERFI_PROFILE_ID?.trim();
  if (!apiKey || !profileId) {
    console.error('Missing LATE_API_KEY or LATE_OWNERFI_PROFILE_ID');
    return false;
  }

  // Get accounts for profile
  const accountsRes = await fetch(`${LATE_BASE_URL}/accounts?profileId=${profileId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (!accountsRes.ok) {
    console.error('Failed to fetch Late accounts:', await accountsRes.text());
    return false;
  }

  const accountsData = await accountsRes.json();
  const accounts = Array.isArray(accountsData) ? accountsData : accountsData.accounts || [];

  // Map platforms
  const targetPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'twitter', 'threads', 'bluesky'];
  const platforms = targetPlatforms.map(platform => {
    const account = accounts.find((a: any) => a.platform.toLowerCase() === platform);
    if (!account) { console.log(`  Skipping ${platform} — no account connected`); return null; }
    const config: any = { platform, accountId: account._id, platformSpecificData: {} };
    if (platform === 'instagram') config.platformSpecificData.contentType = 'reel';
    if (platform === 'tiktok') config.platformSpecificData.privacy = 'public';
    if (platform === 'facebook') config.platformSpecificData.contentType = 'reel';
    if (platform === 'youtube') {
      config.platformSpecificData = {
        title: title || caption.substring(0, 100),
        category: 'People & Blogs',
        privacy: 'public',
        madeForKids: false,
        short: true,
      };
    }
    return config;
  }).filter(Boolean);

  if (platforms.length === 0) {
    console.error('No Late.dev accounts connected — nothing to post to');
    return false;
  }

  console.log(`Posting to Late.dev: ${platforms.map((p: any) => p.platform).join(', ')}`);

  // Truncate caption for Twitter's 280 char limit
  const twitterMaxChars = 280;
  const twitterPlatform = platforms.find((p: any) => p.platform === 'twitter');
  if (twitterPlatform && caption.length > twitterMaxChars) {
    // Give Twitter a trimmed caption (drop hashtags, keep core message)
    const lines = caption.split('\n\n');
    const coreCaption = lines[0]; // Caption without hashtags
    (twitterPlatform as any).platformSpecificData.content =
      coreCaption.length <= twitterMaxChars ? coreCaption : coreCaption.slice(0, twitterMaxChars - 3) + '...';
    console.log(`  Twitter caption trimmed to ${(twitterPlatform as any).platformSpecificData.content.length} chars`);
  }

  const body: Record<string, unknown> = {
    content: caption,
    platforms,
    mediaItems: [{ type: 'video', url: videoUrl }],
    publishNow: true,
    timezone: 'America/Chicago', // CST — consistent with all other brand posting
  };
  if (title) body.title = title;

  const res = await fetch(`${LATE_BASE_URL}/posts`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`Late API error ${res.status}:`, responseText);
    return false;
  }

  try {
    const data = JSON.parse(responseText);
    console.log(`Late post created: ${data.id || data._id || 'ok'}`);
  } catch {
    console.log('Late post created (non-JSON response)');
  }
  return true;
}

// ============================================================================
// Build Post Metadata (caption + hashtags + title)
// ============================================================================

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'NewHampshire', NJ: 'NewJersey', NM: 'NewMexico',
  NY: 'NewYork', NC: 'NorthCarolina', ND: 'NorthDakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'RhodeIsland', SC: 'SouthCarolina',
  SD: 'SouthDakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'WestVirginia', WI: 'Wisconsin', WY: 'Wyoming',
};

function buildPostMeta(cards: CardData[], script: VideoScript, lang: 'en' | 'es'): PostMeta {
  const stateCode = cards[0].state;
  const stateFullName = STATE_NAMES[stateCode] || stateCode;

  const uniqueCities = [...new Set(cards.map(c => c.city))];
  const cityHashtags = uniqueCities.map(c => `#${c.replace(/[^a-zA-Z0-9]/g, '')}`.toLowerCase());

  const stateHashtags = [
    `#${stateCode.toLowerCase()}`,
    `#${stateFullName.toLowerCase()}`,
    `#${stateCode.toLowerCase()}realestate`,
    `#${stateFullName.toLowerCase()}homes`,
  ];

  const coreHashtags = lang === 'en'
    ? ['#ownerfinancing', '#ownerfi', '#realestate', '#homebuying', '#renterstoowners', '#nobank', '#homesforsale']
    : ['#ownerfinancing', '#ownerfi', '#bienesraices', '#casasenventa', '#financiamientodirecto', '#compracasa', '#sinbanco'];

  const allHashtags = [...cityHashtags, ...stateHashtags, ...coreHashtags];
  const uniqueHashtags = [...new Set(allHashtags)].join(' ');

  return {
    caption: script.postCaption,
    title: script.postTitle,
    hashtags: uniqueHashtags,
  };
}

// ============================================================================
// Run a single language pipeline: script → video → post
// ============================================================================

async function runLang(cards: CardData[], lang: 'en' | 'es'): Promise<boolean> {
  const label = lang.toUpperCase();

  // Generate script
  console.log(`\n=== ${label}: Generate Script ===\n`);
  const script = await generateScript(cards, lang);
  const meta = buildPostMeta(cards, script, lang);

  if (DRY_RUN) {
    console.log(`\n${label} Post Preview:`);
    console.log(`  Caption: "${meta.caption}"`);
    console.log(`  Title: "${meta.title}"`);
    console.log(`  Hashtags: ${meta.hashtags}`);
    return true;
  }

  // Submit video
  console.log(`\n=== ${label}: Submit Video ===`);
  const scenes = buildScenes(cards, script);
  const videoId = await submitVideo(label, scenes);
  if (!videoId) return false;

  // Poll
  console.log(`\n=== ${label}: Poll for Completion ===`);
  const videoUrl = await pollVideo(videoId, label);
  if (!videoUrl) return false;

  // Post
  console.log(`\n=== ${label}: Post to Late.dev ===`);
  console.log(`  Title: "${meta.title}"`);
  console.log(`  Caption: "${meta.caption}"`);
  console.log(`  Hashtags: ${meta.hashtags}`);
  return await postToLate(videoUrl, `${meta.caption}\n\n${meta.hashtags}`, meta.title);
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  const startTime = Date.now();
  console.log('============================================');
  console.log('  Ownerfi Daily Video Pipeline');
  console.log(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT`);
  console.log(`  Language: ${LANG}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log('============================================');

  // Step 1: Get cards
  // EN run (or both): generate fresh cards via subprocess + upload JSON to R2
  // ES-only run: download cards from R2 (uploaded by prior EN run)
  const cards = LANG === 'es' ? await loadExistingCards() : await generateCards();
  if (cards.length === 0) {
    console.error('No cards. Aborting.');
    process.exit(1);
  }

  // Check credits (skip on dry-run)
  if (!DRY_RUN) {
    const creditRes = await fetch(`${CREATIFY_API}/remaining_credits/`, { headers: CREATIFY_HEADERS });
    if (creditRes.ok) {
      const credits = await creditRes.json();
      const scenesPerVideo = cards.length + 2; // houses + intro + cta
      const videosToMake = LANG === 'both' ? 2 : 1;
      const needed = scenesPerVideo * 5 * videosToMake;
      console.log(`\nCredits: ${credits.remaining_credits} (need ~${needed})`);
      if (credits.remaining_credits < needed) {
        console.error('Not enough credits. Aborting.');
        process.exit(1);
      }
    } else {
      console.warn('Credit check failed — proceeding anyway');
    }
  }

  // Run language(s)
  let enPosted = false;
  let esPosted = false;

  if (LANG === 'both') {
    // Parallel
    [enPosted, esPosted] = await Promise.all([
      runLang(cards, 'en'),
      runLang(cards, 'es'),
    ]);
  } else if (LANG === 'en') {
    enPosted = await runLang(cards, 'en');
  } else {
    esPosted = await runLang(cards, 'es');
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n============================================`);
  console.log(`  Pipeline complete in ${duration}s`);
  if (LANG === 'both' || LANG === 'en') console.log(`  EN: ${enPosted ? 'POSTED' : 'FAILED'}`);
  if (LANG === 'both' || LANG === 'es') console.log(`  ES: ${esPosted ? 'POSTED' : 'FAILED'}`);
  console.log('============================================\n');

  if (DRY_RUN) return;

  // Exit non-zero if the requested language(s) all failed
  if (LANG === 'both' && !enPosted && !esPosted) {
    console.error('Both videos failed. Exiting with error.');
    process.exit(1);
  }
  if (LANG === 'en' && !enPosted) {
    console.error('EN video failed. Exiting with error.');
    process.exit(1);
  }
  if (LANG === 'es' && !esPosted) {
    console.error('ES video failed. Exiting with error.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
