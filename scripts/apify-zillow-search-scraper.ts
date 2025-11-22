import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

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
 * 🏡 Apify Zillow Search Scraper - WITH STRICT FILTERING
 *
 * Uses maxcopell/zillow-scraper to extract property URLs from your search
 * Then adds URLs to scraper_queue for detail scraping + strict filter verification
 *
 * This ensures ALL properties go through the strict filter before being listed!
 */

const SCRAPER_CONFIG = {
  // Your Zillow search URL (with owner financing keywords in filters)
  // 7-day search for biweekly runs
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-123.82329050572206%2C%22east%22%3A-55.795946755722056%2C%22south%22%3A-18.62001504632672%2C%22north%22%3A61.02913536475284%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22financing%20available%2Foffered%5C%22%20%2C%20%5C%22creative%20financing%5C%22%20%2C%20%5C%22flexible%20financing%5C%22%2C%20%5C%22terms%20available%5C%22%2C%20%5C%22owner%20terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',

  // Scraper mode
  // 'map' = Fast, limited results (free-tier friendly)
  // 'pagination' = Up to 820 results per search (recommended)
  // 'deep' = Unlimited results (most expensive)
  mode: 'pagination' as 'map' | 'pagination' | 'deep',

  // Max results to extract
  maxResults: 500, // Adjust based on your needs

  // Add to scraper queue for detail scraping + filtering
  addToQueue: true,

  // Trigger queue processor immediately after adding URLs?
  triggerQueueProcessor: true,
};

async function main() {
  console.log('🏡 Starting Apify Zillow Search Scraper WITH STRICT FILTERING\n');
  console.log(`Mode: ${SCRAPER_CONFIG.mode}`);
  console.log(`Max Results: ${SCRAPER_CONFIG.maxResults}`);
  console.log(`Search URL: ${SCRAPER_CONFIG.searchUrl.substring(0, 100)}...\n`);

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY not found in environment variables');
  }

  const client = new ApifyClient({ token: apiKey });

  // Configure the scraper
  const input = {
    searchUrls: [{ url: SCRAPER_CONFIG.searchUrl }],
    maxResults: SCRAPER_CONFIG.maxResults,
    mode: SCRAPER_CONFIG.mode,
  };

  console.log('🚀 Starting Apify actor: maxcopell/zillow-scraper\n');

  // Run the actor
  const run = await client.actor('maxcopell/zillow-scraper').call(input);

  console.log(`✅ Actor finished: ${run.id}\n`);
  console.log('📥 Fetching results...\n');

  // Get the results
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  console.log(`\n📊 Results Summary:`);
  console.log(`   Properties found: ${items.length}`);

  if (items.length === 0) {
    console.log('\n⚠️  No properties found. Check your search URL.');
    return;
  }

  // Show sample property
  console.log(`\n📋 Sample Property:`);
  const sample = items[0] as any;
  console.log(`   Address: ${sample.address || 'N/A'}`);
  console.log(`   Price: $${sample.price?.toLocaleString() || 'N/A'}`);
  console.log(`   Detail URL: ${sample.detailUrl || 'N/A'}`);
  console.log(`   Beds/Baths: ${sample.beds || '?'}bd / ${sample.baths || '?'}ba`);

  // Add URLs to scraper queue for detail scraping + strict filtering
  if (SCRAPER_CONFIG.addToQueue) {
    console.log(`\n📋 Adding URLs to scraper queue for detail scraping + strict filter...\n`);

    let addedToQueue = 0;
    let alreadyInQueue = 0;
    let alreadyScraped = 0;
    let noUrl = 0;

    for (const item of items) {
      const property = item as any;

      // Extract detail URL (this is the link to the full property page)
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

      // Check if already scraped and in zillow_imports
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
        source: 'apify_search_scraper',
      });

      addedToQueue++;

      // Log progress every 50 items
      if (addedToQueue % 50 === 0) {
        console.log(`   Added ${addedToQueue} URLs to queue...`);
      }
    }

    console.log(`\n✅ Queue Summary:`);
    console.log(`   ✅ Added to queue:      ${addedToQueue}`);
    console.log(`   ⏭️  Already in queue:    ${alreadyInQueue}`);
    console.log(`   ⏭️  Already scraped:     ${alreadyScraped}`);
    if (noUrl > 0) {
      console.log(`   ⚠️  No URL found:        ${noUrl}`);
    }

    console.log(`\n📌 Next Step: Queue processor will:`);
    console.log(`   1. Scrape full details for each URL`);
    console.log(`   2. Apply STRICT FILTER (owner financing keywords)`);
    console.log(`   3. Only save properties that pass filter`);
    console.log(`   4. Send to GHL if they have contact info\n`);

    // Trigger queue processor if enabled
    if (SCRAPER_CONFIG.triggerQueueProcessor && addedToQueue > 0) {
      console.log(`🚀 Triggering queue processor to start processing immediately...\n`);

      const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
      const CRON_SECRET = process.env.CRON_SECRET;

      if (!CRON_SECRET) {
        console.log('⚠️  CRON_SECRET not found. Queue will be processed on next cron run.');
      } else {
        try {
          const response = await fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${CRON_SECRET}`,
              'User-Agent': 'search-scraper/1.0'
            }
          });

          if (response.ok) {
            console.log(`✅ Queue processor started! Processing ${addedToQueue} URLs now...`);
          } else {
            console.log(`⚠️  Failed to trigger queue processor: ${response.status} ${response.statusText}`);
            console.log(`   Queue will be processed on next cron run.`);
          }
        } catch (error: any) {
          console.log(`⚠️  Failed to trigger queue processor: ${error.message}`);
          console.log(`   Queue will be processed on next cron run.`);
        }
      }
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`\n📁 URLs added to scraper_queue for strict filtering`);
}

main().catch(console.error);
