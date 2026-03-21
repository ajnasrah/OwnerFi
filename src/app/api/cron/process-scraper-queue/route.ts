import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { getFirebaseAdmin, FieldValue } from '@/lib/scraper-v2/firebase-admin';
import { transformProperty, validateProperty } from '@/lib/scraper-v2/property-transformer';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { db } = getFirebaseAdmin();

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [QUEUE CRON] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔄 [QUEUE CRON] Starting queue processor');

  const startTime = Date.now();

  // Tracking metrics
  const metrics = {
    queueItemsProcessed: 0,
    apifyItemsReturned: 0,
    transformSucceeded: 0,
    transformFailed: 0,
    validationFailed: 0,
    duplicatesSkipped: 0,
    propertiesSaved: 0,
    queueItemsCompleted: 0,
    queueItemsFailed: 0,
    errors: [] as Array<{ zpid?: number; address?: string; error: string; stage: string }>,
  };

  // Use cron lock to prevent concurrent execution
  const result = await withCronLock('process-scraper-queue', async () => {
  try {
    // Reset stuck processing items (older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckItems = await db
      .collection('scraper_queue')
      .where('status', '==', 'processing')
      .get();

    if (!stuckItems.empty) {
      const resetBatch = db.batch();
      let resetCount = 0;

      stuckItems.docs.forEach(doc => {
        const data = doc.data();
        const processingStartedAt = data.processingStartedAt?.toDate?.();

        if (!processingStartedAt || processingStartedAt < tenMinutesAgo) {
          resetBatch.update(doc.ref, {
            status: 'pending',
            processingStartedAt: null,
          });
          resetCount++;
        }
      });

      if (resetCount > 0) {
        await resetBatch.commit();
        console.log(`🔄 [QUEUE CRON] Reset ${resetCount} stuck items back to pending`);
      }
    }

    // Find pending items in queue (limit to 25 for optimal processing)
    const pendingItems = await db
      .collection('scraper_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(25)
      .get();

    if (pendingItems.empty) {
      console.log('✅ [QUEUE CRON] No pending items in queue');
      return NextResponse.json({ message: 'No pending items in queue' });
    }

    const urls = pendingItems.docs.map(doc => doc.data().url);
    const queueDocRefs = pendingItems.docs.map(doc => doc.ref);
    metrics.queueItemsProcessed = urls.length;

    console.log(`📋 [QUEUE CRON] Processing ${urls.length} URLs from queue`);

    // Mark as processing
    const batch = db.batch();
    pendingItems.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'processing',
        processingStartedAt: new Date(),
      });
    });
    await batch.commit();

    // Call Apify to scrape
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });
    const actorId = 'maxcopell/zillow-detail-scraper';

    console.log(`🚀 [APIFY] Starting scraper with ${urls.length} URLs`);

    const input = { startUrls: urls.map(url => ({ url })) };

    // Start the run but don't wait for it to finish (use .start() instead of .call())
    const run = await client.actor(actorId).start(input);
    console.log(`✓ [APIFY] Run started: ${run.id}`);

    // Wait for the run to finish with a timeout
    console.log(`⏳ [APIFY] Waiting for run to complete...`);
    const finishedRun = await client.run(run.id).waitForFinish({ waitSecs: 240 }); // 4 minute max wait

    console.log(`✓ [APIFY] Run completed: ${finishedRun.id} (status: ${finishedRun.status})`);

    // Validate Apify run status
    if (finishedRun.status !== 'SUCCEEDED') {
      const errorMsg = `Apify run failed with status: ${finishedRun.status}`;
      console.error(`❌ [APIFY] ${errorMsg}`);
      metrics.errors.push({ error: errorMsg, stage: 'apify' });

      // Mark all queue items as failed so they can be retried
      const failBatch = db.batch();
      queueDocRefs.forEach(docRef => {
        failBatch.update(docRef, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: errorMsg,
          retryCount: FieldValue.increment(1),
        });
      });
      await failBatch.commit();
      metrics.queueItemsFailed = urls.length;

      throw new Error(errorMsg);
    }

    // Validate defaultDatasetId exists
    if (!finishedRun.defaultDatasetId) {
      const errorMsg = 'Apify run succeeded but defaultDatasetId is missing';
      console.error(`❌ [APIFY] ${errorMsg}`);
      metrics.errors.push({ error: errorMsg, stage: 'apify' });
      throw new Error(errorMsg);
    }

    // Get results (no fields filter to get ALL data)
    const { items } = await client.dataset(finishedRun.defaultDatasetId).listItems({
      clean: false,
      limit: 1000,
    });

    metrics.apifyItemsReturned = items.length;
    console.log(`📦 [APIFY] Received ${items.length} items`);

    // Check for existing zpids to avoid duplicates (batched for Firestore 'in' limit of 10)
    const zpids = items.map((item: any) => item.zpid).filter(Boolean);
    const existingZillowZpids = new Set<number>();

    // Batch duplicate checks in groups of 10 (Firestore limit)
    for (let i = 0; i < zpids.length; i += 10) {
      const batchZpids = zpids.slice(i, i + 10);
      if (batchZpids.length > 0) {
        // Check zillow_imports for duplicates
        const zillowSnap = await db
          .collection('zillow_imports')
          .where('zpid', 'in', batchZpids)
          .get();

        zillowSnap.docs.forEach(doc => {
          const zpid = doc.data().zpid;
          if (zpid) existingZillowZpids.add(zpid);
        });
      }
    }

    console.log(`🔍 [DEDUPLICATION] Checked ${zpids.length} zpids, found ${existingZillowZpids.size} existing in zillow_imports`);

    // Transform and save to Firebase with error handling and batching
    let currentBatch = db.batch();
    let batchOperations = 0;
    const BATCH_LIMIT = 500;

    for (const item of items) {
      try {
        // Transform property
        const propertyData = transformProperty(item, 'scraper-queue', 'apify-zillow');
        metrics.transformSucceeded++;

        // Validate property data
        const validation = validateProperty(propertyData);
        if (!validation.valid) {
          metrics.validationFailed++;
          metrics.errors.push({
            zpid: propertyData.zpid,
            address: propertyData.fullAddress,
            error: validation.reason || 'Validation failed',
            stage: 'validation',
          });
          console.log(`⚠️ Validation failed for ZPID ${propertyData.zpid}: ${validation.reason}`);
          continue;
        }

        // Check for duplicates in zillow_imports
        if (existingZillowZpids.has(propertyData.zpid)) {
          metrics.duplicatesSkipped++;
          console.log(`⏭️ DUPLICATE FOUND - Skipping ZPID ${propertyData.zpid} (already in zillow_imports)`);
          console.log(`   Address: ${propertyData.fullAddress}`);
          continue;
        }

        // ZPID not found - this is either NEW or RELISTED after deletion
        console.log(`✅ ZPID ${propertyData.zpid} NOT in database - importing fresh!`);
        console.log(`   Address: ${propertyData.fullAddress}`);
        console.log(`   Agent: ${propertyData.agentName || 'N/A'} (${propertyData.agentPhoneNumber || 'N/A'})`);
        console.log(`   Status: This could be a NEW property or RELISTED after being SOLD/PENDING`);

        // Log contact info status
        if (!propertyData.agentPhoneNumber && !propertyData.brokerPhoneNumber) {
          console.log(`⚠️ No contact info for ZPID ${propertyData.zpid} - saving anyway`);
        }

        // REMOVED: Cross-save to cash_houses for "needs work" properties
        // Owner finance properties should ONLY be in zillow_imports
        // Cash deals are for admin research only, saved via /api/cron/process-cash-deals-queue

        // ===== STRICT FILTER - ONLY SAVE IF PASSES =====
        const filterResult = hasStrictOwnerfinancing(propertyData.description);

        // SKIP property if it doesn't pass strict filter
        if (!filterResult.passes) {
          console.log(`⏭️  FILTERED OUT: ${propertyData.fullAddress} - No owner financing keywords found`);
          metrics.validationFailed++; // Count as filtered
          continue; // Don't save, move to next property
        }

        // Property passed! Log the matched keywords
        console.log(`✅ OWNER FINANCE FOUND: ${propertyData.fullAddress}`);
        console.log(`   Keywords: ${filterResult.matchedKeywords.join(', ')}`);

        // Save to zillow_imports (ONLY properties that passed strict filter)
        const docRef = db.collection('zillow_imports').doc();
        currentBatch.set(docRef, {
          ...propertyData,
          // Owner Financing Detection
          ownerFinanceVerified: true,                  // Passed strict filter
          matchedKeywords: filterResult.matchedKeywords, // ALL keywords found
          primaryKeyword: filterResult.primaryKeyword,   // Main keyword (for display)

          // Status tracking - starts null, auto-updates when all fields filled
          status: null,                     // Changes to 'verified' when terms are filled
          foundAt: new Date(),
          verifiedAt: null,                 // Set when terms received
          soldAt: null,

          // Financing terms (initially null - "Seller to Decide")
          downPaymentAmount: null,
          downPaymentPercent: null,
          monthlyPayment: null,
          interestRate: null,
          loanTermYears: null,
          balloonPaymentYears: null,
        });

        batchOperations++;

        // Commit batch if we hit the limit
        if (batchOperations >= BATCH_LIMIT) {
          await currentBatch.commit();
          console.log(`✅ [FIREBASE] Committed batch of ${batchOperations} properties`);
          metrics.propertiesSaved += batchOperations;
          currentBatch = db.batch();
          batchOperations = 0;
        }

      } catch (error: unknown) {
        metrics.transformFailed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        metrics.errors.push({
          zpid: typeof item.zpid === 'number' ? item.zpid : undefined,
          error: errorMessage,
          stage: 'transform',
        });
        console.error(`❌ Failed to transform ZPID ${item.zpid}: ${errorMessage}`);
        // Continue processing other items
      }
    }

    // Commit remaining batch
    if (batchOperations > 0) {
      await currentBatch.commit();
      console.log(`✅ [FIREBASE] Committed final batch of ${batchOperations} properties`);
      metrics.propertiesSaved += batchOperations;
    }

    console.log(`✅ [FIREBASE] Total saved: ${metrics.propertiesSaved} properties to zillow_imports`);

    // Mark queue items as completed (only if we saved at least 1 property)
    if (metrics.propertiesSaved > 0) {
      const completeBatch = db.batch();
      queueDocRefs.forEach(docRef => {
        completeBatch.update(docRef, {
          status: 'completed',
          completedAt: new Date(),
        });
      });
      await completeBatch.commit();
      metrics.queueItemsCompleted = urls.length;
      console.log(`✅ [QUEUE CRON] Marked ${urls.length} queue items as completed`);
    } else {
      // Mark as failed if no properties were saved
      const failBatch = db.batch();
      queueDocRefs.forEach(docRef => {
        failBatch.update(docRef, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'No properties were successfully saved',
          retryCount: FieldValue.increment(1),
        });
      });
      await failBatch.commit();
      metrics.queueItemsFailed = urls.length;
      console.log(`⚠️ [QUEUE CRON] Marked ${urls.length} queue items as failed (no properties saved)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Final metrics summary
    console.log(`\n📊 ============ SCRAPER METRICS ============`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📋 Queue Items Processed: ${metrics.queueItemsProcessed}`);
    console.log(`📦 Apify Items Returned: ${metrics.apifyItemsReturned}`);
    console.log(`✅ Transform Succeeded: ${metrics.transformSucceeded}`);
    console.log(`❌ Transform Failed: ${metrics.transformFailed}`);
    console.log(`⚠️  Validation Failed: ${metrics.validationFailed}`);
    console.log(`⏭️  Duplicates Skipped: ${metrics.duplicatesSkipped}`);
    console.log(`💾 Properties Saved: ${metrics.propertiesSaved}`);
    console.log(`✅ Queue Items Completed: ${metrics.queueItemsCompleted}`);
    console.log(`❌ Queue Items Failed: ${metrics.queueItemsFailed}`);
    console.log(`🚨 Total Errors: ${metrics.errors.length}`);

    if (metrics.errors.length > 0) {
      console.log(`\n📋 Error Breakdown by Stage:`);
      const errorsByStage = metrics.errors.reduce((acc: any, err) => {
        acc[err.stage] = (acc[err.stage] || 0) + 1;
        return acc;
      }, {});
      Object.entries(errorsByStage).forEach(([stage, count]) => {
        console.log(`   ${stage}: ${count}`);
      });
    }
    console.log(`========================================\n`);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      metrics,
    });

  } catch (error: unknown) {
    console.error('❌ [QUEUE CRON] Critical Error:', error);

    // Log final metrics even on error
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n📊 ============ SCRAPER METRICS (ERROR) ============`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📋 Queue Items Processed: ${metrics.queueItemsProcessed}`);
    console.log(`📦 Apify Items Returned: ${metrics.apifyItemsReturned}`);
    console.log(`✅ Transform Succeeded: ${metrics.transformSucceeded}`);
    console.log(`❌ Transform Failed: ${metrics.transformFailed}`);
    console.log(`⚠️  Validation Failed: ${metrics.validationFailed}`);
    console.log(`💾 Properties Saved: ${metrics.propertiesSaved}`);
    console.log(`🚨 Total Errors: ${metrics.errors.length}`);
    console.log(`========================================\n`);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        metrics,
      },
      { status: 500 }
    );
  }
  }); // End withCronLock

  // If lock wasn't acquired, return early
  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true
    }, { status: 200 });
  }

  return result;
}
