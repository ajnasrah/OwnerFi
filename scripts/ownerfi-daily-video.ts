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

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { timeoutMs?: number; retries?: number; label?: string } = {},
): Promise<Response> {
  const { timeoutMs = 60_000, retries = 3, label = url } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500 && attempt < retries) {
        console.warn(`[${label}] HTTP ${res.status} (attempt ${attempt}/${retries}) — retrying...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[${label}] fetch failed (attempt ${attempt}/${retries}): ${msg}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

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

  // Add date variation to ensure unique content
  const today = new Date();
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][today.getMonth()];
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = lang === 'en'
    ? `You create VIRAL TikTok/Instagram real estate scripts that stop scrolling instantly.
    
TODAY'S DATE: ${dayOfWeek}, ${month} ${today.getDate()} - use trending references from TODAY.

VIRAL HOOK FORMULAS (rotate between these):
1. "These sellers might finance directly"
2. "POV: You just discovered seller financing exists"
3. "When banks say no, some sellers say maybe"
4. "No bank? Some sellers have options"
5. "Seller financing opportunities exist"
6. "Direct from owner financing is real"
7. "Skip the bank? It's possible with some sellers"

AUDIENCE: Renters curious about homeownership alternatives.

VOICE: Intriguing but responsible. Like sharing an insider tip responsibly.

NEVER SAY: Prices, addresses, "guaranteed", "you qualify", "easy", "no credit needed"
ALWAYS SAY: "Some sellers", "may consider", "potentially available", "worth exploring"
FOCUS ON: The concept of seller financing, not specific deals

OUTPUT FORMAT (JSON):
{
  "hook": "Intriguing opener about seller financing possibility. Max 10 words.",
  "intro": "We find homes where sellers may offer financing. Under 25 words.",
  "cta": "Explore options at Ownerfi. Link in bio. Under 10 words.",
  "postCaption": "Intriguing caption about seller financing. Compliant. Under 100 chars.",
  "postTitle": "Engaging title about seller financing options. Under 100 chars.",
  "trending": "Suggest a trending audio/sound that would work (optional)"
}`
    : `Creas guiones VIRALES de TikTok/Instagram sobre bienes raíces que paran el scroll al instante.
    
FECHA DE HOY: ${dayOfWeek}, ${month} ${today.getDate()} - usa referencias de tendencias de HOY.

FÓRMULAS DE GANCHO VIRAL (rotar entre estas):
1. "Estos vendedores podrían financiar directamente"
2. "POV: Acabas de descubrir que existe financiamiento del vendedor"
3. "Cuando los bancos dicen no, algunos vendedores dicen tal vez"
4. "¿Sin banco? Algunos vendedores tienen opciones"
5. "Existen oportunidades de financiamiento del vendedor"
6. "Financiamiento directo del dueño es real"
7. "¿Saltar el banco? Es posible con algunos vendedores"

AUDIENCIA: Personas interesadas en aprender sobre opciones de vivienda.

VOZ: Educativa e informativa. Como un maestro útil explicando conceptos.

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
  "hook": "Apertura educativa sobre owner financing. Max 10 palabras.",
  "intro": "Explica qué hacemos - conectamos personas con oportunidades de owner financing. Menos de 25 palabras.",
  "cta": "Aprende más en Ownerfi. Link en bio. Menos de 10 palabras.",
  "postCaption": "Pie educativo sobre owner financing. Sin promesas falsas. Menos de 100 caracteres.",
  "postTitle": "Título informativo sobre educación de owner financing. Menos de 100 caracteres.",
  "trending": "Sugiere un audio/sonido trending que funcionaría (opcional)"
}`;

  // Add variety by rotating hook types
  const hookTypes = [
    'shocking_price', 'rent_comparison', 'hidden_gem', 
    'specific_feature', 'bank_rejection', 'economy_angle', 'nobody_talking'
  ];
  const selectedHook = hookTypes[Math.floor(Math.random() * hookTypes.length)];

  const userPrompt = lang === 'en'
    ? `Create an INTRIGUING script using the "${selectedHook}" hook.
    We help people explore seller financing options.
    DO NOT: mention prices, specific locations, or make guarantees.
    DO: Create curiosity about seller financing as a concept.
    Key message: Some sellers offer financing when banks won't.
    Use: "some sellers", "may consider", "potentially", "explore options".
    Make it compelling but compliant.`
    : `Crea un guión INTRIGANTE usando el gancho "${selectedHook}".
    Ayudamos a personas explorar opciones de financiamiento del vendedor.
    NO: menciones precios, ubicaciones específicas, o hagas garantías.
    SÍ: Crea curiosidad sobre el financiamiento del vendedor como concepto.
    Mensaje clave: Algunos vendedores ofrecen financiamiento cuando los bancos no.
    Usa: "algunos vendedores", "podrían considerar", "potencialmente", "explorar opciones".
    Hazlo atractivo pero responsable.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0.95, max_tokens: 600,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(res.choices[0].message.content || '{}');

  function buildNarrations(cards: CardData[], lang: 'en' | 'es'): string[] {
    // Focus on the opportunity, not specifics
    const narratives = lang === 'en' 
      ? [
          "Example one: A home where the seller may consider financing.",
          "Example two: Another opportunity for potential seller financing.",
          "Example three: One more home with possible owner financing.",
          "These are examples of homes we've found where sellers might finance.",
          "Remember: Terms vary. Each situation is unique."
        ]
      : [
          "Ejemplo uno: Una casa donde el vendedor podría financiar.",
          "Ejemplo dos: Otra oportunidad de posible financiamiento del vendedor.",
          "Ejemplo tres: Una casa más con potencial owner financing.",
          "Estos son ejemplos de casas donde los vendedores podrían financiar.",
          "Recuerda: Los términos varían. Cada situación es única."
        ];
    
    // Show examples without revealing specifics
    return narratives.slice(0, Math.min(cards.length, 3));
  }

  const defaultHook = lang === 'en' ? 'Some sellers finance directly.' : 'Algunos vendedores financian directamente.';
  const defaultIntro = lang === 'en' ? `We found homes where sellers may offer financing.` : `Encontramos casas donde vendedores podrían financiar.`;
  const defaultCta = lang === 'en' ? 'Explore more at Ownerfi. Link in bio.' : 'Explora más en Ownerfi. Link en bio.';
  const defaultCaption = lang === 'en' ? `When banks say no, some sellers say maybe` : `Cuando bancos dicen no, algunos vendedores dicen tal vez`;
  const defaultTitle = lang === 'en' ? `Seller financing opportunities - explore options` : `Oportunidades de financiamiento del vendedor`;

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
  const scenes: any[] = [];

  // HOOK SCENE (2-3 seconds) - Just the hook, avatar closeup for urgency
  scenes.push({
    character: { 
      type: 'avatar', 
      avatar_id: AVATAR_ID, 
      avatar_style: 'closeUp', // More intimate, urgent feel
      scale: 0.5, 
      offset: { x: 0, y: 0.15 } 
    },
    voice: { 
      type: 'text', 
      input_text: script.hook, 
      voice_id: VOICE_ID, 
      volume: 0.9,
      speed: 1.1 // Slightly faster for urgency
    },
    caption_setting: { 
      style: 'shout-block', 
      font_family: 'Montserrat', 
      font_size: 70, // Bigger for mobile viewing
      text_color: '#FFFFFFFF', 
      highlight_text_color: '#FF0000FF', // Red for urgency
      offset: { x: 0.0, y: 0.35 }, 
      hidden: false, 
      override_visual_style: true 
    },
    background: { type: 'image', url: cards[0].cardImageUrl, fit: 'cover' }, // Cover for full screen
  });

  // INTRO + FIRST 2 HOUSES (quick cuts, 3-4 seconds each)
  const quickTransitions = ['cut', 'cut', 'cut']; // Fast cuts for TikTok style
  const introWithFirstHouse = `${script.intro} ${script.houseNarrations[0]}`;
  
  scenes.push({
    character: { 
      type: 'avatar', 
      avatar_id: AVATAR_ID, 
      avatar_style: 'normal', 
      scale: 0.35, 
      offset: { x: 0.3, y: 0.2 } 
    },
    voice: { 
      type: 'text', 
      input_text: introWithFirstHouse, 
      voice_id: VOICE_ID, 
      volume: 0.85,
      speed: 1.15 // Faster pacing
    },
    caption_setting: { 
      style: 'shout-block', 
      font_family: 'Montserrat', 
      font_size: 60, 
      text_color: '#FFFFFFFF', 
      highlight_text_color: '#00FF00FF', // Green for money/opportunity
      offset: { x: 0.0, y: 0.3 }, 
      hidden: false, 
      override_visual_style: true 
    },
    background: { type: 'image', url: cards[0].cardImageUrl, fit: 'contain' },
    transition_effect: { transition_in: 'cut' },
  });

  // Show only 2-3 more houses (keep it under 20 seconds total)
  const housesToShow = Math.min(2, cards.length - 1);
  for (let i = 1; i <= housesToShow; i++) {
    scenes.push({
      character: { 
        type: 'avatar', 
        avatar_id: AVATAR_ID, 
        avatar_style: 'normal', 
        scale: 0.35, 
        offset: { x: 0.3, y: 0.2 } 
      },
      voice: { 
        type: 'text', 
        input_text: script.houseNarrations[i], 
        voice_id: VOICE_ID, 
        volume: 0.85,
        speed: 1.2 // Even faster for middle houses
      },
      caption_setting: { 
        style: 'shout-block', 
        font_family: 'Montserrat', 
        font_size: 60, 
        text_color: '#FFFFFFFF', 
        highlight_text_color: '#00BC7DFF', 
        offset: { x: 0.0, y: 0.3 }, 
        hidden: false, 
        override_visual_style: true 
      },
      background: { type: 'image', url: cards[i].cardImageUrl, fit: 'contain' },
      transition_effect: { transition_in: 'cut' }, // Fast cuts only
    });
  }

  // CTA - Quick and punchy (2-3 seconds)
  scenes.push({
    character: { 
      type: 'avatar', 
      avatar_id: AVATAR_ID, 
      avatar_style: 'closeUp', // Back to closeup for CTA
      scale: 0.5, 
      offset: { x: 0, y: 0.15 } 
    },
    voice: { 
      type: 'text', 
      input_text: script.cta, 
      voice_id: VOICE_ID, 
      volume: 0.9,
      speed: 1.1
    },
    caption_setting: { 
      style: 'shout-block', 
      font_family: 'Montserrat', 
      font_size: 65, 
      text_color: '#FFFFFFFF', 
      highlight_text_color: '#FFFF00FF', // Yellow for CTA
      offset: { x: 0.0, y: 0.35 }, 
      hidden: false, 
      override_visual_style: true 
    },
    background: { type: 'image', url: cards[cards.length - 1].cardImageUrl, fit: 'cover' },
    transition_effect: { transition_in: 'cut' },
  });

  return scenes;
}

