import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
 * CRON: Search for Cash Deals
 *
 * Runs twice weekly to find properties that may be below market value
 * Filters: Listed in last 7 days, $50k-$500k, sorted by "days on Zillow" (newest first)
 * These get added to cash_deals_queue for detailed scraping
 *
 * Schedule: Mon/Thu at 10 AM (1 hour after owner finance search)
 */

// Search URLs for different markets - focus on areas with cash deals
const CASH_DEAL_SEARCHES = [
  {
    name: 'Texas Metro - Price Cuts',
    // Dallas, Houston, San Antonio, Austin - sorted by price cuts
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-106.65%2C%22east%22%3A-93.51%2C%22south%22%3A25.84%2C%22north%22%3A36.5%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22priced%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22rs%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D',
    maxResults: 200,
  },
  {
    name: 'Southeast - Price Cuts',
    // Florida, Georgia, Tennessee, North Carolina
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-90.31%2C%22east%22%3A-75.46%2C%22south%22%3A24.52%2C%22north%22%3A36.59%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22priced%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22rs%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D',
    maxResults: 200,
  },
  {
    name: 'Midwest - Price Cuts',
    // Ohio, Indiana, Michigan, Illinois
    url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-91.51%2C%22east%22%3A-80.52%2C%22south%22%3A36.97%2C%22north%22%3A45.02%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22priced%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A400000%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22rs%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D',
    maxResults: 200,
  },
];

const SEARCH_CONFIG = {
  mode: 'map' as const,  // MAP mode respects maxResults limit!
  hardLimit: 1000, // SAFETY: Abort if more than this many results per search
};

/**
 * Batch check for existing URLs/ZPIDs in a collection
 */
async function batchCheckExistingZpids(
  collectionName: string,
  zpids: (string | number)[]
): Promise<Set<string>> {
  const existingZpids = new Set<string>();

  // Process in batches of 10 (Firestore 'in' operator limit)
  for (let i = 0; i < zpids.length; i += 10) {
    const batch = zpids.slice(i, i + 10).map(z => Number(z) || z);
    if (batch.length === 0) continue;

    const snapshot = await db
      .collection(collectionName)
      .where('zpid', 'in', batch)
      .select()
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.zpid) existingZpids.add(String(data.zpid));
    });
  }

  return existingZpids;
}

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Use cron lock to prevent concurrent executions
  const result = await withCronLock('search-cash-deals', async () => {
    const startTime = Date.now();
    const stats = {
      totalFound: 0,
      addedToQueue: 0,
      alreadyInQueue: 0,
      alreadyInCashHouses: 0,
      noZpid: 0,
      searchResults: [] as { name: string; found: number; added: number }[],
    };

    try {
      console.log('💰 [CASH DEALS SEARCH] Starting cash deals search scraper...');

      const apiKey = process.env.APIFY_API_KEY;
      if (!apiKey) {
        throw new Error('APIFY_API_KEY not found');
      }

      const client = new ApifyClient({ token: apiKey });

      // Process each search
      for (const search of CASH_DEAL_SEARCHES) {
        console.log(`\n🔍 [CASH DEALS] Searching: ${search.name}`);

        try {
          const input = {
            searchUrls: [{ url: search.url }],
            maxResults: search.maxResults,
            mode: SEARCH_CONFIG.mode,
          };

          const run = await client.actor('maxcopell/zillow-scraper').call(input);
          const { items } = await client.dataset(run.defaultDatasetId).listItems();

          console.log(`   📦 Found ${items.length} properties`);

          // Safety check
          if (items.length > SEARCH_CONFIG.hardLimit) {
            console.error(`   🚨 SKIPPING: ${items.length} results exceeds limit`);
            continue;
          }

          stats.totalFound += items.length;

          // Extract ZPIDs
          const itemsWithZpid = items
            .map(item => item as { detailUrl?: string; address?: string; price?: string; zpid?: string | number; zestimate?: number })
            .filter(item => item.zpid);

          const noZpid = items.length - itemsWithZpid.length;
          stats.noZpid += noZpid;

          const allZpids = itemsWithZpid.map(item => String(item.zpid));

          // Check for duplicates in both queue and cash_houses
          const [zpidsInQueue, zpidsInCashHouses] = await Promise.all([
            batchCheckExistingZpids('cash_deals_queue', allZpids),
            batchCheckExistingZpids('cash_houses', allZpids),
          ]);

          // Filter to only new items
          const newItems = itemsWithZpid.filter(item => {
            const zpid = String(item.zpid);
            return !zpidsInQueue.has(zpid) && !zpidsInCashHouses.has(zpid);
          });

          stats.alreadyInQueue += zpidsInQueue.size;
          stats.alreadyInCashHouses += zpidsInCashHouses.size;

          // Add new items to cash_deals_queue
          let addedThisSearch = 0;
          const BATCH_SIZE = 500;

          for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
            const batchItems = newItems.slice(i, i + BATCH_SIZE);
            const batch = db.batch();

            for (const property of batchItems) {
              const docRef = db.collection('cash_deals_queue').doc();
              batch.set(docRef, {
                url: property.detailUrl,
                zpid: property.zpid,
                address: property.address || '',
                price: property.price || '',
                zestimate: property.zestimate || null,
                status: 'pending',
                addedAt: new Date(),
                source: 'cash_deals_search_cron',
                searchName: search.name,
              });
              addedThisSearch++;
            }

            await batch.commit();
          }

          stats.addedToQueue += addedThisSearch;
          stats.searchResults.push({
            name: search.name,
            found: items.length,
            added: addedThisSearch,
          });

          console.log(`   ✅ Added ${addedThisSearch} to queue (${zpidsInQueue.size} already in queue, ${zpidsInCashHouses.size} already processed)`);

        } catch (searchError: any) {
          console.error(`   ❌ Error in search ${search.name}:`, searchError.message);
          stats.searchResults.push({
            name: search.name,
            found: 0,
            added: 0,
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ [CASH DEALS SEARCH] Complete in ${duration}s`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Total properties found: ${stats.totalFound}`);
      console.log(`Added to queue: ${stats.addedToQueue}`);
      console.log(`Already in queue: ${stats.alreadyInQueue}`);
      console.log(`Already in cash_houses: ${stats.alreadyInCashHouses}`);
      console.log(`No ZPID (skipped): ${stats.noZpid}`);

      return {
        success: true,
        duration: `${duration}s`,
        stats,
        message: `Added ${stats.addedToQueue} properties to cash_deals_queue for detailed processing`,
      };

    } catch (error: any) {
      console.error('❌ [CASH DEALS SEARCH] Error:', error);
      return {
        success: false,
        error: error.message,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        stats,
      };
    }
  });

  // If lock was not acquired
  if (result === null) {
    return NextResponse.json({
      success: false,
      skipped: true,
      message: 'Another instance is currently running',
    });
  }

  if ('error' in result && result.error) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
