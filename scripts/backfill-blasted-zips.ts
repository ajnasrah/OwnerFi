/**
 * Backfill: ingest properties from the targeted-zips one-off GHL blasts
 * into Firestore + Typesense so tomorrow's daily cron dedupes them and
 * doesn't double-send to GHL.
 *
 * Why: the one-off blast script (`test-targeted-zips-blast.ts`) sent
 * properties directly to GHL without running the filter or saving to
 * Firestore. Without this backfill, the daily cron would re-find these
 * properties, process them fresh, and potentially re-send OF-keyword /
 * cash-deal matches to GHL.
 *
 * What it does (mirrors the production pipeline but skips GHL send):
 *   1. Scrapes the 59 targeted zips (same URLs as production config)
 *   2. Filters to the target zips (drops bleed-over from mapBounds)
 *   3. Skips ZPIDs already in Firestore (idempotent)
 *   4. Detail-scrapes the new ones
 *   5. Transforms + validates + runs runUnifiedFilter
 *   6. Saves ALL to Firestore with sentToGHL=true, sentToGHLAt=now
 *      (even if filter failed — so cron dedupe still catches them)
 *   7. Indexes filter-passing ones to Typesense
 *   8. Does NOT send to GHL, Abdullah SMS, or investor alerts
 *
 * Usage:
 *   npx tsx scripts/backfill-blasted-zips.ts --dry-run
 *   npx tsx scripts/backfill-blasted-zips.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runSearchScraper, runDetailScraper } from '../src/lib/scraper-v2/apify-client';
import {
  TARGETED_CASH_ZIPS,
  buildZipSearchUrl,
} from '../src/lib/scraper-v2/search-config';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '../src/lib/scraper-v2/property-transformer';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';
import { UnifiedProperty } from '../src/lib/unified-property-schema';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('='.repeat(60));
  console.log('BACKFILL BLASTED ZIPS — ingest into Firestore');
  console.log('='.repeat(60));
  console.log(`Zips: ${TARGETED_CASH_ZIPS.length}`);
  console.log(`Dry run: ${DRY_RUN}`);

  const { db } = getFirebaseAdmin();

  // 1. Scrape 59 zips
  const urls = TARGETED_CASH_ZIPS.map(z => buildZipSearchUrl(z));
  console.log(`\n[APIFY] Scraping ${urls.length} zip URLs...`);
  const rawResults = await runSearchScraper(urls, { maxResults: 2500, mode: 'pagination' });
  console.log(`[APIFY] Total results: ${rawResults.length}`);

  // 2. Restrict to target zips
  const allowed = new Set(TARGETED_CASH_ZIPS);
  const inZips = rawResults.filter(p => {
    const z = String((p as any).zipcode ?? (p as any).addressZipcode ?? '');
    return z && allowed.has(z);
  });
  console.log(`[ZIP FILTER] In target zips: ${inZips.length}`);

  // 3. Dedupe by zpid
  const byZpid = new Map<number, typeof inZips[number]>();
  for (const r of inZips) {
    const zpid = typeof r.zpid === 'string' ? parseInt(r.zpid, 10) : r.zpid;
    if (zpid && !byZpid.has(zpid)) byZpid.set(zpid, r);
  }
  console.log(`[DEDUPE] Unique zpids: ${byZpid.size}`);

  // 4. Skip zpids already in Firestore (idempotent)
  const allZpids = Array.from(byZpid.keys());
  const existing = new Set<number>();
  for (let i = 0; i < allZpids.length; i += 100) {
    const batch = allZpids.slice(i, i + 100);
    const refs = batch.map(z => db.collection('properties').doc(`zpid_${z}`));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s, idx) => { if (s.exists) existing.add(batch[idx]); });
  }
  console.log(`[FIRESTORE] Already in DB: ${existing.size}`);

  const newZpids = allZpids.filter(z => !existing.has(z));
  console.log(`[FIRESTORE] New to ingest: ${newZpids.length}`);

  if (newZpids.length === 0) {
    console.log('\nNothing to backfill. Done.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would detail-scrape + save ${newZpids.length} properties.`);
    return;
  }

  // 5. Detail scrape
  const searchByZpid = new Map<string, any>();
  inZips.forEach(p => { if (p.zpid) searchByZpid.set(String(p.zpid), p); });

  const detailUrls = newZpids
    .map(z => searchByZpid.get(String(z)))
    .map(p => p?.detailUrl || p?.url)
    .filter((u): u is string => !!u && u.includes('zillow.com'));

  console.log(`\n[APIFY] Detail-scraping ${detailUrls.length} URLs...`);
  let details = await runDetailScraper(detailUrls, { timeoutSecs: 300 });
  console.log(`[APIFY] Got ${details.length} detailed properties`);

  // Merge images from search results
  for (const d of details) {
    if (!d.imgSrc && d.zpid) {
      const s = searchByZpid.get(String(d.zpid));
      if (s?.imgSrc) d.imgSrc = s.imgSrc;
    }
  }

  // 6. Transform + filter + save
  let batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 400;
  const typesenseProps: UnifiedProperty[] = [];
  const metrics = { saved: 0, filterPassed: 0, filterFailed: 0, validationFailed: 0 };

  for (const raw of details) {
    try {
      const property = transformProperty(raw, 'backfill-blast', 'unified');
      const validation = validateProperty(property);
      if (!validation.valid) {
        metrics.validationFailed++;
        continue;
      }

      const filterResult = runUnifiedFilter(
        property.description,
        property.price,
        property.estimate,
        property.homeType,
        {
          isAuction: property.isAuction,
          isForeclosure: property.isForeclosure,
          isBankOwned: property.isBankOwned,
        }
      );

      const zpid = property.zpid;
      const docId = `zpid_${zpid}`;
      const docRef = db.collection('properties').doc(docId);

      // Save regardless of filter result — we need dedupe to catch them
      // tomorrow. If filter failed, property is in DB but not flagged as
      // OF/cash-deal (won't appear in investor feeds).
      const docData = createUnifiedPropertyDoc(property, filterResult);
      (docData as any).sentToGHL = true;
      (docData as any).sentToGHLAt = new Date();
      (docData as any).isRegional = true;
      (docData as any).backfillSource = 'one-off-blast';

      batch.set(docRef, docData, { merge: true });
      batchCount++;
      metrics.saved++;

      if (filterResult.shouldSave) {
        metrics.filterPassed++;
        typesenseProps.push({
          id: docId,
          zpid: String(zpid),
          address: property.streetAddress || property.fullAddress || '',
          city: property.city || '',
          state: property.state || '',
          zipCode: property.zipCode || '',
          latitude: property.latitude,
          longitude: property.longitude,
          propertyType: (property.homeType || 'other') as any,
          isLand: filterResult.isLand || false,
          isAuction: property.isAuction || false,
          isForeclosure: property.isForeclosure || false,
          isBankOwned: property.isBankOwned || false,
          listingSubType: property.listingSubType || '',
          bedrooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
          squareFeet: property.squareFoot,
          yearBuilt: property.yearBuilt,
          listPrice: property.price || 0,
          zestimate: property.estimate,
          dealType: filterResult.isOwnerfinance && filterResult.isCashDeal
            ? 'both'
            : filterResult.isOwnerfinance ? 'owner_finance' : 'cash_deal',
          // Respect Zillow homeStatus — only index if actively for sale
          status: property.homeStatus?.toUpperCase?.() === 'FOR_SALE' ? 'active' : 'inactive',
          isActive: property.homeStatus?.toUpperCase?.() === 'FOR_SALE',
          nearbyCities: property.nearbyCities || [],
          ownerFinance: filterResult.isOwnerfinance ? {
            verified: true,
            financingType: 'owner_finance' as const,
            primaryKeyword: filterResult.primaryOwnerfinanceKeyword || 'owner financing',
            matchedKeywords: filterResult.ownerFinanceKeywords || [],
          } : undefined,
          cashDeal: filterResult.isCashDeal ? {
            reason: filterResult.cashDealReason || 'discount',
            discountPercent: filterResult.discountPercentage,
            needsWork: filterResult.needsWork,
            needsWorkKeywords: filterResult.needsWorkKeywords,
          } : undefined,
          source: { type: 'scraper', provider: 'apify', importedAt: new Date().toISOString() },
          verification: { autoVerified: true, manuallyVerified: false, needsReview: false },
          images: { primary: property.firstPropertyImage || '', gallery: property.propertyImages || [] },
          description: property.description || '',
          contact: { agentName: property.agentName, agentPhone: property.agentPhoneNumber },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as UnifiedProperty);
      } else {
        metrics.filterFailed++;
      }

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`[BATCH] Committed ${batchCount}`);
        batch = db.batch();
        batchCount = 0;
      }
    } catch (err: any) {
      console.error(`[ERROR] ${raw.zpid}: ${err.message}`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`[BATCH] Final commit: ${batchCount}`);
  }

  // 7. Index filter-passing to Typesense
  if (typesenseProps.length > 0) {
    console.log(`\n[TYPESENSE] Indexing ${typesenseProps.length} properties...`);
    const ts = await indexPropertiesBatch(typesenseProps, { batchSize: 100 });
    console.log(`[TYPESENSE] Success: ${ts.success}, Failed: ${ts.failed}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`[DONE] Saved: ${metrics.saved}, Filter pass: ${metrics.filterPassed}, Filter fail: ${metrics.filterFailed}, Invalid: ${metrics.validationFailed}`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
