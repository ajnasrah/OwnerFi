import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

/**
 * CRON: Run Search Scraper Twice Weekly
 *
 * Runs on Monday and Thursday at 9 AM
 * Extracts property URLs from Zillow search and adds to queue
 */

const SEARCH_CONFIG = {
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-129.09672800572204%2C%22east%22%3A-50.522509255722056%2C%22south%22%3A-25.100328170509652%2C%22north%22%3A64.2375265423478%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A100000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%2C%22max%22%3A435600%2C%22units%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%2214%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner+financing%5C%22+%2C+%5C%22seller+financing%5C%22+%2C+%5C%22owner+carry%5C%22+%2C+%5C%22seller+carry%5C%22+%2C+%5C%22financing+available%2Foffered%5C%22+%2C+%5C%22creative+financing%5C%22+%2C+%5C%22flexible+financing%5C%22%2C+%5C%22terms+available%5C%22%2C+%5C%22owner+terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
  mode: 'pagination' as 'map' | 'pagination' | 'deep',
  maxResults: 500,
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('🏡 [SEARCH CRON] Starting search scraper...');

  try {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      throw new Error('APIFY_API_KEY not found');
    }

    const client = new ApifyClient({ token: apiKey });

    // Run search scraper
    const input = {
      searchUrls: [{ url: SEARCH_CONFIG.searchUrl }],
      maxResults: SEARCH_CONFIG.maxResults,
      mode: SEARCH_CONFIG.mode,
    };

    console.log(`🚀 [SEARCH CRON] Running Apify search scraper (mode: ${SEARCH_CONFIG.mode}, max: ${SEARCH_CONFIG.maxResults})`);

    const run = await client.actor('maxcopell/zillow-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`📦 [SEARCH CRON] Found ${items.length} properties`);

    // Add URLs to queue
    let addedToQueue = 0;
    let alreadyInQueue = 0;
    let alreadyScraped = 0;
    let noUrl = 0;

    for (const item of items) {
      const property = item as any;
      const detailUrl = property.detailUrl;

      if (!detailUrl) {
        noUrl++;
        continue;
      }

      // Check if already in queue
      const existingInQueue = await db
        .collection('scraper_queue')
        .where('url', '==', detailUrl)
        .limit(1)
        .get();

      if (!existingInQueue.empty) {
        alreadyInQueue++;
        continue;
      }

      // Check if already scraped
      const existingInImports = await db
        .collection('zillow_imports')
        .where('url', '==', detailUrl)
        .limit(1)
        .get();

      if (!existingInImports.empty) {
        alreadyScraped++;
        continue;
      }

      // Add to queue
      await db.collection('scraper_queue').add({
        url: detailUrl,
        address: property.address || '',
        price: property.price || '',
        zpid: property.zpid || null,
        status: 'pending',
        addedAt: new Date(),
        source: 'search_cron',
      });

      addedToQueue++;

      // Log progress every 100 items
      if (addedToQueue % 100 === 0) {
        console.log(`   Added ${addedToQueue} URLs to queue...`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [SEARCH CRON] Complete in ${duration}s:`);
    console.log(`   ✅ Added to queue: ${addedToQueue}`);
    console.log(`   ⏭️  Already in queue: ${alreadyInQueue}`);
    console.log(`   ⏭️  Already scraped: ${alreadyScraped}`);
    if (noUrl > 0) {
      console.log(`   ⚠️  No URL: ${noUrl}`);
    }

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      propertiesFound: items.length,
      addedToQueue,
      alreadyInQueue,
      alreadyScraped,
      message: `Added ${addedToQueue} new properties to queue. Queue processor will handle filtering.`,
    });

  } catch (error: any) {
    console.error('❌ [SEARCH CRON] Error:', error);

    return NextResponse.json(
      {
        error: error.message,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      },
      { status: 500 }
    );
  }
}
