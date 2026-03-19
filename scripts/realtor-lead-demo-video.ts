/**
 * Realtor Lead Demo Video Pipeline
 *
 * Full end-to-end pipeline: generates UI screenshots of the lead referral flow,
 * creates an AI avatar video walking through the process, posts to social media.
 *
 * Target audience: Licensed real estate agents looking for buyer leads.
 * Shows: Finding John Doe → Referral Agreement → Signing → Getting contact info.
 *
 * Usage:
 *   npx tsx scripts/realtor-lead-demo-video.ts              (full pipeline)
 *   npx tsx scripts/realtor-lead-demo-video.ts --dry-run     (screens + script preview only)
 *
 * Same pattern as ownerfi-daily-video.ts.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import OpenAI from 'openai';
import { execSync } from 'child_process';

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
const VOICE_ID = 'f20167ac-d1be-452c-b5a7-e48ea0ede3a9';  // Amir - Arabic accent

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const DRY_RUN = process.argv.includes('--dry-run');
const SCREENS_PATH = '/tmp/lead-demo-screens.json';

interface ScreenData {
  step: number;
  label: string;
  description: string;
  screenImageUrl: string;
}

// ============================================================================
// Step 1: Generate Demo Screens
// ============================================================================

async function generateScreens(): Promise<ScreenData[]> {
  console.log('\n=== STEP 1: Generate Lead Demo Screens ===\n');

  if (fs.existsSync(SCREENS_PATH)) fs.unlinkSync(SCREENS_PATH);

  const dryFlag = DRY_RUN ? ' --dry-run' : '';
  const scriptPath = path.resolve(__dirname, 'generate-lead-demo-screens.ts');
  execSync(`npx tsx ${scriptPath}${dryFlag}`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  if (!fs.existsSync(SCREENS_PATH)) throw new Error('Screen generation failed — no output file');
  const screens: ScreenData[] = JSON.parse(fs.readFileSync(SCREENS_PATH, 'utf-8'));
  console.log(`Loaded ${screens.length} screens.\n`);
  return screens;
}

// ============================================================================
// Step 2: Generate Script with GPT
// ============================================================================

interface VideoScript {
  hook: string;
  screenNarrations: string[];
  cta: string;
  postCaption: string;
  postTitle: string;
}

async function generateScript(): Promise<VideoScript> {
  console.log('\n=== STEP 2: Generate Script ===\n');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You write TikTok/Reels scripts. You sound like a REAL PERSON talking to camera — not a marketer, not a robot, not LinkedIn. You're a realtor who found something wild and is telling your friends about it.

AUDIENCE: Real estate agents who are TIRED of paying Zillow $500/month for garbage leads. They want real buyers, not tire kickers.

YOUR VIBE:
- Talk like you're FaceTiming a friend. Use "bro", "look", "watch this", "I'm not kidding"
- Short punchy sentences. 5-10 words max per sentence.
- Sound EXCITED but not fake. Like you genuinely can't believe this exists.
- Reference specific pain points: cold calling, buying leads that ghost, Zillow fees, door knocking
- NEVER sound corporate. NEVER say "unlock", "discover", "leverage", "utilize", "solution"
- NO exclamation marks.

WHAT YOU'RE SHOWING:
This app called OwnerFi gives you buyer leads for FREE. Real people who are actively browsing homes on the app right now. You sign a referral agreement (30% fee only if you close) and you get their phone number and email INSTANTLY. No cold calling. No paying per lead.

THE 5 SCREENS YOU'RE NARRATING (keep each under 20 words):
1. Your dashboard — you see 4 active buyers right now, with match scores
2. You found John Doe from Houston — 92% match, 14 properties liked. You're about to grab him.
3. Sign the referral agreement — type your name, check the boxes, done in 30 seconds
4. BOOM — John's phone number and email just popped up. You can text him RIGHT NOW.
5. He's in your leads forever. Text him, call him, he's yours.

OUTPUT (JSON):
{
  "hook": "First 2-3 seconds. Pattern interrupt. Make them stop scrolling. Max 10 words. Talk TO them.",
  "screenNarrations": [
    "Screen 1 — what you see when you open the app. Casual, real.",
    "Screen 2 — you found your guy. Build anticipation.",
    "Screen 3 — the signing part. Make it sound stupidly easy.",
    "Screen 4 — the payoff. This is the moment. Make it hit.",
    "Screen 5 — wrap it up. He's yours now."
  ],
  "cta": "Tell them to go to ownerfi.ai. Keep it casual. Under 12 words.",
  "postCaption": "Under 120 chars. Make realtors NEED to watch. Tease the result without giving it away. No hashtags.",
  "postTitle": "Under 100 chars. Curiosity gap — they have to click. No hashtags."
}`;

  const userPrompt = `Generate a script for a product demo video showing how realtors get free buyer leads on OwnerFi. The demo walks through accepting a lead named John Doe from Houston, TX, signing the referral agreement, and getting his contact info.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0.9, max_tokens: 500,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(res.choices[0].message.content || '{}');

  // Fallback narrations (one per screen, always exactly 5)
  const defaultNarrations = [
    'When you log in, you see active buyers in your area with match scores.',
    'Found John Doe in Houston. 92% match. Tap Accept Lead.',
    'Review the referral agreement, type your name, check the boxes, and sign.',
    'His full name, phone number, and email are now yours. Text or call him.',
    'Your leads stay here. Text them, view details, or refer to another agent.',
  ];

  // Ensure exactly 5 narrations — pad with defaults if GPT returned fewer
  const rawNarrations = Array.isArray(parsed.screenNarrations) ? parsed.screenNarrations : [];
  const narrations = defaultNarrations.map((fallback, i) => rawNarrations[i] || fallback);

  const script: VideoScript = {
    hook: parsed.hook || 'Realtors, you need to see this lead system.',
    screenNarrations: narrations,
    cta: parsed.cta || 'Sign up free at ownerfi.ai. Link in bio.',
    postCaption: parsed.postCaption || 'Realtors are getting free buyer leads without paying a dime. Here is how',
    postTitle: parsed.postTitle || 'Free buyer leads for realtors — no cold calling needed',
  };

  console.log('Script:');
  console.log(`  Hook: "${script.hook}"`);
  script.screenNarrations.forEach((n, i) => console.log(`  Screen ${i + 1}: "${n}"`));
  console.log(`  CTA: "${script.cta}"`);
  console.log(`  Caption: "${script.postCaption}" (${script.postCaption.length} chars)`);
  console.log(`  Title: "${script.postTitle}" (${script.postTitle.length} chars)`);

  return script;
}

// ============================================================================
// Step 3: Build Creatify Scenes + Submit
// ============================================================================

function buildScenes(screens: ScreenData[], script: VideoScript): any[] {
  const scenes: any[] = [];

  // Intro scene: Hook over first screen
  scenes.push({
    character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.75, offset: { x: 0.35, y: 0.38 } },
    voice: { type: 'text', input_text: script.hook, voice_id: VOICE_ID, volume: 0.85 },
    caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 80, text_color: '#FFFFFFFF', highlight_text_color: '#10B981FF', offset: { x: 0.0, y: 0.25 }, hidden: false, override_visual_style: true },
    background: { type: 'image', url: screens[0].screenImageUrl, fit: 'contain' },
  });

  // One scene per screen with its narration
  const transitions = ['leftSwipe', 'rightSwipe', 'fade', 'topSwipe', 'bottomSwipe'];
  screens.forEach((screen, i) => {
    scenes.push({
      character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.75, offset: { x: 0.35, y: 0.38 } },
      voice: { type: 'text', input_text: script.screenNarrations[i], voice_id: VOICE_ID, volume: 0.85 },
      caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 80, text_color: '#FFFFFFFF', highlight_text_color: '#10B981FF', offset: { x: 0.0, y: 0.25 }, hidden: false, override_visual_style: true },
      background: { type: 'image', url: screen.screenImageUrl, fit: 'contain' },
      transition_effect: { transition_in: transitions[i % transitions.length] },
    });
  });

  // CTA scene over last screen
  scenes.push({
    character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal', scale: 0.75, offset: { x: 0.35, y: 0.38 } },
    voice: { type: 'text', input_text: script.cta, voice_id: VOICE_ID, volume: 0.85 },
    caption_setting: { style: 'shout-block', font_family: 'Montserrat', font_size: 80, text_color: '#FFFFFFFF', highlight_text_color: '#10B981FF', offset: { x: 0.0, y: 0.25 }, hidden: false, override_visual_style: true },
    background: { type: 'image', url: screens[screens.length - 1].screenImageUrl, fit: 'contain' },
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

  // Map platforms (same as ownerfi-daily-video.ts + YouTube)
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
        category: 'Education',
        privacy: 'public',
        madeForKids: false,
        short: true,
      };
    }
    return config;
  }).filter(Boolean);

  if (platforms.length === 0) {
    console.error('No Late.dev accounts connected');
    return false;
  }

  console.log(`Posting to Late.dev: ${platforms.map((p: any) => p.platform).join(', ')}`);

  // Truncate caption for Twitter
  const twitterPlatform = platforms.find((p: any) => p.platform === 'twitter');
  if (twitterPlatform && caption.length > 280) {
    const lines = caption.split('\n\n');
    const coreCaption = lines[0];
    (twitterPlatform as any).platformSpecificData.content =
      coreCaption.length <= 280 ? coreCaption : coreCaption.slice(0, 277) + '...';
  }

  const body: Record<string, unknown> = {
    content: caption,
    platforms,
    mediaItems: [{ type: 'video', url: videoUrl }],
    publishNow: true,
    timezone: 'America/Chicago',
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
// Build Post Metadata
// ============================================================================

interface PostMeta {
  caption: string;
  title: string;
  hashtags: string;
}

function buildPostMeta(script: VideoScript): PostMeta {
  const hashtags = [
    '#realtors', '#buyerleads', '#ownerfi', '#ownerfinancing',
    '#realestateleads', '#realestateagent', '#realtorsoftiktok',
    '#freeleads', '#leadgeneration', '#realtorlife',
    '#closingdeals', '#referral', '#realestatemarketing',
  ].join(' ');

  return {
    caption: script.postCaption,
    title: script.postTitle,
    hashtags,
  };
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  const startTime = Date.now();
  console.log('============================================');
  console.log('  Realtor Lead Demo Video Pipeline');
  console.log(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT`);
  console.log(`  ${DRY_RUN ? '(dry-run)' : ''}`);
  console.log('============================================');

  // Step 1: Generate screens
  const screens = await generateScreens();
  if (screens.length === 0) {
    console.error('No screens generated. Aborting.');
    process.exit(1);
  }

  // Step 2: Generate script
  const script = await generateScript();
  const meta = buildPostMeta(script);

  if (DRY_RUN) {
    console.log('\nPost Preview:');
    console.log(`  Caption: "${meta.caption}"`);
    console.log(`  Title: "${meta.title}"`);
    console.log(`  Hashtags: ${meta.hashtags}`);
    console.log('\n--dry-run: Skipping video creation and posting.\n');
    return;
  }

  // Check credits
  const creditRes = await fetch(`${CREATIFY_API}/remaining_credits/`, { headers: CREATIFY_HEADERS });
  if (creditRes.ok) {
    const credits = await creditRes.json();
    const scenesCount = screens.length + 2; // screens + intro + CTA
    const needed = scenesCount * 5;
    console.log(`\nCredits: ${credits.remaining_credits} (need ~${needed})`);
    if (credits.remaining_credits < needed) {
      console.error('Not enough Creatify credits. Aborting.');
      process.exit(1);
    }
  } else {
    console.warn('Credit check failed — proceeding anyway');
  }

  // Step 3: Submit video
  console.log('\n=== STEP 3: Submit Video ===');
  const scenes = buildScenes(screens, script);
  const videoId = await submitVideo('Lead Demo', scenes);
  if (!videoId) {
    console.error('Video submission failed. Aborting.');
    process.exit(1);
  }

  // Step 4: Poll
  console.log('\n=== STEP 4: Poll for Completion ===');
  const videoUrl = await pollVideo(videoId, 'Lead Demo');
  if (!videoUrl) {
    console.error('Video generation failed. Aborting.');
    process.exit(1);
  }

  // Step 5: Post
  console.log('\n=== STEP 5: Post to Late.dev ===');
  console.log(`  Title: "${meta.title}"`);
  console.log(`  Caption: "${meta.caption}"`);
  console.log(`  Hashtags: ${meta.hashtags}`);
  const posted = await postToLate(videoUrl, `${meta.caption}\n\n${meta.hashtags}`, meta.title);

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n============================================`);
  console.log(`  Pipeline complete in ${duration}s`);
  console.log(`  Video: ${posted ? 'POSTED' : 'FAILED'}`);
  console.log('============================================\n');

  if (!posted) {
    console.error('Posting failed.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
