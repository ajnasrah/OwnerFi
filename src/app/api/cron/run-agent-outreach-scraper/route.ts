import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasStrictOwnerFinancing } from '@/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '@/lib/negative-keywords';

// Extend function timeout to 5 minutes
export const maxDuration = 300;

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
 * AGENT OUTREACH SCRAPER
 *
 * Finds properties WITHOUT owner financing keywords to ask agents about.
 *
 * Uses the specific Memphis/TN area search URL provided.
 * Filters: $50k-$500k, last 7 days, no multi-family/land/foreclosures/auctions
 */

const SEARCH_CONFIG = {
  // Daily search - filters to last 1 day (doz=1), no owner finance keywords
  searchUrl: 'https://www.zillow.com/homes/for_sale/?category=SEMANTIC&searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-94.61048517767817%2C%22east%22%3A-86.51356134955317%2C%22south%22%3A30.185278877142437%2C%22north%22%3A40.05475766218434%7D%2C%22mapZoom%22%3A7%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%225f8096924aX1-CR1i1r231i2qe0e_1276cg%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%7D',
  mode: 'pagination' as const,
  maxResults: 1000,
  detailBatchSize: 100,   // Process fewer at a time to stay under 5min limit
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('🏡 [AGENT OUTREACH SCRAPER] Starting...');

  // Security check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Log start to cron_logs
    await db.collection('cron_logs').add({
      cron: 'run-agent-outreach-scraper',
      status: 'started',
      timestamp: new Date(),
    });

    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) throw new Error('APIFY_API_KEY not found');

    const client = new ApifyClient({ token: apiKey });

    // STEP 1: Run SEARCH scraper to find URLs quickly
    console.log(`🔍 Step 1: Search scraper (mode: ${SEARCH_CONFIG.mode}, max ${SEARCH_CONFIG.maxResults})...`);
    const searchRun = await client.actor('maxcopell/zillow-scraper').call({
      searchUrls: [{ url: SEARCH_CONFIG.searchUrl }],
      maxResults: SEARCH_CONFIG.maxResults,
      mode: SEARCH_CONFIG.mode,
    });
    const { items: searchItems } = await client.dataset(searchRun.defaultDatasetId).listItems();
    console.log(`   Found ${searchItems.length} properties from search`);

    // Get URLs and ZPIDs from search results
    const propertyData: { url: string; zpid: string }[] = [];

    for (const item of searchItems as any[]) {
      const url = item.detailUrl;
      const zpid = String(item.zpid || '');
      if (url && zpid && url.includes('zillow.com')) {
        propertyData.push({ url, zpid });
      }
    }

    // OPTIMIZATION: Pre-fetch ALL existing ZPIDs in ONE query per collection
    console.log(`📊 Pre-fetching existing ZPIDs...`);

    const [existingQueueDocs, existingPropertiesDocs] = await Promise.all([
      db.collection('agent_outreach_queue').select('zpid').get(),
      db.collection('properties').select('zpid').get(),
    ]);

    const existingZpids = new Set<string>();
    existingQueueDocs.docs.forEach(doc => existingZpids.add(doc.data().zpid));
    existingPropertiesDocs.docs.forEach(doc => existingZpids.add(String(doc.data().zpid)));

    console.log(`   Existing ZPIDs in system: ${existingZpids.size}`);

    // Filter to only NEW properties
    const newProperties = propertyData.filter(p => !existingZpids.has(p.zpid));
    const urlsToScrape = newProperties.slice(0, SEARCH_CONFIG.detailBatchSize).map(p => p.url);

    console.log(`   New properties to scrape: ${urlsToScrape.length}`);

    if (urlsToScrape.length === 0) {
      return NextResponse.json({
        success: true,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        propertiesFound: searchItems.length,
        addedToQueue: 0,
        message: 'No new properties found - all already in system',
      });
    }

    // STEP 2: Run DETAIL scraper to get agent contact info
    console.log(`🔍 Step 2: Detail scraper (${urlsToScrape.length} URLs)...`);
    const detailRun = await client.actor('maxcopell/zillow-detail-scraper').call({
      startUrls: urlsToScrape.map(url => ({ url })),
    });
    const { items: detailItems } = await client.dataset(detailRun.defaultDatasetId).listItems();
    console.log(`   Got ${detailItems.length} detailed properties`);

    // MERGE: Copy images from search results to detail results
    // Detail scraper doesn't return images, but search scraper does
    const searchByZpid = new Map<string, any>();
    for (const item of searchItems as any[]) {
      if (item.zpid) {
        searchByZpid.set(String(item.zpid), item);
      }
    }

    let imagesMerged = 0;
    for (const prop of detailItems as any[]) {
      if (!prop.imgSrc && prop.zpid) {
        const searchItem = searchByZpid.get(String(prop.zpid));
        if (searchItem?.imgSrc) {
          prop.imgSrc = searchItem.imgSrc;
          imagesMerged++;
        }
      }
    }
    console.log(`   Merged ${imagesMerged} images from search results`);

    // Process results
    const stats = {
      total: detailItems.length,
      added: 0,
      cashDeals: 0,
      potentialOwnerFinance: 0,
      noAgent: 0,
      hasOwnerFinance: 0,
      negativeKeywords: 0,
      failedStored: 0,
    };

    // Batch write
    let batch = db.batch();
    let batchCount = 0;

    // Separate batch for failed properties
    let failedBatch = db.batch();
    let failedBatchCount = 0;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    for (const item of detailItems) {
      const property = item as any;

      // Get URL
      let url = property.addressOrUrlFromInput || property.url;
      if (!url && property.hdpUrl) {
        url = `https://www.zillow.com${property.hdpUrl}`;
      }

      const zpid = String(property.zpid || '');
      if (!url || !zpid) continue;

      // FILTER 1: Check for agent phone
      const agentPhone = property.attributionInfo?.agentPhoneNumber
        || property.agentPhoneNumber
        || property.contactRecipients?.[0]?.phoneNumber
        || property.attributionInfo?.brokerPhoneNumber
        || property.brokerPhoneNumber;

      if (!agentPhone) {
        stats.noAgent++;
        continue;
      }

      // FILTER 2: Check keywords
      const description = property.description || '';
      const streetAddr = property.streetAddress || property.address?.streetAddress || '';
      const city = property.city || property.address?.city || '';
      const state = property.state || property.address?.state || '';

      const ownerFinanceResult = hasStrictOwnerFinancing(description);
      const negativeResult = hasNegativeKeywords(description);

      if (ownerFinanceResult.passes) {
        stats.hasOwnerFinance++;
        // Store for analysis - these passed owner financing filter
        const failedDocRef = db.collection('failed_filter_properties').doc();
        failedBatch.set(failedDocRef, {
          zpid,
          url,
          address: streetAddr,
          city,
          state,
          description: description.substring(0, 2000),
          filterResult: 'has_owner_financing',
          matchedKeywords: ownerFinanceResult.matchedKeywords,
          reason: 'Property has owner financing keywords - skipped from agent outreach',
          expiresAt,
          createdAt: new Date(),
        });
        failedBatchCount++;
        stats.failedStored++;

        if (failedBatchCount >= 50) {
          await failedBatch.commit();
          failedBatch = db.batch();
          failedBatchCount = 0;
        }
        continue;
      }

      if (negativeResult.hasNegative) {
        stats.negativeKeywords++;
        // Store for analysis - these had negative keywords
        const failedDocRef = db.collection('failed_filter_properties').doc();
        failedBatch.set(failedDocRef, {
          zpid,
          url,
          address: streetAddr,
          city,
          state,
          description: description.substring(0, 2000),
          filterResult: 'negative_keywords',
          matchedKeywords: negativeResult.matches,
          reason: 'Property has negative keywords (no owner financing, cash only, etc)',
          expiresAt,
          createdAt: new Date(),
        });
        failedBatchCount++;
        stats.failedStored++;

        if (failedBatchCount >= 50) {
          await failedBatch.commit();
          failedBatch = db.batch();
          failedBatchCount = 0;
        }
        continue;
      }

      // Extract remaining property data
      const zipCode = property.zipcode || property.address?.zipcode || '';
      const price = property.price || 0;
      const zestimate = property.zestimate || 0;

      // Classify deal type
      let dealType: 'cash_deal' | 'potential_owner_finance' = 'potential_owner_finance';
      if (zestimate > 0 && price > 0 && (price / zestimate) < 0.80) {
        dealType = 'cash_deal';
        stats.cashDeals++;
      } else {
        stats.potentialOwnerFinance++;
      }

      // Get agent info
      const agentName = property.attributionInfo?.agentName
        || property.agentName
        || property.contactRecipients?.[0]?.displayName
        || 'Agent';

      // Normalize for dedup
      const phoneNormalized = agentPhone.replace(/\D/g, '');
      const addressNormalized = streetAddr.toLowerCase().trim()
        .replace(/[#,\.]/g, '').replace(/\s+/g, ' ');

      // Add to batch
      const docRef = db.collection('agent_outreach_queue').doc();
      batch.set(docRef, {
        zpid,
        url,
        address: streetAddr,
        city,
        state,
        zipCode,
        price,
        zestimate,
        priceToZestimateRatio: zestimate > 0 ? price / zestimate : null,
        beds: property.bedrooms || 0,
        baths: property.bathrooms || 0,
        squareFeet: property.livingArea || 0,
        propertyType: property.homeType || 'SINGLE_FAMILY',
        agentName,
        agentPhone,
        agentEmail: property.attributionInfo?.agentEmail || null,
        phoneNormalized,
        addressNormalized,
        dealType,
        status: 'pending',
        source: 'agent_outreach_scraper',
        addedAt: new Date(),
        rawData: property,
      });

      batchCount++;
      stats.added++;

      // Commit batch if at 50 (smaller batches to avoid size issues)
      if (batchCount >= 50) {
        await batch.commit();
        console.log(`   Committed batch of ${batchCount}`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   Committed final batch of ${batchCount}`);
    }

    // Commit remaining failed properties
    if (failedBatchCount > 0) {
      await failedBatch.commit();
      console.log(`   Committed ${failedBatchCount} failed filter properties for analysis`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [AGENT OUTREACH SCRAPER] Complete in ${duration}s`);
    console.log(`   Properties from search: ${searchItems.length}`);
    console.log(`   Properties detailed: ${stats.total}`);
    console.log(`   Added to queue: ${stats.added}`);
    console.log(`   - Cash deals: ${stats.cashDeals}`);
    console.log(`   - Potential OF: ${stats.potentialOwnerFinance}`);
    console.log(`   Skipped:`);
    console.log(`   - No agent: ${stats.noAgent}`);
    console.log(`   - Has OF keywords: ${stats.hasOwnerFinance}`);
    console.log(`   - Negative keywords: ${stats.negativeKeywords}`);
    console.log(`   Stored for analysis: ${stats.failedStored} (expires in 7 days)`);

    // Log completion to cron_logs
    await db.collection('cron_logs').add({
      cron: 'run-agent-outreach-scraper',
      status: 'completed',
      duration: `${duration}s`,
      propertiesFromSearch: searchItems.length,
      propertiesDetailed: stats.total,
      addedToQueue: stats.added,
      stats: {
        cashDeals: stats.cashDeals,
        potentialOwnerFinance: stats.potentialOwnerFinance,
      },
      skipped: {
        noAgent: stats.noAgent,
        hasOwnerFinance: stats.hasOwnerFinance,
        negativeKeywords: stats.negativeKeywords,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      propertiesFound: stats.total,
      addedToQueue: stats.added,
      stats: {
        cashDeals: stats.cashDeals,
        potentialOwnerFinance: stats.potentialOwnerFinance,
      },
      skipped: {
        noAgent: stats.noAgent,
        hasOwnerFinance: stats.hasOwnerFinance,
        negativeKeywords: stats.negativeKeywords,
      },
      failedStoredForAnalysis: stats.failedStored,
      message: `Added ${stats.added} properties to agent outreach queue, stored ${stats.failedStored} failed properties for analysis`,
    });

  } catch (error) {
    console.error('❌ [AGENT OUTREACH SCRAPER] Error:', error);
    return NextResponse.json({
      error: error.message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    }, { status: 500 });
  }
}
