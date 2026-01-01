// Social Media Trends Fetcher
// Pulls VIRAL content from TikTok, Twitter/X, Reddit, and Google Trends
// This is what social media WANTS - not boring publisher articles

import { fetchWithTimeout, retry, TIMEOUTS } from './api-utils';
import { ApifyClient } from 'apify-client';

// ============================================================================
// APIFY CACHE - Reduce costs by caching results for 4 hours
// ============================================================================
const APIFY_CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry {
  data: SocialTrend[];
  fetchedAt: number;
}

// In-memory cache (persists for duration of serverless function, cleared between invocations)
// For longer persistence, this could be moved to Firestore/Redis
const apifyCache: Map<string, CacheEntry> = new Map();

/**
 * Get cached Apify results if still fresh
 */
function getCachedApifyResults(cacheKey: string): SocialTrend[] | null {
  const cached = apifyCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt) < APIFY_CACHE_DURATION_MS) {
    const ageMinutes = Math.round((Date.now() - cached.fetchedAt) / 60000);
    console.log(`📦 [CACHE HIT] Using cached ${cacheKey} results (${ageMinutes}min old, ${cached.data.length} items)`);
    return cached.data;
  }
  return null;
}

/**
 * Store Apify results in cache
 */
function setCachedApifyResults(cacheKey: string, data: SocialTrend[]): void {
  apifyCache.set(cacheKey, {
    data,
    fetchedAt: Date.now()
  });
  console.log(`💾 [CACHE SET] Stored ${cacheKey} results (${data.length} items, valid for 4 hours)`);
}

// ============================================================================
// TYPES
// ============================================================================

export interface SocialTrend {
  id: string;
  platform: 'tiktok' | 'twitter' | 'reddit' | 'google_trends';
  title: string;
  description: string;
  content: string;  // Full content for video generation
  url: string;
  engagement: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    score?: number;  // Reddit upvotes or calculated engagement score
  };
  hashtags: string[];
  trending_rank?: number;
  velocity?: string;  // "rising", "hot", "exploding"
  category: 'ownerfi' | 'carz' | 'vassdistro' | 'gaza' | 'general';
  fetchedAt: number;
  pubDate: number;
}

export interface TrendFilters {
  categories?: string[];
  keywords?: string[];
  minEngagement?: number;
  maxAge?: number;  // hours
  country?: string;
}

// ============================================================================
// BRAND KEYWORD FILTERS
// ============================================================================

const BRAND_KEYWORDS: Record<string, string[]> = {
  ownerfi: [
    'mortgage', 'housing', 'real estate', 'home buying', 'rent', 'apartment',
    'interest rate', 'fed rate', 'housing market', 'home prices', 'foreclosure',
    'first time buyer', 'down payment', 'housing crash', 'property', 'realtor',
    'home loan', 'refinance', 'closing costs', 'home inspection', 'appraisal',
    'seller financing', 'owner financing', 'rent to own', 'lease option'
  ],
  carz: [
    'tesla', 'ev', 'electric vehicle', 'cybertruck', 'car', 'automotive',
    'car dealership', 'used car', 'car buying', 'car prices', 'auto loan',
    'hybrid', 'rivian', 'lucid', 'ford', 'chevrolet', 'toyota', 'honda',
    'car maintenance', 'car insurance', 'gas prices', 'car recall'
  ],
  vassdistro: [
    'vape', 'vaping', 'e-cigarette', 'nicotine', 'fda', 'tobacco',
    'disposable vape', 'vape ban', 'vape shop', 'wholesale vape',
    'juul', 'puff bar', 'elf bar', 'vape regulation', 'pmta'
  ],
  gaza: [
    'gaza', 'palestine', 'humanitarian', 'ceasefire', 'relief',
    'middle east', 'rafah', 'west bank', 'unrwa', 'aid'
  ]
};

// ============================================================================
// SUBREDDITS BY BRAND
// ============================================================================

const BRAND_SUBREDDITS: Record<string, string[]> = {
  ownerfi: [
    'RealEstate', 'FirstTimeHomeBuyer', 'homeowners', 'personalfinance',
    'Mortgages', 'realestateinvesting', 'homebuying', 'landlord'
  ],
  carz: [
    'cars', 'electricvehicles', 'teslamotors', 'whatcarshouldIbuy',
    'askcarsales', 'Cartalk', 'MechanicAdvice', 'cybertruck'
  ],
  vassdistro: [
    'Vaping', 'electronic_cigarette', 'Vaping101', 'VapePorn'
  ],
  gaza: [
    'Palestine', 'worldnews', 'news'
  ]
};

