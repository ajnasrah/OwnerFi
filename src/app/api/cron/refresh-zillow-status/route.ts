import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';
import { detectListingSubType } from '@/lib/scraper-v2/property-transformer';
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';

/**
 * Statuses that mean the property is gone for good — delete from Firestore
 * AND Typesense. FOR_RENT is a different market segment we don't serve.
 * SOLD is handled separately below (see SOLD_STATUSES): we keep the Firestore
 * doc so bookmarks show a friendly "sold" page instead of 404, but still
 * drop it from the Typesense search index.
 */
const PERMANENT_DELETE_STATUSES = new Set(['FOR_RENT']);

/**
 * Statuses meaning the property closed. Keep the Firestore doc (for SEO
 * continuity on bookmarks / search-engine cached links), drop from Typesense,
 * stamp with soldAt. /property/[slug] will render a "sold" state + 410 Gone.
 */
const SOLD_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD']);

/**
 * Statuses that make a listing temporarily inactive but still worth
 * re-checking — PENDING deals can fall through, OFF_MARKET can relist.
 */
const TRANSIENT_INACTIVE_STATUSES = new Set([
  'PENDING', 'CONTINGENT', 'OFF_MARKET', 'OTHER', 'UNKNOWN',
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
  responsivePhotos?: Array<{ mixedSources?: { jpeg?: Array<{ url: string }> } }>;
  propertyImages?: string[];
  attributionInfo?: {
    agentName?: string;
    agentPhoneNumber?: string;
    agentEmail?: string;
    brokerName?: string;
    brokerPhoneNumber?: string;
  };
  agentName?: string;
  agentPhoneNumber?: string;
  brokerName?: string;
  address?: { streetAddress?: string };
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

      // ===== SOLD =====
      // SOLD / RECENTLY_SOLD → keep the Firestore doc so bookmarks / indexed
      // search results land on a friendly "sold" page instead of 404. Drop
      // from Typesense so the property stops appearing in search results.
      if (SOLD_STATUSES.has(newStatus)) {
        // `prop` (PropertyDoc) does not carry `soldAt` — read from Firestore
        // so we only stamp the FIRST time we observe SOLD. Otherwise
        // `soldAt` would drift forward on every 14-day recheck, breaking
        // any future retention cleanup built on that timestamp.
        let existingSoldAt: unknown = null;
        try {
          const docSnap = await docRef.get();
          existingSoldAt = docSnap.exists ? (docSnap.data() as Record<string, unknown>).soldAt : null;
        } catch {
          // If the read fails, fall through to stamping — better to
          // overwrite once than to lose the sold-state transition entirely.
        }
        const update: Record<string, unknown> = {
          isActive: false,
          homeStatus: newStatus,
          status: 'sold',
          lastStatusCheck: new Date(),
          consecutiveNoResults: 0,
        };
        if (!existingSoldAt) update.soldAt = new Date();
        firestoreBatch.update(docRef, update);
        if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
        deactivated++;
        batchCount++;
        continue;
      }

      // ===== TRANSIENT INACTIVE =====
      // PENDING / CONTINGENT / OFF_MARKET — deal might fall through, keep for
      // recheck on the inactive rotation bucket.
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
      const subTypeFlags = detectListingSubType(result);
      const isDistressedNow = subTypeFlags.isAuction || subTypeFlags.isForeclosure || subTypeFlags.isBankOwned;

      // Build update data
      const updateData: Record<string, unknown> = {
        homeStatus: newStatus,
        price: result.listPrice || result.price || 0,
        listPrice: result.listPrice || result.price || 0,

        // Reactivation: property is FOR_SALE again.
        isActive: true,
        offMarketReason: admin.firestore.FieldValue.delete(),
        consecutiveNoResults: 0,
        ...(ofMissIncrement !== null ? { ofMissCount: ofMissIncrement } : {}),

        // Distressed-listing flags
        isAuction: subTypeFlags.isAuction,
        isForeclosure: subTypeFlags.isForeclosure,
        isBankOwned: subTypeFlags.isBankOwned,
        listingSubType: subTypeFlags.listingSubType,

        // Distressed listings are never owner-finance — strip any stale OF
        // tagging on this refresh pass. Scraper-v2 ingest already handles new
        // properties; this catches docs that transitioned to distressed state
        // after being tagged OF.
        ...(isDistressedNow
          ? {
              isOwnerfinance: false,
              dealTypes: admin.firestore.FieldValue.arrayRemove('owner_finance'),
            }
          : {}),
        daysOnZillow: result.daysOnZillow || 0,
        description: sanitizeDescription(result.description),
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),

        // Property details
        bedrooms: result.bedrooms ?? null,
        bathrooms: result.bathrooms ?? null,
        squareFoot: result.livingArea || result.livingAreaValue || result.squareFoot || null,
        lotSquareFoot: result.lotAreaValue || result.lotSize || result.lotSquareFoot || null,
        yearBuilt: result.yearBuilt ?? null,
        homeType: result.homeType || result.propertyType || null,

        // Location
        latitude: result.latitude ?? null,
        longitude: result.longitude ?? null,

        // Estimates
        estimate: result.zestimate || result.estimate || null,
        rentEstimate: result.rentZestimate || result.rentEstimate || null,

        // Costs
        hoa: result.monthlyHoaFee || result.hoaFee || result.hoa || 0,
        annualTaxAmount: result.annualTaxAmount || null,

        // Agent info
        ...(result.attributionInfo?.agentName && { agentName: result.attributionInfo.agentName }),
        ...(result.attributionInfo?.agentPhoneNumber && { agentPhoneNumber: result.attributionInfo.agentPhoneNumber }),
        ...(result.agentName && { agentName: result.agentName }),

        // Images
        ...(result.hiResImageLink && { firstPropertyImage: result.hiResImageLink }),
        ...(result.propertyImages?.length && {
          propertyImages: result.propertyImages,
          photoCount: result.propertyImages.length,
          firstPropertyImage: result.propertyImages[0],
        }),
      };

      // Remove nulls
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

      while (reconcileScanned < RECONCILE_MAX_SCAN && Date.now() - startTime < MAX_RUNTIME_MS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let searchRes: any;
        try {
          searchRes = await tsCollection.documents().search({
            q: '*',
            filter_by: 'isActive:=true',
            per_page: PAGE_SIZE,
            page: tsPage,
            include_fields: 'id,homeStatus',
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
            if (!snap.exists) { driftIds.push(id); return; }
            const data = snap.data();
            if (!data) return;
            if (data.isActive === false) { driftIds.push(id); return; }
            const status = String(data.homeStatus || '').toUpperCase();
            if (PERMANENT_DELETE_STATUSES.has(status)) { driftIds.push(id); }
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

      await reconcileMetaRef.set({
        lastRun: new Date(),
        scanned: reconcileScanned,
        drift: reconcileDeleted,
      }, { merge: true });

      console.log(`🧹 Reconcile done: scanned ${reconcileScanned}, drift ${reconcileDeleted}`);
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
