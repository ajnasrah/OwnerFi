import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '@/lib/negative-keywords';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { TARGETED_CASH_ZIPS, buildAgentOutreachZipUrl } from '@/lib/scraper-v2/search-config';

export const maxDuration = 600;

/**
 * AGENT OUTREACH SCRAPER
 *
 * Finds properties WITHOUT owner financing keywords to ask agents about.
 *
 * Fans out across the 59 TARGETED_CASH_ZIPS (Memphis/Birmingham/Huntsville/
 * Indianapolis/Louisville/Dayton/Montgomery/Akron) — one Zillow URL per
 * zip, all issued to Apify in a single run. doz=1 → only listings posted
 * in the last 24h. Filters: $50k–$500k, multi-family INCLUDED, no land/
 * NC/auction/foreclosure/apartment/manufactured/55+.
 */

const SEARCH_CONFIG = {
  // Apify `maxResults` applies per searchUrl for maxcopell/zillow-scraper —
  // keep per-zip low since doz=1 + narrow zip rarely exceeds a handful.
  maxResultsPerZip: 50,
  mode: 'pagination' as const,
  detailBatchSize: 200,
};

const SEARCH_URLS = TARGETED_CASH_ZIPS.map(zip =>
  buildAgentOutreachZipUrl(zip, { dozDays: 1 })
);

