/**
 * Full test of Agent Outreach flow with all filters
 */

import { ApifyClient } from 'apify-client';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = admin.firestore();

// Import the actual filter functions
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '../src/lib/negative-keywords';

const SEARCH_CONFIG = {
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-124.848974%2C%22east%22%3A-66.885444%2C%22south%22%3A24.396308%2C%22north%22%3A49.384358%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22days%22%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22sf%22%3A%7B%22value%22%3Atrue%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A4%7D',
  mode: 'pagination' as const,
  maxResults: 300,
};

async function testFullOutreach() {
  console.log('🧪 FULL AGENT OUTREACH TEST\n');
  console.log('📍 Search: NATIONWIDE (Continental US)');
  console.log(`📊 Max results: ${SEARCH_CONFIG.maxResults}\n`);

  const startTime = Date.now();

  try {
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

    console.log('🚀 Running Apify search scraper...');

    const run = await client.actor('maxcopell/zillow-scraper').call({
      searchUrls: [{ url: SEARCH_CONFIG.searchUrl }],
      maxResults: SEARCH_CONFIG.maxResults,
      mode: SEARCH_CONFIG.mode,
    });

    const { items: allItems } = await client.dataset(run.defaultDatasetId).listItems();

    // Limit to 300 for realistic daily test
    const items = allItems.slice(0, 300);

    console.log(`📦 Found ${allItems.length} total, testing with ${items.length} properties\n`);

    // Track stats
    let wouldAddToQueue = 0;
    let skippedOwnerFinance = 0;
    let skippedNegativeKeywords = 0;
    let alreadyInQueue = 0;
    let alreadyInImports = 0;
    let alreadyContacted = 0;
    let noAgent = 0;
    let noUrl = 0;
    let noDescription = 0;

    const stats = {
      cashDeals: 0,
      potentialOwnerFinance: 0,
    };

    const byState: Record<string, number> = {};
    const samples: any[] = [];

    console.log('🔍 Processing properties (checking filters)...\n');

    for (const item of items) {
      const property = item as any;
      const detailUrl = property.detailUrl;
      const zpid = String(property.zpid || '');

      if (!detailUrl || !zpid) {
        noUrl++;
        continue;
      }

      // Note: Search scraper doesn't return agent info - that comes from detail scraper
      // For this test, we'll check what we can

      const description = property.description || '';

      if (!description) {
        noDescription++;
        // Still count these as potential - they just don't have description yet
      }

      // Skip if already has owner financing keywords
      const ownerFinanceCheck = hasStrictOwnerFinancing(description);

      if (ownerFinanceCheck.passes) {
        skippedOwnerFinance++;
        continue;
      }

      // Skip if has negative keywords
      const negativeCheck = hasNegativeKeywords(description);

      if (negativeCheck.hasNegative) {
        skippedNegativeKeywords++;
        continue;
      }

      // Check if already in agent_outreach_queue
      const existingInQueue = await db
        .collection('agent_outreach_queue')
        .where('zpid', '==', zpid)
        .limit(1)
        .get();

      if (!existingInQueue.empty) {
        alreadyInQueue++;
        continue;
      }

      // Check if already in zillow_imports
      const existingInImports = await db
        .collection('zillow_imports')
        .where('zpid', '==', parseInt(zpid))
        .limit(1)
        .get();

      if (!existingInImports.empty) {
        alreadyInImports++;
        continue;
      }

      // Calculate deal type (if zestimate available)
      const price = property.price || 0;
      const zestimate = property.zestimate || 0;
      let dealType = 'potential_owner_finance';

      if (zestimate > 0 && price > 0) {
        const ratio = price / zestimate;
        if (ratio < 0.80) {
          dealType = 'cash_deal';
          stats.cashDeals++;
        } else {
          stats.potentialOwnerFinance++;
        }
      } else {
        stats.potentialOwnerFinance++;
      }

      wouldAddToQueue++;

      // Track by state
      const state = property.addressState || 'Unknown';
      byState[state] = (byState[state] || 0) + 1;

      // Collect samples
      if (samples.length < 5) {
        samples.push({
          address: property.address,
          city: property.addressCity,
          state: property.addressState,
          price: property.price,
          dealType,
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log(`📦 Properties from Apify: ${items.length}`);
    console.log(`\n✅ WOULD ADD TO QUEUE: ${wouldAddToQueue}`);
    console.log(`   💰 Cash deals: ${stats.cashDeals}`);
    console.log(`   🏡 Potential owner finance: ${stats.potentialOwnerFinance}`);
    console.log(`\n⏭️  SKIPPED:`);
    console.log(`   Has owner financing keywords: ${skippedOwnerFinance}`);
    console.log(`   Has negative keywords: ${skippedNegativeKeywords}`);
    console.log(`   Already in outreach queue: ${alreadyInQueue}`);
    console.log(`   Already in zillow_imports: ${alreadyInImports}`);
    console.log(`   No URL/ZPID: ${noUrl}`);
    console.log(`   (No description at search stage): ${noDescription}`);

    if (Object.keys(byState).length > 0) {
      console.log(`\n📍 TOP STATES:`);
      Object.entries(byState)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([state, count]) => {
          console.log(`   ${state}: ${count}`);
        });
    }

    if (samples.length > 0) {
      console.log(`\n📝 SAMPLE PROPERTIES:`);
      samples.forEach((s, i) => {
        console.log(`\n   ${i + 1}. ${s.address}`);
        console.log(`      ${s.city}, ${s.state} - $${s.price?.toLocaleString()}`);
        console.log(`      Type: ${s.dealType}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📤 DAILY ESTIMATE: ~${wouldAddToQueue} properties added to queue`);
    console.log(`📞 After detail scraper + agent filter: ~${Math.floor(wouldAddToQueue * 0.7)} with contact info`);
    console.log(`🎯 To GHL: ~${Math.floor(wouldAddToQueue * 0.7 * 0.9)} per day (after dedup)`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testFullOutreach();
