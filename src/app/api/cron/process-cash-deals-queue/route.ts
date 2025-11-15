import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { transformApifyProperty, validatePropertyData } from '@/lib/property-transform';
import { detectNeedsWork, getMatchingKeywords } from '@/lib/property-needs-work-detector';

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

export async function GET(request: NextRequest) {
  console.log('💰 [CASH DEALS CRON] Starting queue processor');

  const startTime = Date.now();

  // Tracking metrics
  const metrics = {
    queueItemsProcessed: 0,
    apifyItemsReturned: 0,
    transformSucceeded: 0,
    transformFailed: 0,
    validationFailed: 0,
    duplicatesSkipped: 0,
    missingPriceOrZestimate: 0,
    filteredOut80Percent: 0,
    cashDealsSaved: 0,
    needsWorkPropertiesSaved: 0,
    queueItemsCompleted: 0,
    queueItemsFailed: 0,
    errors: [] as Array<{ zpid?: number; address?: string; error: string; stage: string }>,
  };

  try {
    // Reset stuck processing items (older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckItems = await db
      .collection('cash_deals_queue')
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
        console.log(`🔄 [CASH DEALS] Reset ${resetCount} stuck items back to pending`);
      }
    }

    // Find pending items in queue (limit to 25 for optimal processing)
    const pendingItems = await db
      .collection('cash_deals_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(25)
      .get();

    if (pendingItems.empty) {
      console.log('✅ [CASH DEALS] No pending items in queue');
      return NextResponse.json({ message: 'No pending items in cash deals queue' });
    }

    const urls = pendingItems.docs.map(doc => doc.data().url);
    const queueDocRefs = pendingItems.docs.map(doc => doc.ref);
    metrics.queueItemsProcessed = urls.length;

    console.log(`📋 [CASH DEALS] Processing ${urls.length} URLs from queue`);

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

    // Start the run but don't wait for it to finish
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
          retryCount: getFirestore.FieldValue.increment(1),
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

    // Check for existing zpids to avoid duplicates
    const zpids = items.map((item: any) => item.zpid).filter(Boolean);
    const existingPropertiesSnap = await db
      .collection('cash_houses')
      .where('zpid', 'in', zpids.slice(0, 10)) // Firestore 'in' limited to 10 items
      .get();

    const existingZpids = new Set(existingPropertiesSnap.docs.map(doc => doc.data().zpid));

    // Filter and save to Firebase - ONLY properties with price < 80% of Zestimate
    const savedProperties: Array<{ docRef: any, data: any }> = [];
    let currentBatch = db.batch();
    let batchOperations = 0;
    const BATCH_LIMIT = 500;

    for (const item of items) {
      try {
        // Transform property
        const propertyData = transformApifyProperty(item, 'apify-zillow-cash-deals');
        metrics.transformSucceeded++;

        // Validate property data
        const validation = validatePropertyData(propertyData);
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

        // Check for duplicates
        if (existingZpids.has(propertyData.zpid)) {
          metrics.duplicatesSkipped++;
          console.log(`⏭️ Skipping duplicate ZPID ${propertyData.zpid}`);
          continue;
        }

        // Check if we have both price and zestimate
        if (!propertyData.price || !propertyData.estimate) {
          metrics.missingPriceOrZestimate++;
          metrics.errors.push({
            zpid: propertyData.zpid,
            address: propertyData.fullAddress,
            error: 'Missing price or zestimate',
            stage: 'filter',
          });
          console.log(`⚠️ Missing price or zestimate for ZPID ${propertyData.zpid} - filtering out`);
          continue;
        }

        // Check if property needs work based on description keywords
        const needsWork = detectNeedsWork(propertyData.description);
        const matchingKeywords = needsWork ? getMatchingKeywords(propertyData.description) : [];

        // Calculate 80% of Zestimate
        const eightyPercentOfZestimate = propertyData.estimate * 0.8;

        // Save if: (1) price < 80% of Zestimate OR (2) needs work (investor opportunity)
        const meetsDiscountCriteria = propertyData.price < eightyPercentOfZestimate;
        const meetsNeedsWorkCriteria = needsWork;

        if (meetsDiscountCriteria || meetsNeedsWorkCriteria) {
          const discountPercentage = ((propertyData.estimate - propertyData.price) / propertyData.estimate * 100).toFixed(2);

          // Add tags and metadata
          propertyData.discountPercentage = parseFloat(discountPercentage);
          propertyData.eightyPercentOfZestimate = Math.round(eightyPercentOfZestimate);
          propertyData.needsWork = needsWork;
          propertyData.needsWorkKeywords = matchingKeywords;
          propertyData.source = 'cash_deals_scraper';
          propertyData.dealType = meetsDiscountCriteria ? 'discount' : 'needs_work';

          if (meetsNeedsWorkCriteria && !meetsDiscountCriteria) {
            console.log(`🔨 NEEDS WORK: ${propertyData.fullAddress} - Keywords: ${matchingKeywords.join(', ')}`);
            metrics.needsWorkPropertiesSaved++;
          } else if (meetsDiscountCriteria) {
            console.log(`✅ CASH DEAL: ${propertyData.fullAddress} - Price: $${propertyData.price.toLocaleString()}, Zestimate: $${propertyData.estimate.toLocaleString()} (${discountPercentage}% discount)${needsWork ? ' + NEEDS WORK' : ''}`);
            metrics.cashDealsSaved++;
          }

          // Add to batch
          const docRef = db.collection('cash_houses').doc();
          currentBatch.set(docRef, propertyData);
          savedProperties.push({ docRef, data: propertyData });
          batchOperations++;

          // Commit batch if we hit the limit
          if (batchOperations >= BATCH_LIMIT) {
            await currentBatch.commit();
            console.log(`✅ [FIREBASE] Committed batch of ${batchOperations} properties`);
            currentBatch = db.batch();
            batchOperations = 0;
          }
        } else {
          metrics.filteredOut80Percent++;
          const discountPercentage = ((propertyData.estimate - propertyData.price) / propertyData.estimate * 100).toFixed(2);
          console.log(`❌ FILTERED OUT: ${propertyData.fullAddress} - Price: $${propertyData.price.toLocaleString()}, Zestimate: $${propertyData.estimate.toLocaleString()} (only ${discountPercentage}% discount, no needs work keywords)`);
        }

      } catch (error: any) {
        metrics.transformFailed++;
        metrics.errors.push({
          zpid: item.zpid,
          error: error.message,
          stage: 'transform',
        });
        console.error(`❌ Failed to transform ZPID ${item.zpid}: ${error.message}`);
        // Continue processing other items
      }
    }

    // Commit remaining batch
    if (batchOperations > 0) {
      await currentBatch.commit();
      console.log(`✅ [FIREBASE] Committed final batch of ${batchOperations} properties`);
    }

    const totalSaved = metrics.cashDealsSaved + metrics.needsWorkPropertiesSaved;
    console.log(`✅ [FIREBASE] Total saved: ${totalSaved} properties (${metrics.cashDealsSaved} discount deals + ${metrics.needsWorkPropertiesSaved} needs work)`);

    // Mark queue items as completed (only if we saved at least 1 property OR if it was a valid run)
    // For cash deals, it's OK if nothing meets the 80% filter, so we complete if transform succeeded
    if (metrics.transformSucceeded > 0) {
      const completeBatch = db.batch();
      queueDocRefs.forEach(docRef => {
        completeBatch.update(docRef, {
          status: 'completed',
          completedAt: new Date(),
        });
      });
      await completeBatch.commit();
      metrics.queueItemsCompleted = urls.length;
      console.log(`✅ [CASH DEALS] Marked ${urls.length} queue items as completed`);
    } else {
      // Mark as failed if no properties could be transformed
      const failBatch = db.batch();
      queueDocRefs.forEach(docRef => {
        failBatch.update(docRef, {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'No properties could be transformed',
          retryCount: getFirestore.FieldValue.increment(1),
        });
      });
      await failBatch.commit();
      metrics.queueItemsFailed = urls.length;
      console.log(`⚠️ [CASH DEALS] Marked ${urls.length} queue items as failed (no properties transformed)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Final metrics summary
    console.log(`\n📊 ============ CASH DEALS METRICS ============`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📋 Queue Items Processed: ${metrics.queueItemsProcessed}`);
    console.log(`📦 Apify Items Returned: ${metrics.apifyItemsReturned}`);
    console.log(`✅ Transform Succeeded: ${metrics.transformSucceeded}`);
    console.log(`❌ Transform Failed: ${metrics.transformFailed}`);
    console.log(`⚠️  Validation Failed: ${metrics.validationFailed}`);
    console.log(`⏭️  Duplicates Skipped: ${metrics.duplicatesSkipped}`);
    console.log(`⚠️  Missing Price/Zestimate: ${metrics.missingPriceOrZestimate}`);
    console.log(`❌ Filtered Out (< 80%): ${metrics.filteredOut80Percent}`);
    console.log(`💰 Cash Deals Saved (Discount): ${metrics.cashDealsSaved}`);
    console.log(`🔨 Needs Work Properties Saved: ${metrics.needsWorkPropertiesSaved}`);
    console.log(`✅ Queue Items Completed: ${metrics.queueItemsCompleted}`);
    console.log(`❌ Queue Items Failed: ${metrics.queueItemsFailed}`);
    console.log(`🚨 Total Errors: ${metrics.errors.length}`);

    // Calculate success rate
    const totalProcessed = metrics.transformSucceeded + metrics.transformFailed;
    const successRate = totalProcessed > 0 ? ((metrics.transformSucceeded / totalProcessed) * 100).toFixed(1) : '0';
    const cashDealRate = metrics.transformSucceeded > 0 ? ((metrics.cashDealsSaved / metrics.transformSucceeded) * 100).toFixed(1) : '0';
    console.log(`\n📈 Transform Success Rate: ${successRate}%`);
    console.log(`📈 Cash Deal Conversion Rate: ${cashDealRate}% (of successfully transformed)`);

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
      conversionRates: {
        transformSuccessRate: `${successRate}%`,
        cashDealConversionRate: `${cashDealRate}%`,
      },
    });

  } catch (error: any) {
    console.error('❌ [CASH DEALS CRON] Critical Error:', error);

    // Log final metrics even on error
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n📊 ============ CASH DEALS METRICS (ERROR) ============`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📋 Queue Items Processed: ${metrics.queueItemsProcessed}`);
    console.log(`📦 Apify Items Returned: ${metrics.apifyItemsReturned}`);
    console.log(`✅ Transform Succeeded: ${metrics.transformSucceeded}`);
    console.log(`❌ Transform Failed: ${metrics.transformFailed}`);
    console.log(`⚠️  Validation Failed: ${metrics.validationFailed}`);
    console.log(`💰 Cash Deals Saved (Discount): ${metrics.cashDealsSaved}`);
    console.log(`🔨 Needs Work Properties Saved: ${metrics.needsWorkPropertiesSaved}`);
    console.log(`🚨 Total Errors: ${metrics.errors.length}`);
    console.log(`========================================\n`);

    return NextResponse.json(
      {
        error: error.message,
        metrics,
      },
      { status: 500 }
    );
  }
}
