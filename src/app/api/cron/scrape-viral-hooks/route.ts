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
  // Apify actor for TikTok scraping - using clockworks/tiktok-scraper with hashtags
  actorId: 'clockworks/tiktok-scraper',

  // NICHE-SPECIFIC HASHTAGS - Relevant to our brands
  hashtags: {
    // Real Estate / Owner Financing (OwnerFi, Property, Benefit)
    realEstate: [
      'realestate',
      'realestatetiktok',
      'firsttimehomebuyer',
      'homebuying',
      'ownerfinancing',
      'renttoown',
      'housingmarket',
      'realestateagent',
      'homeownership',
      'realestatetips',
    ],

    // Business / Entrepreneurship (Abdullah, VassDistro)
    business: [
      'entrepreneur',
      'businesstiktok',
      'smallbusiness',
      'sidehustle',
      'moneytok',
      'financetok',
      'wealthbuilding',
      'passiveincome',
      'businessowner',
      'entrepreneurlife',
    ],

    // News / Current Events (Gaza, Carz for EV news)
    news: [
      'breakingnews',
      'worldnews',
      'newstiktok',
      'currentevents',
      'journalismtiktok',
    ],

    // Gaza / Humanitarian
    humanitarian: [
      'freepalestine',
      'gaza',
      'palestine',
      'humanitarian',
      'standwithpalestine',
    ],

    // Cars / EVs (Carz)
    automotive: [
      'cartok',
      'cartiktok',
      'electricvehicle',
      'evtok',
      'tesla',
      'evnews',
      'carsoftiktok',
      'carnews',
    ],

    // Motivational / Personal Brand (Abdullah)
    motivation: [
      'motivation',
      'mindset',
      'success',
      'growthmindset',
      'selfimprovement',
      'motivationaltiktok',
    ],
  },

  // Search queries for finding hook-style content (niche-specific)
  searchQueries: [
    // Real estate hooks
    'real estate tips',
    'how to buy a house',
    'owner financing homes',
    'first time home buyer tips',

    // Business hooks
    'business advice',
    'entrepreneur tips',
    'money tips',
    'wealth building',

    // News style hooks
    'breaking news intro',
    'news update',

    // Motivational hooks
    'motivation speech',
    'success mindset',
  ],

  // Limits per input type
  resultsPerHashtag: 10,
  resultsPerSearch: 8,
  maxTotalVideos: 80,

  // Filter criteria
  minLikes: 5000,        // Higher threshold for quality
  minViews: 20000,       // Higher threshold - need actually viral content
  maxDuration: 30,       // Allow longer videos - we'll trim to first 3 seconds
};

// Brand targeting for hooks - maps hashtag categories to brands
const BRAND_HOOK_MAPPING: Record<string, string[]> = {
  // Gaza - news, humanitarian content
  gaza: ['news', 'breaking', 'urgent', 'emotional', 'awareness', 'humanitarian', 'palestine', 'freepalestine', 'worldnews'],

  // OwnerFi / Benefit - real estate, homebuying
  ownerfi: ['realestate', 'home', 'homebuying', 'firsttimehomebuyer', 'ownerfinancing', 'renttoown', 'housingmarket', 'homeownership'],
  benefit: ['realestate', 'home', 'homebuying', 'firsttimehomebuyer', 'ownerfinancing', 'renttoown', 'housingmarket', 'homeownership'],
  property: ['realestate', 'home', 'homebuying', 'firsttimehomebuyer', 'ownerfinancing', 'renttoown', 'housingmarket', 'homeownership'],

  // Carz - automotive, EVs
  carz: ['car', 'cars', 'auto', 'electric', 'tesla', 'ev', 'cartok', 'evtok', 'carnews', 'electricvehicle'],

  // VassDistro - business, industry news
  vassdistro: ['business', 'entrepreneur', 'industry', 'news', 'smallbusiness', 'businessowner'],

  // Abdullah - motivation, business, personal brand
  abdullah: ['motivation', 'mindset', 'success', 'entrepreneur', 'business', 'moneytok', 'wealthbuilding', 'growthmindset', 'selfimprovement'],
};

