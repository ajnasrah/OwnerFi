import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, FieldValue } from '@/lib/scraper-v2/firebase-admin';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import { withCronLock } from '@/lib/scraper-v2/cron-lock';
import { sendSMS } from '@/lib/agent-outreach/twilio-sms';
import { formatInitialOutreach } from '@/lib/agent-outreach/sms-templates';
import { getOrCreateConversation, addMessage, isOptedOut } from '@/lib/agent-outreach/conversation-manager';
import { isWithinBusinessHours, getBusinessHoursStatus } from '@/lib/agent-outreach/business-hours';
import { isValidPhone, normalizePhone } from '@/lib/phone-utils';

export const maxDuration = 300;

/**
 * CRON: Process Agent Outreach Queue
 *
 * Sends properties from agent_outreach_queue via Twilio SMS
 * in batches of 50 properties at a time.
 *
 * Safety: AGENT_OUTREACH_LIVE must be "true" to send real SMS.
 * Otherwise runs in DRY_RUN mode (logs only).
 *
 * Schedule: Every 2 hours
 */

// In live mode: 1 item per run (cron runs every 3 min = natural drip)
// In dry-run: 50 items per run (fast testing)
const BATCH_SIZE = process.env.AGENT_OUTREACH_LIVE === 'true' ? 1 : 50;
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

  // Twilio config is validated inside sendSMS — no env check needed here.
  // DRY_RUN mode is controlled by AGENT_OUTREACH_LIVE env var.

  // Business hours check: skip sending if outside 9 AM – 8 PM Central
  const isLive = process.env.AGENT_OUTREACH_LIVE === 'true';
  if (isLive && !isWithinBusinessHours()) {
    const status = getBusinessHoursStatus();
    console.log(`🕐 [AGENT OUTREACH QUEUE] Outside business hours, skipping. ${status.reason}`);
    return NextResponse.json({
      success: true,
      message: `Skipped: outside business hours. ${status.reason}`,
      skipped: true,
    });
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

    // Send each property via Twilio SMS
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

        // Skip opted-out numbers
        const optedOut = await isOptedOut(property.agentPhone);
        if (optedOut) {
          console.log(`   🚫 Skipping opted-out: ${property.agentPhone}`);
          await doc.ref.update({ status: 'opted_out', updatedAt: new Date() });
          continue;
        }

        // Validate phone number format
        if (!isValidPhone(property.agentPhone)) {
          console.log(`   ⚠️ Skipping invalid phone: ${property.agentPhone}`);
          await doc.ref.update({
            status: 'failed',
            errorMessage: `Invalid phone number: ${property.agentPhone}`,
            updatedAt: new Date(),
          });
          errors++;
          errorDetails.push({ address: property.address, error: `Invalid phone: ${property.agentPhone}` });
          continue;
        }

        // Per-agent rate limit: max 1 SMS per phone per day
        // Check sentAt across ALL statuses (item may have progressed past 'sent')
        // Wrapped in try/catch: this query needs a composite index (phoneNormalized + sentAt).
        // If the index doesn't exist yet, skip rate limiting rather than crashing the send.
        const normalizedAgentPhone = normalizePhone(property.agentPhone);
        try {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentSends = await db
            .collection('agent_outreach_queue')
            .where('phoneNormalized', '==', normalizedAgentPhone)
            .where('sentAt', '>', oneDayAgo)
            .limit(1)
            .get();

          if (!recentSends.empty) {
            console.log(`   ⏳ Skipping rate-limited phone: ${normalizedAgentPhone} (already texted today)`);
            // Reset back to pending so it gets picked up later (not stuck as processing)
            await doc.ref.update({ status: 'pending', processingStartedAt: null, updatedAt: new Date() });
            continue;
          }
        } catch (rateLimitErr) {
          // Composite index may not exist yet — Firestore logs the creation URL.
          // Continue without rate limiting rather than failing the send.
          console.warn(`   ⚠️ Rate limit check failed (index may be missing): ${rateLimitErr instanceof Error ? rateLimitErr.message : rateLimitErr}`);
        }

        // Format and send SMS via Twilio
        const smsBody = formatInitialOutreach({
          agentName: property.agentName,
          address: property.address,
          city: property.city,
          state: property.state,
        });

        // Idempotency: skip sending if SMS was already sent (retry after partial failure)
        let smsResult;
        if (property.twilioMessageSid && !property.twilioMessageSid.startsWith('dry_run_')) {
          console.log(`   ⏭️ SMS already sent (SID: ${property.twilioMessageSid}), skipping re-send`);
          smsResult = { sid: property.twilioMessageSid, status: 'already_sent', dryRun: false };
        } else {
          console.log(`   📤 Sending SMS: ${property.address} (${property.dealType})`);
          smsResult = await sendSMS(property.agentPhone, smsBody);
        }

        console.log(`   📥 Twilio: SID=${smsResult.sid} Status=${smsResult.status} DryRun=${smsResult.dryRun}`);

        // Persist SID immediately so retries don't re-send
        if (smsResult.status !== 'already_sent') {
          await doc.ref.update({ twilioMessageSid: smsResult.sid, updatedAt: new Date() });
        }

        // Create/update conversation thread
        const conversation = await getOrCreateConversation(
          property.agentPhone,
          property.agentName,
          doc.id
        );

        await addMessage(conversation.id, {
          role: 'outbound',
          body: smsBody,
          timestamp: new Date(),
          twilioSid: smsResult.sid,
          source: 'sms',
        });

        // Update status to sent
        await doc.ref.update({
          status: 'sent',
          twilioMessageSid: smsResult.sid,
          conversationId: conversation.id,
          sentAt: new Date(),
          followUpCount: 0,
          updatedAt: new Date(),
        });

        // Mark as contacted (audit trail)
        await db.collection('contacted_agents').add({
          propertyAddress: property.address,
          contactName: property.agentName,
          contactPhone: property.agentPhone,
          contactEmail: property.agentEmail || '',
          stage: 'sent',
          status: 'awaiting_response',
          createdOn: new Date().toISOString(),
          firebase_id: doc.id,
          twilioSid: smsResult.sid,
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
              homeType: property.propertyType,
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
              twilioMessageSid: smsResult.sid || null,
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
        console.log(`   ✅ SMS sent${isRetry ? ' (retry)' : ''}: ${property.address}`);

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
    console.log(`   ✅ SMS sent: ${sent} (${retried} retries)`);
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
