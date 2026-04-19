import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';
import { detectFinancingType } from '@/lib/financing-type-detector';
import { detectListingSubType, normalizeHomeType } from '@/lib/scraper-v2/property-transformer';
import { calculateCashFlow } from '@/lib/cash-flow';
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';

/**
 * Statuses that mean the property is gone for good — hard-delete from
 * Firestore AND Typesense. Sold/closed/off-market listings are removed
 * completely per product decision (no "sold-page" SEO retention).
 */
const PERMANENT_DELETE_STATUSES = new Set([
  'FOR_RENT',
  'SOLD',
  'RECENTLY_SOLD',
  'OFF_MARKET',
]);

/**
 * Statuses that make a listing temporarily inactive but still worth
 * re-checking — PENDING/CONTINGENT/UNDER_CONTRACT deals can fall through.
 */
const TRANSIENT_INACTIVE_STATUSES = new Set([
  'PENDING', 'CONTINGENT', 'UNDER_CONTRACT', 'OTHER', 'UNKNOWN',
]);

/**
 * How many consecutive "no Apify result" checks before a property is
 * permanently deleted. Zillow delists properties it stops tracking.
 */
const NO_RESULT_DELETE_THRESHOLD = 3;

/**
 * Maximum acceptable staleness for inactive-property re-checks. Adaptive
 * batch sizing aims to rotate every inactive property within this window.
 * Small backlogs check daily, large backlogs spread across 14 days.
 */
const INACTIVE_RECHECK_TARGET_DAYS = 14;

/**
 * Skip re-checking a property that was scraped or confirmed by the main
 * scraper within this window — data is already fresh.
 */
const FRESH_SKIP_HOURS = 12;

/**
 * Number of consecutive OF-keyword misses before we strip the
 * isOwnerfinance flag. Prevents false positives where Zillow edits the
 * description and drops keywords for a cycle but the deal is still live.
 */
const OF_MISS_THRESHOLD = 2;