// Map hashtag categories to the brands that should use them
const CATEGORY_TO_BRANDS: Record<string, string[]> = {
  realEstate: ['ownerfi', 'benefit', 'property'],
  business: ['abdullah', 'vassdistro'],
  news: ['gaza', 'carz', 'vassdistro'],
  humanitarian: ['gaza'],
  automotive: ['carz'],
  motivation: ['abdullah'],
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

    // Scrape TikTok content using NICHE-SPECIFIC hashtags
    console.log('📡 Scraping TikTok for niche-specific viral hooks...');

    const allItems: any[] = [];
    const itemCategories = new Map<string, string>(); // Track which category each item came from

    // Scrape each category of hashtags
    const categories = Object.entries(SCRAPER_CONFIG.hashtags);

    for (const [category, hashtags] of categories) {
      if (allItems.length >= SCRAPER_CONFIG.maxTotalVideos) break;

      console.log(`\n📁 Scraping category: ${category.toUpperCase()}`);

      // Pick 2 random hashtags from each category to diversify
      const selectedHashtags = hashtags
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);

      for (const hashtag of selectedHashtags) {
        if (allItems.length >= SCRAPER_CONFIG.maxTotalVideos) break;

        try {
          console.log(`  🔍 Scraping hashtag: #${hashtag}`);
          const run = await client.actor(SCRAPER_CONFIG.actorId).call({
            hashtags: [hashtag],
            resultsPerPage: SCRAPER_CONFIG.resultsPerHashtag,
            shouldDownloadVideos: false,
            shouldDownloadCovers: true,
          });

          const { items } = await client.dataset(run.defaultDatasetId).listItems();
          console.log(`    Found ${items.length} videos for #${hashtag}`);

          // Tag items with their source category
          for (const item of items) {
            const id = item.id || item.videoId;
            if (id) {
              itemCategories.set(id, category);
            }
          }

          allItems.push(...items);
        } catch (hashtagError) {
          console.warn(`    ⚠️ Failed to scrape #${hashtag}:`, hashtagError);
        }
      }
    }

    // Run scraper for search queries if we need more
    if (allItems.length < SCRAPER_CONFIG.maxTotalVideos) {
      console.log(`\n🔎 Running search queries for more content...`);

      for (const query of SCRAPER_CONFIG.searchQueries.slice(0, 4)) {
        if (allItems.length >= SCRAPER_CONFIG.maxTotalVideos) break;

        try {
          console.log(`  🔍 Searching: "${query}"`);
          const run = await client.actor(SCRAPER_CONFIG.actorId).call({
            searchQueries: [query],
            resultsPerPage: SCRAPER_CONFIG.resultsPerSearch,
            shouldDownloadVideos: false,
            shouldDownloadCovers: true,
          });

          const { items } = await client.dataset(run.defaultDatasetId).listItems();
          console.log(`    Found ${items.length} videos for "${query}"`);

          // Determine category from search query
          let searchCategory = 'general';
          if (query.includes('real estate') || query.includes('house') || query.includes('home')) {
            searchCategory = 'realEstate';
          } else if (query.includes('business') || query.includes('entrepreneur') || query.includes('money')) {
            searchCategory = 'business';
          } else if (query.includes('news')) {
            searchCategory = 'news';
          } else if (query.includes('motivation') || query.includes('success')) {
            searchCategory = 'motivation';
          }

          for (const item of items) {
            const id = item.id || item.videoId;
            if (id && !itemCategories.has(id)) {
              itemCategories.set(id, searchCategory);
            }
          }

          allItems.push(...items);
        } catch (searchError) {
          console.warn(`    ⚠️ Failed to search "${query}":`, searchError);
        }
      }
    }

    // Deduplicate by video ID
    const seenIds = new Set<string>();
    const items = allItems.filter(item => {
      const id = item.id || item.videoId;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    console.log(`📊 Found ${items.length} unique potential hook videos`);

    // Process each video
    let skippedLowLikes = 0;
    let skippedLowViews = 0;
    let skippedTooLong = 0;
    let skippedNoUrl = 0;
    let skippedDuplicate = 0;

    for (const video of items) {
      try {
        totalScraped++;

        // Filter by engagement
        const likes = video.diggCount || video.likes || 0;
        const views = video.playCount || video.views || 0;
        const duration = video.duration || video.videoMeta?.duration || 0;

        // Log first few videos for debugging - show raw data structure
        if (totalScraped <= 3) {
          console.log(`  📊 Video ${totalScraped} raw data:`, JSON.stringify({
            id: video.id,
            diggCount: video.diggCount,
            likes: video.likes,
            playCount: video.playCount,
            views: video.views,
            duration: video.duration,
            videoMeta: video.videoMeta,
            videoUrl: video.videoUrl,
            downloadAddr: video.downloadAddr,
            stats: video.stats,
            statsV2: video.statsV2,
          }, null, 2));
          console.log(`  📊 Video ${totalScraped}: likes=${likes}, views=${views}, duration=${duration}s`);
        }

        if (likes < SCRAPER_CONFIG.minLikes) {
          skippedLowLikes++;
          continue;
        }

        if (views < SCRAPER_CONFIG.minViews) {
          skippedLowViews++;
          continue;
        }

        if (duration > SCRAPER_CONFIG.maxDuration) {
          skippedTooLong++;
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
          skippedDuplicate++;
          continue;
        }

        // Determine hook category based on content
        const text = (video.text || video.desc || '').toLowerCase();
        const videoId = video.id || video.videoId;
        const sourceCategory = itemCategories.get(videoId) || 'general';

        const category = categorizeHook(text);
        const mood = detectMood(text);
        const contentType = detectContentType(text);

        // Determine which brands can use this hook (using source category for better targeting)
        const brands = determineBrandsFromCategory(sourceCategory, text, mood, contentType);

        // Download and process video (first 3 seconds)
        // For now, we'll save the source URL and process later
        const videoUrl = video.videoUrl || video.downloadAddr || '';

        if (!videoUrl) {
          skippedNoUrl++;
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
    console.log(`   Skipped - low likes (<${SCRAPER_CONFIG.minLikes}): ${skippedLowLikes}`);
    console.log(`   Skipped - low views (<${SCRAPER_CONFIG.minViews}): ${skippedLowViews}`);
    console.log(`   Skipped - too long (>${SCRAPER_CONFIG.maxDuration}s): ${skippedTooLong}`);
    console.log(`   Skipped - no video URL: ${skippedNoUrl}`);
    console.log(`   Skipped - duplicate: ${skippedDuplicate}`);
    console.log(`   Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      totalScraped,
      totalAdded,
      pendingReview: totalAdded,
      skipped: {
        lowLikes: skippedLowLikes,
        lowViews: skippedLowViews,
        tooLong: skippedTooLong,
        noUrl: skippedNoUrl,
        duplicate: skippedDuplicate,
      },
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
 * Determine which brands can use this hook based on source category, text, mood, and content type
 * This provides much better targeting since we know which hashtag category the content came from
 */
function determineBrandsFromCategory(
  sourceCategory: string,
  text: string,
  mood: HookMood,
  contentType: ContentType
): string[] {
  const brands: string[] = [];

  // First, add brands based on the source category (most reliable)
  const categoryBrands = CATEGORY_TO_BRANDS[sourceCategory];
  if (categoryBrands) {
    brands.push(...categoryBrands);
  }

  // Then check text for additional brand keywords
  const lower = text.toLowerCase();
  for (const [brand, keywords] of Object.entries(BRAND_HOOK_MAPPING)) {
    if (brands.includes(brand)) continue; // Already added

    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        brands.push(brand);
        break;
      }
    }
  }

  // Add brands based on mood matching (secondary signal)
  if (mood === 'serious' || mood === 'urgent' || mood === 'sad') {
    if (!brands.includes('gaza')) brands.push('gaza');
  }
  if (mood === 'inspiring' || mood === 'excited') {
    if (!brands.includes('abdullah')) brands.push('abdullah');
  }

  // Add brands based on content type (secondary signal)
  if (contentType === 'news') {
    if (!brands.includes('gaza')) brands.push('gaza');
  }
  if (contentType === 'educational') {
    if (!brands.includes('ownerfi')) brands.push('ownerfi');
    if (!brands.includes('benefit')) brands.push('benefit');
  }
  if (contentType === 'humanitarian') {
    if (!brands.includes('gaza')) brands.push('gaza');
  }

  // If still no brands (shouldn't happen with category-based approach), be conservative
  // Only assign to brands that make sense for general content
  if (brands.length === 0) {
    // General content can work for business/motivation brands
    return ['abdullah', 'vassdistro'];
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
