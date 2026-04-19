/**
 * Unified Scraper v2 - Manual Property Add Endpoint
 *
 * Used by:
 * - Admin quick add (realtors manually confirm owner finance)
 * - Chrome extension / bookmarklet
 * - Manual property submission
 *
 * WHAT IT DOES:
 * 1. Accepts Zillow property URL(s)
 * 2. Immediately scrapes full details via Apify
 * 3. If forceOwnerfinance=true (default for manual adds): ALWAYS saves as owner finance
 * 4. Otherwise: Runs filters and only saves if passes
 *
 * COLLECTION: 'properties' (unified)
 * - Document ID: zpid_${zpid}
 * - isOwnerfinance: boolean
 * - isCashDeal: boolean
 * - dealTypes: string[]
 *
 * NO QUEUE - Immediate processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { runDetailScraper } from '@/lib/scraper-v2/apify-client';
import { runUnifiedFilter, logFilterResult, FilterResult } from '@/lib/scraper-v2/unified-filter';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '@/lib/scraper-v2/property-transformer';

/**
 * Verify the request is from an admin session or has a valid CRON_SECRET bearer token.
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Check Bearer CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check admin session
  const session = await getServerSession(authOptions as any) as ExtendedSession | null;
  if (session?.user && (session as ExtendedSession).user.role === 'admin') {
    return true;
  }

  return false;
}

// CORS headers for bookmarklet access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Auth: require admin session or CRON_SECRET
    if (!(await isAuthorized(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access or valid CRON_SECRET required.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { url, urls, forceOwnerfinance = true } = body; // Default to true for manual adds

    // Support single URL or array of URLs
    const urlsToProcess: string[] = urls || (url ? [url] : []);

    if (urlsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No URL provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate URLs
    const validUrls = urlsToProcess.filter(u => {
      try {
        const parsed = new URL(u);
        return parsed.hostname.includes('zillow.com');
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid Zillow URLs provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[ADD] Processing ${validUrls.length} URL(s)`);

    const { db } = getFirebaseAdmin();

    // Check for duplicates in unified 'properties' collection
    const zpidsFromUrls = validUrls
      .map(u => {
        const match = u.match(/(\d+)_zpid/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((z): z is number => z !== null);

    const existingZpids = new Set<number>();

    if (zpidsFromUrls.length > 0) {
      for (let i = 0; i < zpidsFromUrls.length; i += 10) {
        const batch = zpidsFromUrls.slice(i, i + 10);
        if (batch.length === 0) continue;

        // Check by document ID pattern zpid_${zpid}
        const docIds = batch.map(z => `zpid_${z}`);
        const docRefs = docIds.map(id => db.collection('properties').doc(id));

        const snapshots = await db.getAll(...docRefs);
        snapshots.forEach((snap, idx) => {
          if (snap.exists) {
            existingZpids.add(batch[idx]);
          }
        });
      }
    }

    // Scrape property details
    console.log(`[ADD] Scraping ${validUrls.length} properties via Apify...`);

    let scrapedProperties;
    try {
      scrapedProperties = await runDetailScraper(validUrls, { timeoutSecs: 120 });
    } catch (apifyError: any) {
      console.error('[ADD] Apify scraper failed:', apifyError.message);
      return NextResponse.json(
        { success: false, error: `Scraper failed: ${apifyError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[ADD] Received ${scrapedProperties.length} properties from Apify`);

    // Process each property
    const results: Array<{
      url: string;
      zpid?: number;
      address?: string;
      savedTo: string[];
      skipped?: boolean;
      skipReason?: string;
      error?: string;
    }> = [];

    for (const raw of scrapedProperties) {
      try {
        // Transform
        const property = transformProperty(raw, 'manual-add-v2', 'manual');

        // Validate
        const validation = validateProperty(property);
        if (!validation.valid) {
          results.push({
            url: property.url,
            zpid: property.zpid,
            address: property.fullAddress,
            savedTo: [],
            skipped: true,
            skipReason: validation.reason,
          });
          continue;
        }

        // Check if already exists in properties collection
        if (existingZpids.has(property.zpid)) {
          if (!forceOwnerfinance) {
            // Automated path — keep existing skip behavior
            console.log(`[ADD] Duplicate in properties: ${property.zpid}`);
            results.push({
              url: property.url,
              zpid: property.zpid,
              address: property.fullAddress,
              savedTo: [],
              skipped: true,
              skipReason: 'Duplicate - already exists in properties collection',
            });
            continue;
          }

          // Manual add on an existing doc — flip to owner_finance without
          // losing existing fields (e.g. scraper-v2's address, agent info,
          // cash_deal tag, etc). Run the read-modify-write inside a
          // transaction so concurrent admin adds can't clobber each other's
          // dealTypes / matchedKeywords array unions.
          console.log(`[ADD] Flipping existing property ${property.zpid} → owner_finance`);
          const docRef = db.collection('properties').doc(`zpid_${property.zpid}`);
          const existingDataAfter = await db.runTransaction(async tx => {
            const snap = await tx.get(docRef);
            const d = snap.data() || {};
            const existingDealTypes = Array.isArray(d.dealTypes) ? d.dealTypes : [];
            const newDealTypes = Array.from(new Set([...existingDealTypes, 'owner_finance']));
            const existingFinancingTypes = Array.isArray(d.allFinancingTypes) ? d.allFinancingTypes : [];
            const newFinancingTypes = Array.from(new Set([...existingFinancingTypes, 'Owner Finance']));
            const existingMatched = Array.isArray(d.matchedKeywords) ? d.matchedKeywords : [];
            const newMatched = Array.from(new Set([...existingMatched, 'manually_added']));

            tx.update(docRef, {
              isOwnerfinance: true,
              isActive: true,
              dealTypes: newDealTypes,
              ownerFinanceVerified: true,
              // Overwrite financingType/label unconditionally — the realtor
              // confirmed this is owner-finance, so even if the existing doc
              // had "Unknown", the authoritative value is Owner Finance now.
              financingType: 'Owner Finance',
              allFinancingTypes: newFinancingTypes,
              financingTypeLabel: 'Owner Finance',
              matchedKeywords: newMatched,
              primaryKeyword: d.primaryKeyword || 'manually_added',
              manuallyConfirmedOwnerFinance: true,
              manuallyConfirmedAt: new Date(),
              updatedAt: new Date(),
              // Backfill address fields if missing (agent-outreach scraper
              // sometimes leaves these null on imported docs).
              ...(d.fullAddress ? {} : { fullAddress: property.fullAddress }),
              ...(d.streetAddress ? {} : { streetAddress: property.streetAddress }),
              ...(d.city ? {} : { city: property.city }),
              ...(d.state ? {} : { state: property.state }),
              ...(d.zipCode ? {} : { zipCode: property.zipCode }),
            });
            return d;
          });

          results.push({
            url: property.url,
            zpid: property.zpid,
            address: property.fullAddress || existingDataAfter.fullAddress || existingDataAfter.address,
            savedTo: ['owner_finance (updated existing)'],
            skipped: false,
          });
          continue;
        }

        const savedTo: string[] = [];
        let filterResult: FilterResult;

        if (forceOwnerfinance) {
          // MANUAL ADD: Always save as owner finance (realtor confirmed)
          console.log(`[ADD] Force owner finance mode - saving ${property.fullAddress}`);

          // Create a manual override filter result
          filterResult = {
            passesOwnerfinance: true,
            ownerFinanceKeywords: ['manually_added'],
            primaryOwnerfinanceKeyword: 'manually_added',
            financingType: { financingType: 'owner_finance', allTypes: ['owner_finance'], displayLabel: 'Owner Finance' },
            passesCashDeal: false,
            needsWork: false,
            needsWorkKeywords: [],
            dealTypes: ['owner_finance'] as ('owner_finance' | 'cash_deal')[],
            isOwnerfinance: true,
            isCashDeal: false,
            shouldSave: true,
            shouldSaveToZillowImports: true,
            shouldSaveToCashHouses: false,
            targetCollections: ['zillow_imports'] as ('zillow_imports' | 'cash_houses')[],
          };
          savedTo.push('owner_finance');
        } else {
          // AUTOMATED SCRAPER: Run unified filter
          filterResult = runUnifiedFilter(
            property.description,
            property.price,
            property.estimate
          );

          logFilterResult(property.fullAddress, filterResult, property.price, property.estimate);

          // Skip if no filters passed
          if (!filterResult.shouldSave) {
            results.push({
              url: property.url,
              zpid: property.zpid,
              address: property.fullAddress,
              savedTo: [],
              skipped: true,
              skipReason: 'No filters passed (not owner finance or cash deal)',
            });
            continue;
          }

          // Track what types it saved as
          if (filterResult.isOwnerfinance) savedTo.push('owner_finance');
          if (filterResult.isCashDeal) savedTo.push('cash_deal');
        }

        // Save to unified 'properties' collection with zpid_${zpid} as doc ID
        const docId = `zpid_${property.zpid}`;
        const docRef = db.collection('properties').doc(docId);
        await docRef.set(createUnifiedPropertyDoc(property, filterResult), { merge: true });
        existingZpids.add(property.zpid);

        results.push({
          url: property.url,
          zpid: property.zpid,
          address: property.fullAddress,
          savedTo,
          skipped: false,
        });
      } catch (error) {
        results.push({
          url: raw.url || raw.detailUrl || 'unknown',
          error: error.message,
          savedTo: [],
        });
      }
    }

    // Summary
    const saved = results.filter(r => r.savedTo.length > 0);
    const skipped = results.filter(r => r.skipped);
    const errors = results.filter(r => r.error);

    console.log(`[ADD] Complete: ${saved.length} saved, ${skipped.length} skipped, ${errors.length} errors`);

    return NextResponse.json(
      {
        success: true,
        processed: results.length,
        saved: saved.length,
        skipped: skipped.length,
        errors: errors.length,
        results,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[ADD] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET endpoint for simple bookmarklet usage
export async function GET(request: NextRequest) {
  // Auth: require admin session or CRON_SECRET
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Admin access or valid CRON_SECRET required.' },
      { status: 401, headers: corsHeaders }
    );
  }

  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'No URL provided. Use ?url=<zillow-url>' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Create a fake request with the URL and forward auth headers
  const fakeRequest = {
    json: async () => ({ url }),
    headers: request.headers,
  } as NextRequest;

  return POST(fakeRequest);
}
