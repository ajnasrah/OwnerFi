import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

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
 * ONE-TIME FULL SCRAPE
 *
 * Gets ALL current owner finance properties nationwide.
 * This establishes the baseline - from now on we only need to check for new listings.
 */

const SEARCH_URL = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-130.32719675572204%2C%22east%22%3A-49.292040505722056%2C%22south%22%3A-19.07748960170659%2C%22north%22%3A61.2624139158194%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22financing%20available%2Foffered%5C%22%20%2C%20%5C%22creative%20financing%5C%22%20%2C%20%5C%22flexible%20financing%5C%22%2C%20%5C%22terms%20available%5C%22%2C%20%5C%22owner%20terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D';

// For a full scrape, we need more results but still have a safety limit
const MAX_RESULTS = 6000;  // User confirmed ~5800 properties exist
const HARD_LIMIT = 7000;   // Abort if more than this (something wrong)

async function batchCheckExistingUrls(
  collectionName: string,
  urls: string[]
): Promise<Set<string>> {
  const existingUrls = new Set<string>();

  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const snapshot = await db
      .collection(collectionName)
      .where('url', 'in', batch)
      .get();

    snapshot.docs.forEach(doc => {
      const url = doc.data().url;
      if (url) existingUrls.add(url);
    });
  }

  return existingUrls;
}

async function main() {
  console.log('🏡 ONE-TIME FULL OWNER FINANCE SCRAPE\n');
  console.log('This will get ALL current owner finance listings nationwide.\n');

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY not found');
  }

  const client = new ApifyClient({ token: apiKey });

  const input = {
    searchUrls: [{ url: SEARCH_URL }],
    maxResults: MAX_RESULTS,
    mode: 'map' as const,  // MUST use map mode to respect maxResults
  };

  console.log(`Mode: map (respects maxResults)`);
  console.log(`Max results: ${MAX_RESULTS}`);
  console.log(`Hard limit: ${HARD_LIMIT}\n`);

  console.log('🚀 Starting Apify scraper...\n');

  try {
    const run = await client.actor('maxcopell/zillow-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`📦 Found ${items.length} properties\n`);

    // Safety check
    if (items.length > HARD_LIMIT) {
      console.error(`🚨 ABORTING: ${items.length} results exceeds hard limit of ${HARD_LIMIT}`);
      process.exit(1);
    }

    if (items.length === 0) {
      console.log('No properties found. Check search URL.');
      return;
    }

    // Extract URLs
    const itemsWithUrls = items
      .map(item => item as any)
      .filter(item => item.detailUrl);

    const allUrls = itemsWithUrls.map(item => item.detailUrl);
    const noUrl = items.length - itemsWithUrls.length;

    console.log(`Checking ${allUrls.length} URLs for duplicates...`);

    // Check for existing in queue and imports
    const [urlsInQueue, urlsInImports] = await Promise.all([
      batchCheckExistingUrls('scraper_queue', allUrls),
      batchCheckExistingUrls('zillow_imports', allUrls),
    ]);

    console.log(`  Already in queue: ${urlsInQueue.size}`);
    console.log(`  Already imported: ${urlsInImports.size}`);

    // Filter to new URLs only
    const newItems = itemsWithUrls.filter(item => {
      return !urlsInQueue.has(item.detailUrl) && !urlsInImports.has(item.detailUrl);
    });

    console.log(`  New URLs to add: ${newItems.length}\n`);

    if (newItems.length === 0) {
      console.log('✅ No new properties to add. Database is up to date!');
      return;
    }

    // Add to queue
    const BATCH_SIZE = 500;
    let added = 0;

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
          source: 'one_time_full_scrape',
        });
        added++;
      }

      await batch.commit();
      console.log(`Added ${Math.min(i + BATCH_SIZE, newItems.length)}/${newItems.length} to queue...`);
    }

    console.log(`\n✅ DONE!`);
    console.log(`   Added to queue: ${added}`);
    console.log(`   Already in queue: ${urlsInQueue.size}`);
    console.log(`   Already imported: ${urlsInImports.size}`);
    if (noUrl > 0) console.log(`   No URL: ${noUrl}`);

    console.log(`\n📌 Next: Run process-scraper-queue to get full details and apply filters`);

  } catch (error: any) {
    if (error.message?.includes('limit') || error.message?.includes('usage')) {
      console.error('\n🚨 APIFY MONTHLY LIMIT EXCEEDED');
      console.error('Cannot run scraper until billing cycle resets.');
      console.error('Check your Apify dashboard: https://console.apify.com/billing');
    } else {
      console.error('Error:', error.message || error);
    }
    process.exit(1);
  }
}

main();
