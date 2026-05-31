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
 * Statuses that mean the property is gone for good
 */
const PERMANENT_DELETE_STATUSES = new Set([
  'FOR_RENT',
  'SOLD',
  'RECENTLY_SOLD',
  'OFF_MARKET',
]);

/**
 * Statuses that make a listing temporarily inactive
 */
const TRANSIENT_INACTIVE_STATUSES = new Set([
  'PENDING', 'CONTINGENT', 'UNDER_CONTRACT', 'OTHER', 'UNKNOWN',
]);

const NO_RESULT_DELETE_THRESHOLD = 3;
const FRESH_SKIP_HOURS = 12;
const OF_MISS_THRESHOLD = 2;

// Type for Apify Zillow scraper response
interface ZillowApifyItem {
  zpid?: string | number;
  id?: string | number;
  homeStatus?: string;
  keystoneHomeStatus?: string;
  hdpTypeDimension?: string;
  listingSubType?: any;
  listing_sub_type?: any;
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
  responsivePhotos?: Array<any>;
  propertyImages?: string[];
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
  resoFacts?: { parcelNumber?: string; [k: string]: any };
  hdpUrl?: string;
  virtualTourUrl?: string;
  thirdPartyVirtualTour?: { externalUrl?: string };
  taxHistory?: Array<{ taxPaid?: number; [k: string]: any }>;
  address?: { streetAddress?: string; city?: string; state?: string; zipcode?: string; [k: string]: any };
  city?: string;
  state?: string;
  zipcode?: string;
  zip?: string;
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
 * Fixed Zillow Status Refresh Cron
 * 
 * Key fixes:
 * 1. Query properties in smaller chunks to avoid memory issues
 * 2. Prioritize properties that haven't been checked or have problematic statuses
 * 3. Better error handling for Apify failures
 * 4. Process more properties per run to catch up with backlog
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

