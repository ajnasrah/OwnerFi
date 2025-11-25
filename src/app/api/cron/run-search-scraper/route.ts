import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { withCronLock } from '@/lib/cron-lock';

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
 *
 * OPTIMIZED: Uses batched duplicate checking to reduce Firestore queries
 * from O(n*2) to O(n/10*2) - 10x improvement
 */

const SEARCH_CONFIG = {
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-123.82329050572206%2C%22east%22%3A-55.795946755722056%2C%22south%22%3A-18.62001504632672%2C%22north%22%3A61.02913536475284%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22financing%20available%2Foffered%5C%22%20%2C%20%5C%22creative%20financing%5C%22%20%2C%20%5C%22flexible%20financing%5C%22%2C%20%5C%22terms%20available%5C%22%2C%20%5C%22owner%20terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
  mode: 'pagination' as 'map' | 'pagination' | 'deep',
  maxResults: 500,
};

/**
 * Batch check for existing URLs in a collection
 * Uses Firestore 'in' operator (max 10 items per query) to reduce query count
 */
async function batchCheckExistingUrls(
  collectionName: string,
  urls: string[]
): Promise<Set<string>> {
  const existingUrls = new Set<string>();

  // Process in batches of 10 (Firestore 'in' operator limit)
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const snapshot = await db
      .collection(collectionName)
      .where('url', 'in', batch)
      .select() // Only fetch document refs, not full data
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.url) existingUrls.add(data.url);
    });
  }

  return existingUrls;
}

export async function GET(request: NextRequest) {
  // Use cron lock to prevent concurrent executions
  const result = await withCronLock('run-search-scraper', async () => {
    const startTime = Date.now();

    try {
      console.log('🏡 [SEARCH CRON] Starting search scraper...');

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

      // Extract all URLs first (filter out items without URLs)
      const itemsWithUrls = items
        .map(item => item as { detailUrl?: string; address?: string; price?: string; zpid?: string })
        .filter(item => item.detailUrl);

      const allUrls = itemsWithUrls.map(item => item.detailUrl!);
      const noUrl = items.length - itemsWithUrls.length;

      console.log(`🔍 [SEARCH CRON] Checking ${allUrls.length} URLs for duplicates (batched)...`);

      // Batch check both collections in parallel - 10x faster than individual queries
      const [urlsInQueue, urlsInImports] = await Promise.all([
        batchCheckExistingUrls('scraper_queue', allUrls),
        batchCheckExistingUrls('zillow_imports', allUrls),
      ]);

      console.log(`📊 [SEARCH CRON] Found ${urlsInQueue.size} in queue, ${urlsInImports.size} already scraped`);

      // Filter to only new URLs
      const newItems = itemsWithUrls.filter(item => {
        const url = item.detailUrl!;
        return !urlsInQueue.has(url) && !urlsInImports.has(url);
      });

      // Track counts
      const alreadyInQueue = urlsInQueue.size;
      const alreadyScraped = urlsInImports.size;
      let addedToQueue = 0;

      // Use batch writes for efficiency (max 500 per batch)
      const BATCH_SIZE = 500;
      for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        const batchItems = newItems.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const property of batchItems) {
          const docRef = db.collection('scraper_queue').doc();
          batch.set(docRef, {
            url: property.detailUrl,
            address: property.address || '',
            price: property.price || '',
            zpid: property.zpid || null,
            status: 'pending',
            addedAt: new Date(),
            source: 'search_cron',
          });
          addedToQueue++;
        }

        await batch.commit();
        console.log(`   Committed batch: ${Math.min(i + BATCH_SIZE, newItems.length)}/${newItems.length} items`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n✅ [SEARCH CRON] Complete in ${duration}s:`);
      console.log(`   ✅ Added to queue: ${addedToQueue}`);
      console.log(`   ⏭️  Already in queue: ${alreadyInQueue}`);
      console.log(`   ⏭️  Already scraped: ${alreadyScraped}`);
      if (noUrl > 0) {
        console.log(`   ⚠️  No URL: ${noUrl}`);
      }

      return {
        success: true,
        duration: `${duration}s`,
        propertiesFound: items.length,
        addedToQueue,
        alreadyInQueue,
        alreadyScraped,
        message: `Added ${addedToQueue} new properties to queue. Queue processor will handle filtering.`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [SEARCH CRON] Error:', error);
      return {
        success: false,
        error: errorMessage,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      };
    }
  });

  // If lock was not acquired (another instance is running)
  if (result === null) {
    return NextResponse.json({
      success: false,
      skipped: true,
      message: 'Another instance of this cron is currently running',
    });
  }

  // Return the result from the locked execution
  if ('error' in result) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