// ============================================================================
// GOOGLE TRENDS (FREE - using pytrends-like approach)
// ============================================================================

/**
 * Fetch Google Trends real-time data
 * Uses the unofficial Google Trends API endpoint
 */
export async function fetchGoogleTrends(
  country: string = 'US',
  category?: string
): Promise<SocialTrend[]> {
  console.log(`📈 [Google Trends] Fetching trending searches for ${country}...`);

  try {
    // Google Trends daily trends RSS feed (free, no auth needed)
    const url = `https://trends.google.com/trending/rss?geo=${country}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OwnerFi/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    }, 10000);

    if (!response.ok) {
      console.error(`❌ [Google Trends] Failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const trends = parseGoogleTrendsRSS(xml);

    console.log(`✅ [Google Trends] Found ${trends.length} trending topics`);
    return trends;

  } catch (error) {
    console.error(`❌ [Google Trends] Error:`, error);
    return [];
  }
}

function parseGoogleTrendsRSS(xml: string): SocialTrend[] {
  const trends: SocialTrend[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const items = xml.match(itemRegex) || [];

  items.forEach((itemXml, index) => {
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
    const trafficMatch = itemXml.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/i);
    const newsItemMatch = itemXml.match(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/i);
    const descMatch = itemXml.match(/<ht:news_item_snippet>(.*?)<\/ht:news_item_snippet>/i);

    if (titleMatch) {
      const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const traffic = trafficMatch ? trafficMatch[1].replace(/[^0-9KkMm+]/g, '') : '0';
      const newsTitle = newsItemMatch ? newsItemMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

      // Determine category based on keywords
      const category = detectCategory(title + ' ' + description);

      trends.push({
        id: `google-trends-${Date.now()}-${index}`,
        platform: 'google_trends',
        title: title,
        description: newsTitle || description || `Trending search: ${title}`,
        content: `${title}\n\n${newsTitle}\n\n${description}`,
        url: linkMatch ? linkMatch[1].trim() : `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}`,
        engagement: {
          views: parseTrafficNumber(traffic),
          score: items.length - index  // Higher rank = higher score
        },
        hashtags: extractHashtags(title),
        trending_rank: index + 1,
        velocity: index < 5 ? 'exploding' : index < 15 ? 'hot' : 'rising',
        category,
        fetchedAt: Date.now(),
        pubDate: Date.now()
      });
    }
  });

  return trends;
}

function parseTrafficNumber(traffic: string): number {
  const num = traffic.replace(/[^0-9.KkMm]/g, '');
  if (num.toLowerCase().includes('m')) {
    return parseFloat(num) * 1000000;
  } else if (num.toLowerCase().includes('k')) {
    return parseFloat(num) * 1000;
  }
  return parseInt(num) || 0;
}

// ============================================================================
// REDDIT API (FREE)
// ============================================================================

/**
 * Fetch Reddit hot/rising posts from relevant subreddits
 * Reddit API is FREE with reasonable rate limits
 */
