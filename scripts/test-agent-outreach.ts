/**
 * Test the Agent Outreach Scraper
 *
 * This simulates what the cron job does but locally
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

// Import filters
async function hasStrictOwnerFinancing(description: string) {
  const keywords = [
    'owner financing', 'owner-financing', 'owner finance', 'owner-finance',
    'seller financing', 'seller-financing', 'seller finance', 'seller-finance',
    'owner carry', 'seller carry', 'creative financing', 'flexible financing',
    'terms available', 'owner terms', 'financing available', 'financing offered'
  ];

  const lowerDesc = description.toLowerCase();
  const matchedKeywords = keywords.filter(kw => lowerDesc.includes(kw));

  return {
    passes: matchedKeywords.length > 0,
    matchedKeywords
  };
}

async function hasNegativeKeywords(description: string) {
  const negativeKeywords = [
    'no owner financing', 'no seller financing', 'no creative financing',
    'cash only', 'cash buyers only', 'conventional only', 'no owner finance',
    'owner financing not available', 'seller financing not available',
    'will not carry', 'no terms'
  ];

  const lowerDesc = description.toLowerCase();
  const matches = negativeKeywords.filter(kw => lowerDesc.includes(kw));

  return {
    hasNegative: matches.length > 0,
    matches
  };
}

const SEARCH_CONFIG = {
  // NATIONWIDE search - same as updated cron
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-123.82329050572206%2C%22east%22%3A-55.795946755722056%2C%22south%22%3A-18.62001504632672%2C%22north%22%3A61.02913536475284%7D%2C%22mapZoom%22%3A4%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22beds%22%3A%7B%22min%22%3A1%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
  mode: 'pagination' as const,
  maxResults: 300,
};

async function testAgentOutreachScraper() {
  console.log('🧪 TESTING AGENT OUTREACH SCRAPER\n');
  console.log('📍 Search: NATIONWIDE');
  console.log(`📊 Max results: ${SEARCH_CONFIG.maxResults}\n`);

  const startTime = Date.now();

  try {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      throw new Error('APIFY_API_KEY not found');
    }

    const client = new ApifyClient({ token: apiKey });

    console.log('🚀 Running Apify search scraper...');

    const input = {
      searchUrls: [{ url: SEARCH_CONFIG.searchUrl }],
      maxResults: SEARCH_CONFIG.maxResults,
      mode: SEARCH_CONFIG.mode,
    };

    const run = await client.actor('maxcopell/zillow-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`📦 Found ${items.length} properties from Apify\n`);

    // Track stats
    let wouldAddToQueue = 0;
    let skippedOwnerFinance = 0;
    let skippedNegativeKeywords = 0;
    let alreadyInQueue = 0;
    let alreadyInImports = 0;
    let alreadyContacted = 0;
    let noAgent = 0;
    let noUrl = 0;

    const stats = {
      cashDeals: 0,
      potentialOwnerFinance: 0,
    };

    // Sample properties to show
    const samples: any[] = [];

    for (const item of items) {
      const property = item as any;
      const detailUrl = property.detailUrl;
      const zpid = String(property.zpid || '');

      if (!detailUrl || !zpid) {
        noUrl++;
        continue;
      }

      // Skip if no agent contact info
      if (!property.attributionInfo?.agentPhoneNumber && !property.attributionInfo?.brokerPhoneNumber) {
        noAgent++;
        continue;
      }

      // Skip if already has owner financing keywords
      const description = property.description || '';
      const ownerFinanceCheck = await hasStrictOwnerFinancing(description);

      if (ownerFinanceCheck.passes) {
        skippedOwnerFinance++;
        continue;
      }

      // Skip if has negative keywords
      const negativeCheck = await hasNegativeKeywords(description);

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
        .where('zpid', '==', zpid)
        .limit(1)
        .get();

      if (!existingInImports.empty) {
        alreadyInImports++;
        continue;
      }

      // Check contacted_agents
      const agentPhone = property.attributionInfo?.agentPhoneNumber || property.attributionInfo?.brokerPhoneNumber;
      const phoneNormalized = agentPhone.replace(/\D/g, '');
      const addressNormalized = (property.address || '')
        .toLowerCase()
        .trim()
        .replace(/[#,\.]/g, '')
        .replace(/\s+/g, ' ');

      const alreadyContactedCheck = await db
        .collection('contacted_agents')
        .where('phoneNormalized', '==', phoneNormalized)
        .limit(1)
        .get();

      if (!alreadyContactedCheck.empty) {
        alreadyContacted++;
        continue;
      }

      // Calculate deal type
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

      // Collect samples
      if (samples.length < 5) {
        samples.push({
          address: property.address,
          city: property.addressCity,
          state: property.addressState,
          price: property.price,
          agent: property.attributionInfo?.agentName,
          phone: agentPhone,
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
    console.log(`   Already in queue: ${alreadyInQueue}`);
    console.log(`   Already in imports: ${alreadyInImports}`);
    console.log(`   Already contacted: ${alreadyContacted}`);
    console.log(`   No agent contact: ${noAgent}`);
    console.log(`   No URL/ZPID: ${noUrl}`);

    if (samples.length > 0) {
      console.log(`\n📝 SAMPLE PROPERTIES THAT WOULD BE ADDED:`);
      samples.forEach((s, i) => {
        console.log(`\n   ${i + 1}. ${s.address}`);
        console.log(`      ${s.city}, ${s.state} - $${s.price?.toLocaleString()}`);
        console.log(`      Agent: ${s.agent} | ${s.phone}`);
        console.log(`      Type: ${s.dealType}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📤 DAILY ESTIMATE: ~${wouldAddToQueue} properties/day to GHL`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testAgentOutreachScraper();