const MAX_RUNTIME_MS = 570_000; // 9.5 minutes — buffer for 10min Vercel limit

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { db } = getFirebaseAdmin();

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [AGENT OUTREACH SCRAPER] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use cron lock to prevent concurrent execution (Apify costs $$$)
  const result = await withCronLock('run-agent-outreach-scraper', async () => {
    console.log('🏡 [AGENT OUTREACH SCRAPER] Starting at', new Date().toISOString());

    await db.collection('cron_logs').add({
      cron: 'run-agent-outreach-scraper',
      status: 'started',
      timestamp: new Date(),
    });

    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) throw new Error('APIFY_API_KEY not found');

    const client = new ApifyClient({ token: apiKey });

    // STEP 1: Run SEARCH scraper across all 59 targeted zips
    console.log(`🔍 Step 1: Search scraper across ${SEARCH_URLS.length} zips (mode: ${SEARCH_CONFIG.mode}, max ${SEARCH_CONFIG.maxResultsPerZip}/zip)...`);
    const searchRun = await client.actor('maxcopell/zillow-scraper').call({
      searchUrls: SEARCH_URLS.map(url => ({ url })),
      maxResults: SEARCH_CONFIG.maxResultsPerZip * SEARCH_URLS.length,
      mode: SEARCH_CONFIG.mode,
    });
    const { items: searchItems } = await client.dataset(searchRun.defaultDatasetId).listItems();
    console.log(`   Found ${searchItems.length} properties from search`);

    // Timeout check after Apify call
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      throw new Error('Timeout after search scraper — aborting before detail scrape');
    }

    // Get URLs and ZPIDs from search results. Zillow mapBounds bleed into
    // neighbor zips — drop anything whose addressZipcode isn't one of ours
    // BEFORE paying for the detail scrape (search has zipcode + homeType).
    const targetZipSet = new Set(TARGETED_CASH_ZIPS);
    const propertyData: { url: string; zpid: string }[] = [];
    let bboxBleedDropped = 0;

    for (const item of searchItems as any[]) {
      const url = item.detailUrl;
      const zpid = String(item.zpid || '');
      const zipcode = String(item.addressZipcode || item.zipcode || item.hdpData?.homeInfo?.zipcode || '');
      if (!url || !zpid || !url.includes('zillow.com')) continue;
      if (!targetZipSet.has(zipcode)) { bboxBleedDropped++; continue; }
      propertyData.push({ url, zpid });
    }
    console.log(`   After zip prefilter: ${propertyData.length} kept, ${bboxBleedDropped} dropped (bbox bleed)`);

    // Check existing ZPIDs using document ID lookups (efficient, no full collection scan)
    console.log(`📊 Checking for existing ZPIDs...`);
    const existingZpids = new Set<string>();

    // Batch check agent_outreach_queue by zpid field (in batches of 10 for Firestore 'in' limit)
    const allZpids = propertyData.map(p => p.zpid);
    for (let i = 0; i < allZpids.length; i += 10) {
      const batch = allZpids.slice(i, i + 10);
      if (batch.length === 0) continue;

      const [queueSnap, propsSnap] = await Promise.all([
        db.collection('agent_outreach_queue').where('zpid', 'in', batch).select().get(),
        db.collection('properties').where('zpid', 'in', batch).select().get(),
      ]);

      queueSnap.docs.forEach(doc => existingZpids.add(doc.data().zpid || doc.id));
      propsSnap.docs.forEach(doc => existingZpids.add(String(doc.data().zpid)));
    }

    console.log(`   Existing ZPIDs in system: ${existingZpids.size}`);

    // Filter to only NEW properties
    const newProperties = propertyData.filter(p => !existingZpids.has(p.zpid));
    const urlsToScrape = newProperties.slice(0, SEARCH_CONFIG.detailBatchSize).map(p => p.url);

    console.log(`   New properties to scrape: ${urlsToScrape.length}`);

    if (urlsToScrape.length === 0) {
      return {
        success: true,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        propertiesFound: searchItems.length,
        addedToQueue: 0,
        message: 'No new properties found - all already in system',
      };
    }

    // Timeout check before second Apify call
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      throw new Error('Timeout before detail scraper — aborting');
    }

    // STEP 2: Run DETAIL scraper to get agent contact info
    console.log(`🔍 Step 2: Detail scraper (${urlsToScrape.length} URLs)...`);
    const detailRun = await client.actor('maxcopell/zillow-detail-scraper').call({
      startUrls: urlsToScrape.map(url => ({ url })),
    });
    const { items: detailItems } = await client.dataset(detailRun.defaultDatasetId).listItems();
    console.log(`   Got ${detailItems.length} detailed properties`);

    // MERGE: Copy images from search results to detail results
    const searchByZpid = new Map<string, any>();
    for (const item of searchItems as any[]) {
      if (item.zpid) searchByZpid.set(String(item.zpid), item);
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
      potentialOwnerfinance: 0,
      noAgent: 0,
      hasOwnerfinance: 0,
      negativeKeywords: 0,
      outsideTargetZips: 0,
    };

    let batch = db.batch();
    let batchCount = 0;

    for (const item of detailItems) {
      // Timeout check during processing
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏰ Approaching timeout, committing current batch and stopping');
        break;
      }

      const property = item as any;

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

      // FILTER 1b: Validate phone number format
      if (!isValidPhone(agentPhone)) {
        stats.noAgent++;
        continue;
      }

      // FILTER 2: Check keywords
      const description = property.description || '';
      const streetAddr = property.streetAddress || property.address?.streetAddress || '';
      const city = property.city || property.address?.city || '';
      const state = property.state || property.address?.state || '';

      const ownerFinanceResult = hasStrictOwnerfinancing(description);
      const negativeResult = hasNegativeKeywords(description);

      if (ownerFinanceResult.passes) {
        stats.hasOwnerfinance++;
        continue;
      }

      if (negativeResult.hasNegative) {
        stats.negativeKeywords++;
        continue;
      }

      // Extract remaining property data
      const zipCode = property.zipcode || property.address?.zipcode || '';
      const price = property.price || 0;
      const zestimate = property.zestimate || 0;

      // Zillow bboxes can bleed into neighbor zips — enforce strict zip membership
      if (!zipCode || !TARGETED_CASH_ZIPS.includes(zipCode)) {
        stats.outsideTargetZips++;
        continue;
      }

      // Classify deal type
      let dealType: 'cash_deal' | 'potential_owner_finance' = 'potential_owner_finance';
      if (zestimate > 0 && price > 0 && (price / zestimate) < 0.80) {
        dealType = 'cash_deal';
        stats.cashDeals++;
      } else {
        stats.potentialOwnerfinance++;
      }

      const agentName = property.attributionInfo?.agentName
        || property.agentName
        || property.contactRecipients?.[0]?.displayName
        || 'Agent';

      const phoneNormalized = normalizePhone(agentPhone);
      const addressNormalized = streetAddr.toLowerCase().trim()
        .replace(/[#,\.]/g, '').replace(/\s+/g, ' ');

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
        imgSrc: property.imgSrc || null,
        phoneNormalized,
        addressNormalized,
        dealType,
        status: 'pending',
        source: 'agent_outreach_scraper',
        addedAt: new Date(),
      });

      batchCount++;
      stats.added++;

      if (batchCount >= 50) {
        try {
          await batch.commit();
          console.log(`   Committed batch of ${batchCount}`);
        } catch (batchErr: unknown) {
          const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
          console.error(`   ❌ Batch commit failed: ${msg}`);
        }
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      try {
        await batch.commit();
        console.log(`   Committed final batch of ${batchCount}`);
      } catch (batchErr: unknown) {
        const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
        console.error(`   ❌ Final batch commit failed: ${msg}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [AGENT OUTREACH SCRAPER] Complete in ${duration}s`);
    console.log(`   Properties from search: ${searchItems.length}`);
    console.log(`   Properties detailed: ${stats.total}`);
    console.log(`   Added to queue: ${stats.added}`);
    console.log(`   - Cash deals: ${stats.cashDeals}`);
    console.log(`   - Potential OF: ${stats.potentialOwnerfinance}`);
    console.log(`   Skipped:`);
    console.log(`   - No agent: ${stats.noAgent}`);
    console.log(`   - Has OF keywords: ${stats.hasOwnerfinance}`);
    console.log(`   - Negative keywords: ${stats.negativeKeywords}`);
    console.log(`   - Outside target zips: ${stats.outsideTargetZips}`);

    await db.collection('cron_logs').add({
      cron: 'run-agent-outreach-scraper',
      status: 'completed',
      duration: `${duration}s`,
      propertiesFromSearch: searchItems.length,
      propertiesDetailed: stats.total,
      addedToQueue: stats.added,
      stats: { cashDeals: stats.cashDeals, potentialOwnerfinance: stats.potentialOwnerfinance },
      skipped: { noAgent: stats.noAgent, hasOwnerfinance: stats.hasOwnerfinance, negativeKeywords: stats.negativeKeywords, outsideTargetZips: stats.outsideTargetZips },
      timestamp: new Date(),
    });

    return {
      success: true,
      duration: `${duration}s`,
      propertiesFound: stats.total,
      addedToQueue: stats.added,
      stats: { cashDeals: stats.cashDeals, potentialOwnerfinance: stats.potentialOwnerfinance },
      skipped: { noAgent: stats.noAgent, hasOwnerfinance: stats.hasOwnerfinance, negativeKeywords: stats.negativeKeywords, outsideTargetZips: stats.outsideTargetZips },
      message: `Added ${stats.added} properties to agent outreach queue`,
    };
  });

  // Lock not acquired
  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true,
    }, { status: 200 });
  }

  return NextResponse.json(result);
}