// Type for Apify Zillow scraper response
interface ZillowApifyItem {
  zpid?: string | number;
  id?: string | number;
  homeStatus?: string;
  keystoneHomeStatus?: string;
  hdpTypeDimension?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listingSubType?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing_sub_type?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  foreclosureTypes?: any;
  price?: number;
  listPrice?: number;
  daysOnZillow?: number;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  livingAreaValue?: number;
  squareFoot?: number;
  lotAreaValue?: number;
  lotSize?: number;
  lotSquareFoot?: number;
  yearBuilt?: number;
  homeType?: string;
  propertyType?: string;
  buildingType?: string;
  latitude?: number;
  longitude?: number;
  zestimate?: number;
  estimate?: number;
  rentZestimate?: number;
  rentEstimate?: number;
  monthlyHoaFee?: number;
  hoaFee?: number;
  hoa?: number;
  annualTaxAmount?: number;
  propertyTaxRate?: number;
  annualHomeownersInsurance?: number;
  hiResImageLink?: string;
  mediumImageLink?: string;
  desktopWebHdpImageLink?: string;
  imgSrc?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responsivePhotos?: Array<any>;
  propertyImages?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  photos?: Array<any>;
  images?: string[];
  photoCount?: number;
  attributionInfo?: {
    agentName?: string;
    agentPhoneNumber?: string;
    agentEmail?: string;
    brokerName?: string;
    brokerPhoneNumber?: string;
    mlsId?: string;
  };
  agentName?: string;
  agentPhoneNumber?: string;
  agentEmail?: string;
  brokerName?: string;
  brokerPhoneNumber?: string;
  brokerPhone?: string;
  mlsid?: string;
  county?: string;
  parcelId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resoFacts?: { parcelNumber?: string; [k: string]: any };
  hdpUrl?: string;
  virtualTourUrl?: string;
  thirdPartyVirtualTour?: { externalUrl?: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxHistory?: Array<{ taxPaid?: number; [k: string]: any }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  address?: { streetAddress?: string; city?: string; state?: string; zipcode?: string; [k: string]: any };
  city?: string;
  state?: string;
  zipcode?: string;
  zip?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contactRecipients?: Array<any>;
}

interface PropertyDoc {
  id: string;
  collection: 'properties' | 'agent_outreach_queue';
  url: string;
  zpid: string | number;
  address: string;
  currentStatus: string;
  lastCheck: Date | null;
  isOwnerfinance: boolean;
  agentConfirmedOwnerfinance?: boolean;
  source?: string;
}

/**
 * Zillow Status Refresh Cron
 *
 * Checks properties on Zillow to catch PENDING/SOLD status changes quickly.
 *
 * OPTIMIZATION:
 * - 3-day rotation target to catch status changes fast
 * - Skips properties checked within last 24 hours
 * - Dynamic batch size based on total properties
 * - Max 100 properties/run to cap costs
 *
 * FEATURES:
 * 1. Error logging to Firestore (cron_logs collection)
 * 2. Syncs lastStatusCheck to unified 'properties' collection
 * 3. Timeout protection - stops at 4.5 min
 * 4. Priority: never checked → >3 days → 1-3 days → skip fresh
 *
 * TARGETS: properties (unified) + agent_outreach_queue
 * RUNS: Every 30 minutes
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { db } = getFirebaseAdmin();

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use cron lock to prevent concurrent execution (Apify costs $$$)
  const lockResult = await withCronLock('refresh-zillow-status', async () => {
    const runId = `run_${Date.now()}`;
    console.log(`🔄 [CRON ${runId}] Starting Zillow status refresh`);

    // Typesense client for direct deletes — the Cloud Function sync is a
    // nice-to-have but we can't rely on it for cleanup correctness.
    const tsClient = getTypesenseAdminClient();
    const tsCollection = tsClient?.collections(TYPESENSE_COLLECTIONS.PROPERTIES);

    async function deleteFromTypesense(docId: string): Promise<void> {
      if (!tsCollection) return;
      try {
        await tsCollection.documents(docId).delete();
      } catch (err: unknown) {
        // 404 is fine — already gone
        const httpStatus = (err as { httpStatus?: number })?.httpStatus;
        if (httpStatus !== 404) {
          console.error(`[TS-delete] ${docId} failed:`, err);
        }
      }
    }

  // Log cron start
  const logRef = db.collection('cron_logs').doc(runId);
  await logRef.set({
    runId,
    type: 'refresh-zillow-status',
    status: 'started',
    startedAt: new Date(),
  });

  try {
    // Configuration
    const MAX_RUNTIME_MS = 270000; // 4.5 minutes (leave buffer for 5min Vercel limit)
    const TARGET_ROTATION_DAYS = 3; // Check every property once per 3 days
    const RUNS_PER_DAY = 48; // Every 30 minutes
    const MIN_BATCH_SIZE = 10; // Minimum to process per run
    const MAX_BATCH_SIZE = 100; // Maximum to keep Apify costs reasonable

    // ============================================
    // STEP 1: Gather ALL properties (active + inactive) + agent outreach.
    // Inactive properties are rechecked on a separate rotation so Zillow
    // relistings get caught, and sold/delisted get permanently deleted.
    // ============================================
    const [activePropsSnap, inactivePropsSnap, agentOutreachSnap] = await Promise.all([
      db.collection('properties').where('isActive', '==', true).get(),
      db.collection('properties').where('isActive', '==', false).get(),
      db.collection('agent_outreach_queue').where('status', '==', 'sent_to_ghl').get(),
    ]);

    console.log(`📊 Collections: ${activePropsSnap.size} active, ${inactivePropsSnap.size} inactive, ${agentOutreachSnap.size} agent outreach`);

    if (activePropsSnap.empty && inactivePropsSnap.empty && agentOutreachSnap.empty) {
      await logRef.update({ status: 'completed', message: 'No properties', completedAt: new Date() });
      return NextResponse.json({ success: true, message: 'No properties' });
    }

    // Track which active properties we've already added so inactive rechecks
    // don't double-up, and dedup zpids across both collections.
    const seenDocIds = new Set<string>();
    const seenZpids = new Set<string>();
    const activeProperties: PropertyDoc[] = [];
    const inactiveProperties: PropertyDoc[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addProp = (doc: any, collection: 'properties' | 'agent_outreach_queue', isActive: boolean) => {
      const data = doc.data();
      if (!data.url) return;
      if (seenDocIds.has(doc.id)) return;
      const zpid = String(data.zpid || '');
      if (zpid && seenZpids.has(zpid)) return;

      seenDocIds.add(doc.id);
      if (zpid) seenZpids.add(zpid);

      const prop: PropertyDoc = {
        id: doc.id,
        collection,
        url: data.url,
        zpid: data.zpid || '',
        address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
        currentStatus: data.homeStatus || 'UNKNOWN',
        lastCheck: data.lastStatusCheck?.toDate?.() || null,
        isOwnerfinance: data.isOwnerfinance || false,
        agentConfirmedOwnerfinance: data.agentConfirmedOwnerfinance,
        source: data.source,
      };
      if (isActive) activeProperties.push(prop);
      else inactiveProperties.push(prop);
    };

    activePropsSnap.docs.forEach(doc => addProp(doc, 'properties', true));
    inactivePropsSnap.docs.forEach(doc => addProp(doc, 'properties', false));
    agentOutreachSnap.docs.forEach(doc => addProp(doc, 'agent_outreach_queue', true));

    const allProperties: PropertyDoc[] = [...activeProperties, ...inactiveProperties];

    // ============================================
    // STEP 2: Build priority queue with adaptive batch sizing
    // ============================================
    const now = Date.now();
    const FRESH_MS = FRESH_SKIP_HOURS * 60 * 60 * 1000;

    // ---- ACTIVE bucket: normal 3-day rotation, skip <12h fresh ----
    const activeFresh = activeProperties.filter(p => p.lastCheck && (now - p.lastCheck.getTime()) < FRESH_MS);
    const activeNeedsCheck = activeProperties.filter(p => !p.lastCheck || (now - p.lastCheck.getTime()) >= FRESH_MS);
    activeNeedsCheck.sort((a, b) => {
      if (!a.lastCheck && !b.lastCheck) return 0;
      if (!a.lastCheck) return -1;
      if (!b.lastCheck) return 1;
      return a.lastCheck.getTime() - b.lastCheck.getTime();
    });
    const activeTotalSlots = TARGET_ROTATION_DAYS * RUNS_PER_DAY;
    const activeOptimalBatch = Math.ceil(activeProperties.length / activeTotalSlots);
    const activeBatchSize = Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, activeOptimalBatch));

    // ---- INACTIVE bucket: adaptive 1-14 day rotation ----
    // Small backlogs (e.g. 50 pending) finish within hours; large backlogs
    // (thousands) spread across 14 days. Formula same as active but with
    // a longer target window and separate cap.
    const inactiveNeedsCheck = [...inactiveProperties];
    inactiveNeedsCheck.sort((a, b) => {
      if (!a.lastCheck && !b.lastCheck) return 0;
      if (!a.lastCheck) return -1;
      if (!b.lastCheck) return 1;
      return a.lastCheck.getTime() - b.lastCheck.getTime();
    });
    const inactiveTotalSlots = INACTIVE_RECHECK_TARGET_DAYS * RUNS_PER_DAY;
    const inactiveOptimalBatch = Math.ceil(inactiveNeedsCheck.length / inactiveTotalSlots);
    // Inactive batch capped separately — give active priority.
    const inactiveBatchSize = Math.min(Math.max(0, inactiveOptimalBatch), 25);

    const toProcess = [
      ...activeNeedsCheck.slice(0, activeBatchSize),
      ...inactiveNeedsCheck.slice(0, inactiveBatchSize),
    ];

    console.log(`📊 Adaptive rotation:`);
    console.log(`   Active:   ${activeProperties.length} total → batch ${activeBatchSize}  (skipping ${activeFresh.length} fresh <${FRESH_SKIP_HOURS}h)`);
    console.log(`   Inactive: ${inactiveProperties.length} total → batch ${inactiveBatchSize}  (target ${INACTIVE_RECHECK_TARGET_DAYS}d rotation)`);
    console.log(`   Total this run: ${toProcess.length}`);

    if (toProcess.length === 0) {
      await logRef.update({ status: 'completed', message: 'No properties to process', completedAt: new Date() });
      return NextResponse.json({ success: true, message: 'No properties to process' });
    }

    // Update log with batch info
    await logRef.update({
      totalProperties: allProperties.length,
      activeTotal: activeProperties.length,
      inactiveTotal: inactiveProperties.length,
      activeBatch: activeBatchSize,
      inactiveBatch: inactiveBatchSize,
      activeFreshSkipped: activeFresh.length,
      batchSize: toProcess.length,
      targetRotationDays: TARGET_ROTATION_DAYS,
      inactiveRotationDays: INACTIVE_RECHECK_TARGET_DAYS,
    });

    // ============================================
    // STEP 3: Run Apify scraper (single batch)
    // ============================================
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    console.log(`🚀 Starting Apify scraper for ${toProcess.length} properties...`);

    // Normalize URLs - ensure they have the full Zillow domain
    const normalizeZillowUrl = (url: string): string => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      // Handle relative URLs like "/homedetails/..."
      return `https://www.zillow.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const run = await client.actor(actorId).call({
      startUrls: toProcess.map(p => ({ url: normalizeZillowUrl(p.url) })),
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems({
      clean: false,
      limit: 1000,
    });

    const results = items as ZillowApifyItem[];
    console.log(`✓ Apify returned ${results.length} results`);

    // ============================================
    // STEP 4: Process results and update Firestore
    // ============================================
    const zpidToResult = new Map<string, ZillowApifyItem>();
    results.forEach(item => {
      const zpid = String(item.zpid || item.id || '');
      if (zpid) zpidToResult.set(zpid, item);
    });

    let updated = 0;
    let deleted = 0;          // permanent deletes (SOLD / delisted / price error)
    let deactivated = 0;      // marked inactive but retained for recheck
    let reactivated = 0;      // previously inactive, now FOR_SALE again
    let statusChanged = 0;
    let noResult = 0;

    const statusChanges: Array<{ address: string; old: string; new: string }> = [];
    const deletions: Array<{ address: string; reason: string }> = [];

    // Process in Firestore batches (max 500 per batch)
    let firestoreBatch = db.batch();
    let batchCount = 0;
    // Typesense deletes to run after Firestore commit (so we don't delete from
    // TS for a Firestore write that ended up failing).
    const typesenseDeletesAfterCommit: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getExistingField = async (docRef: FirebaseFirestore.DocumentReference, field: string): Promise<any> => {
      const snap = await docRef.get();
      return snap.data()?.[field];
    };

    for (const prop of toProcess) {
      // Check timeout
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏰ Approaching timeout, stopping early');
        break;
      }

      const zpid = String(prop.zpid || '');
      const result = zpidToResult.get(zpid);
      const docRef = db.collection(prop.collection).doc(prop.id);

      // ===== NO APIFY RESULT =====
      // Property delisted from Zillow. Escalate after N consecutive misses.
      if (!result) {
        noResult++;
        const currentMisses = (await getExistingField(docRef, 'consecutiveNoResults')) || 0;
        const newMisses = currentMisses + 1;

        if (newMisses >= NO_RESULT_DELETE_THRESHOLD) {
          // Permanent delete — Zillow has forgotten this property.
          await docRef.delete();
          if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
          deleted++;
          deletions.push({ address: prop.address, reason: `Delisted (${newMisses} consecutive misses)` });
        } else {
          // Soft inactive — retry on future rotations.
          firestoreBatch.update(docRef, {
            isActive: false,
            offMarketReason: `No Apify result (${newMisses}/${NO_RESULT_DELETE_THRESHOLD} misses)`,
            consecutiveNoResults: newMisses,
            lastStatusCheck: new Date(),
          });
          if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
          deactivated++;
          batchCount++;
        }
        continue;
      }

      const newStatus = String(result.homeStatus || 'UNKNOWN').toUpperCase();
      const oldStatus = (prop.currentStatus || '').toUpperCase();

      if (oldStatus !== newStatus) {
        statusChanged++;
        statusChanges.push({ address: prop.address, old: oldStatus, new: newStatus });
      }

      const hasNoPrice = !result.price && !result.listPrice;
      const isPriceZero = result.price === 0 || result.listPrice === 0;

      // ===== PERMANENT DELETE =====
      // FOR_RENT → wrong market segment, clean from DB + TS entirely.
      if (PERMANENT_DELETE_STATUSES.has(newStatus)) {
        await docRef.delete();
        if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
        deleted++;
        deletions.push({ address: prop.address, reason: `Deleted (status: ${newStatus})` });
        continue;
      }

      // ===== TRANSIENT INACTIVE =====
      // PENDING / CONTINGENT / UNDER_CONTRACT — deal might fall through, keep
      // for recheck on the inactive rotation bucket.
      if (TRANSIENT_INACTIVE_STATUSES.has(newStatus) || hasNoPrice || isPriceZero) {
        const reason = TRANSIENT_INACTIVE_STATUSES.has(newStatus)
          ? `Status: ${newStatus}`
          : 'No/zero price';
        if (prop.collection === 'agent_outreach_queue') {
          firestoreBatch.update(docRef, {
            status: 'property_off_market',
            homeStatus: newStatus,
            offMarketReason: reason,
            lastStatusCheck: new Date(),
          });
        } else {
          firestoreBatch.update(docRef, {
            isActive: false,
            homeStatus: newStatus,
            offMarketReason: reason,
            lastStatusCheck: new Date(),
            consecutiveNoResults: 0,
          });
          if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
        }
        deactivated++;
        batchCount++;
        continue;
      }

      // If we reach here, property is FOR_SALE (or similar active state).
      // If it was previously inactive, track reactivation.
      if (oldStatus && TRANSIENT_INACTIVE_STATUSES.has(oldStatus)) {
        reactivated++;
      }

      // Property is still active - check owner financing for owner finance properties
      // Gated on OF_MISS_THRESHOLD consecutive misses to absorb Zillow
      // description edits that temporarily drop keywords.
      let ofMissIncrement: number | null = null;
      if (prop.collection === 'properties' && prop.isOwnerfinance) {
        const manualSources = ['manual-add-v2', 'manual-add', 'admin-upload', 'manual', 'bookmarklet'];
        const isManuallyAdded = manualSources.includes(prop.source || '');
        const isAgentConfirmed = prop.agentConfirmedOwnerfinance || prop.source === 'agent_outreach';
        const isTrustedSource = isManuallyAdded || isAgentConfirmed;

        const ownerFinanceCheck = hasStrictOwnerfinancing(result.description);

        if (!ownerFinanceCheck.passes && !isTrustedSource) {
          const currentMisses = (await getExistingField(docRef, 'ofMissCount')) || 0;
          const newMisses = currentMisses + 1;
          if (newMisses >= OF_MISS_THRESHOLD) {
            firestoreBatch.update(docRef, {
              isOwnerfinance: false,
              isActive: false,
              offMarketReason: `Owner financing removed from listing (${newMisses} consecutive misses)`,
              lastStatusCheck: new Date(),
              ofMissCount: newMisses,
            });
            if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
            deactivated++;
            deletions.push({ address: prop.address, reason: 'OF keywords removed' });
            batchCount++;
            continue;
          } else {
            ofMissIncrement = newMisses;
          }
        } else {
          // Keywords present — reset counter.
          ofMissIncrement = 0;
        }
      }

      // Re-detect auction / foreclosure / bank-owned status on each refresh.
      // A listing can transition between FOR_SALE and FOR_AUCTION over its life,
      // so we must keep these flags in sync with the current Zillow state.
      //
      // BUT: Apify responses are inconsistent — `listingSubType` is sometimes
      // present, sometimes missing entirely. Blindly trusting a missing field
      // would silently downgrade a true auction back to FOR_SALE. So we only
      // DOWNGRADE flags when we have positive evidence (the listingSubType
      // object is present in the response). UPGRADES (false→true) always apply.
      const detected = detectListingSubType(result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = result as any;
      const hasListingSubTypeData = Boolean(r.listing_sub_type || r.listingSubType || r.foreclosureTypes || r.keystoneHomeStatus);
      const existing = await docRef.get();
      const existingData = existing.data() || {};
      const subTypeFlags = {
        isAuction: detected.isAuction || (!hasListingSubTypeData && existingData.isAuction === true),
        isForeclosure: detected.isForeclosure || (!hasListingSubTypeData && existingData.isForeclosure === true),
        isBankOwned: detected.isBankOwned || (!hasListingSubTypeData && existingData.isBankOwned === true),
        listingSubType: detected.listingSubType
          || (!hasListingSubTypeData && existingData.listingSubType ? String(existingData.listingSubType) : ''),
      };
      const isDistressedNow = subTypeFlags.isAuction || subTypeFlags.isForeclosure || subTypeFlags.isBankOwned;

      // Estimates: Zillow can drop a Zestimate it previously reported (suppressed
      // for unique homes, recent sales, etc.). When it's gone, clear our stored
      // value — otherwise a stale Zestimate sticks around forever and gets used
      // for cash-deal classification and shown to buyers.
      const newEstimate = result.zestimate || result.estimate || null;
      const newRentEstimate = result.rentZestimate || result.rentEstimate || null;

      // ── Address normalization ────────────────────────────────────────────
      // Zillow occasionally updates the address object (typo fix, unit
      // parsing). Pull every part so the Firestore doc tracks current truth.
      const addrObj = (result.address || {}) as { streetAddress?: string; city?: string; state?: string; zipcode?: string };
      const freshStreetAddress = addrObj.streetAddress || existingData.streetAddress || existingData.address || '';
      const freshCity = addrObj.city || result.city || existingData.city || '';
      const freshState = addrObj.state || result.state || existingData.state || '';
      const freshZip = addrObj.zipcode || result.zipcode || result.zip || existingData.zipCode || existingData.zipcode || '';
      const freshFullAddress = freshStreetAddress && freshCity && freshState
        ? `${freshStreetAddress}, ${freshCity}, ${freshState} ${freshZip}`.trim()
        : (existingData.fullAddress || '');

      // ── Image resolution ─────────────────────────────────────────────────
      // Prefer gallery from responsivePhotos → photos → propertyImages → images.
      // We store the full gallery in propertyImages / imageUrls and surface
      // a single primary under every alias the rest of the codebase reads.
      const galleryFromResponsive: string[] = Array.isArray(result.responsivePhotos)
        ? result.responsivePhotos.map((p): string => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const jpeg = (p as any)?.mixedSources?.jpeg;
            if (Array.isArray(jpeg) && jpeg.length > 0) return String(jpeg[jpeg.length - 1]?.url || '');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return String((p as any)?.url || '');
          }).filter(Boolean)
        : [];
      const galleryFromPhotos: string[] = Array.isArray(result.photos)
        ? result.photos.map((p): string => typeof p === 'string' ? p : String(p?.url || p?.href || '')).filter(Boolean)
        : [];
      const gallery: string[] = galleryFromResponsive.length > 0
        ? galleryFromResponsive
        : galleryFromPhotos.length > 0
          ? galleryFromPhotos
          : Array.isArray(result.propertyImages) ? result.propertyImages
          : Array.isArray(result.images) ? result.images
          : [];
      const primaryImage: string = result.hiResImageLink
        || result.desktopWebHdpImageLink
        || result.mediumImageLink
        || result.imgSrc
        || gallery[0]
        || '';

      // ── Description + derived flags ──────────────────────────────────────
      // Re-run financing + OF keyword detection on the fresh description so
      // financingType / matchedKeywords / needsWork stay current when Zillow
      // edits the listing mid-cycle.
      const freshDescription = sanitizeDescription(result.description);
      const ofCheck = hasStrictOwnerfinancing(freshDescription);
      const financingResult = detectFinancingType(freshDescription);

      // ── Contact info (attributionInfo wins over top-level) ───────────────
      const freshAgentName = result.attributionInfo?.agentName || result.agentName || existingData.agentName || null;
      const freshAgentPhone = result.attributionInfo?.agentPhoneNumber || result.agentPhoneNumber || existingData.agentPhoneNumber || null;
      const freshAgentEmail = result.attributionInfo?.agentEmail || result.agentEmail || existingData.agentEmail || null;
      const freshBrokerName = result.attributionInfo?.brokerName || result.brokerName || existingData.brokerName || null;
      const freshBrokerPhone = result.attributionInfo?.brokerPhoneNumber || result.brokerPhoneNumber || result.brokerPhone || existingData.brokerPhoneNumber || null;
      const freshMlsId = result.attributionInfo?.mlsId || result.mlsid || existingData.mlsId || null;

      // ── Parcel / county (from resoFacts when available) ──────────────────
      const freshParcelId = result.parcelId || result.resoFacts?.parcelNumber || existingData.parcelId || null;
      const freshCounty = result.county || existingData.county || null;

      // ── Virtual tour ─────────────────────────────────────────────────────
      const freshVirtualTour = result.virtualTourUrl || result.thirdPartyVirtualTour?.externalUrl || existingData.virtualTourUrl || null;

      // ── Tax: prefer explicit annualTaxAmount, fall back to latest taxHistory ─
      const taxFromHistory = Array.isArray(result.taxHistory)
        ? (result.taxHistory.find(t => t?.taxPaid)?.taxPaid || 0)
        : 0;
      const freshAnnualTax = result.annualTaxAmount || taxFromHistory || null;

      // ── Price & sqft normalized ──────────────────────────────────────────
      const freshPrice = result.listPrice || result.price || 0;
      const freshSqft = result.livingArea || result.livingAreaValue || result.squareFoot || null;
      const freshLotSqft = result.lotAreaValue || result.lotSize || result.lotSquareFoot || null;
      const freshHoa = result.monthlyHoaFee || result.hoaFee || result.hoa || 0;

      // ── Cash flow recompute (null when missing rent/price) ───────────────
      const cashFlow = freshPrice && newRentEstimate
        ? calculateCashFlow(freshPrice, newRentEstimate, Number(freshAnnualTax) || 0, Number(freshHoa) || 0)
        : null;

      // ── Canonical URL (hdpUrl has highest fidelity) ──────────────────────
      const freshHdpUrl = result.hdpUrl || existingData.hdpUrl || '';
      const freshUrl = freshHdpUrl
        ? (freshHdpUrl.startsWith('http') ? freshHdpUrl : `https://www.zillow.com${freshHdpUrl}`)
        : (prop.url || existingData.url);

      // Build update data — every property detail refreshed, with delete
      // sentinels on optional fields so a cleared-by-Zillow value doesn't
      // silently stick around from a prior scrape.
      const del = admin.firestore.FieldValue.delete;
      const updateData: Record<string, unknown> = {
        // Identifiers + URLs
        url: freshUrl,
        hdpUrl: freshHdpUrl || del(),
        virtualTourUrl: freshVirtualTour ?? del(),
        mlsId: freshMlsId ?? del(),
        parcelId: freshParcelId ?? del(),
        county: freshCounty ?? del(),

        // Address (current Zillow truth — only write when we have a fresh
        // non-empty value; never clobber a populated address with empty).
        ...(freshStreetAddress ? { streetAddress: freshStreetAddress, address: freshStreetAddress } : {}),
        ...(freshFullAddress ? { fullAddress: freshFullAddress } : {}),
        ...(freshCity ? { city: freshCity } : {}),
        ...(freshState ? { state: freshState } : {}),
        ...(freshZip ? { zipCode: freshZip, zipcode: freshZip } : {}),

        // Status + activity
        homeStatus: newStatus,
        keystoneHomeStatus: r.keystoneHomeStatus || del(),
        price: freshPrice,
        listPrice: freshPrice,
        daysOnZillow: result.daysOnZillow || 0,
        description: freshDescription,

        // Reactivation
        isActive: true,
        offMarketReason: del(),
        consecutiveNoResults: 0,
        ...(ofMissIncrement !== null ? { ofMissCount: ofMissIncrement } : {}),

        // Distressed-listing flags
        isAuction: subTypeFlags.isAuction,
        isForeclosure: subTypeFlags.isForeclosure,
        isBankOwned: subTypeFlags.isBankOwned,
        listingSubType: subTypeFlags.listingSubType,

        // Distressed listings are never owner-finance — strip stale OF tagging.
        ...(isDistressedNow
          ? {
              isOwnerfinance: false,
              dealTypes: admin.firestore.FieldValue.arrayRemove('owner_finance'),
            }
          : {}),

        // Timestamps
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),
        updatedAt: new Date(),

        // Property details — structural facts don't change, so only overwrite
        // when Zillow returns a non-null value; never delete on a scrape miss.
        ...(result.bedrooms != null ? { bedrooms: result.bedrooms } : {}),
        ...(result.bathrooms != null ? { bathrooms: result.bathrooms } : {}),
        ...(freshSqft != null && freshSqft > 0 ? { squareFoot: freshSqft, squareFeet: freshSqft } : {}),
        ...(freshLotSqft != null && freshLotSqft > 0 ? { lotSquareFoot: freshLotSqft, lotSize: freshLotSqft } : {}),
        ...(result.yearBuilt != null && result.yearBuilt > 0 ? { yearBuilt: result.yearBuilt } : {}),
        ...(result.homeType || result.propertyType ? {
          homeType: normalizeHomeType(result.homeType || result.propertyType),
          propertyType: result.homeType || result.propertyType,
          isLand: normalizeHomeType(result.homeType || result.propertyType) === 'land',
        } : {}),

        // Location — coords only move when Zillow re-geocodes; don't delete on miss.
        ...(result.latitude != null ? { latitude: result.latitude } : {}),
        ...(result.longitude != null ? { longitude: result.longitude } : {}),

        // Estimates (delete sentinel when Zillow no longer reports)
        estimate: newEstimate ?? del(),
        zestimate: newEstimate ?? del(),
        rentEstimate: newRentEstimate ?? del(),
        rentZestimate: newRentEstimate ?? del(),

        // Cash-deal / fixer classification (land + missing-estimate paths)
        ...(() => {
          const freshIsLand = normalizeHomeType(result.homeType || result.propertyType) === 'land';
          if (!newEstimate || newEstimate <= 0 || !freshPrice || freshIsLand) {
            return {
              eightyPercentOfZestimate: del(),
              discountPercentage: del(),
              priceToZestimateRatio: del(),
              isCashDeal: false,
              isFixer: false,
              cashDealReason: del(),
              dealTypes: admin.firestore.FieldValue.arrayRemove('cash_deal'),
            };
          }
          const disc = ((newEstimate - freshPrice) / newEstimate) * 100;
          const eighty = newEstimate * 0.8;
          const gap = newEstimate - freshPrice;
          const FIXER_GAP = 150_000;
          const isFixer = freshPrice < eighty && gap > FIXER_GAP;
          const stillCashDeal = freshPrice < eighty;
          return {
            eightyPercentOfZestimate: eighty,
            discountPercentage: disc,
            priceToZestimateRatio: freshPrice / newEstimate,
            isFixer,
            ...(!stillCashDeal ? {
              isCashDeal: false,
              cashDealReason: del(),
              dealTypes: admin.firestore.FieldValue.arrayRemove('cash_deal'),
            } : isFixer ? {
              cashDealReason: 'fixer',
            } : {
              ...(existingData.cashDealReason === 'fixer' ? { cashDealReason: del() } : {}),
            }),
          };
        })(),

        // Costs
        hoa: freshHoa,
        monthlyHoaFee: freshHoa || del(),
        annualTaxAmount: freshAnnualTax ?? del(),
        propertyTaxRate: result.propertyTaxRate ?? del(),
        annualHomeownersInsurance: result.annualHomeownersInsurance ?? del(),

        // Cash flow (recomputed from fresh price / rent / tax / hoa)
        cashFlow: cashFlow || del(),

        // Financing classification (re-detected from fresh description). Only
        // overwrite for non-trusted sources — agent-confirmed / manual docs
        // have curated financing fields we don't want to clobber when Zillow
        // drops keywords from the description.
        ...((() => {
          const manualSources = ['manual-add-v2', 'manual-add', 'admin-upload', 'manual', 'bookmarklet'];
          const isTrusted = manualSources.includes(prop.source || '')
            || prop.agentConfirmedOwnerfinance === true
            || prop.source === 'agent_outreach';
          if (isTrusted) return {};
          return {
            financingType: financingResult.financingType ?? del(),
            allFinancingTypes: financingResult.allTypes.length > 0 ? financingResult.allTypes : del(),
            financingTypeLabel: financingResult.displayLabel || del(),
            matchedKeywords: ofCheck.matchedKeywords.length > 0 ? ofCheck.matchedKeywords : del(),
            primaryKeyword: ofCheck.primaryKeyword || del(),
          };
        })()),

        // Contact info — attribution fields win over stale top-level copies.
        agentName: freshAgentName ?? del(),
        agentPhoneNumber: freshAgentPhone ?? del(),
        agentEmail: freshAgentEmail ?? del(),
        brokerName: freshBrokerName ?? del(),
        brokerPhoneNumber: freshBrokerPhone ?? del(),

        // Images — surface same primary under every alias the rest of the
        // codebase reads (sync.ts, investor-deals route, etc.).
        ...(primaryImage && {
          firstPropertyImage: primaryImage,
          primaryImage: primaryImage,
          imgSrc: primaryImage,
          hiResImageLink: result.hiResImageLink || primaryImage,
          mediumImageLink: result.mediumImageLink || primaryImage,
          desktopWebHdpImageLink: result.desktopWebHdpImageLink || primaryImage,
        }),
        ...(gallery.length > 0 && {
          propertyImages: gallery,
          imageUrls: gallery,
          photoCount: result.photoCount || gallery.length,
        }),
      };

      // Strip null + undefined. Clears are handled via FieldValue.delete()
      // sentinels above (not raw null), so this filter is safe.
      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== null && v !== undefined)
      );

      firestoreBatch.update(docRef, cleanedData);
      updated++;
      batchCount++;

    }

    // Commit the main batch
    if (batchCount > 0) {
      await firestoreBatch.commit();
    }

    // Process Typesense deletes ONLY after Firestore commit succeeds. This
    // prevents drift where Firestore still has active data but Typesense was
    // cleared (or vice versa). We also belt-and-suspender this: the Cloud
    // Function may have already deleted — that's a 404 we swallow.
    if (typesenseDeletesAfterCommit.length > 0) {
      console.log(`🧹 Typesense deletes: ${typesenseDeletesAfterCommit.length}`);
      await Promise.all(typesenseDeletesAfterCommit.map(deleteFromTypesense));
    }

    // NOTE: No longer need separate sync step since we're operating directly on unified 'properties' collection
    const totalSynced = updated;

    // ============================================
    // STEP 4.5: Typesense reconciliation (once per 24h)
    //
    // Cloud Function sync occasionally drifts — scripts that write directly
    // to Typesense without checking Firestore, CF failures, etc. Scan a page
    // of active Typesense docs and delete any whose Firestore is missing,
    // inactive, or permanently-deleted-status.
    // ============================================
    const RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const RECONCILE_MAX_SCAN = 2500;
    const reconcileMetaRef = db.collection('cron_meta').doc('typesense_reconcile');
    const reconcileMeta = await reconcileMetaRef.get();
    const lastReconcile = reconcileMeta.exists
      ? (reconcileMeta.data()?.lastRun?.toMillis?.() || 0)
      : 0;
    let reconcileDeleted = 0;
    let reconcileScanned = 0;
    let reconcileRan = false;

    if (tsCollection && Date.now() - lastReconcile > RECONCILE_INTERVAL_MS) {
      reconcileRan = true;
      console.log(`🧹 Typesense reconciliation starting (last run: ${lastReconcile ? new Date(lastReconcile).toISOString() : 'never'})`);

      const PAGE_SIZE = 250;
      let tsPage = 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const driftIds: string[] = [];
      // Field drift: Typesense has stale flag values that disagree with
      // Firestore. We re-upsert these so the search index reflects the truth.
      const fieldDriftIds: string[] = [];

      while (reconcileScanned < RECONCILE_MAX_SCAN && Date.now() - startTime < MAX_RUNTIME_MS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let searchRes: any;
        try {
          searchRes = await tsCollection.documents().search({
            q: '*',
            filter_by: 'isActive:=true',
            per_page: PAGE_SIZE,
            page: tsPage,
            include_fields: 'id,homeStatus,isAuction,isForeclosure,isBankOwned,listPrice,zestimate',
          });
        } catch (err) {
          console.error('[reconcile] Typesense search failed:', err);
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hits = (searchRes.hits || []) as Array<{ document: any }>;
        if (hits.length === 0) break;
        reconcileScanned += hits.length;

        // Batch Firestore reads in chunks of 30 (in-query limit)
        const ids = hits.map(h => String(h.document.id));
        for (let i = 0; i < ids.length; i += 30) {
          const chunk = ids.slice(i, i + 30);
          const snaps = await Promise.all(chunk.map(id => db.collection('properties').doc(id).get()));
          snaps.forEach((snap, idx) => {
            const id = chunk[idx];
            const tsDoc = hits.find(h => String(h.document.id) === id)?.document || {};
            if (!snap.exists) { driftIds.push(id); return; }
            const data = snap.data();
            if (!data) return;
            if (data.isActive === false) { driftIds.push(id); return; }
            const status = String(data.homeStatus || '').toUpperCase();
            if (PERMANENT_DELETE_STATUSES.has(status)) { driftIds.push(id); return; }

            // FIELD DRIFT: distressed flags or price disagreement between
            // Firestore (truth) and Typesense (search index). Re-upsert via
            // a noop Firestore touch so the Cloud Function re-syncs.
            const fsAuction = data.isAuction === true;
            const fsForeclosure = data.isForeclosure === true;
            const fsBankOwned = data.isBankOwned === true;
            const tsAuction = tsDoc.isAuction === true;
            const tsForeclosure = tsDoc.isForeclosure === true;
            const tsBankOwned = tsDoc.isBankOwned === true;
            const fsPrice = Number(data.listPrice || data.price || 0);
            const tsPrice = Number(tsDoc.listPrice || 0);
            const priceDriftPct = fsPrice > 0 ? Math.abs(fsPrice - tsPrice) / fsPrice : 0;

            if (
              fsAuction !== tsAuction ||
              fsForeclosure !== tsForeclosure ||
              fsBankOwned !== tsBankOwned ||
              priceDriftPct > 0.01
            ) {
              fieldDriftIds.push(id);
            }
          });
        }

        if (hits.length < PAGE_SIZE) break;
        tsPage++;
      }

      if (driftIds.length > 0) {
        console.log(`🧹 Reconcile: deleting ${driftIds.length} drifted Typesense docs`);
        await Promise.all(driftIds.map(deleteFromTypesense));
        reconcileDeleted = driftIds.length;
      }

      // Field-drift fix: touch each drifted Firestore doc so the Cloud Function
      // re-syncs the full record to Typesense. This is cheap (one timestamp
      // write per drifted doc) and self-healing.
      let fieldDriftFixed = 0;
      if (fieldDriftIds.length > 0) {
        console.log(`🧹 Reconcile: ${fieldDriftIds.length} field-drift docs — touching to re-sync`);
        let touchBatch = db.batch();
        let touchCount = 0;
        for (const id of fieldDriftIds) {
          touchBatch.update(db.collection('properties').doc(id), {
            typesenseReconciledAt: new Date(),
          });
          touchCount++;
          if (touchCount >= 400) {
            await touchBatch.commit();
            touchBatch = db.batch();
            touchCount = 0;
          }
        }
        if (touchCount > 0) await touchBatch.commit();
        fieldDriftFixed = fieldDriftIds.length;
      }

      await reconcileMetaRef.set({
        lastRun: new Date(),
        scanned: reconcileScanned,
        drift: reconcileDeleted,
        fieldDrift: fieldDriftFixed,
      }, { merge: true });

      console.log(`🧹 Reconcile done: scanned ${reconcileScanned}, deleted ${reconcileDeleted}, field-drift ${fieldDriftFixed}`);
    } else if (tsCollection) {
      const hoursSince = ((Date.now() - lastReconcile) / 3600000).toFixed(1);
      console.log(`🧹 Reconcile skipped (last run ${hoursSince}h ago, interval 24h)`);
    }

    // ============================================
    // STEP 5: Save report and log completion
    // ============================================
    const duration = Date.now() - startTime;

    // Always save status change report (for monitoring)
    await db.collection('status_change_reports').add({
      date: new Date(),
      totalChecked: toProcess.length,
      updated,
      deactivated,
      deleted,
      reactivated,
      statusChanges: statusChanges.length,
      noResult,
      changes: statusChanges.slice(0, 50),
      deletions: deletions.slice(0, 50),
      synced: totalSynced,
      durationMs: duration,
      createdAt: new Date(),
    });

    // Update cron log
    await logRef.update({
      status: 'completed',
      completedAt: new Date(),
      durationMs: duration,
      reconcile: reconcileRan ? { scanned: reconcileScanned, drift: reconcileDeleted } : null,
      results: {
        processed: toProcess.length,
        updated,
        deactivated,
        deleted,
        reactivated,
        noResult,
        statusChanged,
        synced: totalSynced,
      },
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ Status refresh complete');
    console.log(`   Processed:    ${toProcess.length}`);
    console.log(`   Updated:      ${updated}`);
    console.log(`   Deactivated:  ${deactivated}`);
    console.log(`   Deleted:      ${deleted}`);
    console.log(`   Reactivated:  ${reactivated}`);
    console.log(`   No result:    ${noResult}`);
    console.log(`   Status changes: ${statusChanged}`);
    console.log(`   Synced to properties: ${totalSynced}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);

    // Calculate backlog percentage based on active bucket only
    const activeNeedsCount = activeNeedsCheck.length;
    const backlogPercent = activeProperties.length > 0 ? (activeNeedsCount / activeProperties.length) * 100 : 0;

    return NextResponse.json({
      success: true,
      runId,
      stats: {
        total: allProperties.length,
        active: activeProperties.length,
        inactive: inactiveProperties.length,
        processed: toProcess.length,
        updated,
        deactivated,
        deleted,
        reactivated,
        noResult,
        statusChanged,
        synced: totalSynced,
        backlogPercent: parseFloat(backlogPercent.toFixed(1)),
        durationMs: duration,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Cron error:', errorMessage);

    // Log failure
    await logRef.update({
      status: 'failed',
      error: errorMessage,
      failedAt: new Date(),
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
  }); // End withCronLock

  if (lockResult === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true,
    }, { status: 200 });
  }

  return lockResult;
}
