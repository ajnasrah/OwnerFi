#!/usr/bin/env npx tsx
/**
 * ONE-TIME BACKFILL: Find owner finance properties missed during the 3-day scraper outage (Feb 11-13)
 *
 * Uses the EXACT same pipeline as the daily scraper:
 *   1. Apify search (maxcopell/zillow-scraper) with doz=7 instead of doz=1
 *   2. Deduplicate against existing properties in Firestore
 *   3. Apify detail scraper (maxcopell/zillow-detail-scraper) for new properties only
 *   4. Transform → Unified Filter → Save to Firestore
 *   5. Index to Typesense
 *   6. Send regional properties to GHL
 *   7. Send cash deal alerts (Abdullah + investor subscribers)
 *
 * Usage: npx tsx scripts/backfill-missed-7-days.ts [--dry-run]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Import the exact same modules the scraper uses
import {
  runUnifiedFilter,
  logFilterResult,
  calculateFilterStats,
  logFilterStats,
  FilterResult,
} from '../src/lib/scraper-v2/unified-filter';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '../src/lib/scraper-v2/property-transformer';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';
import { UnifiedProperty } from '../src/lib/unified-property-schema';
import { sendBatchToGHLWebhook, toGHLPayload } from '../src/lib/scraper-v2/ghl-webhook';
import { sendCashDealAlerts, CashDealAlert } from '../src/lib/abdullah-cash-deal-alert';
import { sendInvestorDealAlerts, InvestorDealInfo } from '../src/lib/investor-deal-alerts';

// =============================================
// SEARCH CONFIG — IDENTICAL to search-config.ts but with doz=7
// =============================================

// Owner Finance Nationwide — doz changed from "1" to "7"
const OWNER_FINANCE_URL_7DAY = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-167.85649363072204%2C%22east%22%3A-11.762743630722056%2C%22south%22%3A-42.37056114607797%2C%22north%22%3A71.96035173654774%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22max%22%3A750000%2C%22min%22%3A0%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22owner%20terms%5C%22%20%2C%20%5C%22seller%20terms%5C%22%20%2C%20%5C%22rent%20to%20own%5C%22%20%2C%20%5C%22lease%20option%5C%22%20%2C%20%5C%22contract%20for%20deed%5C%22%20%2C%20%5C%22land%20contract%5C%22%20%2C%20%5C%22assumable%20loan%5C%22%20%2C%20%5C%22no%20bank%20needed%5C%22%22%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D';

// Cash Deals Regional (AR/TN) — doz changed from "1" to "7"
const CASH_DEALS_URL_7DAY = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-93.00098810736567%2C%22east%22%3A-88.12305841986567%2C%22south%22%3A33.303923989315145%2C%22north%22%3A37.189660587627294%7D%2C%22mapZoom%22%3A9%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22max%22%3A11000000%2C%22min%22%3A0%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%2C%22customRegionId%22%3A%22f6068695e6X1-CRor2wysttztwe_tcbal%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D';

const SEARCH_ACTOR = 'maxcopell/zillow-scraper';
const DETAIL_ACTOR = 'maxcopell/zillow-detail-scraper';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('BACKFILL: Finding missed properties (last 7 days)');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  // ===== STEP 1: RUN SEARCHES (doz=7) =====
  console.log('\n[STEP 1] Running Apify searches (last 7 days)...');

  const searches = [
    { id: 'owner-finance-nationwide', name: 'Owner Finance - Nationwide (7d)', url: OWNER_FINANCE_URL_7DAY, sendToGHL: false },
    { id: 'cash-deals-regional', name: 'Cash Deals - Regional AR/TN (7d)', url: CASH_DEALS_URL_7DAY, sendToGHL: true },
  ];

  const allSearchResults: any[] = [];
  const regionalZpids = new Set<number>();
  const searchByZpid = new Map<string, any>();

  for (const search of searches) {
    console.log(`\n  [SEARCH] ${search.name}`);
    try {
      const run = await apify.actor(SEARCH_ACTOR).call({
        searchUrls: [{ url: search.url }],
        maxResults: 2500,
        mode: 'pagination',
      });
      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      console.log(`  Found: ${items.length} properties`);

      for (const item of items as any[]) {
        allSearchResults.push(item);
        if (item.zpid) searchByZpid.set(String(item.zpid), item);
        if (search.sendToGHL && item.zpid) {
          regionalZpids.add(typeof item.zpid === 'string' ? parseInt(item.zpid, 10) : item.zpid);
        }
      }
    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  console.log(`\n[SEARCH] Total found: ${allSearchResults.length}`);
  console.log(`[REGIONAL] ${regionalZpids.size} from regional search`);

  if (allSearchResults.length === 0) {
    console.log('No properties found. Exiting.');
    return;
  }

  // ===== STEP 2: DEDUPLICATE AGAINST FIRESTORE =====
  console.log('\n[STEP 2] Deduplicating against existing properties...');

  const searchZpids = allSearchResults
    .map((p: any) => p.zpid)
    .filter((z: any) => z !== undefined && z !== null)
    .map((z: any) => (typeof z === 'string' ? parseInt(z, 10) : z));

  const uniqueZpids = [...new Set(searchZpids)];
  console.log(`  Unique ZPIDs from search: ${uniqueZpids.length}`);

  const existingZpids = new Set<number>();
  for (let i = 0; i < uniqueZpids.length; i += 100) {
    const batch = uniqueZpids.slice(i, i + 100);
    if (batch.length === 0) continue;
    const docRefs = batch.map(z => db.collection('properties').doc(`zpid_${z}`));
    const snapshots = await db.getAll(...docRefs);
    snapshots.forEach((snap, idx) => {
      if (snap.exists) existingZpids.add(batch[idx]);
    });
  }

  console.log(`  Already in Firestore: ${existingZpids.size}`);

  const newProperties = allSearchResults.filter((p: any) => {
    const zpid = typeof p.zpid === 'string' ? parseInt(p.zpid, 10) : p.zpid;
    return zpid && !existingZpids.has(zpid);
  });

  console.log(`  NEW properties to process: ${newProperties.length}`);

  if (newProperties.length === 0) {
    console.log('All properties already exist. Nothing to backfill.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would process these new properties:');
    newProperties.slice(0, 20).forEach((p: any) => {
      console.log(`  zpid=${p.zpid} | ${p.address || p.streetAddress || '?'} | $${p.price || '?'}`);
    });
    if (newProperties.length > 20) console.log(`  ... and ${newProperties.length - 20} more`);
    console.log('\nRe-run without --dry-run to save them.');
    return;
  }

  // ===== STEP 3: GET PROPERTY DETAILS =====
  console.log('\n[STEP 3] Fetching property details from Apify...');

  const propertyUrls = newProperties
    .map((p: any) => p.detailUrl || p.url)
    .filter((url: string) => url && url.includes('zillow.com'));

  const MAX_DETAIL_URLS = 2500;
  const urlsToProcess = propertyUrls.slice(0, MAX_DETAIL_URLS);
  console.log(`  URLs to fetch details: ${urlsToProcess.length}`);

  let detailedProperties: any[] = [];

  if (urlsToProcess.length > 0) {
    try {
      const run = await apify.actor(DETAIL_ACTOR).start({
        startUrls: urlsToProcess.map((url: string) => ({ url })),
      });
      const finishedRun = await apify.run(run.id).waitForFinish({ waitSecs: 600 });

      if (finishedRun.status !== 'SUCCEEDED') {
        console.error(`  Detail scraper failed: ${finishedRun.status}, falling back to search results`);
        detailedProperties = newProperties.slice(0, MAX_DETAIL_URLS);
      } else {
        const { items } = await apify.dataset(finishedRun.defaultDatasetId).listItems();
        detailedProperties = items;
        console.log(`  Got ${detailedProperties.length} detailed properties`);
      }
    } catch (err: any) {
      console.error(`  Detail error: ${err.message}, falling back to search results`);
      detailedProperties = newProperties.slice(0, MAX_DETAIL_URLS);
    }
  }

  // Merge images from search results
  let imagesMerged = 0;
  for (const prop of detailedProperties) {
    if (!prop.imgSrc && prop.zpid) {
      const searchItem = searchByZpid.get(String(prop.zpid));
      if (searchItem?.imgSrc) {
        prop.imgSrc = searchItem.imgSrc;
        imagesMerged++;
      }
    }
  }
  console.log(`  Merged ${imagesMerged} images from search results`);

  // ===== STEP 4: TRANSFORM, FILTER, SAVE =====
  console.log('\n[STEP 4] Transform → Filter → Save...');

  const filterResults: FilterResult[] = [];
  const typesenseProperties: UnifiedProperty[] = [];
  const ghlProperties: any[] = [];
  const abdullahCashDeals: CashDealAlert[] = [];
  const investorAlertDeals: InvestorDealInfo[] = [];

  let saved = 0;
  let savedOwnerFinance = 0;
  let savedCashDeal = 0;
  let savedBoth = 0;
  let filteredOut = 0;
  let transformFailed = 0;
  let validationFailed = 0;

  let batch = db.batch();
  let batchCount = 0;

  for (const raw of detailedProperties) {
    try {
      const property = transformProperty(raw, 'scraper-v2', 'unified');

      const validation = validateProperty(property);
      if (!validation.valid) {
        validationFailed++;
        continue;
      }

      const filterResult = runUnifiedFilter(
        property.description,
        property.price,
        property.estimate,
        property.homeType
      );
      filterResults.push(filterResult);
      logFilterResult(property.fullAddress, filterResult, property.price, property.estimate);

      if (!filterResult.shouldSave) {
        filteredOut++;
        continue;
      }

      const zpid = property.zpid;
      const docId = `zpid_${zpid}`;
      const docRef = db.collection('properties').doc(docId);
      const docData = createUnifiedPropertyDoc(property, filterResult);

      const isRegionalProperty = regionalZpids.has(zpid);
      (docData as any).sentToGHL = isRegionalProperty;
      (docData as any).sentToGHLAt = isRegionalProperty ? new Date() : null;
      (docData as any).isRegional = isRegionalProperty;
      (docData as any).source = 'scraper-v2'; // Same source as daily scraper

      batch.set(docRef, docData, { merge: true });
      batchCount++;
      saved++;

      if (filterResult.isOwnerFinance && filterResult.isCashDeal) savedBoth++;
      if (filterResult.isOwnerFinance) savedOwnerFinance++;
      if (filterResult.isCashDeal) savedCashDeal++;

      // Collect for Typesense
      // Use zpid_ prefix to match Cloud Function and admin sync ID format
      typesenseProperties.push({
        id: `zpid_${zpid}`,
        zpid: String(zpid),
        address: property.streetAddress || property.fullAddress || '',
        city: property.city || '',
        state: property.state || '',
        zipCode: property.zipCode || '',
        latitude: property.latitude,
        longitude: property.longitude,
        propertyType: (property.homeType || 'other') as any,
        isLand: filterResult.isLand || false,
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        squareFeet: property.squareFoot,
        yearBuilt: property.yearBuilt,
        listPrice: property.price || 0,
        zestimate: property.estimate,
        dealType: filterResult.isOwnerFinance && filterResult.isCashDeal
          ? 'both'
          : filterResult.isOwnerFinance ? 'owner_finance' : 'cash_deal',
        status: 'active',
        isActive: true,
        nearbyCities: property.nearbyCities || [],
        ownerFinance: filterResult.isOwnerFinance ? {
          verified: true,
          financingType: 'owner_finance' as const,
          primaryKeyword: filterResult.primaryOwnerFinanceKeyword || 'owner financing',
          matchedKeywords: filterResult.ownerFinanceKeywords || [],
          monthlyPayment: (property as any).monthlyPayment,
          downPaymentAmount: (property as any).downPaymentAmount,
        } : undefined,
        cashDeal: filterResult.isCashDeal ? {
          reason: filterResult.cashDealReason || 'discount',
          discountPercent: filterResult.discountPercentage,
          needsWork: filterResult.needsWork,
          needsWorkKeywords: filterResult.needsWorkKeywords,
        } : undefined,
        source: {
          type: 'scraper',
          provider: 'apify',
          importedAt: new Date().toISOString(),
        },
        verification: {
          autoVerified: true,
          manuallyVerified: false,
          needsReview: false,
        },
        images: {
          primary: property.firstPropertyImage || '',
          gallery: property.propertyImages || [],
        },
        description: property.description || '',
        contact: {
          agentName: property.agentName,
          agentPhone: property.agentPhoneNumber,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as UnifiedProperty);

      // Collect for GHL
      if (isRegionalProperty) {
        ghlProperties.push({
          zpid,
          fullAddress: property.fullAddress,
          streetAddress: property.streetAddress,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          price: property.price,
          estimate: property.estimate,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          livingArea: property.squareFoot,
          yearBuilt: property.yearBuilt,
          homeType: property.homeType,
          description: property.description,
          zillowUrl: property.url,
          imgSrc: property.firstPropertyImage,
          firstPropertyImage: property.firstPropertyImage,
        });
      }

      // Collect for Abdullah cash deal alerts
      if (filterResult.isCashDeal && isRegionalProperty && property.price && property.estimate && !filterResult.isLand) {
        abdullahCashDeals.push({
          streetAddress: property.streetAddress || property.fullAddress || '',
          askingPrice: property.price,
          zestimate: property.estimate,
          zillowLink: property.url || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
        });
      }

      // Collect for investor subscriber alerts
      if (property.price && property.estimate && !filterResult.isLand) {
        if (filterResult.isCashDeal) {
          investorAlertDeals.push({
            streetAddress: property.streetAddress || property.fullAddress || '',
            askingPrice: property.price,
            zestimate: property.estimate,
            zpid: String(zpid),
            city: property.city,
            state: property.state,
            zipCode: property.zipCode || '',
          });
        } else if (property.estimate > 0) {
          const pctOfArv = (property.price / property.estimate) * 100;
          if (pctOfArv < 90) {
            investorAlertDeals.push({
              streetAddress: property.streetAddress || property.fullAddress || '',
              askingPrice: property.price,
              zestimate: property.estimate,
              zpid: String(zpid),
              city: property.city,
              state: property.state,
              zipCode: property.zipCode || '',
            });
          }
        }
      }

      // Commit Firestore batch if needed
      if (batchCount >= 400) {
        await batch.commit();
        console.log(`  [BATCH] Committed ${batchCount} to Firestore`);
        batch = db.batch();
        batchCount = 0;
      }
    } catch (err: any) {
      transformFailed++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  [BATCH] Committed final ${batchCount} to Firestore`);
  }

  // ===== STEP 5: INDEX TO TYPESENSE =====
  console.log('\n[STEP 5] Indexing to Typesense...');
  if (typesenseProperties.length > 0) {
    try {
      const result = await indexPropertiesBatch(typesenseProperties, { batchSize: 100 });
      console.log(`  Indexed: ${result.success}, Failed: ${result.failed}`);
    } catch (err: any) {
      console.error(`  Typesense error: ${err.message}`);
    }
  }

  // ===== STEP 6: SEND TO GHL =====
  console.log('\n[STEP 6] Sending regional properties to GHL...');
  if (ghlProperties.length > 0) {
    try {
      const ghlPayloads = ghlProperties.map((p: any) => toGHLPayload(p));
      const result = await sendBatchToGHLWebhook(ghlPayloads, { delayMs: 100 });
      console.log(`  GHL sent: ${result.sent}, Failed: ${result.failed}`);
    } catch (err: any) {
      console.error(`  GHL error: ${err.message}`);
    }
  }

  // ===== STEP 7: SEND ALERTS =====
  console.log('\n[STEP 7] Sending alerts...');
  if (abdullahCashDeals.length > 0) {
    try {
      const result = await sendCashDealAlerts(abdullahCashDeals);
      console.log(`  Abdullah alerts: ${result.sent} sent, ${result.failed} failed`);
    } catch (err: any) {
      console.error(`  Abdullah alert error: ${err.message}`);
    }
  }

  if (investorAlertDeals.length > 0) {
    try {
      const result = await sendInvestorDealAlerts(investorAlertDeals);
      console.log(`  Investor alerts: ${result.totalSent} sent to ${result.subscribersNotified} subscribers`);
    } catch (err: any) {
      console.error(`  Investor alert error: ${err.message}`);
    }
  }

  // ===== SUMMARY =====
  const filterStats = calculateFilterStats(filterResults);
  logFilterStats(filterStats);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL COMPLETE');
  console.log('='.repeat(60));
  console.log(`Duration: ${duration}s`);
  console.log(`Search results: ${allSearchResults.length}`);
  console.log(`Already existed: ${existingZpids.size}`);
  console.log(`New processed: ${detailedProperties.length}`);
  console.log(`Transform failed: ${transformFailed}`);
  console.log(`Validation failed: ${validationFailed}`);
  console.log(`Filtered out: ${filteredOut}`);
  console.log(`Saved: ${saved} (OF: ${savedOwnerFinance}, Cash: ${savedCashDeal}, Both: ${savedBoth})`);
  console.log(`Typesense indexed: ${typesenseProperties.length}`);
  console.log(`GHL sent: ${ghlProperties.length}`);
  console.log(`Cash deal alerts: ${abdullahCashDeals.length}`);
  console.log(`Investor alerts: ${investorAlertDeals.length}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
