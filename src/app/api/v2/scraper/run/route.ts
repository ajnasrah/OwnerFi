/**
 * Unified Scraper v2 - Main Cron Endpoint
 *
 * SCHEDULE: Daily at 9 PM
 *
 * TWO SEARCHES:
 * 1. Owner Finance (Nationwide) - keyword filtered
 * 2. Cash Deals (Regional AR/TN) - price/condition filtered
 *
 * ALL properties from BOTH searches:
 * - Run through BOTH filters (owner finance + cash deal)
 * - Save to SINGLE 'properties' collection with dealTypes array
 * - dealTypes: ['owner_finance', 'cash_deal'] - can have one or both
 *
 * COLLECTION: 'properties' (unified)
 * - Document ID: zpid_${zpid}
 * - isOwnerfinance: boolean
 * - isCashDeal: boolean
 * - dealTypes: string[]
 *
 * GHL WEBHOOK: ENABLED for regional properties
 * - All regional (AR/TN) properties are sent to GHL to find more owner finance deals
 * - Tracks sentToGHL field to avoid duplicate sends
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { runSearchScraper, runDetailScraper, type ScrapedProperty } from '@/lib/scraper-v2/apify-client';
import { SEARCH_CONFIGS, SAFETY_LIMITS } from '@/lib/scraper-v2/search-config';
import {
  runUnifiedFilter,
  logFilterResult,
  calculateFilterStats,
  logFilterStats,
  FilterResult,
} from '@/lib/scraper-v2/unified-filter';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '@/lib/scraper-v2/property-transformer';
import { withScraperLock } from '@/lib/scraper-v2/cron-lock';
import { indexPropertiesBatch } from '@/lib/typesense/sync';
import { UnifiedProperty } from '@/lib/unified-property-schema';
import { sendBatchToGHLWebhook, toGHLPayload } from '@/lib/scraper-v2/ghl-webhook';
import { alertSystemError } from '@/lib/error-monitoring';
import { sendCashDealAlerts, CashDealAlert } from '@/lib/abdullah-cash-deal-alert';
import { sendInvestorDealAlerts, InvestorDealInfo } from '@/lib/investor-deal-alerts';

// Allow long-running requests (Vercel)
export const maxDuration = 600; // 10 minutes

interface ScraperMetrics {
  startTime: number;
  searchesRun: number;
  totalPropertiesFound: number;
  propertiesBySearch: Record<string, number>;
  transformSucceeded: number;
  transformFailed: number;
  validationFailed: number;
  duplicatesSkipped: number;
  // Unified collection metrics
  savedToProperties: number;
  savedAsOwnerfinance: number;
  savedAsCashDeal: number;
  savedAsBoth: number;
  filteredOut: number;
  indexedToTypesense: number;
  typesenseFailed: number;
  sentToGHL: number;
  ghlFailed: number;
  errors: Array<{ zpid?: number; address?: string; error: string; stage: string }>;
}

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use lock to prevent concurrent execution
  const lockResult = await withScraperLock('unified-scraper-v2', async () => {
    return runUnifiedScraper();
  });

  if (lockResult.locked) {
    const message = lockResult.error
      ? `Lock system error: ${lockResult.error}`
      : 'Another scraper instance is currently running';

    return NextResponse.json({
      success: false,
      skipped: true,
      message,
      error: lockResult.error,
    }, { status: lockResult.error ? 503 : 200 });
  }

  const { result } = lockResult;

  if (result.success) {
    return NextResponse.json(result);
  } else {
    return NextResponse.json(result, { status: 500 });
  }
}

async function runUnifiedScraper(): Promise<{
  success: boolean;
  duration: string;
  metrics: ScraperMetrics;
  message: string;
  error?: string;
}> {
  const metrics: ScraperMetrics = {
    startTime: Date.now(),
    searchesRun: 0,
    totalPropertiesFound: 0,
    propertiesBySearch: {},
    transformSucceeded: 0,
    transformFailed: 0,
    validationFailed: 0,
    duplicatesSkipped: 0,
    // Unified collection metrics
    savedToProperties: 0,
    savedAsOwnerfinance: 0,
    savedAsCashDeal: 0,
    savedAsBoth: 0,
    filteredOut: 0,
    indexedToTypesense: 0,
    typesenseFailed: 0,
    sentToGHL: 0,
    ghlFailed: 0,
    errors: [],
  };

  // Collect properties for Typesense indexing
  const typesenseProperties: UnifiedProperty[] = [];

  // Collect properties for GHL webhook (regional properties)
  const ghlProperties: Array<{
    zpid: number;
    fullAddress?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    price?: number;
    estimate?: number;
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    yearBuilt?: number;
    homeType?: string;
    description?: string;
    zillowUrl?: string;
    imgSrc?: string;
    firstPropertyImage?: string;
  }> = [];

  // Collect cash deals under 80% for Abdullah's SMS alerts
  const abdullahCashDeals: CashDealAlert[] = [];

  // Collect deals for investor subscriber alerts (nationwide, up to 90% ARV)
  const investorAlertDeals: InvestorDealInfo[] = [];

  // Collect owner finance properties for buyer notifications
  const ownerFinancePropertiesForNotification: Array<{
    id: string;
    address: string;
    city: string;
    state: string;
    bedrooms: number;
    bathrooms: number;
    listPrice: number;
    monthlyPayment?: number;
    downPaymentAmount?: number;
  }> = [];

  try {
    console.log('\n' + '='.repeat(60));
    console.log('UNIFIED SCRAPER v2 - STARTING');
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Searches to run: ${SEARCH_CONFIGS.length}`);

    // Get Firebase
    const { db } = getFirebaseAdmin();

    // ===== STEP 1: RUN SEARCHES =====
    console.log('\n[STEP 1] Running Apify searches...');

    // Track properties by search for GHL routing
    const propertiesBySearchId: Map<string, ScrapedProperty[]> = new Map();
    const allProperties: ScrapedProperty[] = [];

    for (const config of SEARCH_CONFIGS) {
      const configUrls = config.urls ?? [config.url];
      console.log(`\n[SEARCH] ${config.name}`);
      console.log(`  URLs: ${configUrls.length} (first: ${configUrls[0].substring(0, 80)}...)`);
      console.log(`  Max items: ${config.maxItems}`);
      console.log(`  Send to GHL: ${config.sendToGHL}`);

      try {
        // Run search scraper (api-ninja accepts multiple searchUrls in one run)
        let searchResults = await runSearchScraper(configUrls, {
          maxResults: config.maxItems,
          mode: 'pagination',
        });

        console.log(`  Found: ${searchResults.length} properties`);

        // Apply zip filter if configured (for per-zip searches where Zillow
        // mapBounds bleed into neighboring zips).
        if (config.zipFilter && config.zipFilter.length > 0) {
          const allowedZips = new Set(config.zipFilter);
          const before = searchResults.length;
          searchResults = searchResults.filter(p => {
            const zip = (p as any).zipcode || (p as any).addressZipcode;
            return zip && allowedZips.has(String(zip));
          });
          console.log(`  After zip filter: ${searchResults.length} (dropped ${before - searchResults.length})`);
        }

        metrics.propertiesBySearch[config.id] = searchResults.length;

        // Store for GHL routing
        propertiesBySearchId.set(config.id, searchResults);
        allProperties.push(...searchResults);
        metrics.searchesRun++;
      } catch (searchError: any) {
        console.error(`  ERROR: ${searchError.message}`);
        metrics.errors.push({ error: searchError.message, stage: `search-${config.id}` });
      }
    }

    metrics.totalPropertiesFound = allProperties.length;
    console.log(`\n[SEARCH] Total properties found: ${allProperties.length}`);

    // Track which ZPIDs came from GHL-routed searches (regional AR/TN +
    // targeted-zips). These flow through the GHL webhook + Abdullah SMS.
    const regionalZpids = new Set<number>();
    for (const config of SEARCH_CONFIGS) {
      if (!config.sendToGHL) continue;
      const configProps = propertiesBySearchId.get(config.id) || [];
      configProps.forEach(p => {
        if (p.zpid) regionalZpids.add(typeof p.zpid === 'string' ? parseInt(p.zpid, 10) : p.zpid);
      });
    }
    console.log(`[REGIONAL] ${regionalZpids.size} properties from GHL-routed searches (will send to GHL)`);

    if (allProperties.length === 0) {
      return {
        success: true,
        duration: getDuration(metrics.startTime),
        metrics,
        message: 'No properties found in any search',
      };
    }

    // Safety check
    if (allProperties.length > SAFETY_LIMITS.maxTotalItems) {
      console.error(`[SAFETY] Found ${allProperties.length} properties, exceeds limit ${SAFETY_LIMITS.maxTotalItems}`);
      return {
        success: false,
        duration: getDuration(metrics.startTime),
        metrics,
        message: 'Safety limit exceeded',
        error: `Found ${allProperties.length} properties, exceeds safety limit`,
      };
    }

    // ===== STEP 2: CHECK DUPLICATES FIRST (before expensive detail scraping) =====
    // This saves Apify credits by not fetching details for properties we already have
    console.log('\n[STEP 2] Checking for duplicates BEFORE detail scraping...');

    // Build map of search results by ZPID for later image merging
    const searchByZpid = new Map<string, any>();
    for (const item of allProperties) {
      if (item.zpid) {
        searchByZpid.set(String(item.zpid), item);
      }
    }

    // Extract ZPIDs from search results
    const searchZpids = allProperties
      .map(p => p.zpid)
      .filter((zpid): zpid is number | string => zpid !== undefined && zpid !== null)
      .map(zpid => (typeof zpid === 'string' ? parseInt(zpid, 10) : zpid));

    const uniqueSearchZpids = [...new Set(searchZpids)];
    console.log(`Unique ZPIDs from search: ${uniqueSearchZpids.length}`);

    // Check unified properties collection by document ID (zpid_${zpid})
    const existingZpids = new Set<number>();

    // Use batch size of 100 (Firebase getAll limit) for efficiency
    for (let i = 0; i < uniqueSearchZpids.length; i += 100) {
      const batch = uniqueSearchZpids.slice(i, i + 100);
      if (batch.length === 0) continue;

      const docIds = batch.map(z => `zpid_${z}`);
      const docRefs = docIds.map(id => db.collection('properties').doc(id));

      const snapshots = await db.getAll(...docRefs);
      snapshots.forEach((snap, idx) => {
        if (snap.exists) {
          existingZpids.add(batch[idx]);
        }
      });
    }

    console.log(`Found existing in properties: ${existingZpids.size}`);
    metrics.duplicatesSkipped = existingZpids.size;

    // Filter to only NEW properties (not in database)
    const newProperties = allProperties.filter(p => {
      const zpid = typeof p.zpid === 'string' ? parseInt(p.zpid, 10) : p.zpid;
      return zpid && !existingZpids.has(zpid);
    });
    console.log(`New properties to process: ${newProperties.length}`);

    if (newProperties.length === 0) {
      return {
        success: true,
        duration: getDuration(metrics.startTime),
        metrics,
        message: `All ${allProperties.length} properties already exist in database`,
      };
    }

    // ===== STEP 3: GET PROPERTY DETAILS (only for NEW properties) =====
    console.log('\n[STEP 3] Getting property details for NEW properties only...');

    const propertyUrls = newProperties
      .map((p: any) => p.detailUrl || p.url)
      .filter((url: string) => url && url.includes('zillow.com'));

    console.log(`Valid property URLs to fetch: ${propertyUrls.length}`);

    // Limit detail scraping to control costs
    const MAX_DETAIL_URLS = 2500;
    const urlsToProcess = propertyUrls.slice(0, MAX_DETAIL_URLS);

    if (propertyUrls.length > MAX_DETAIL_URLS) {
      console.log(`[LIMIT] Processing first ${MAX_DETAIL_URLS} of ${propertyUrls.length} new properties`);
    }

    let detailedProperties: ScrapedProperty[] = [];

    if (urlsToProcess.length > 0) {
      try {
        detailedProperties = await runDetailScraper(urlsToProcess, { timeoutSecs: 300 });
        console.log(`[DETAILS] Got ${detailedProperties.length} detailed properties`);
      } catch (detailError: any) {
        console.error(`[DETAILS] Error: ${detailError.message}`);
        // Fall back to search results without details
        detailedProperties = newProperties.slice(0, MAX_DETAIL_URLS);
      }
    }

    // MERGE: Copy images from search results to detail results
    // Detail scraper doesn't return images, but search scraper does
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
    console.log(`[IMAGES] Merged ${imagesMerged} images from search results`);

    // ===== STEP 4: TRANSFORM, FILTER, AND SAVE TO UNIFIED COLLECTION =====
    console.log('\n[STEP 4] Processing properties (saving to unified collection)...');

    const filterResults: FilterResult[] = [];
    let propertiesBatch = db.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 400;

    for (const raw of detailedProperties) {
      try {
        // Transform
        const property = transformProperty(raw, 'scraper-v2', 'unified');
        metrics.transformSucceeded++;

        // Validate
        const validation = validateProperty(property);
        if (!validation.valid) {
          metrics.validationFailed++;
          metrics.errors.push({
            zpid: property.zpid,
            address: property.fullAddress,
            error: validation.reason || 'Validation failed',
            stage: 'validation',
          });
          continue;
        }

        // Run unified filter (BOTH filters on every property).
        // Pass distressed-listing flags so auctions/foreclosures are excluded
        // from owner_finance (price is a starting bid / estimate, not asking).
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
        filterResults.push(filterResult);

        // Log result
        logFilterResult(property.fullAddress, filterResult, property.price, property.estimate);

        // Warn on suspicious discounts (price < 50% Zestimate)
        if (filterResult.suspiciousDiscount) {
          const pct = filterResult.discountPercentage?.toFixed(1);
          console.warn(`   [WARNING] ${property.fullAddress} — suspicious ${pct}% discount ($${property.price} vs $${property.estimate} Zestimate)`);
        }

        // Skip if no filters passed (neither owner finance nor cash deal)
        if (!filterResult.shouldSave) {
          metrics.filteredOut++;
          continue;
        }

        // NOTE: Duplicates already filtered in Step 2 before detail scraping
        const zpid = property.zpid;

        // Save to unified 'properties' collection with zpid_${zpid} as doc ID
        const docId = `zpid_${zpid}`;
        const docRef = db.collection('properties').doc(docId);
        const docData = createUnifiedPropertyDoc(property, filterResult);

        // Check if this is a regional property (for GHL)
        const isRegionalProperty = regionalZpids.has(zpid);

        // Add GHL tracking field
        (docData as any).sentToGHL = isRegionalProperty; // Will be sent after save
        (docData as any).sentToGHLAt = isRegionalProperty ? new Date() : null;
        (docData as any).isRegional = isRegionalProperty;

        propertiesBatch.set(docRef, docData, { merge: true });
        batchCount++;
        existingZpids.add(zpid);

        // Update metrics based on deal types
        metrics.savedToProperties++;
        if (filterResult.isOwnerfinance && filterResult.isCashDeal) {
          metrics.savedAsBoth++;
        }
        if (filterResult.isOwnerfinance) {
          metrics.savedAsOwnerfinance++;

          // Collect for buyer notifications
          ownerFinancePropertiesForNotification.push({
            id: docId,
            address: property.streetAddress || property.fullAddress || '',
            city: property.city || '',
            state: property.state || '',
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            listPrice: property.price || 0,
            monthlyPayment: property.monthlyPayment,
            downPaymentAmount: property.downPaymentAmount,
          });
        }
        if (filterResult.isCashDeal) {
          metrics.savedAsCashDeal++;

          // Collect for Abdullah's SMS alerts (regional cash deals under 80% only)
          // Skip land properties - Zestimate is unreliable for land (based on SFR comps)
          // Skip suspicious discounts (< 50% Zestimate) - likely bad data
          // Skip auction/foreclosure/REO - "askingPrice" in GHL template would misrepresent
          // an opening bid or estimated value as a seller's asking price.
          const isDistressedListing = property.isAuction || property.isForeclosure || property.isBankOwned;
          // Skip fixer properties from SMS — Zestimate spread > $150k is unreliable
          if (isRegionalProperty && property.price && property.estimate && !filterResult.isLand && !filterResult.suspiciousDiscount && !isDistressedListing && !filterResult.isFixer) {
            abdullahCashDeals.push({
              streetAddress: property.streetAddress || property.fullAddress || '',
              askingPrice: property.price,
              zestimate: property.estimate,
              zillowLink: property.url || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
            });
          }

          // Collect for investor subscriber alerts (nationwide)
          // Skip land, suspicious, distressed, and fixer properties from SMS
          if (property.price && property.estimate && !filterResult.isLand && !filterResult.suspiciousDiscount && !isDistressedListing && !filterResult.isFixer) {
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

        // Collect near-deals (80-90% ARV) for investor alerts with higher thresholds
        // Skip land properties - Zestimate is unreliable for land
        // Skip auction/foreclosure/REO — price is a starting bid / estimate
        const isDistressedListingNear = property.isAuction || property.isForeclosure || property.isBankOwned;
        if (!filterResult.isCashDeal && !filterResult.isLand && !isDistressedListingNear && property.price && property.estimate && property.estimate > 0) {
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

        // Collect regional properties for GHL webhook
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

        // Collect for Typesense indexing
        // Use zpid_ prefix to match Cloud Function and admin sync ID format
        const propertyId = `zpid_${zpid}`;
        typesenseProperties.push({
          id: propertyId,
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
          status: 'active',
          isActive: true,
          nearbyCities: property.nearbyCities || [],
          ownerFinance: filterResult.isOwnerfinance ? {
            verified: true,
            financingType: 'owner_finance' as const,
            primaryKeyword: filterResult.primaryOwnerfinanceKeyword || 'owner financing',
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

        // Commit batch if needed
        if (batchCount >= BATCH_LIMIT) {
          try {
            await propertiesBatch.commit();
            console.log(`[BATCH] Committed ${batchCount} to properties`);
          } catch (batchError: any) {
            console.error(`[BATCH] Failed to commit ${batchCount} properties:`, batchError);
            metrics.errors.push({ zpid: 0, address: 'batch-commit', error: `Batch commit failed: ${batchError?.message}`, stage: 'firestore-write' });
          }
          propertiesBatch = db.batch();
          batchCount = 0;
        }
      } catch (error) {
        metrics.transformFailed++;
        metrics.errors.push({
          zpid: raw.zpid as number,
          error: error.message,
          stage: 'transform',
        });
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      try {
        await propertiesBatch.commit();
        console.log(`[BATCH] Committed final ${batchCount} to properties`);
      } catch (batchError: any) {
        console.error(`[BATCH] Failed to commit final ${batchCount} properties:`, batchError);
        metrics.errors.push({ zpid: 0, address: 'final-batch-commit', error: `Final batch commit failed: ${batchError?.message}`, stage: 'firestore-write' });
      }
    }

    // ===== STEP 5: INDEX TO TYPESENSE =====
    console.log('\n[STEP 5] Indexing properties to Typesense...');

    if (typesenseProperties.length > 0) {
      try {
        const typesenseResult = await indexPropertiesBatch(typesenseProperties, { batchSize: 100 });
        metrics.indexedToTypesense = typesenseResult.success;
        metrics.typesenseFailed = typesenseResult.failed;
        console.log(`[Typesense] Indexed: ${typesenseResult.success}, Failed: ${typesenseResult.failed}`);
      } catch (error) {
        console.error('[Typesense] Indexing failed:', error.message);
        metrics.typesenseFailed = typesenseProperties.length;
        metrics.errors.push({ error: error.message, stage: 'typesense' });

        // Alert if all indexing failed
        await alertSystemError('Typesense Indexing Failed', error.message, {
          propertiesAttempted: typesenseProperties.length,
          stage: 'typesense',
        });
      }
    } else {
      console.log('[Typesense] No new properties to index');
    }

    // ===== STEP 6: SEND REGIONAL PROPERTIES TO GHL =====
    console.log('\n[STEP 6] Sending regional properties to GHL webhook...');

    if (ghlProperties.length > 0) {
      try {
        const ghlPayloads = ghlProperties.map(p => toGHLPayload(p));
        const ghlResult = await sendBatchToGHLWebhook(ghlPayloads, {
          delayMs: 100,
          onProgress: (sent, total) => {
            console.log(`[GHL] Progress: ${sent}/${total}`);
          },
        });
        metrics.sentToGHL = ghlResult.sent;
        metrics.ghlFailed = ghlResult.failed;
        console.log(`[GHL] Sent: ${ghlResult.sent}, Failed: ${ghlResult.failed}`);
      } catch (error: any) {
        console.error('[GHL] Webhook failed:', error.message);
        metrics.ghlFailed = ghlProperties.length;
        metrics.errors.push({ error: error.message, stage: 'ghl-webhook' });

        // Alert if GHL webhook completely failed
        await alertSystemError('GHL Webhook Failed', error.message, {
          propertiesAttempted: ghlProperties.length,
          stage: 'ghl-webhook',
        });
      }
    } else {
      console.log('[GHL] No regional properties to send');
    }

    // ===== STEP 7: SEND ABDULLAH'S CASH DEAL SMS ALERTS =====
    console.log('\n[STEP 7] Sending Abdullah cash deal alerts...');

    if (abdullahCashDeals.length > 0) {
      try {
        const alertResult = await sendCashDealAlerts(abdullahCashDeals);
        console.log(`[ABDULLAH] Sent ${alertResult.sent} alerts, ${alertResult.failed} failed`);
      } catch (error: any) {
        console.error('[ABDULLAH] Alert failed:', error.message);
      }
    } else {
      console.log('[ABDULLAH] No cash deals under 80% to alert');
    }

    // ===== STEP 7.5: SEND INVESTOR SUBSCRIBER DEAL ALERTS =====
    console.log('\n[STEP 7.5] Sending investor subscriber deal alerts...');

    if (investorAlertDeals.length > 0) {
      try {
        const investorResult = await sendInvestorDealAlerts(investorAlertDeals);
        console.log(`[INVESTOR-ALERT] Sent ${investorResult.totalSent} alerts to ${investorResult.subscribersNotified} subscribers, ${investorResult.totalFailed} failed, ${investorResult.deferred} deferred`);
      } catch (error: any) {
        console.error('[INVESTOR-ALERT] Alert system failed:', error.message);
      }
    } else {
      console.log('[INVESTOR-ALERT] No deals to alert subscribers about');
    }

    // ===== STEP 8: TRIGGER BUYER NOTIFICATIONS =====
    console.log('\n[STEP 8] Triggering buyer notifications for owner finance properties...');

    if (ownerFinancePropertiesForNotification.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
      let notificationsSent = 0;
      let notificationsFailed = 0;

      // Process in batches to avoid overwhelming the system
      for (const property of ownerFinancePropertiesForNotification) {
        try {
          // Fire and forget - call sync-matches for each property
          fetch(`${baseUrl}/api/properties/sync-matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              propertyId: property.id,
              propertyData: property,
            }),
          }).catch(err => {
            console.error(`[NOTIFY] Failed for ${property.id}:`, err.message);
          });
          notificationsSent++;

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 50));
        } catch (error: any) {
          notificationsFailed++;
          console.error(`[NOTIFY] Error for ${property.id}:`, error.message);
        }
      }

      console.log(`[NOTIFY] Triggered ${notificationsSent} buyer notifications`);
    } else {
      console.log('[NOTIFY] No owner finance properties to notify buyers about');
    }

    // ===== STEP 9: LOG STATISTICS =====
    const filterStats = calculateFilterStats(filterResults);
    logFilterStats(filterStats);

    const duration = getDuration(metrics.startTime);

    console.log('\n' + '='.repeat(60));
    console.log('UNIFIED SCRAPER v2 - COMPLETE');
    console.log('='.repeat(60));
    console.log(`Duration: ${duration}`);
    console.log(`Properties Found: ${metrics.totalPropertiesFound}`);
    console.log(`  - Owner Finance search: ${metrics.propertiesBySearch['owner-finance-nationwide'] || 0}`);
    console.log(`  - Cash Deals Regional: ${metrics.propertiesBySearch['cash-deals-regional'] || 0}`);
    console.log(`Transform Succeeded: ${metrics.transformSucceeded}`);
    console.log(`Transform Failed: ${metrics.transformFailed}`);
    console.log(`Validation Failed: ${metrics.validationFailed}`);
    console.log(`Duplicates Skipped: ${metrics.duplicatesSkipped}`);
    console.log(`Filtered Out: ${metrics.filteredOut}`);
    console.log(`Saved to properties: ${metrics.savedToProperties}`);
    console.log(`  - Owner Finance: ${metrics.savedAsOwnerfinance}`);
    console.log(`  - Cash Deal: ${metrics.savedAsCashDeal}`);
    console.log(`  - Both: ${metrics.savedAsBoth}`);
    console.log(`Indexed to Typesense: ${metrics.indexedToTypesense}`);
    console.log(`Typesense Failed: ${metrics.typesenseFailed}`);
    console.log(`Sent to GHL: ${metrics.sentToGHL}`);
    console.log(`GHL Failed: ${metrics.ghlFailed}`);
    console.log(`Errors: ${metrics.errors.length}`);
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      duration,
      metrics,
      message: `Scraped ${metrics.totalPropertiesFound} properties. Saved ${metrics.savedToProperties} to properties collection (${metrics.savedAsOwnerfinance} owner finance, ${metrics.savedAsCashDeal} cash deal, ${metrics.savedAsBoth} both). Indexed ${metrics.indexedToTypesense} to Typesense. Sent ${metrics.sentToGHL} regional properties to GHL.`,
    };
  } catch (error) {
    console.error('[SCRAPER] Fatal error:', error);
    metrics.errors.push({ error: error.message, stage: 'fatal' });

    // Alert admin via Slack
    await alertSystemError('Unified Scraper v2 Failed', error.message, {
      duration: getDuration(metrics.startTime),
      propertiesFound: metrics.totalPropertiesFound,
      errorCount: metrics.errors.length,
      stage: 'fatal',
    });

    return {
      success: false,
      duration: getDuration(metrics.startTime),
      metrics,
      message: 'Scraper failed with fatal error',
      error: error.message,
    };
  }
}

function getDuration(startTime: number): string {
  return ((Date.now() - startTime) / 1000).toFixed(2) + 's';
}
