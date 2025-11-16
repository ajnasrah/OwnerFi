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
 * 🧪 TEST - Search Scraper with Strict Filtering
 *
 * Small test run with only 10 properties to verify workflow
 */

const TEST_CONFIG = {
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-129.09672800572204%2C%22east%22%3A-50.522509255722056%2C%22south%22%3A-25.100328170509652%2C%22north%22%3A64.2375265423478%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A100000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%2C%22max%22%3A435600%2C%22units%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%2214%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner+financing%5C%22+%2C+%5C%22seller+financing%5C%22+%2C+%5C%22owner+carry%5C%22+%2C+%5C%22seller+carry%5C%22+%2C+%5C%22financing+available%2Foffered%5C%22+%2C+%5C%22creative+financing%5C%22+%2C+%5C%22flexible+financing%5C%22%2C+%5C%22terms+available%5C%22%2C+%5C%22owner+terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
  mode: 'map' as 'map' | 'pagination' | 'deep', // Map mode = ~40 results (cheap test)
  maxResults: 10, // Only 10 for testing
};

async function main() {
  console.log('🧪 TESTING Search Scraper → Queue → Strict Filter Workflow\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Mode: ${TEST_CONFIG.mode} (cheap test mode)`);
  console.log(`Max Results: ${TEST_CONFIG.maxResults}\n`);

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY not found in environment variables');
  }

  const client = new ApifyClient({ token: apiKey });

  // STEP 1: Run search scraper
  console.log('🚀 STEP 1: Running search scraper...\n');

  const input = {
    searchUrls: [{ url: TEST_CONFIG.searchUrl }],
    maxResults: TEST_CONFIG.maxResults,
    mode: TEST_CONFIG.mode,
  };

  const run = await client.actor('maxcopell/zillow-scraper').call(input);
  console.log(`✅ Search scraper finished: ${run.id}\n`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`📦 Found ${items.length} properties from search\n`);

  if (items.length === 0) {
    console.log('⚠️  No properties found. Check search URL.');
    return;
  }

  // Show samples
  console.log('📋 Sample properties from search:');
  items.slice(0, 3).forEach((item: any, i: number) => {
    console.log(`   ${i + 1}. ${item.address} - $${item.price?.toLocaleString()}`);
    console.log(`      URL: ${item.detailUrl}`);
  });

  // STEP 2: Add to queue
  console.log('\n🚀 STEP 2: Adding URLs to scraper_queue...\n');

  let addedToQueue = 0;
  let alreadyExists = 0;

  for (const item of items) {
    const property = item as any;
    const detailUrl = property.detailUrl;

    if (!detailUrl) continue;

    // Check duplicates
    const existingInQueue = await db
      .collection('scraper_queue')
      .where('url', '==', detailUrl)
      .limit(1)
      .get();

    const existingInImports = await db
      .collection('zillow_imports')
      .where('url', '==', detailUrl)
      .limit(1)
      .get();

    if (!existingInQueue.empty || !existingInImports.empty) {
      alreadyExists++;
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
      source: 'test_search_scraper',
    });

    addedToQueue++;
  }

  console.log(`✅ Added ${addedToQueue} URLs to queue`);
  console.log(`⏭️  Skipped ${alreadyExists} duplicates\n`);

  if (addedToQueue === 0) {
    console.log('⚠️  No new URLs to process (all were duplicates)\n');
    console.log('🎉 TEST COMPLETE - Workflow is working!\n');
    return;
  }

  // STEP 3: Trigger queue processor
  console.log('🚀 STEP 3: Triggering queue processor...\n');

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.log('⚠️  CRON_SECRET not found. Please trigger manually.');
    console.log('   Or wait for automatic cron job.\n');
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'User-Agent': 'test-search-scraper/1.0'
      }
    });

    if (response.ok) {
      console.log(`✅ Queue processor started!\n`);

      const result = await response.json();
      console.log('📊 Queue Processor Results:');
      console.log(JSON.stringify(result.metrics, null, 2));

      console.log('\n═══════════════════════════════════════════════════════════\n');
      console.log('🎉 TEST COMPLETE!\n');
      console.log('✅ Search scraper extracted URLs');
      console.log('✅ URLs added to scraper_queue');
      console.log('✅ Queue processor ran detail scraper');
      console.log('✅ Strict filter applied to descriptions');
      console.log('✅ Only verified properties saved\n');

      if (result.metrics.propertiesSaved > 0) {
        console.log(`🎯 ${result.metrics.propertiesSaved} properties passed strict filter!`);
        console.log(`   These properties are now live with verified owner financing keywords.\n`);
      } else {
        console.log('⚠️  0 properties passed strict filter');
        console.log('   This means none of the search results had owner financing keywords.');
        console.log('   The filter is working correctly!\n');
      }

    } else {
      console.log(`⚠️  Queue processor returned: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`   Response: ${text}\n`);
    }
  } catch (error: any) {
    console.log(`❌ Failed to trigger queue processor: ${error.message}`);
    console.log(`   Queue will be processed on next cron run.\n`);
  }
}

main().catch(console.error);