export async function fetchRedditTrends(
  brand: 'ownerfi' | 'carz' | 'vassdistro' | 'gaza',
  sortBy: 'hot' | 'rising' | 'top' = 'hot',
  timeframe: 'hour' | 'day' | 'week' = 'day'
): Promise<SocialTrend[]> {
  const subreddits = BRAND_SUBREDDITS[brand] || [];

  if (subreddits.length === 0) {
    console.log(`⚠️ [Reddit] No subreddits configured for ${brand}`);
    return [];
  }

  console.log(`🔥 [Reddit] Fetching ${sortBy} posts from ${subreddits.length} subreddits for ${brand}...`);

  const allTrends: SocialTrend[] = [];

  for (const subreddit of subreddits) {
    try {
      const url = sortBy === 'top'
        ? `https://www.reddit.com/r/${subreddit}/${sortBy}.json?t=${timeframe}&limit=10`
        : `https://www.reddit.com/r/${subreddit}/${sortBy}.json?limit=10`;

      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'OwnerFi/1.0 (by /u/ownerfi_bot)',
          'Accept': 'application/json'
        }
      }, 10000);

      if (!response.ok) {
        console.warn(`⚠️ [Reddit] r/${subreddit} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const p = post.data;

        // Skip stickied posts and low-engagement posts
        if (p.stickied || p.score < 50) continue;

        allTrends.push({
          id: `reddit-${p.id}`,
          platform: 'reddit',
          title: p.title,
          description: p.selftext?.substring(0, 500) || p.title,
          content: `${p.title}\n\n${p.selftext || ''}\n\nSubreddit: r/${subreddit}\nUpvotes: ${p.score}\nComments: ${p.num_comments}`,
          url: `https://reddit.com${p.permalink}`,
          engagement: {
            score: p.score,
            comments: p.num_comments,
            likes: p.ups
          },
          hashtags: extractHashtags(p.title),
          velocity: p.score > 1000 ? 'exploding' : p.score > 500 ? 'hot' : 'rising',
          category: brand,
          fetchedAt: Date.now(),
          pubDate: p.created_utc * 1000
        });
      }

      // Rate limit: wait between subreddit requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ [Reddit] Error fetching r/${subreddit}:`, error);
    }
  }

  // Sort by engagement
  allTrends.sort((a, b) => (b.engagement.score || 0) - (a.engagement.score || 0));

  console.log(`✅ [Reddit] Found ${allTrends.length} trending posts for ${brand}`);
  return allTrends.slice(0, 20);  // Top 20
}

// ============================================================================
// APIFY - TIKTOK TRENDS
// ============================================================================

/**
 * Fetch TikTok trends using Apify
 * Actor: clockworks/tiktok-trends-scraper
 */
export async function fetchTikTokTrends(
  brand: 'ownerfi' | 'carz' | 'vassdistro' | 'gaza',
  country: string = 'US'
): Promise<SocialTrend[]> {
  // Check cache first to reduce Apify costs
  const cacheKey = `tiktok_${brand}_${country}`;
  const cached = getCachedApifyResults(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('❌ [TikTok] APIFY_API_KEY not found');
    return [];
  }

  console.log(`🎵 [TikTok] Fetching trends for ${brand} in ${country}... (cache miss, calling Apify)`);

  try {
    const client = new ApifyClient({ token: apiKey });

    // Run the TikTok Trends Scraper actor
    const run = await client.actor('clockworks/tiktok-trends-scraper').call({
      country: country,
      maxItems: 50,
      extendOutputFunction: ''
    }, {
      timeout: 120  // 2 minute timeout
    });

    // Get results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    const keywords = BRAND_KEYWORDS[brand] || [];
    const trends: SocialTrend[] = [];

    // Define item type for TikTok data
    interface TikTokItem {
      id?: string;
      title?: string;
      description?: string;
      hashtags?: string[];
      url?: string;
      webVideoUrl?: string;
      views?: number;
      playCount?: number;
      likes?: number;
      diggCount?: number;
      comments?: number;
      commentCount?: number;
      shares?: number;
      shareCount?: number;
      createTime?: string | number;
    }

    for (const rawItem of items) {
      const item = rawItem as TikTokItem;

      // Filter by brand keywords
      const title = item.title || '';
      const description = item.description || '';
      const hashtags = item.hashtags || [];

      const matchesBrand = keywords.length === 0 || keywords.some(kw =>
        title.toLowerCase().includes(kw.toLowerCase()) ||
        description.toLowerCase().includes(kw.toLowerCase()) ||
        hashtags.some((h: string) => h.toLowerCase().includes(kw.toLowerCase()))
      );

      if (!matchesBrand) continue;

      const views = item.views || item.playCount || 0;
      const likes = item.likes || item.diggCount || 0;

      trends.push({
        id: `tiktok-${item.id || Date.now()}-${trends.length}`,
        platform: 'tiktok',
        title: title || description.substring(0, 100) || 'TikTok Trend',
        description: description,
        content: `${title}\n\n${description}\n\nViews: ${formatNumber(views)}\nLikes: ${formatNumber(likes)}`,
        url: item.url || item.webVideoUrl || '',
        engagement: {
          views,
          likes,
          comments: item.comments || item.commentCount || 0,
          shares: item.shares || item.shareCount || 0
        },
        hashtags,
        velocity: views > 1000000 ? 'exploding' : views > 100000 ? 'hot' : 'rising',
        category: brand,
        fetchedAt: Date.now(),
        pubDate: item.createTime ? new Date(item.createTime).getTime() : Date.now()
      });
    }

    console.log(`✅ [TikTok] Found ${trends.length} relevant trends for ${brand}`);

    // Cache results to avoid repeated Apify calls
    setCachedApifyResults(cacheKey, trends);

    return trends;

  } catch (error) {
    console.error(`❌ [TikTok] Error:`, error);
    return [];
  }
}

