/**
 * Viral Hooks Scraper - Scrapes trending TikTok content for hook videos
 *
 * Uses Apify's TikTok Scraper to find viral short-form content
 * Downloads first 2-3 seconds as hook clips
 * Stores in R2 for use in video generation
 *
 * Schedule: Weekly (Sunday at 6 AM)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { getAdminDb } from '@/lib/firebase-admin';
import { addHook, HookCategory, HookStyle, HookMood, ContentType, ViralHook } from '@/lib/viral-hooks';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes

// TikTok scraper config
const SCRAPER_CONFIG = {
  // Apify actor for TikTok scraping
  actorId: 'clockworks/tiktok-scraper',  // Popular TikTok scraper

  // Search for viral content with good hooks
  searchQueries: [
    'viral hooks',
    'attention grabbing',
    'stop scrolling',
    'wait for it',
    'pov',
  ],

  // Hashtags to search
  hashtags: [
    'fyp',
    'viral',
    'foryou',
    'trending',
    'mustwatch',
  ],

  // Limits
  maxVideosPerQuery: 20,
  maxTotalVideos: 100,

  // Filter criteria
  minLikes: 10000,       // Only viral content
  minViews: 50000,
  maxDuration: 15,       // Short videos more likely to have good hooks
};

// Brand targeting for hooks
const BRAND_HOOK_MAPPING: Record<string, string[]> = {
  gaza: ['news', 'breaking', 'urgent', 'emotional', 'awareness'],
  ownerfi: ['realestate', 'home', 'money', 'tips', 'education'],
  carz: ['cars', 'auto', 'electric', 'tesla', 'ev'],
  vassdistro: ['business', 'entrepreneur', 'industry', 'news'],
};

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🎣 Starting viral hooks scraper...');

    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      throw new Error('APIFY_API_KEY not configured');
    }

    const client = new ApifyClient({ token: apiKey });
    const adminDb = await getAdminDb();

    let totalScraped = 0;
    let totalAdded = 0;
    const errors: string[] = [];

    // Scrape trending TikTok content
    console.log('📡 Scraping TikTok for viral hooks...');

    // Run the scraper for trending content
    const run = await client.actor(SCRAPER_CONFIG.actorId).call({
      // Scrape trending/fyp content
      type: 'TREND',
      maxItems: SCRAPER_CONFIG.maxTotalVideos,

      // Additional filters
      shouldDownloadVideos: false, // We'll download separately
      shouldDownloadCovers: true,  // Get thumbnails
    });

    // Get results
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`📊 Found ${items.length} potential hook videos`);

    // Process each video
    for (const video of items) {
      try {
        totalScraped++;

        // Filter by engagement
        const likes = video.diggCount || video.likes || 0;
        const views = video.playCount || video.views || 0;
        const duration = video.duration || video.videoMeta?.duration || 0;

        if (likes < SCRAPER_CONFIG.minLikes) {
          console.log(`  ⏭️  Skipping - low likes (${likes})`);
          continue;
        }

        if (views < SCRAPER_CONFIG.minViews) {
          console.log(`  ⏭️  Skipping - low views (${views})`);
          continue;
        }

        if (duration > SCRAPER_CONFIG.maxDuration) {
          console.log(`  ⏭️  Skipping - too long (${duration}s)`);
          continue;
        }

        // Check for duplicates
        const sourceUrl = video.webVideoUrl || video.url || `https://tiktok.com/@${video.authorMeta?.name}/video/${video.id}`;
        const existingQuery = await adminDb
          .collection('viral_hooks')
          .where('sourceUrl', '==', sourceUrl)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          console.log(`  ⏭️  Already exists: ${sourceUrl}`);
          continue;
        }

        // Determine hook category based on content
        const text = (video.text || video.desc || '').toLowerCase();
        const category = categorizeHook(text);
        const mood = detectMood(text);
        const contentType = detectContentType(text);

        // Determine which brands can use this hook
        const brands = determineBrands(text, mood, contentType);

        // Download and process video (first 3 seconds)
        // For now, we'll save the source URL and process later
        const videoUrl = video.videoUrl || video.downloadAddr || '';

        if (!videoUrl) {
          console.log(`  ⏭️  No video URL available`);
          continue;
        }

        // Create hook record (pending review)
        const hookId = await addHook({
          videoUrl: videoUrl, // Will be replaced with R2 URL after processing
          thumbnailUrl: video.coverUrl || video.cover || '',
          duration: Math.min(duration, 3), // We'll trim to 3s
          transcript: video.text || video.desc || '',

          category,
          style: 'mixed' as HookStyle,
          mood,
          contentType,

          brands: brands as any[],
          topics: extractTopics(text),
          keywords: extractKeywords(text),

          source: 'apify',
          sourceUrl,
          sourceUsername: video.authorMeta?.name || video.author?.uniqueId || '',
          sourceLikes: likes,
          sourceViews: views,

          isActive: false, // Inactive until reviewed
          needsReview: true,
        });

        console.log(`  ✅ Added hook: ${hookId} (${category}, ${likes} likes)`);
        totalAdded++;

      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        errors.push(error);
        console.error(`  ❌ Error processing video:`, error);
      }
    }

    console.log(`\n🎉 Scraping complete!`);
    console.log(`   Total scraped: ${totalScraped}`);
    console.log(`   Added to queue: ${totalAdded}`);
    console.log(`   Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      totalScraped,
      totalAdded,
      pendingReview: totalAdded,
      errors: errors.slice(0, 10), // First 10 errors
    });

  } catch (error) {
    console.error('❌ Viral hooks scraper error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Categorize hook based on content text
 */
