import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, FieldValue } from '@/lib/scraper-v2/firebase-admin';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { normalizeHomeType } from '@/lib/scraper-v2/property-transformer';

export const maxDuration = 300;

/**
 * CRON: Process Agent Outreach Queue
 *
 * Sends properties from agent_outreach_queue to GoHighLevel
 * in batches of 50 properties at a time.
 *
 * Schedule: Every 2 hours
 */

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const MAX_RUNTIME_MS = 270_000; // 4.5 minutes — leave buffer for 5min Vercel limit

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { db } = getFirebaseAdmin();

  console.log('🔄 [AGENT OUTREACH QUEUE] Request received at', new Date().toISOString());

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [AGENT OUTREACH QUEUE] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const GHL_WEBHOOK_URL = process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL;
  if (!GHL_WEBHOOK_URL) {
    console.error('❌ [AGENT OUTREACH QUEUE] GHL_AGENT_OUTREACH_WEBHOOK_URL not configured');
    return NextResponse.json({ error: 'GHL webhook URL not configured' }, { status: 500 });
  }

  // Use cron lock to prevent concurrent execution
  const result = await withCronLock('process-agent-outreach-queue', async () => {
    // Reset stuck processing items (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stuckItems = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'processing')
      .get();

    if (!stuckItems.empty) {
      const resetBatch = db.batch();
      let resetCount = 0;

      stuckItems.docs.forEach(doc => {
        const data = doc.data();
        const processingStartedAt = data.processingStartedAt?.toDate?.();

        if (!processingStartedAt || processingStartedAt < thirtyMinutesAgo) {
          resetBatch.update(doc.ref, {
            status: 'pending',
            processingStartedAt: null,
            updatedAt: new Date(),
          });
          resetCount++;
        }
      });

      if (resetCount > 0) {
        await resetBatch.commit();
        console.log(`🔄 [AGENT OUTREACH QUEUE] Reset ${resetCount} stuck items back to pending`);
      }
    }

    // Get next batch of pending items
    const pending = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'pending')
      .orderBy('addedAt', 'asc')
      .limit(BATCH_SIZE)
      .get();

    // Also get failed items that can be retried
    const retryableQuery = await db
      .collection('agent_outreach_queue')
      .where('status', '==', 'failed')
      .limit(BATCH_SIZE)
      .get();

    const retryableDocs = retryableQuery.docs
      .filter(doc => (doc.data().retryCount || 0) < MAX_RETRIES)
      .slice(0, Math.max(0, BATCH_SIZE - pending.size));

    const allDocs = [...pending.docs, ...retryableDocs];

    if (allDocs.length === 0) {
      console.log('✅ [AGENT OUTREACH QUEUE] No pending or retryable items in queue');
      return NextResponse.json({ success: true, message: 'Queue empty' });
    }

    console.log(`📋 [AGENT OUTREACH QUEUE] Found ${pending.size} pending + ${retryableDocs.length} retryable = ${allDocs.length} total`);

    await db.collection('cron_logs').add({
      cron: 'process-agent-outreach-queue',
      status: 'started',
      pendingCount: pending.size,
      retryableCount: retryableDocs.length,
      timestamp: new Date(),
    });

    // Mark all as processing
    const processingBatch = db.batch();
    allDocs.forEach(doc => {
      processingBatch.update(doc.ref, {
        status: 'processing',
        processingStartedAt: new Date(),
        updatedAt: new Date(),
      });
    });
    await processingBatch.commit();

    // Send each property to GHL
    let sent = 0;
    let errors = 0;
    let retried = 0;
    const errorDetails: Array<{ address: string; error: string }> = [];

    for (const doc of allDocs) {
      // Timeout check
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏰ Approaching timeout, stopping early');
        break;
      }

      const isRetry = doc.data().status === 'failed' || (doc.data().retryCount || 0) > 0;
      try {
        const property = doc.data();

        const discountPercent = property.dealType === 'cash_deal' && property.priceToZestimateRatio
          ? Math.round((1 - property.priceToZestimateRatio) * 100)
          : null;

        const ghlPayload = {
          contactName: property.agentName,
          contactPhone: property.agentPhone,
          contactEmail: property.agentEmail || undefined,
          propertyAddress: property.address,
          propertyCity: property.city,
          propertyState: property.state,
          propertyZip: property.zipCode,
          propertyPrice: property.price,
          propertyBeds: property.beds,
          propertyBaths: property.baths,
          propertySquareFeet: property.squareFeet,
          propertyZestimate: property.zestimate || undefined,
          dealType: property.dealType,
          discountPercent,
          firebaseId: doc.id,
          zpid: property.zpid,
          zillowUrl: property.url,
          source: 'agent_outreach_system',
          addedAt: property.addedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };

        console.log(`   📤 Sending to GHL: ${property.address} (${property.dealType})`);

        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ghlPayload),
        });

        const responseText = await response.text();
        console.log(`   📥 GHL Response: ${response.status} - ${responseText.substring(0, 200)}`);

        if (!response.ok) {
          throw new Error(`GHL returned ${response.status}: ${responseText}`);
        }

        let ghlResponse: any = {};
        try {
          ghlResponse = JSON.parse(responseText);
        } catch {
          console.log(`   ⚠️ GHL response is not JSON: ${responseText.substring(0, 100)}`);
        }

        // Update status to sent_to_ghl
        await doc.ref.update({
          status: 'sent_to_ghl',
          ghlOpportunityId: ghlResponse.opportunityId || null,
          ghlContactId: ghlResponse.contactId || null,
          sentToGHLAt: new Date(),
          updatedAt: new Date(),
        });

        // Mark as contacted
        await db.collection('contacted_agents').add({
          propertyAddress: property.address,
          contactName: property.agentName,
          contactPhone: property.agentPhone,
          contactEmail: property.agentEmail || '',
          stage: 'sent',
          status: 'awaiting_response',
          createdOn: new Date().toISOString(),
          firebase_id: doc.id,
          opportunityId: ghlResponse.opportunityId || '',
          addressNormalized: property.addressNormalized,
          phoneNormalized: property.phoneNormalized,
          importedAt: new Date(),
          source: 'agent_outreach_system',
          dealType: property.dealType,
        });

        // Save cash deals to unified properties collection
        if (property.dealType === 'cash_deal') {
          const existingProperty = await db
            .collection('properties')
            .where('zpid', '==', property.zpid)
            .limit(1)
            .get();

          if (existingProperty.empty) {
            const imgSrc = property.imgSrc || null;

            const propertyData = {
              zpid: property.zpid,
              url: property.url,
              fullAddress: property.address,
              streetAddress: property.address,
              address: property.address,
              city: property.city,
              state: property.state,
              zipCode: property.zipCode,
              price: property.price,
              estimate: property.zestimate,
              priceToZestimateRatio: property.priceToZestimateRatio,
              discountPercentage: discountPercent,
              bedrooms: property.beds,
              bathrooms: property.baths,
              squareFoot: property.squareFeet,
              homeType: normalizeHomeType(property.propertyType),
              isLand: normalizeHomeType(property.propertyType) === 'land',
              imgSrc,
              firstPropertyImage: imgSrc,
              agentName: property.agentName,
              agentPhoneNumber: property.agentPhone,
              agentEmail: property.agentEmail || null,
              source: 'agent_outreach_system',
              isCashDeal: true,
              isOwnerfinance: false,
              dealTypes: ['cash_deal'],
              isActive: true,
              importedAt: new Date(),
              createdAt: new Date(),
              ghlOpportunityId: ghlResponse.opportunityId || null,
              homeStatus: 'FOR_SALE',
            };

            await db.collection('properties').doc(`zpid_${property.zpid}`).set(propertyData);
            console.log(`   💰 Saved to properties: ${property.address} (${discountPercent}% discount)`);

            try {
              await indexRawFirestoreProperty(`zpid_${property.zpid}`, propertyData, 'properties');
              console.log(`   🔍 Synced to Typesense: ${propertyData.address}`);
            } catch (typesenseErr: unknown) {
              const msg = typesenseErr instanceof Error ? typesenseErr.message : String(typesenseErr);
              console.error(`   ⚠️ Typesense sync failed: ${msg}`);
            }
          } else {
            const existingDoc = existingProperty.docs[0];
            const existingData = existingDoc.data();
            if (!existingData.isCashDeal) {
              await existingDoc.ref.update({
                isCashDeal: true,
                dealTypes: [...(existingData.dealTypes || []), 'cash_deal'].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
                updatedAt: new Date(),
              });
              console.log(`   💰 Updated existing property as cash deal: ${property.address}`);
            }
          }
        }

        sent++;
        if (isRetry) retried++;
        console.log(`   ✅ Sent${isRetry ? ' (retry)' : ''}: ${property.address}`);

      } catch (error: unknown) {
        const failedProperty = doc.data();
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error sending ${failedProperty.address}: ${errorMessage}`);

        await doc.ref.update({
          status: 'failed',
          errorMessage,
          retryCount: FieldValue.increment(1),
          lastFailedAt: new Date(),
          updatedAt: new Date(),
        });

        errors++;
        errorDetails.push({ address: failedProperty.address, error: errorMessage });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [AGENT OUTREACH QUEUE] Batch complete in ${duration}s:`);
    console.log(`   ✅ Sent to GHL: ${sent} (${retried} retries)`);
    console.log(`   ❌ Errors: ${errors}`);

    const logEntry: Record<string, unknown> = {
      cron: 'process-agent-outreach-queue',
      status: 'completed',
      duration: `${duration}s`,
      batchSize: allDocs.length,
      sent,
      retried,
      errors,
      timestamp: new Date(),
    };
    if (errors > 0 && errorDetails.length > 0) {
      logEntry.errorDetails = errorDetails;
    }
    await db.collection('cron_logs').add(logEntry);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      batchSize: allDocs.length,
      sent,
      retried,
      errors,
      ...(errors > 0 && errorDetails.length > 0 ? { errorDetails } : {}),
    });
  });

  if (result === null) {
    return NextResponse.json({
      success: false,
      message: 'Another instance is already running',
      skipped: true,
    }, { status: 200 });
  }

  return result;
}
