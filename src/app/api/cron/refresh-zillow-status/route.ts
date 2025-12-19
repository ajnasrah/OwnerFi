import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
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
  isOwnerFinance: boolean;
  agentConfirmedOwnerFinance?: boolean;
  source?: string;
}

/**
 * COST-OPTIMIZED Zillow Status Refresh Cron
 *
 * COST OPTIMIZATION:
 * - 7-day rotation target (not daily) to minimize Apify credits
 * - Skips properties checked within last 3 days
 * - Dynamic batch size: ~18 properties/run for 6,000 total
 * - Max 100 properties/run to cap costs
 *
 * FEATURES:
 * 1. Error logging to Firestore (cron_logs collection)
 * 2. Syncs lastStatusCheck to unified 'properties' collection
 * 3. Timeout protection - stops at 4.5 min
 * 4. Priority: never checked → >7 days → 3-7 days → skip fresh
 *
 * TARGETS: properties (unified) + agent_outreach_queue
 * RUNS: Every 30 minutes
 * COST: ~860 properties/day (vs 7,200 before) = 88% savings
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}`;

  console.log(`🔄 [CRON ${runId}] Starting Zillow status refresh`);

  // Security check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const TARGET_ROTATION_DAYS = 7; // Check every property once per 7 days
    const RUNS_PER_DAY = 48; // Every 30 minutes
    const MIN_BATCH_SIZE = 10; // Minimum to process per run
    const MAX_BATCH_SIZE = 100; // Maximum to keep Apify costs reasonable

    // ============================================
    // STEP 1: Gather all properties from unified collection + agent outreach
    // ============================================
    const [propertiesSnap, agentOutreachSnap] = await Promise.all([
      db.collection('properties').where('isActive', '==', true).get(),
      db.collection('agent_outreach_queue').where('status', '==', 'sent_to_ghl').get(),
    ]);

    console.log(`📊 Collections: ${propertiesSnap.size} properties, ${agentOutreachSnap.size} agent outreach`);

    if (propertiesSnap.empty && agentOutreachSnap.empty) {
      await logRef.update({ status: 'completed', message: 'No properties', completedAt: new Date() });
      return NextResponse.json({ success: true, message: 'No properties' });
    }

    // Build combined list sorted by lastStatusCheck (oldest first)
    const allProperties: PropertyDoc[] = [];

    // Add properties from unified collection
    propertiesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.url) return;

      allProperties.push({
        id: doc.id,
        collection: 'properties',
        url: data.url,
        zpid: data.zpid || '',
        address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
        currentStatus: data.homeStatus || 'UNKNOWN',
        lastCheck: data.lastStatusCheck?.toDate?.() || null,
        isOwnerFinance: data.isOwnerFinance || false,
        agentConfirmedOwnerFinance: data.agentConfirmedOwnerFinance,
        source: data.source,
      });
    });

    // Add agent outreach queue
    agentOutreachSnap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.url) return;

      allProperties.push({
        id: doc.id,
        collection: 'agent_outreach_queue',
        url: data.url,
        zpid: data.zpid || '',
        address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
        currentStatus: data.homeStatus || 'UNKNOWN',
        lastCheck: data.lastStatusCheck?.toDate?.() || null,
        isOwnerFinance: false,
        agentConfirmedOwnerFinance: data.agentConfirmedOwnerFinance,
        source: data.source,
      });
    });

    // ============================================
    // STEP 2: Filter to only properties that NEED checking (cost optimization)
    // ============================================
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // Categorize properties by staleness
    const neverChecked = allProperties.filter(p => !p.lastCheck);
    const over7Days = allProperties.filter(p => {
      if (!p.lastCheck) return false;
      return (now - p.lastCheck.getTime()) > SEVEN_DAYS_MS;
    });
    const threeTo7Days = allProperties.filter(p => {
      if (!p.lastCheck) return false;
      const age = now - p.lastCheck.getTime();
      return age > THREE_DAYS_MS && age <= SEVEN_DAYS_MS;
    });
    const fresh = allProperties.filter(p => {
      if (!p.lastCheck) return false;
      return (now - p.lastCheck.getTime()) <= THREE_DAYS_MS;
    });

    console.log(`📊 Property freshness breakdown:`);
    console.log(`   Never checked: ${neverChecked.length}`);
    console.log(`   >7 days old: ${over7Days.length}`);
    console.log(`   3-7 days old: ${threeTo7Days.length}`);
    console.log(`   Fresh (<3 days): ${fresh.length} (SKIPPING)`);

    // Build priority queue: never checked → >7 days → 3-7 days
    // SKIP fresh properties entirely to save Apify credits
    const needsChecking = [...neverChecked, ...over7Days, ...threeTo7Days];

    // Sort by lastCheck (null/oldest first)
    needsChecking.sort((a, b) => {
      if (!a.lastCheck && !b.lastCheck) return 0;
      if (!a.lastCheck) return -1;
      if (!b.lastCheck) return 1;
      return a.lastCheck.getTime() - b.lastCheck.getTime();
    });

    // Calculate optimal batch size to complete rotation in TARGET_ROTATION_DAYS
    // Formula: totalProperties / (TARGET_ROTATION_DAYS * RUNS_PER_DAY)
    const totalRuns = TARGET_ROTATION_DAYS * RUNS_PER_DAY;
    const optimalBatchSize = Math.ceil(allProperties.length / totalRuns);
    const batchSize = Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, optimalBatchSize));

    const dailyProperties = batchSize * RUNS_PER_DAY;
    const actualRotationDays = allProperties.length / dailyProperties;

    console.log(`📊 Cost optimization:`);
    console.log(`   Total properties: ${allProperties.length}`);
    console.log(`   Target rotation: ${TARGET_ROTATION_DAYS} days`);
    console.log(`   Optimal batch: ${optimalBatchSize} → Capped: ${batchSize}`);
    console.log(`   Daily checks: ${dailyProperties} | Actual rotation: ${actualRotationDays.toFixed(1)} days`);
    console.log(`   Need checking now: ${needsChecking.length} (skipping ${fresh.length} fresh)`);

    // Select properties to process (only from those that need it)
    const toProcess = needsChecking.slice(0, batchSize);

    if (toProcess.length === 0) {
      await logRef.update({ status: 'completed', message: 'No properties to process', completedAt: new Date() });
      return NextResponse.json({ success: true, message: 'No properties to process' });
    }

    // Update log with batch info
    await logRef.update({
      totalProperties: allProperties.length,
      needsChecking: needsChecking.length,
      freshSkipped: fresh.length,
      batchSize: toProcess.length,
      targetRotationDays: TARGET_ROTATION_DAYS,
      actualRotationDays: parseFloat(actualRotationDays.toFixed(1)),
    });

    // ============================================
    // STEP 3: Run Apify scraper (single batch)
    // ============================================
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    console.log(`🚀 Starting Apify scraper for ${toProcess.length} properties...`);

    const run = await client.actor(actorId).call({
      startUrls: toProcess.map(p => ({ url: p.url })),
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
    let deleted = 0;
    let statusChanged = 0;
    let noResult = 0;

    const statusChanges: Array<{ address: string; old: string; new: string }> = [];
    const deletions: Array<{ address: string; reason: string }> = [];

    // Process in Firestore batches (max 500 per batch)
    const firestoreBatch = db.batch();
    let batchCount = 0;

    for (const prop of toProcess) {
      // Check timeout
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏰ Approaching timeout, stopping early');
        break;
      }

      const zpid = String(prop.zpid || '');
      const result = zpidToResult.get(zpid);

      const docRef = db.collection(prop.collection).doc(prop.id);

      if (!result) {
        // No Apify result - property likely off-market
        noResult++;

        if (prop.collection === 'properties') {
          // Mark as inactive in unified collection (don't delete)
          firestoreBatch.update(docRef, {
            isActive: false,
            offMarketReason: 'No Apify result (likely off-market)',
            lastStatusCheck: new Date(),
          });
          deleted++;
          deletions.push({ address: prop.address, reason: 'No Apify result (likely off-market)' });
        } else {
          // agent_outreach_queue
          firestoreBatch.update(docRef, {
            status: 'property_off_market',
            offMarketReason: 'No Apify result',
            lastStatusCheck: new Date(),
          });
        }
        batchCount++;
        continue;
      }

      const newStatus = result.homeStatus || 'UNKNOWN';
      const oldStatus = prop.currentStatus;

      // Track status changes
      if (oldStatus !== newStatus) {
        statusChanged++;
        statusChanges.push({ address: prop.address, old: oldStatus, new: newStatus });
      }

      // Check if property is inactive
      const inactiveStatuses = ['PENDING', 'SOLD', 'RECENTLY_SOLD', 'OFF_MARKET', 'FOR_RENT', 'CONTINGENT', 'OTHER', 'UNKNOWN'];
      const isInactive = inactiveStatuses.includes(newStatus);
      const hasNoPrice = !result.price && !result.listPrice;
      const isPriceZero = result.price === 0 || result.listPrice === 0;

      if (isInactive || hasNoPrice || isPriceZero) {
        const reason = isInactive ? `Status: ${newStatus}` : 'No/zero price';

        if (prop.collection === 'agent_outreach_queue') {
          firestoreBatch.update(docRef, {
            status: 'property_off_market',
            homeStatus: newStatus,
            offMarketReason: reason,
            lastStatusCheck: new Date(),
          });
        } else {
          // Unified properties collection - mark as inactive instead of deleting
          firestoreBatch.update(docRef, {
            isActive: false,
            homeStatus: newStatus,
            offMarketReason: reason,
            lastStatusCheck: new Date(),
          });
          deleted++;
          deletions.push({ address: prop.address, reason });
        }
        batchCount++;
        continue;
      }

      // Property is still active - check owner financing for owner finance properties
      if (prop.collection === 'properties' && prop.isOwnerFinance) {
        const isAgentConfirmed = prop.agentConfirmedOwnerFinance || prop.source === 'agent_outreach';
        const ownerFinanceCheck = hasStrictOwnerFinancing(result.description);

        if (!ownerFinanceCheck.passes && !isAgentConfirmed) {
          // No longer offers owner financing - mark as inactive instead of deleting
          firestoreBatch.update(docRef, {
            isOwnerFinance: false,
            isActive: false,
            offMarketReason: 'Owner financing removed from listing',
            lastStatusCheck: new Date(),
          });
          deleted++;
          deletions.push({ address: prop.address, reason: 'Owner financing removed from listing' });
          batchCount++;
          continue;
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        homeStatus: newStatus,
        price: result.price || result.listPrice || 0,
        listPrice: result.listPrice || result.price || 0,
        daysOnZillow: result.daysOnZillow || 0,
        description: sanitizeDescription(result.description),
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),
        consecutiveNoResults: 0,

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

    // NOTE: No longer need separate sync step since we're operating directly on unified 'properties' collection
    const totalSynced = updated;

    // ============================================
    // STEP 5: Save report and log completion
    // ============================================
    const duration = Date.now() - startTime;

    // Always save status change report (for monitoring)
    await db.collection('status_change_reports').add({
      date: new Date(),
      totalChecked: toProcess.length,
      updated,
      statusChanges: statusChanges.length,
      deleted: deletions.length,
      noResult,
      changes: statusChanges.slice(0, 50), // Limit stored
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
      results: {
        processed: toProcess.length,
        updated,
        deleted,
        noResult,
        statusChanged,
        synced: totalSynced,
      },
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ Status refresh complete');
    console.log(`   Processed: ${toProcess.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   No result: ${noResult}`);
    console.log(`   Status changes: ${statusChanged}`);
    console.log(`   Synced to properties: ${totalSynced}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);

    // Calculate backlog percentage (properties not checked in last 7 days)
    const backlogPercent = needsChecking.length > 0 ? (needsChecking.length / allProperties.length) * 100 : 0;

    return NextResponse.json({
      success: true,
      runId,
      stats: {
        total: allProperties.length,
        processed: toProcess.length,
        updated,
        deleted,
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
}
