/**
 * Social Trends Fetcher Cron Job
 *
 * Fetches WHAT SOCIAL MEDIA WANTS - not boring publisher articles.
 * Pulls trending topics from TikTok, Twitter/X, Reddit, and Google Trends.
 *
 * These trends replace/supplement RSS feeds as content sources for video generation.
 *
 * Schedule: Every 4 hours (or on-demand)
 *
 * Flow:
 * 1. Fetch trends from all platforms
 * 2. Filter by brand keywords
 * 3. Store in Firestore as "articles" (same format as RSS)
 * 4. Video generation picks from these instead of boring RSS
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAllSocialTrends,
  fetchGoogleTrends,
  fetchRedditTrends,
  fetchTikTokTrends,
  fetchTwitterTrends,
  trendToArticle,
  SocialTrend
} from '@/lib/social-trends-fetcher';
import { getAdminDb } from '@/lib/firebase-admin';
import { getCollectionName } from '@/lib/feed-store-firestore';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes

// Brands to fetch trends for
const BRANDS = ['ownerfi', 'carz', 'gaza'] as const;

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params for selective fetching
    const { searchParams } = new URL(request.url);
    const brandFilter = searchParams.get('brand') as typeof BRANDS[number] | null;
    const platformsParam = searchParams.get('platforms'); // comma-separated: google,reddit,tiktok,twitter
    const country = searchParams.get('country') || 'US';

    // Determine which platforms to fetch
    const platforms = platformsParam
      ? platformsParam.split(',').map(p => p.trim().toLowerCase())
      : ['google', 'reddit', 'tiktok', 'twitter'];

    console.log(`\n🚀 [Social Trends Cron] Starting...`);
    console.log(`   Brands: ${brandFilter || 'ALL'}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log(`   Country: ${country}`);

    const adminDb = await getAdminDb();
    const results: Record<string, {
      total: number;
      added: number;
      duplicates: number;
      byPlatform: Record<string, number>;
    }> = {};

    const brandsToFetch = brandFilter ? [brandFilter] : BRANDS;

    for (const brand of brandsToFetch) {
      console.log(`\n📊 [${brand}] Fetching social trends...`);

      const trends = await fetchAllSocialTrends(brand, {
        includeGoogle: platforms.includes('google'),
        includeReddit: platforms.includes('reddit'),
        includeTikTok: platforms.includes('tiktok'),
        includeTwitter: platforms.includes('twitter'),
        country
      });

      let added = 0;
      let duplicates = 0;
      const byPlatform: Record<string, number> = {};

      // Get the correct collection name (e.g., ownerfi_articles, carz_articles)
      const collectionName = getCollectionName('ARTICLES', brand as any);

      // Store trends as articles
      for (const trend of trends) {
        try {
          // Check for duplicates by URL (primary deduplication)
          const existingQuery = await adminDb
            .collection(collectionName)
            .where('link', '==', trend.url)
            .limit(1)
            .get();

          if (!existingQuery.empty) {
            duplicates++;
            continue;
          }

          // Convert trend to article format
          const article = trendToArticle(trend);

          // Add engagement score for prioritization
          const engagementScore = calculatePriorityScore(trend);

          // Store in Firestore (same collection as RSS articles: ownerfi_articles, etc.)
          // Remove undefined values to avoid Firestore errors
          const trendData: Record<string, any> = {
            ...article,
            createdAt: Date.now(),
            engagementScore,
            source: 'social_trends',
            platform: trend.platform,
          };
          if (trend.velocity) trendData.velocity = trend.velocity;
          if (trend.trending_rank !== undefined) trendData.trending_rank = trend.trending_rank;

          await adminDb
            .collection(collectionName)
            .doc(article.id)
            .set(trendData);

          added++;
          byPlatform[trend.platform] = (byPlatform[trend.platform] || 0) + 1;

          console.log(`   ✅ Added: [${trend.platform}] ${trend.title.substring(0, 50)}... (score: ${engagementScore})`);

        } catch (error) {
          console.error(`   ❌ Error storing trend:`, error);
        }
      }

      results[brand] = {
        total: trends.length,
        added,
        duplicates,
        byPlatform
      };

      console.log(`   📈 ${brand}: ${added} added, ${duplicates} duplicates`);
    }

    // Summary
    const totalAdded = Object.values(results).reduce((sum, r) => sum + r.added, 0);
    const totalTrends = Object.values(results).reduce((sum, r) => sum + r.total, 0);

    console.log(`\n🎉 [Social Trends Cron] Complete!`);
    console.log(`   Total trends found: ${totalTrends}`);
    console.log(`   Total added: ${totalAdded}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalTrends,
        totalAdded,
        platforms,
        country
      },
      results
    });

  } catch (error) {
    console.error('❌ [Social Trends Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Calculate priority score for sorting
 * Higher score = more viral = should be used first
 */
function calculatePriorityScore(trend: SocialTrend): number {
  const { views = 0, likes = 0, comments = 0, shares = 0, score = 0 } = trend.engagement;

  // Base score from engagement
  let priority = 0;

  switch (trend.platform) {
    case 'tiktok':
      // TikTok: views are king, shares indicate virality
      priority = (views / 10000) + (likes / 1000) + (comments * 5) + (shares * 20);
      break;

    case 'reddit':
      // Reddit: upvotes and comments show discussion
      priority = (score / 10) + (comments * 2);
      break;

    case 'twitter':
      // Twitter: tweet volume indicates trending strength
      priority = (score / 100);
      break;

    case 'google_trends':
      // Google: search volume + ranking
      priority = (views / 1000) + ((50 - (trend.trending_rank || 50)) * 10);
      break;
  }

  // Boost for velocity
  if (trend.velocity === 'exploding') priority *= 2;
  else if (trend.velocity === 'hot') priority *= 1.5;

  // Boost for recency (last 6 hours)
  const hoursOld = (Date.now() - trend.pubDate) / (1000 * 60 * 60);
  if (hoursOld < 6) priority *= 1.5;
  else if (hoursOld < 12) priority *= 1.2;

  return Math.round(priority);
}

/**
 * POST endpoint for manual trigger with options
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brand, platforms, country } = body;

    // Build query string and forward to GET
    const params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    if (platforms) params.set('platforms', platforms.join(','));
    if (country) params.set('country', country);

    const url = new URL(request.url);
    url.search = params.toString();

    // Create a new request with the params
    const newRequest = new NextRequest(url, {
      headers: request.headers
    });

    return GET(newRequest);

  } catch (error) {
    console.error('❌ [Social Trends POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