function categorizeHook(text: string): HookCategory {
  const lower = text.toLowerCase();

  if (lower.includes('wait') || lower.includes('stop') || lower.includes('watch')) {
    return 'attention';
  }
  if (lower.includes('believe') || lower.includes('secret') || lower.includes('nobody')) {
    return 'curiosity';
  }
  if (lower.includes('breaking') || lower.includes('urgent') || lower.includes('now')) {
    return 'urgency';
  }
  if (lower.includes('sad') || lower.includes('cry') || lower.includes('heart')) {
    return 'emotional';
  }
  if (lower.includes('pov') || lower.includes('when you') || lower.includes('that feeling')) {
    return 'relatable';
  }
  if (lower.includes('tip') || lower.includes('learn') || lower.includes('how to')) {
    return 'educational';
  }
  if (lower.includes('opinion') || lower.includes('hot take') || lower.includes('controversial')) {
    return 'controversial';
  }

  return 'attention'; // Default
}

/**
 * Determine which brands can use this hook based on text, mood, and content type
 */
function determineBrands(text: string, mood: HookMood, contentType: ContentType): string[] {
  const lower = text.toLowerCase();
  const brands: string[] = [];

  // Check each brand's keywords
  for (const [brand, keywords] of Object.entries(BRAND_HOOK_MAPPING)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        brands.push(brand);
        break;
      }
    }
  }

  // Add brands based on mood matching
  if (mood === 'serious' || mood === 'urgent' || mood === 'sad') {
    if (!brands.includes('gaza')) brands.push('gaza');
  }
  if (mood === 'excited' || mood === 'inspiring') {
    if (!brands.includes('ownerfi')) brands.push('ownerfi');
    if (!brands.includes('abdullah')) brands.push('abdullah');
    if (!brands.includes('property')) brands.push('property');
  }

  // Add brands based on content type
  if (contentType === 'news') {
    if (!brands.includes('gaza')) brands.push('gaza');
    if (!brands.includes('carz')) brands.push('carz');
    if (!brands.includes('vassdistro')) brands.push('vassdistro');
  }
  if (contentType === 'educational') {
    if (!brands.includes('ownerfi')) brands.push('ownerfi');
    if (!brands.includes('carz')) brands.push('carz');
  }
  if (contentType === 'humanitarian') {
    if (!brands.includes('gaza')) brands.push('gaza');
  }
  if (contentType === 'lifestyle') {
    if (!brands.includes('abdullah')) brands.push('abdullah');
    if (!brands.includes('property')) brands.push('property');
  }

  // If still no brands, make it available to all
  if (brands.length === 0) {
    return ['gaza', 'ownerfi', 'carz', 'vassdistro', 'abdullah', 'property'];
  }

  return [...new Set(brands)]; // Remove duplicates
}

/**
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();

  // Common attention-grabbing words
  const keywords: string[] = [];

  const patterns = [
    'wait', 'stop', 'look', 'watch', 'listen',
    'breaking', 'urgent', 'news', 'update',
    'learn', 'tip', 'secret', 'hack',
    'crazy', 'insane', 'unbelievable', 'shocking',
    'help', 'support', 'donate',
    'money', 'save', 'free', 'deal',
    'home', 'house', 'property', 'real estate',
    'car', 'vehicle', 'electric', 'ev',
  ];

  for (const pattern of patterns) {
    if (lower.includes(pattern)) {
      keywords.push(pattern);
    }
  }

  return keywords;
}

/**
 * Detect mood from text
 */
function detectMood(text: string): HookMood {
  const lower = text.toLowerCase();

  if (lower.includes('sad') || lower.includes('cry') || lower.includes('tragic') || lower.includes('heartbreak')) {
    return 'sad';
  }
  if (lower.includes('breaking') || lower.includes('urgent') || lower.includes('now') || lower.includes('alert')) {
    return 'urgent';
  }
  if (lower.includes('news') || lower.includes('important') || lower.includes('serious')) {
    return 'serious';
  }
  if (lower.includes('lol') || lower.includes('funny') || lower.includes('😂') || lower.includes('joke')) {
    return 'funny';
  }
  if (lower.includes('crazy') || lower.includes('insane') || lower.includes('shock') || lower.includes('unbelievable')) {
    return 'dramatic';
  }
  if (lower.includes('inspire') || lower.includes('motivat') || lower.includes('success') || lower.includes('achieve')) {
    return 'inspiring';
  }
  if (lower.includes('!') || lower.includes('amazing') || lower.includes('wow') || lower.includes('excited')) {
    return 'excited';
  }

  return 'neutral';
}

/**
 * Detect content type from text
 */
function detectContentType(text: string): ContentType {
  const lower = text.toLowerCase();

  if (lower.includes('breaking') || lower.includes('news') || lower.includes('update') || lower.includes('just in')) {
    return 'news';
  }
  if (lower.includes('tip') || lower.includes('learn') || lower.includes('how to') || lower.includes('guide') || lower.includes('tutorial')) {
    return 'educational';
  }
  if (lower.includes('donate') || lower.includes('help') || lower.includes('support') || lower.includes('charity') || lower.includes('humanitarian')) {
    return 'humanitarian';
  }
  if (lower.includes('product') || lower.includes('review') || lower.includes('unbox') || lower.includes('new release')) {
    return 'product';
  }
  if (lower.includes('pov') || lower.includes('day in') || lower.includes('routine') || lower.includes('life')) {
    return 'lifestyle';
  }

  return 'entertainment';
}

/**
 * Extract topic keywords from text
 */
function extractTopics(text: string): string[] {
  // Extract hashtags
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags.map(h => h.replace('#', '').toLowerCase()).slice(0, 10);
}