// ============================================================================
// APIFY - TWITTER/X TRENDS
// ============================================================================

/**
 * Fetch Twitter/X trending topics using Apify
 * Actor: easyapi/twitter-trending-topics-scraper
 */
export async function fetchTwitterTrends(
  brand: 'ownerfi' | 'carz' | 'vassdistro' | 'gaza',
  country: string = 'US'
): Promise<SocialTrend[]> {
  // Check cache first to reduce Apify costs
  const cacheKey = `twitter_${brand}_${country}`;
  const cached = getCachedApifyResults(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('❌ [Twitter] APIFY_API_KEY not found');
    return [];
  }

  console.log(`🐦 [Twitter] Fetching trends for ${brand} in ${country}... (cache miss, calling Apify)`);

  try {
    const client = new ApifyClient({ token: apiKey });

    // Run the Twitter Trending Topics Scraper actor
    const run = await client.actor('easyapi/twitter-trending-topics-scraper').call({
      country: country.toLowerCase(),
      maxItems: 50
    }, {
      timeout: 120
    });

    // Get results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    const keywords = BRAND_KEYWORDS[brand] || [];
    const trends: SocialTrend[] = [];

    // Define item type for Twitter data
    interface TwitterItem {
      name?: string;
      trend?: string;
      topic?: string;
      description?: string;
      url?: string;
      tweet_volume?: number;
      tweetVolume?: number;
      volume?: number;
      rank?: number;
    }

    for (const rawItem of items) {
      const item = rawItem as TwitterItem;
      const trendName = String(item.name || item.trend || item.topic || '');
      const tweetVolume = Number(item.tweet_volume || item.tweetVolume || item.volume || 0);

      // Filter by brand keywords
      const matchesBrand = keywords.length === 0 || keywords.some(kw =>
        trendName.toLowerCase().includes(kw.toLowerCase())
      );

      if (!matchesBrand) continue;

      trends.push({
        id: `twitter-${Date.now()}-${trends.length}`,
        platform: 'twitter',
        title: trendName,
        description: String(item.description || `Trending on Twitter: ${trendName}`),
        content: `Twitter Trend: ${trendName}\n\nTweet Volume: ${formatNumber(tweetVolume)}\n\nThis topic is trending right now on Twitter/X.`,
        url: String(item.url || `https://twitter.com/search?q=${encodeURIComponent(trendName)}`),
        engagement: {
          score: tweetVolume,
          views: tweetVolume
        },
        hashtags: trendName.startsWith('#') ? [trendName] : [`#${trendName.replace(/\s+/g, '')}`],
        trending_rank: item.rank || trends.length + 1,
        velocity: tweetVolume > 100000 ? 'exploding' : tweetVolume > 10000 ? 'hot' : 'rising',
        category: brand,
        fetchedAt: Date.now(),
        pubDate: Date.now()
      });
    }

    console.log(`✅ [Twitter] Found ${trends.length} relevant trends for ${brand}`);

    // Cache results to avoid repeated Apify calls
    setCachedApifyResults(cacheKey, trends);

    return trends;

  } catch (error) {
    console.error(`❌ [Twitter] Error:`, error);
    return [];
  }
}

// ============================================================================
// MASTER FUNCTION - FETCH ALL SOCIAL TRENDS
// ============================================================================

/**
 * Fetch trends from ALL platforms for a brand
 * This is the main function to call
 */
