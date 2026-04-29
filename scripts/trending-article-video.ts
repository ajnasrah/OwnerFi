/**
 * Trending Article Video Pipeline
 *
 * Creates engaging videos that connect trending news to owner financing education.
 * Runs twice daily to mix with property videos.
 *
 * Usage:
 *   npx tsx scripts/trending-article-video.ts --lang en
 *   npx tsx scripts/trending-article-video.ts --lang es  
 *   npx tsx scripts/trending-article-video.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import OpenAI from 'openai';
import { getUnprocessedArticles, markArticleVideoGenerated, type Article } from '../src/lib/feed-store-firestore';
import type { Brand } from '../src/config/constants';

// ============================================================================
// Configuration
// ============================================================================

const CREATIFY_API = 'https://api.creatify.ai/api';
const CREATIFY_HEADERS = {
  'X-API-ID': process.env.CREATIFY_API_ID || '',
  'X-API-KEY': process.env.CREATIFY_API_KEY || '',
  'Content-Type': 'application/json',
};
const AVATAR_ID = '22653e70-2320-422f-84b4-348f2260cc3c'; // Original working avatar
const VOICE_ID = 'f20167ac-d1be-452c-b5a7-e48ea0ede3a9';  // Back to working voice

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const DRY_RUN = process.argv.includes('--dry-run');

// Parse --lang flag
function parseLang(): 'en' | 'es' {
  const idx = process.argv.indexOf('--lang');
  if (idx === -1 || idx + 1 >= process.argv.length) return 'en';
  const val = process.argv[idx + 1].toLowerCase();
  return val === 'es' ? 'es' : 'en';
}
const LANG = parseLang();

// ============================================================================
// Types
// ============================================================================

interface VideoScript {
  hook: string;
  connection: string; // How this news connects to housing/finance
  education: string;  // Owner financing education point
  cta: string;
  postCaption: string;
  postTitle: string;
}

interface PostMeta {
  caption: string;
  title: string;
  hashtags: string;
}

// ============================================================================
// Fetch with retry utility
// ============================================================================

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

// ============================================================================
// Article Selection and Script Generation
// ============================================================================

async function selectTrendingArticle(): Promise<Article> {
  const articles = await getUnprocessedArticles('ownerfi', 5);
  if (articles.length === 0) {
    console.log('⚠️ No unprocessed articles found. Creating sample article for testing...');
    return {
      id: 'sample-article-' + Date.now(),
      title: 'Mortgage Rates Hit New High as Housing Market Faces Challenges',
      link: 'https://example.com/sample-article',
      description: 'Rising mortgage rates are making homeownership less accessible for many Americans, prompting exploration of alternative financing options.',
      content: 'As traditional mortgage rates continue to climb, many potential homebuyers are finding themselves priced out of the market. This trend is driving interest in alternative financing solutions such as seller financing, rent-to-own agreements, and other creative financing options.',
      feedId: 'sample-feed',
      pubDate: Date.now(),
      author: 'Sample Author',
      categories: ['housing', 'finance'],
      processed: false,
      videoGenerated: false,
      createdAt: Date.now()
    };
  }

  // Pick the most recent article
  const article = articles[0];
  console.log(`📰 Selected article: "${article.title}"`);
  console.log(`   Source: ${article.link}`);
  return article;
}

async function generateScript(article: Article, lang: 'en' | 'es'): Promise<VideoScript> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const today = new Date();
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][today.getMonth()];

  const systemPrompt = lang === 'en'
    ? `You create engaging scripts that connect trending news to owner financing education.

TODAY: ${dayOfWeek}, ${month} ${today.getDate()}

CONCEPT: Take a trending news story and smoothly connect it to owner financing as an alternative path.

TONE: Informative but engaging. Like a knowledgeable friend sharing insights.

STRUCTURE:
1. HOOK: Reference the trending topic (be specific about the article)
2. CONNECTION: Bridge from the news to housing/finance challenges  
3. EDUCATION: Explain one key aspect of owner financing
4. CTA: Encourage learning more

COMPLIANCE:
- Never promise specific outcomes or guarantees
- Use: "some sellers may", "could be an option", "worth exploring"
- Focus on education, not promises

OUTPUT FORMAT (JSON):
{
  "hook": "Open with the trending story. Max 10 words.",
  "connection": "Bridge from news to housing challenges. Max 15 words.", 
  "education": "One clear owner financing education point. Max 20 words.",
  "cta": "Encourage learning more. Max 10 words.",
  "postCaption": "Intriguing caption connecting news to owner financing. Max 100 chars.",
  "postTitle": "Engaging title about news + owner financing connection. Max 100 chars."
}`
    : `Creas guiones atractivos que conectan noticias trending con educación de owner financing.

HOY: ${dayOfWeek}, ${month} ${today.getDate()}

CONCEPTO: Toma una noticia trending y conéctala suavemente con owner financing como alternativa.

TONO: Informativo pero atractivo. Como un amigo conocedor compartiendo insights.

ESTRUCTURA:
1. GANCHO: Referencia el tema trending (sé específico sobre el artículo)
2. CONEXIÓN: Puente de la noticia a desafíos de vivienda/finanzas
3. EDUCACIÓN: Explica un aspecto clave del owner financing
4. CTA: Anima a aprender más

CUMPLIMIENTO:
- Nunca prometas resultados específicos o garantías
- Usa: "algunos vendedores pueden", "podría ser opción", "vale explorar"
- Enfócate en educación, no promesas

FORMATO (JSON):
{
  "hook": "Abre con la historia trending. Max 10 palabras.",
  "connection": "Puente de noticia a desafíos de vivienda. Max 15 palabras.",
  "education": "Un punto claro de educación owner financing. Max 20 palabras.", 
  "cta": "Anima a aprender más. Max 10 palabras.",
  "postCaption": "Caption intrigante conectando noticia con owner financing. Max 100 chars.",
  "postTitle": "Título atractivo sobre noticia + conexión owner financing. Max 100 chars."
}`;

  const userPrompt = lang === 'en'
    ? `Create a script connecting this trending article to owner financing:

ARTICLE: "${article.title}"
SUMMARY: ${article.description || article.content?.substring(0, 200) + '...' || 'No summary available'}

Connect this news to housing challenges and teach about owner financing as an alternative.
Make it relevant and educational, not salesy.`
    : `Crea un guión conectando este artículo trending con owner financing:

ARTÍCULO: "${article.title}"
RESUMEN: ${article.description || article.content?.substring(0, 200) + '...' || 'Sin resumen disponible'}

Conecta esta noticia con desafíos de vivienda y enseña sobre owner financing como alternativa.
Hazlo relevante y educativo, no promocional.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(res.choices[0].message.content || '{}');
  
  const defaultHook = lang === 'en' ? 'Recent housing news raises questions.' : 'Noticias recientes sobre vivienda generan preguntas.';
  const defaultConnection = lang === 'en' ? 'This affects how people think about buying homes.' : 'Esto afecta cómo la gente piensa sobre comprar casas.';
  const defaultEducation = lang === 'en' ? 'Owner financing lets sellers act as the bank in some cases.' : 'Owner financing permite a vendedores actuar como banco en algunos casos.';
  const defaultCta = lang === 'en' ? 'Learn more at Ownerfi.' : 'Aprende más en Ownerfi.';
  const defaultCaption = lang === 'en' ? 'How trending news connects to owner financing options' : 'Cómo noticias trending conectan con opciones owner financing';
  const defaultTitle = lang === 'en' ? 'Trending news + owner financing connection' : 'Noticias trending + conexión owner financing';

  const script: VideoScript = {
    hook: parsed.hook || defaultHook,
    connection: parsed.connection || defaultConnection,
    education: parsed.education || defaultEducation,
    cta: parsed.cta || defaultCta,
    postCaption: parsed.postCaption || defaultCaption,
    postTitle: parsed.postTitle || defaultTitle,
  };

  console.log(`${lang.toUpperCase()} Trending Script:`);
  console.log(`  Hook: "${script.hook}"`);
  console.log(`  Connection: "${script.connection}"`);
  console.log(`  Education: "${script.education}"`);
  console.log(`  CTA: "${script.cta}"`);
  console.log(`  Caption: "${script.postCaption}" (${script.postCaption.length} chars)`);

  return script;
}

// ============================================================================
// Video Generation 
// ============================================================================

async function buildScenes(article: Article, script: VideoScript): Promise<any[]> {
  const scenes: any[] = [];

  // Scene 1: Hook with article title as background
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 1.2,  // Much larger avatar
      offset: { x: 0, y: 0.15 }
    },
    voice: {
      type: 'text',
      input_text: script.hook,
      voice_id: VOICE_ID,
      volume: 0.95,
      speed: 1.2
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 70,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#FF0000FF',
      offset: { x: 0.0, y: 0.35 },
      hidden: false,
      override_visual_style: true
    },
    background: {
      type: 'image',
      url: `https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=720&h=1280&fit=crop&q=80`,  // Professional news background
      fit: 'cover'
    }
  });

  // Scene 2: Connection  
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 1.1,  // Larger avatar for middle scenes
      offset: { x: -0.1, y: 0.12 }  // Slight left position for variety
    },
    voice: {
      type: 'text',
      input_text: script.connection,
      voice_id: VOICE_ID,
      volume: 0.7,
      speed: 0.9  // Slower for concern
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 60,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#FFFF00FF',
      offset: { x: 0.0, y: 0.3 },
      hidden: false,
      override_visual_style: true
    },
    background: {
      type: 'image',
      url: `https://images.unsplash.com/photo-1495020689067-958852a7765e?w=720&h=1280&fit=crop&q=80`,  // News media background
      fit: 'cover'
    },
    transition_effect: { transition_in: 'fade' }
  });

  // Scene 3: Education
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 1.15,  // Slightly larger for key educational point
      offset: { x: 0.1, y: 0.10 }  // Slight right position for movement
    },
    voice: {
      type: 'text',
      input_text: script.education,
      voice_id: VOICE_ID,
      volume: 0.85,
      speed: 1.1
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 60,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#00FF00FF',
      offset: { x: 0.0, y: 0.3 },
      hidden: false,
      override_visual_style: true
    },
    background: {
      type: 'image',
      url: `https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=720&h=1280&fit=crop&q=80`,  // Breaking news background
      fit: 'cover'
    },
    transition_effect: { transition_in: 'fade' }
  });

  // Scene 4: CTA
  scenes.push({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 1.2,  // Much larger avatar
      offset: { x: 0, y: 0.15 }
    },
    voice: {
      type: 'text',
      input_text: script.cta,
      voice_id: VOICE_ID,
      volume: 0.95,
      speed: 1.25
    },
    caption_setting: {
      style: 'shout-block',
      font_family: 'Montserrat',
      font_size: 65,
      text_color: '#FFFFFFFF',
      highlight_text_color: '#FFFF00FF',
      offset: { x: 0.0, y: 0.35 },
      hidden: false,
      override_visual_style: true
    },
    background: {
      type: 'image',
      url: `https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=720&h=1280&fit=crop&q=80`,  // Professional news background
      fit: 'cover'
    },
    transition_effect: { transition_in: 'fade' }
  });

  return scenes;
}

async function submitVideo(label: string, scenes: any[]): Promise<string | null> {
  const payload = { video_inputs: scenes, aspect_ratio: '9x16' };
  console.log(`\nSubmitting ${label} (${scenes.length} scenes, ~${scenes.length * 5} credits)...`);

  const res = await fetchWithRetry(
    `${CREATIFY_API}/lipsyncs_v2/`,
    {
      method: 'POST',
      headers: CREATIFY_HEADERS,
      body: JSON.stringify(payload),
    },
    { timeoutMs: 30_000, retries: 3, label: `Creatify submit ${label}` }
  );

  const data = await res.json();
  if (res.status !== 200 && res.status !== 201) {
    console.error(`${label} ERROR:`, JSON.stringify(data, null, 2));
    return null;
  }

  console.log(`${label} submitted — ID: ${data.id}`);
  return data.id;
}

async function pollForCompletion(videoId: string): Promise<string | null> {
  console.log(`⏳ Polling video ${videoId}...`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 20000));
    try {
      const res = await fetchWithRetry(
        `${CREATIFY_API}/lipsyncs_v2/${videoId}/`,
        { headers: CREATIFY_HEADERS },
        { timeoutMs: 15_000, retries: 2, label: `Creatify poll trending` }
      );
      if (!res.ok) {
        console.warn(`[Trending] Poll HTTP ${res.status} — retrying...`);
        continue;
      }

      const data = await res.json();
      console.log(`   Poll ${i + 1}: ${data.status}`);

      if (data.status === 'completed') {
        console.log(`✅ Video ready: ${data.video_url}`);
        return data.video_url;
      } else if (data.status === 'failed') {
        console.error(`❌ Video generation failed:`, data);
        return null;
      }
    } catch (error) {
      console.warn(`[Trending] Poll ${i + 1} failed:`, error instanceof Error ? error.message : error);
      if (i === 29) throw error; // Last attempt
    }
  }

  console.error('❌ Video polling timeout after 10 minutes');
  return null;
}

// ============================================================================
// Social Media Posting
// ============================================================================

function buildPostMeta(script: VideoScript, lang: 'en' | 'es'): PostMeta {
  // Trending article hashtags
  const trendingHashtags = lang === 'en'
    ? ['#trending', '#news', '#housing', '#realestate', '#finance', '#education']
    : ['#trending', '#noticias', '#vivienda', '#bienesraices', '#finanzas', '#educacion'];

  const ownerFinancingHashtags = ['#ownerfinancing', '#ownerfi', '#sellerfinancing', '#alternativefinancing'];

  // Shuffle and select hashtags
  const selectedTrending = trendingHashtags.sort(() => 0.5 - Math.random()).slice(0, 3);
  const selectedOF = ownerFinancingHashtags.slice(0, 2);
  
  const finalHashtags = [...selectedTrending, ...selectedOF].join(' ');

  // Daily variation to prevent duplicates
  const dayVariations = lang === 'en'
    ? ['Breaking:', 'Today:', 'Trending:', 'News:', 'Update:', 'Latest:', 'Now:']
    : ['Noticia:', 'Hoy:', 'Trending:', 'Noticias:', 'Actualización:', 'Último:', 'Ahora:'];

  const dayIndex = new Date().getDay();
  const dayPhrase = dayVariations[dayIndex];
  const finalCaption = dayPhrase ? `${dayPhrase} ${script.postCaption}` : script.postCaption;

  return {
    caption: finalCaption,
    title: script.postTitle,
    hashtags: finalHashtags,
  };
}

async function postToLate(videoUrl: string, caption: string, title?: string): Promise<boolean> {
  const apiKey = process.env.LATE_API_KEY?.trim();
  const profileId = process.env.LATE_OWNERFI_PROFILE_ID?.trim();

  if (!apiKey || !profileId) {
    console.error('❌ Late.dev credentials missing');
    return false;
  }

  // Get platforms
  const profileRes = await fetchWithRetry(
    `${LATE_BASE_URL}/profiles/${profileId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    { timeoutMs: 30_000, retries: 3, label: 'Late profile' }
  );

  if (!profileRes.ok) {
    const errorText = await profileRes.text();
    console.error('❌ Late.dev profile error:', errorText);
    return false;
  }

  const profileData = await profileRes.json();
  const platforms = profileData.platforms || [];

  platforms.forEach((platform: any) => {
    if (platform.platform === 'youtube') {
      platform.platformSpecificData = {
        title: title || caption.substring(0, 100),
        category: 'People & Blogs',
        privacy: 'public',
      };
    }
  });

  if (platforms.length === 0) {
    console.error('No Late.dev accounts connected');
    return false;
  }

  console.log(`Posting to Late.dev: ${platforms.map((p: any) => p.platform).join(', ')}`);

  const body = {
    content: caption,
    platforms,
    mediaItems: [{ type: 'video', url: videoUrl }],
  };

  const res = await fetchWithRetry(
    `${LATE_BASE_URL}/posts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    { timeoutMs: 90_000, retries: 3, label: 'Late posts' }
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
// Main Pipeline
// ============================================================================

async function runTrendingVideo(lang: 'en' | 'es'): Promise<boolean> {
  const label = `${lang.toUpperCase()} Trending`;

  try {
    // 1. Select trending article
    console.log(`\n=== ${label}: Select Trending Article ===`);
    const article = await selectTrendingArticle();

    // 2. Generate script
    console.log(`\n=== ${label}: Generate Script ===`);
    const script = await generateScript(article, lang);
    const meta = buildPostMeta(script, lang);

    if (DRY_RUN) {
      console.log(`\n${label} Post Preview:`);
      console.log(`  Caption: "${meta.caption}"`);
      console.log(`  Title: "${meta.title}"`);
      console.log(`  Hashtags: ${meta.hashtags}`);
      console.log(`  Article: ${article.title}`);
      return true;
    }

    // 3. Submit video
    console.log(`\n=== ${label}: Submit Video ===`);
    const scenes = await buildScenes(article, script);
    const videoId = await submitVideo(label, scenes);
    if (!videoId) return false;

    // 4. Poll for completion
    console.log(`\n=== ${label}: Poll for Completion ===`);
    const videoUrl = await pollForCompletion(videoId);
    if (!videoUrl) return false;

    // 5. Post to social media
    console.log(`\n=== ${label}: Post to Late.dev ===`);
    console.log(`  Title: "${meta.title}"`);
    console.log(`  Caption: "${meta.caption}"`);
    console.log(`  Hashtags: ${meta.hashtags}`);
    const posted = await postToLate(videoUrl, `${meta.caption}\n\n${meta.hashtags}`, meta.title);

    if (posted) {
      // Mark article as processed
      await markArticleVideoGenerated(article.id, 'ownerfi' as Brand, videoId);
      console.log(`✅ ${label} pipeline completed successfully`);
    }

    return posted;
  } catch (error) {
    console.error(`❌ ${label} pipeline failed:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Trending Article Video Pipeline');
  console.log(`   Language: ${LANG}`);
  console.log(`   Dry run: ${DRY_RUN}`);

  const startTime = Date.now();

  try {
    const success = await runTrendingVideo(LANG);
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n============================================');
    console.log(`  Pipeline complete in ${duration}s`);
    console.log(`  ${LANG.toUpperCase()}: ${success ? 'SUCCESS' : 'FAILED'}`);
    console.log('============================================');

    if (!success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Pipeline error:', error);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}