#!/usr/bin/env npx tsx
/**
 * ONE-TIME BACKFILL: Import all active properties from custom regional search
 * Region: Wider AR/TN/MS area, <$300K, single family only
 *
 * Uses the EXACT same pipeline as the daily scraper:
 *   1. Apify search (maxcopell/zillow-scraper)
 *   2. Deduplicate against existing properties in Firestore
 *   3. Apify detail scraper (maxcopell/zillow-detail-scraper) for new properties only
 *   4. Transform → Unified Filter → Save to Firestore
 *   5. Index to Typesense
 *   6. Send cash deal alerts
 *
 * Usage: npx tsx scripts/backfill-regional-v2.ts [--dry-run]
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
import { sendCashDealAlerts, CashDealAlert } from '../src/lib/abdullah-cash-deal-alert';
import { sendInvestorDealAlerts, InvestorDealInfo } from '../src/lib/investor-deal-alerts';

// User's custom regional search URL: wider AR/TN/MS, <$300K, single family only
const SEARCH_URL = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-95.09388361517817%2C%22east%22%3A-86.03016291205317%2C%22south%22%3A29.642489219132873%2C%22north%22%3A40.532398383186695%7D%2C%22mapZoom%22%3A7%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22customRegionId%22%3A%22982d669a94X1-CR1xukwe2r25ifv_17b6s0%22%7D';

const SEARCH_ACTOR = 'maxcopell/zillow-scraper';
const DETAIL_ACTOR = 'maxcopell/zillow-detail-scraper';
const DETAIL_BATCH_SIZE = 100;

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('BACKFILL: Regional properties (<$300K, SFR, 1930+)');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  // ===== STEP 1: RUN SEARCH =====
  console.log('\n[STEP 1] Running Apify search...');

  const run = await apify.actor(SEARCH_ACTOR).call({
    searchUrls: [{ url: SEARCH_URL }],
    maxResults: 10000,
    mode: 'pagination',
  }, { waitSecs: 900 });

  const { items: allSearchResults } = await apify.dataset(run.defaultDatasetId).listItems();
  console.log(`  Found: ${allSearchResults.length} properties on Zillow`);

  const searchByZpid = new Map<string, any>();
  for (const item of allSearchResults as any[]) {
    if (item.zpid) searchByZpid.set(String(item.zpid), item);
  }

  if (allSearchResults.length === 0) {
    console.log('No properties found. Exiting.');
    return;
  }

  // ===== STEP 2: DEDUPLICATE AGAINST FIRESTORE =====
  console.log('\n[STEP 2] Deduplicating against existing properties...');

  const searchZpids = (allSearchResults as any[])
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
    if (i % 500 === 0 && i > 0) console.log(`    Checked ${i}/${uniqueZpids.length}...`);
  }

  console.log(`  Already in Firestore: ${existingZpids.size}`);

  const newProperties = (allSearchResults as any[]).filter((p: any) => {
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

  // ===== STEP 3: GET PROPERTY DETAILS (in batches) =====
  console.log('\n[STEP 3] Fetching property details from Apify...');

  const propertyUrls = newProperties
    .map((p: any) => p.detailUrl || p.url)
    .filter((url: string) => url && url.includes('zillow.com'));

  console.log(`  URLs to fetch details: ${propertyUrls.length}`);

  let detailedProperties: any[] = [];

  // Process in batches of 100 to avoid timeouts
  for (let i = 0; i < propertyUrls.length; i += DETAIL_BATCH_SIZE) {
    const batchUrls = propertyUrls.slice(i, i + DETAIL_BATCH_SIZE);
    const batchNum = Math.floor(i / DETAIL_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(propertyUrls.length / DETAIL_BATCH_SIZE);
    console.log(`  [BATCH ${batchNum}/${totalBatches}] Fetching ${batchUrls.length} properties...`);

    try {
      const detailRun = await apify.actor(DETAIL_ACTOR).start({
        startUrls: batchUrls.map((url: string) => ({ url })),
      });
      const finishedRun = await apify.run(detailRun.id).waitForFinish({ waitSecs: 300 });

      if (finishedRun.status !== 'SUCCEEDED') {
        console.error(`    Batch ${batchNum} failed: ${finishedRun.status}`);
        continue;
      }

      const { items } = await apify.dataset(finishedRun.defaultDatasetId).listItems();
      console.log(`    Got ${items.length} detailed properties`);
      detailedProperties.push(...items);
    } catch (err: any) {
      console.error(`    Batch ${batchNum} error: ${err.message}`);
    }
  }

  console.log(`  Total detailed properties: ${detailedProperties.length}`);

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
  const abdullahCashDeals: CashDealAlert[] = [];
  const investorAlertDeals: InvestorDealInfo[] = [];

  let saved = 0;
  let savedOwnerFinance = 0;
  let savedCashDeal = 0;
  let savedBoth = 0;
  let filteredOut = 0;
  let transformFailed = 0;
  let validationFailed = 0;
  let pre1930Skipped = 0;

  let batch = db.batch();
  let batchCount = 0;

  for (const raw of detailedProperties) {
    try {
      const property = transformProperty(raw, 'scraper-v2', 'backfill-regional');

      // Skip pre-1930 properties
      if (property.yearBuilt > 0 && property.yearBuilt < 1930) {
        pre1930Skipped++;
        continue;
      }

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

      // For backfill: save ALL properties (not just ones passing filters)
      // This ensures we have the full regional inventory
      const zpid = property.zpid;
      const docId = `zpid_${zpid}`;
      const docRef = db.collection('properties').doc(docId);
      const docData = createUnifiedPropertyDoc(property, filterResult);

      // Mark as regional, from backfill
      (docData as any).isRegional = true;
      (docData as any).sentToGHL = false;
      (docData as any).sentToGHLAt = null;
      (docData as any).backfilledAt = new Date();
      (docData as any).source = 'scraper-v2';

      batch.set(docRef, docData, { merge: true });
      batchCount++;
      saved++;

      if (filterResult.isOwnerFinance && filterResult.isCashDeal) savedBoth++;
      else if (filterResult.isOwnerFinance) savedOwnerFinance++;
      else if (filterResult.isCashDeal) savedCashDeal++;

      // Collect for Typesense
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

      // Collect for cash deal alerts
      if (filterResult.isCashDeal && property.price && property.estimate && !filterResult.isLand && !filterResult.suspiciousDiscount) {
        abdullahCashDeals.push({
          streetAddress: property.streetAddress || property.fullAddress || '',
          askingPrice: property.price,
          zestimate: property.estimate,
          zillowLink: property.url || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
        });
      }

      // Collect for investor alerts
      if (property.price && property.estimate && !filterResult.isLand && !filterResult.suspiciousDiscount) {
        if (filterResult.isCashDeal || (property.estimate > 0 && (property.price / property.estimate) * 100 < 90)) {
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

      // Commit Firestore batch
      if (batchCount >= 400) {
        await batch.commit();
        console.log(`  [BATCH] Committed ${batchCount} to Firestore (total saved: ${saved})`);
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

  // ===== STEP 6: SEND ALERTS =====
  console.log('\n[STEP 6] Sending alerts...');
  if (abdullahCashDeals.length > 0) {
    try {
      const result = await sendCashDealAlerts(abdullahCashDeals);
      console.log(`  Abdullah alerts: ${result.sent} sent, ${result.failed} failed`);
    } catch (err: any) {
      console.error(`  Abdullah alert error: ${err.message}`);
    }
  } else {
    console.log('  No cash deal alerts to send');
  }

  if (investorAlertDeals.length > 0) {
    try {
      const result = await sendInvestorDealAlerts(investorAlertDeals);
      console.log(`  Investor alerts: ${result.totalSent} sent to ${result.subscribersNotified} subscribers`);
    } catch (err: any) {
      console.error(`  Investor alert error: ${err.message}`);
    }
  } else {
    console.log('  No investor alerts to send');
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
  console.log(`New URLs fetched: ${propertyUrls.length}`);
  console.log(`Details returned: ${detailedProperties.length}`);
  console.log(`Pre-1930 skipped: ${pre1930Skipped}`);
  console.log(`Transform failed: ${transformFailed}`);
  console.log(`Validation failed: ${validationFailed}`);
  console.log(`Filtered out (no deal type): ${filteredOut}`);
  console.log(`SAVED: ${saved}`);
  console.log(`  Owner Finance: ${savedOwnerFinance}`);
  console.log(`  Cash Deal: ${savedCashDeal}`);
  console.log(`  Both: ${savedBoth}`);
  console.log(`Typesense indexed: ${typesenseProperties.length}`);
  console.log(`Cash deal alerts: ${abdullahCashDeals.length}`);
  console.log(`Investor alerts: ${investorAlertDeals.length}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