async function submitVideo(label: string, scenes: any[]): Promise<string | null> {
  const payload = { video_inputs: scenes, aspect_ratio: '9x16' };
  console.log(`\nSubmitting ${label} (${scenes.length} scenes, ~${scenes.length * 5} credits)...`);

  const res = await fetchWithRetry(
    `${CREATIFY_API}/lipsyncs_v2/`,
    { method: 'POST', headers: CREATIFY_HEADERS, body: JSON.stringify(payload) },
    { timeoutMs: 30_000, retries: 3, label: `Creatify submit ${label}` },
  );
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
      const res = await fetchWithRetry(
        `${CREATIFY_API}/lipsyncs_v2/${id}/`,
        { headers: CREATIFY_HEADERS },
        { timeoutMs: 15_000, retries: 2, label: `Creatify poll ${label}` },
      );
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
  const accountsRes = await fetchWithRetry(
    `${LATE_BASE_URL}/accounts?profileId=${profileId}`,
    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
    { timeoutMs: 30_000, retries: 3, label: 'Late accounts' },
  );
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

  const res = await fetchWithRetry(
    `${LATE_BASE_URL}/posts`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { timeoutMs: 90_000, retries: 3, label: 'Late posts' },
  );

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

  // Limit city hashtags to avoid spam look
  const uniqueCities = [...new Set(cards.map(c => c.city))].slice(0, 2);
  const cityHashtags = uniqueCities.map(c => `#${c.replace(/[^a-zA-Z0-9]/g, '')}`.toLowerCase());

  const stateHashtags = [`#${stateCode.toLowerCase()}realestate`];

  // Mix of viral and niche hashtags for algorithm optimization
  const viralHashtags = lang === 'en' 
    ? ['#housetok', '#housetour', '#realestatetok', '#firsttimehomebuyer', '#millennial', '#genz', '#rentersoftiktok', '#property', '#househunting']
    : ['#casastiktok', '#casasbaratas', '#latinos', '#latinosenusa', '#bienesraices', '#propiedades'];
    
  const nicheHashtags = lang === 'en'
    ? ['#ownerfinancing', '#ownerfi', '#renttoown', '#sellerfinancing', '#creativefi', '#nobankmortgage']
    : ['#ownerfinancing', '#ownerfi', '#financiamientodirecto', '#sinbanco'];

  // Randomly select hashtags to create variation
  const shuffleArray = <T>(arr: T[]): T[] => arr.sort(() => 0.5 - Math.random());
  
  const selectedViral = shuffleArray([...viralHashtags]).slice(0, 3);
  const selectedNiche = shuffleArray([...nicheHashtags]).slice(0, 2);
  
  // Mix hashtags
  const allHashtags = [...cityHashtags, ...stateHashtags, ...selectedViral, ...selectedNiche];
  const finalHashtags = [...new Set(allHashtags)].slice(0, 10).join(' '); // TikTok recommends 3-5, IG allows up to 30

  // Add subtle daily variation to prevent duplicate rejection
  const dayVariations = lang === 'en' 
    ? [
        '', 
        'New opportunities:', 
        'Just found:', 
        'Available now:', 
        'This week:', 
        'Recently added:', 
        'Worth exploring:'
      ]
    : [
        '', 
        'Nuevas oportunidades:', 
        'Recién encontrado:', 
        'Disponible ahora:', 
        'Esta semana:', 
        'Agregado recientemente:', 
        'Vale la pena explorar:'
      ];
  
  // Use day of week for consistent daily variation
  const dayIndex = new Date().getDay();
  const dayPhrase = dayVariations[dayIndex];
  const finalCaption = dayPhrase ? `${dayPhrase} ${script.postCaption}` : script.postCaption;

  return {
    caption: finalCaption,
    title: script.postTitle,
    hashtags: finalHashtags,
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
    const creditRes = await fetchWithRetry(
      `${CREATIFY_API}/remaining_credits/`,
      { headers: CREATIFY_HEADERS },
      { timeoutMs: 10_000, retries: 2, label: 'Creatify credits' },
    );
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