  // Use cron lock to prevent concurrent execution
  const lockResult = await withCronLock('refresh-zillow-status', async () => {
    const runId = `run_${Date.now()}`;
    console.log(`🔄 [CRON ${runId}] Starting Zillow status refresh (FIXED)`);

    const tsClient = getTypesenseAdminClient();
    const tsCollection = tsClient?.collections(TYPESENSE_COLLECTIONS.PROPERTIES);

    async function deleteFromTypesense(docId: string): Promise<void> {
      if (!tsCollection) return;
      try {
        await tsCollection.documents(docId).delete();
      } catch (err: unknown) {
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
      version: 'fixed',
    });

    try {
      const MAX_RUNTIME_MS = 270000; // 4.5 minutes
      const MAX_BATCH_SIZE = 150; // Increased to process more properties per run
      const PRIORITY_BATCH_SIZE = 50; // Properties with problematic statuses

      console.log('📊 Fetching priority properties...');

      // PRIORITY 1: Properties with problematic statuses (should be updated immediately)
      const problematicStatuses = ['SOLD', 'PENDING', 'OFF_MARKET', 'UNDER_CONTRACT', 'CONTINGENT', 'RECENTLY_SOLD'];
      const problematicPropsPromises = problematicStatuses.map(status =>
        db.collection('properties')
          .where('isActive', '==', true)
          .where('homeStatus', '==', status)
          .limit(10)
          .get()
      );
      
      const problematicSnapshots = await Promise.all(problematicPropsPromises);
      const problematicDocs = problematicSnapshots.flatMap(snap => snap.docs);
      
      console.log(`Found ${problematicDocs.length} properties with problematic statuses`);

      // PRIORITY 2: Get active properties and filter in memory to avoid index requirements
      const activePropsSnap = await db.collection('properties')
        .where('isActive', '==', true)
        .limit(500) // Get a larger batch and filter in memory
        .get();
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const neverCheckedDocs = [];
      const oldCheckedDocs = [];
      
      activePropsSnap.docs.forEach(doc => {
        const data = doc.data();
        const lastCheck = data.lastStatusCheck?.toDate?.();
        
        if (!lastCheck) {
          if (neverCheckedDocs.length < 50) {
            neverCheckedDocs.push(doc);
          }
        } else if (lastCheck < sevenDaysAgo) {
          if (oldCheckedDocs.length < 50) {
            oldCheckedDocs.push(doc);
          }
        }
      });
      
      // Sort old checked by date
      oldCheckedDocs.sort((a, b) => {
        const aDate = a.data().lastStatusCheck?.toDate?.() || new Date(0);
        const bDate = b.data().lastStatusCheck?.toDate?.() || new Date(0);
        return aDate.getTime() - bDate.getTime();
      });

      console.log(`Found ${neverCheckedDocs.length} never checked, ${oldCheckedDocs.length} not checked in 7+ days`);

      // Combine all priority properties
      const allPriorityDocs = [
        ...problematicDocs,
        ...neverCheckedDocs,
        ...oldCheckedDocs
      ];

      // Deduplicate by ID
      const seenIds = new Set<string>();
      const toProcess: PropertyDoc[] = [];
      
      for (const doc of allPriorityDocs) {
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);
        
        const data = doc.data();
        if (!data.url && !data.hdpUrl) continue;
        
        toProcess.push({
          id: doc.id,
          collection: 'properties',
          url: data.url || data.hdpUrl,
          zpid: data.zpid || '',
          address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
          currentStatus: data.homeStatus || 'UNKNOWN',
          lastCheck: data.lastStatusCheck?.toDate?.() || null,
          isOwnerfinance: data.isOwnerfinance || false,
          agentConfirmedOwnerfinance: data.agentConfirmedOwnerfinance,
          source: data.source,
        });
        
        if (toProcess.length >= MAX_BATCH_SIZE) break;
      }

      // If we still have room, add some regular active properties
      if (toProcess.length < MAX_BATCH_SIZE) {
        // Get more active properties without ordering to avoid index requirement
        const regularPropsSnap = await db.collection('properties')
          .where('isActive', '==', true)
          .limit(300)
          .get();
        
        // Sort in memory by lastStatusCheck (oldest first)
        const sortedDocs = regularPropsSnap.docs.sort((a, b) => {
          const aDate = a.data().lastStatusCheck?.toDate?.() || new Date(0);
          const bDate = b.data().lastStatusCheck?.toDate?.() || new Date(0);
          return aDate.getTime() - bDate.getTime();
        });
          
        for (const doc of sortedDocs) {
          if (seenIds.has(doc.id)) continue;
          
          const data = doc.data();
          if (!data.url && !data.hdpUrl) continue;
          
          toProcess.push({
            id: doc.id,
            collection: 'properties',
            url: data.url || data.hdpUrl,
            zpid: data.zpid || '',
            address: data.fullAddress || data.streetAddress || data.address || 'Unknown',
            currentStatus: data.homeStatus || 'UNKNOWN',
            lastCheck: data.lastStatusCheck?.toDate?.() || null,
            isOwnerfinance: data.isOwnerfinance || false,
            agentConfirmedOwnerfinance: data.agentConfirmedOwnerfinance,
            source: data.source,
          });
          
          if (toProcess.length >= MAX_BATCH_SIZE) break;
        }
      }

      console.log(`📊 Processing ${toProcess.length} properties this run`);

      if (toProcess.length === 0) {
        await logRef.update({ 
          status: 'completed', 
          message: 'No properties to process', 
          completedAt: new Date() 
        });
        return NextResponse.json({ success: true, message: 'No properties to process' });
      }

      // Update log with batch info
      await logRef.update({
        batchSize: toProcess.length,
        problematicCount: problematicDocs.length,
        neverCheckedCount: neverCheckedDocs.length,
        oldCheckedCount: oldCheckedDocs.length,
      });

      // Run Apify scraper
      const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
      const actorId = 'maxcopell/zillow-detail-scraper';

      console.log(`🚀 Starting Apify scraper for ${toProcess.length} properties...`);

      const normalizeZillowUrl = (url: string): string => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `https://www.zillow.com${url.startsWith('/') ? '' : '/'}${url}`;
      };

      let results: ZillowApifyItem[] = [];
      try {
        const run = await client.actor(actorId).call({
          startUrls: toProcess.map(p => ({ url: normalizeZillowUrl(p.url) })),
          maxRequestsPerCrawl: toProcess.length + 10, // Small buffer
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems({
          clean: false,
          limit: 1000,
        });

        results = items as ZillowApifyItem[];
        console.log(`✓ Apify returned ${results.length} results`);
      } catch (apifyError) {
        console.error('❌ Apify scraper failed:', apifyError);
        // Mark all properties as checked anyway to prevent them from being stuck
        const batch = db.batch();
        let batchCount = 0;
        
        for (const prop of toProcess) {
          batch.update(db.collection(prop.collection).doc(prop.id), {
            lastStatusCheck: new Date(),
            lastStatusCheckError: 'Apify scraper failed',
          });
          batchCount++;
          
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
        }
        
        throw apifyError;
      }

      // Process results
      const zpidToResult = new Map<string, ZillowApifyItem>();
      results.forEach(item => {
        const zpid = String(item.zpid || item.id || '');
        if (zpid) zpidToResult.set(zpid, item);
      });

      let updated = 0;
      let deleted = 0;
      let deactivated = 0;
      let reactivated = 0;
      let statusChanged = 0;
      let noResult = 0;

      const statusChanges: Array<{ address: string; old: string; new: string }> = [];
      const deletions: Array<{ address: string; reason: string }> = [];

      // Process in Firestore batches
      let firestoreBatch = db.batch();
      let batchCount = 0;
      const typesenseDeletesAfterCommit: string[] = [];

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

        // NO APIFY RESULT
        if (!result) {
          noResult++;
          const currentMisses = (await getExistingField(docRef, 'consecutiveNoResults')) || 0;
          const newMisses = currentMisses + 1;

          if (newMisses >= NO_RESULT_DELETE_THRESHOLD) {
            // Permanent delete
            await docRef.delete();
            if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
            deleted++;
            deletions.push({ address: prop.address, reason: `Delisted (${newMisses} consecutive misses)` });
          } else {
            // Mark as inactive
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

        // PERMANENT DELETE
        if (PERMANENT_DELETE_STATUSES.has(newStatus)) {
          await docRef.delete();
          if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
          deleted++;
          deletions.push({ address: prop.address, reason: `Deleted (status: ${newStatus})` });
          continue;
        }

        // TRANSIENT INACTIVE
        if (TRANSIENT_INACTIVE_STATUSES.has(newStatus) || hasNoPrice || isPriceZero) {
          const reason = TRANSIENT_INACTIVE_STATUSES.has(newStatus)
            ? `Status: ${newStatus}`
            : 'No/zero price';
          
          firestoreBatch.update(docRef, {
            isActive: false,
            homeStatus: newStatus,
            offMarketReason: reason,
            lastStatusCheck: new Date(),
            consecutiveNoResults: 0,
          });
          if (prop.collection === 'properties') typesenseDeletesAfterCommit.push(prop.id);
          deactivated++;
          batchCount++;
          continue;
        }

        // Property is still active - update with fresh data
        const freshDescription = sanitizeDescription(result.description);
        const freshPrice = result.listPrice || result.price || 0;
        const newEstimate = result.zestimate || result.estimate || null;
        const newRentEstimate = result.rentZestimate || result.rentEstimate || null;

        const del = admin.firestore.FieldValue.delete;
        const updateData: Record<string, unknown> = {
          homeStatus: newStatus,
          price: freshPrice,
          listPrice: freshPrice,
          description: freshDescription,
          isActive: true,
          offMarketReason: del(),
          consecutiveNoResults: 0,
          lastStatusCheck: new Date(),
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
          estimate: newEstimate ?? del(),
          zestimate: newEstimate ?? del(),
          rentEstimate: newRentEstimate ?? del(),
          rentZestimate: newRentEstimate ?? del(),
        };

        // Clean up null/undefined values
        const cleanedData = Object.fromEntries(
          Object.entries(updateData).filter(([_, v]) => v !== null && v !== undefined)
        );

        firestoreBatch.update(docRef, cleanedData);
        updated++;
        batchCount++;

        // Commit batch if it's getting large
        if (batchCount >= 400) {
          await firestoreBatch.commit();
          firestoreBatch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await firestoreBatch.commit();
      }

      // Process Typesense deletes
      if (typesenseDeletesAfterCommit.length > 0) {
        console.log(`🧹 Typesense deletes: ${typesenseDeletesAfterCommit.length}`);
        await Promise.all(typesenseDeletesAfterCommit.map(deleteFromTypesense));
      }

      // Save report
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
        durationMs: Date.now() - startTime,
        createdAt: new Date(),
      });

      // Update cron log
      await logRef.update({
        status: 'completed',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        results: {
          processed: toProcess.length,
          updated,
          deactivated,
          deleted,
          reactivated,
          noResult,
          statusChanged,
        },
      });

      console.log('\n' + '='.repeat(50));
      console.log('✅ Status refresh complete');
      console.log(`   Processed:    ${toProcess.length}`);
      console.log(`   Updated:      ${updated}`);
      console.log(`   Deactivated:  ${deactivated}`);
      console.log(`   Deleted:      ${deleted}`);
      console.log(`   No result:    ${noResult}`);
      console.log(`   Status changes: ${statusChanged}`);

      return NextResponse.json({
        success: true,
        runId,
        stats: {
          processed: toProcess.length,
          updated,
          deactivated,
          deleted,
          noResult,
          statusChanged,
        },
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Cron error:', errorMessage);

      await logRef.update({
        status: 'failed',
        error: errorMessage,
        failedAt: new Date(),
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  });

  if (lockResult === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true,
    }, { status: 200 });
  }

  return lockResult;
}