export async function fetchAllSocialTrends(
  brand: 'ownerfi' | 'carz' | 'vassdistro' | 'gaza',
  options?: {
    includeGoogle?: boolean;
    includeReddit?: boolean;
    includeTikTok?: boolean;
    includeTwitter?: boolean;
    country?: string;
  }
): Promise<SocialTrend[]> {
  const {
    includeGoogle = true,
    includeReddit = true,
    includeTikTok = true,
    includeTwitter = true,
    country = 'US'
  } = options || {};

  console.log(`\n🚀 [Social Trends] Fetching ALL trends for ${brand}...`);
  console.log(`   Platforms: Google=${includeGoogle}, Reddit=${includeReddit}, TikTok=${includeTikTok}, Twitter=${includeTwitter}`);

  const allTrends: SocialTrend[] = [];

  // Fetch in parallel for speed
  const promises: Promise<SocialTrend[]>[] = [];

  if (includeGoogle) {
    promises.push(
      fetchGoogleTrends(country).then(trends =>
        trends.filter(t => filterByBrand(t, brand))
      )
    );
  }

  if (includeReddit) {
    promises.push(fetchRedditTrends(brand, 'hot', 'day'));
  }

  if (includeTikTok) {
    promises.push(fetchTikTokTrends(brand, country));
  }

  if (includeTwitter) {
    promises.push(fetchTwitterTrends(brand, country));
  }

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allTrends.push(...result.value);
    }
  }

  // Sort by engagement (normalized across platforms)
  allTrends.sort((a, b) => {
    const scoreA = calculateEngagementScore(a);
    const scoreB = calculateEngagementScore(b);
    return scoreB - scoreA;
  });

  console.log(`\n✅ [Social Trends] Total: ${allTrends.length} trends for ${brand}`);
  console.log(`   By platform: Google=${allTrends.filter(t => t.platform === 'google_trends').length}, Reddit=${allTrends.filter(t => t.platform === 'reddit').length}, TikTok=${allTrends.filter(t => t.platform === 'tiktok').length}, Twitter=${allTrends.filter(t => t.platform === 'twitter').length}`);

  return allTrends;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectCategory(text: string): 'ownerfi' | 'carz' | 'vassdistro' | 'gaza' | 'general' {
  const lowerText = text.toLowerCase();

  for (const [brand, keywords] of Object.entries(BRAND_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
      return brand as 'ownerfi' | 'carz' | 'vassdistro' | 'gaza';
    }
  }

  return 'general';
}

function filterByBrand(trend: SocialTrend, brand: string): boolean {
  if (brand === 'general') return true;

  const keywords = BRAND_KEYWORDS[brand] || [];
  const text = `${trend.title} ${trend.description}`.toLowerCase();

  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

function extractHashtags(text: string): string[] {
  const hashtags = text.match(/#\w+/g) || [];
  // Also create hashtags from keywords
  const words = text.split(/\s+/).filter(w => w.length > 3 && w.length < 20);
  const generated = words.slice(0, 3).map(w => `#${w.replace(/[^a-zA-Z0-9]/g, '')}`);
  return [...new Set([...hashtags, ...generated])];
}

function formatNumber(num: number | undefined): string {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function calculateEngagementScore(trend: SocialTrend): number {
  const { views = 0, likes = 0, comments = 0, shares = 0, score = 0 } = trend.engagement;

  // Normalize across platforms
  // TikTok: views are primary
  // Reddit: score (upvotes) is primary
  // Twitter: volume is primary
  // Google: search volume

  switch (trend.platform) {
    case 'tiktok':
      return views + (likes * 10) + (comments * 50) + (shares * 100);
    case 'reddit':
      return (score * 100) + (comments * 20);
    case 'twitter':
      return score * 10;
    case 'google_trends':
      return views + (score * 10000);
    default:
      return views + likes + comments + shares + score;
  }
}

// ============================================================================
// CONVERT SOCIAL TREND TO ARTICLE FORMAT
// ============================================================================

/**
 * Convert a SocialTrend to the Article format used by the video pipeline
 */
export function trendToArticle(trend: SocialTrend): {
  id: string;
  title: string;
  content: string;
  description: string;
  link: string;
  feedId: string;
  pubDate: number;
  categories: string[];
  processed: boolean;
  videoGenerated: boolean;
  source: 'social_trends';
  platform: string;
  engagement: SocialTrend['engagement'];
} {
  return {
    id: trend.id,
    title: trend.title,
    content: trend.content,
    description: trend.description,
    link: trend.url,
    feedId: `social-${trend.platform}`,
    pubDate: trend.pubDate,
    categories: trend.hashtags,
    processed: false,
    videoGenerated: false,
    source: 'social_trends',
    platform: trend.platform,
    engagement: trend.engagement
  };
}
