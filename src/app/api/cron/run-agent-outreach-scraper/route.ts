import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasStrictOwnerFinancing } from '@/lib/owner-financing-filter-strict';

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
 * CRON: Agent Outreach Scraper
 *
 * Scrapes newly listed properties from Zillow (last 1-3 days)
 * WITHOUT owner financing keyword filter
 *
 * Purpose: Find properties to ask agents about owner financing or cash deals
 *
 * Classification:
 * - Price < 80% of Zestimate → cash_deal
 * - Otherwise → potential_owner_finance
 *
 * Schedule: Daily at 6 AM
 */

const SEARCH_CONFIG = {
  // Search URL: Newly listed (last 3 days), no owner finance filter
  searchUrl: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-123.82329050572206%2C%22east%22%3A-55.795946755722056%2C%22south%22%3A-18.62001504632672%2C%22north%22%3A61.02913536475284%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%223%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
  mode: 'pagination' as 'map' | 'pagination' | 'deep',
  maxResults: 200, // Get ~200 properties per day
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('🏡 [AGENT OUTREACH SCRAPER] Starting...');

  // Security check - only allow cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [AGENT OUTREACH SCRAPER] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    console.log(`🚀 [AGENT OUTREACH SCRAPER] Running Apify search (mode: ${SEARCH_CONFIG.mode}, max: ${SEARCH_CONFIG.maxResults})`);

    const run = await client.actor('maxcopell/zillow-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`📦 [AGENT OUTREACH SCRAPER] Found ${items.length} properties`);

    // Process results and add to queue
    let addedToQueue = 0;
    let skippedOwnerFinance = 0;
    let alreadyInQueue = 0;
    let alreadyInImports = 0;
    let alreadyInCashDeals = 0;
    let noUrl = 0;
    let noAgent = 0;

    const stats = {
      cashDeals: 0,
      potentialOwnerFinance: 0,
    };

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

      // IMPORTANT: Skip if already has owner financing keywords (System 1 handles these)
      const description = property.description || '';
      const ownerFinanceCheck = hasStrictOwnerFinancing(description);

      if (ownerFinanceCheck.passes) {
        skippedOwnerFinance++;
        console.log(`   ⏭️  Skipping ${property.address} - already has owner financing keywords`);
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

      // Check if already in zillow_imports (System 1)
      const existingInImports = await db
        .collection('zillow_imports')
        .where('zpid', '==', zpid)
        .limit(1)
        .get();

      if (!existingInImports.empty) {
        alreadyInImports++;
        continue;
      }

      // Check if already in cash_deals
      const existingInCashDeals = await db
        .collection('cash_deals')
        .where('zpid', '==', zpid)
        .limit(1)
        .get();

      if (!existingInCashDeals.empty) {
        alreadyInCashDeals++;
        continue;
      }

      // Classify deal type based on price vs zestimate
      const price = property.price || 0;
      const zestimate = property.zestimate || 0;
      let dealType: 'cash_deal' | 'potential_owner_finance' = 'potential_owner_finance';
      let priceToZestimateRatio: number | null = null;

      if (zestimate > 0 && price > 0) {
        priceToZestimateRatio = price / zestimate;

        // If price is less than 80% of zestimate, it's a cash deal candidate
        if (priceToZestimateRatio < 0.80) {
          dealType = 'cash_deal';
          stats.cashDeals++;
        } else {
          stats.potentialOwnerFinance++;
        }
      } else {
        // No zestimate, default to potential owner finance
        stats.potentialOwnerFinance++;
      }

      // Extract agent info
      const agentName = property.attributionInfo?.agentName ||
                       property.attributionInfo?.brokerName ||
                       'Agent';
      const agentPhone = property.attributionInfo?.agentPhoneNumber ||
                        property.attributionInfo?.brokerPhoneNumber;
      const agentEmail = property.attributionInfo?.agentEmail || null;

      // Add to agent_outreach_queue
      await db.collection('agent_outreach_queue').add({
        // Core property info
        zpid: zpid,
        url: detailUrl,
        address: property.address || '',
        city: property.addressCity || '',
        state: property.addressState || '',
        zipCode: property.addressZipcode || '',

        // Pricing
        price: price,
        zestimate: zestimate,
        priceToZestimateRatio: priceToZestimateRatio,

        // Property details
        beds: property.bedrooms || 0,
        baths: property.bathrooms || 0,
        squareFeet: property.livingArea || 0,
        propertyType: property.homeType || 'SINGLE_FAMILY',

        // Agent info
        agentName: agentName,
        agentPhone: agentPhone,
        agentEmail: agentEmail,

        // Classification
        dealType: dealType,

        // Status
        status: 'pending',

        // Metadata
        source: 'agent_outreach_scraper',
        addedAt: new Date(),
        updatedAt: new Date(),

        // Store full property data for later use
        rawData: property,
      });

      addedToQueue++;

      // Log progress every 50 items
      if (addedToQueue % 50 === 0) {
        console.log(`   Added ${addedToQueue} properties to queue...`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [AGENT OUTREACH SCRAPER] Complete in ${duration}s:`);
    console.log(`   ✅ Added to queue: ${addedToQueue}`);
    console.log(`      💰 Cash deals: ${stats.cashDeals}`);
    console.log(`      🏡 Potential owner finance: ${stats.potentialOwnerFinance}`);
    console.log(`   ⏭️  Skipped (has owner finance keywords): ${skippedOwnerFinance}`);
    console.log(`   ⏭️  Already in queue: ${alreadyInQueue}`);
    console.log(`   ⏭️  Already in zillow_imports: ${alreadyInImports}`);
    console.log(`   ⏭️  Already in cash_deals: ${alreadyInCashDeals}`);
    if (noAgent > 0) {
      console.log(`   ⚠️  No agent contact: ${noAgent}`);
    }
    if (noUrl > 0) {
      console.log(`   ⚠️  No URL/ZPID: ${noUrl}`);
    }

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      propertiesFound: items.length,
      addedToQueue,
      stats,
      skipped: {
        ownerFinance: skippedOwnerFinance,
        alreadyInQueue,
        alreadyInImports,
        alreadyInCashDeals,
        noAgent,
        noUrl,
      },
      message: `Added ${addedToQueue} properties to agent outreach queue (${stats.cashDeals} cash deals, ${stats.potentialOwnerFinance} potential owner finance)`,
    });

  } catch (error: any) {
    console.error('❌ [AGENT OUTREACH SCRAPER] Error:', error);

    return NextResponse.json(
      {
        error: error.message,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      },
      { status: 500 }
    );
  }
}
