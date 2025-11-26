import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

/**
 * CRON: Process Agent Outreach Queue
 *
 * Sends properties from agent_outreach_queue to GoHighLevel
 * in batches of 25 properties at a time
 *
 * Properties are sent with custom fields so GHL can:
 * 1. Display appropriate message (cash deal vs owner finance)
 * 2. Send firebaseId back in webhook when agent responds
 *
 * Schedule: Every 4 hours (6 times per day)
 */

const BATCH_SIZE = 50; // Increased to handle nationwide volume (~300 properties/day)
const GHL_WEBHOOK_URL = process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL ||
  'https://services.leadconnectorhq.com/hooks/YOUR_WEBHOOK_HERE';

export async function GET(request: NextRequest) {
  console.log('🔄 [AGENT OUTREACH QUEUE] Starting queue processor');

  const startTime = Date.now();

  // Security check - only allow cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('❌ [AGENT OUTREACH QUEUE] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    if (pending.empty) {
      console.log('✅ [AGENT OUTREACH QUEUE] No pending items in queue');
      return NextResponse.json({
        success: true,
        message: 'Queue empty'
      });
    }

    console.log(`📋 [AGENT OUTREACH QUEUE] Processing batch of ${pending.size} properties`);

    // Mark all as processing
    const processingBatch = db.batch();
    pending.docs.forEach(doc => {
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
    const errorDetails: Array<{ address: string; error: string }> = [];

    for (const doc of pending.docs) {
      try {
        const property = doc.data();

        // Calculate discount percentage for cash deals
        const discountPercent = property.dealType === 'cash_deal' && property.priceToZestimateRatio
          ? Math.round((1 - property.priceToZestimateRatio) * 100)
          : null;

        // Prepare GHL payload
        const ghlPayload = {
          // Contact info
          contactName: property.agentName,
          contactPhone: property.agentPhone,
          contactEmail: property.agentEmail || undefined,

          // Property details
          propertyAddress: property.address,
          propertyCity: property.city,
          propertyState: property.state,
          propertyZip: property.zipCode,
          propertyPrice: property.price,
          propertyBeds: property.beds,
          propertyBaths: property.baths,
          propertySquareFeet: property.squareFeet,
          propertyZestimate: property.zestimate || undefined,

          // Deal classification
          dealType: property.dealType,
          discountPercent: discountPercent,

          // Tracking
          firebaseId: doc.id,
          zpid: property.zpid,
          zillowUrl: property.url,

          // Metadata
          source: 'agent_outreach_system',
          addedAt: property.addedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };

        console.log(`   📤 Sending to GHL: ${property.address} (${property.dealType})`);

        // Send to GHL webhook
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ghlPayload),
        });

        if (!response.ok) {
          throw new Error(`GHL returned ${response.status}: ${await response.text()}`);
        }

        const ghlResponse = await response.json();

        // Update status to sent_to_ghl
        await doc.ref.update({
          status: 'sent_to_ghl',
          ghlOpportunityId: ghlResponse.opportunityId || null,
          ghlContactId: ghlResponse.contactId || null,
          sentToGHLAt: new Date(),
          updatedAt: new Date(),
        });

        // Mark as contacted in contacted_agents collection
        // This prevents future duplicate outreach to same agent about same property
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

          // Normalized for fast deduplication
          addressNormalized: property.addressNormalized,
          phoneNormalized: property.phoneNormalized,

          // Metadata
          importedAt: new Date(),
          source: 'agent_outreach_system',
          dealType: property.dealType,
        });

        // Save cash deals to cash_houses collection for admin dashboard
        if (property.dealType === 'cash_deal') {
          // Check if already exists in cash_houses
          const existingCashHouse = await db
            .collection('cash_houses')
            .where('zpid', '==', property.zpid)
            .limit(1)
            .get();

          if (existingCashHouse.empty) {
            await db.collection('cash_houses').add({
              // Property info
              zpid: property.zpid,
              url: property.url,
              fullAddress: property.address,
              streetAddress: property.address,
              city: property.city,
              state: property.state,
              zipCode: property.zipCode,

              // Pricing
              price: property.price,
              estimate: property.zestimate,
              priceToZestimateRatio: property.priceToZestimateRatio,
              discountPercentage: discountPercent,

              // Property details
              bedrooms: property.beds,
              bathrooms: property.baths,
              squareFoot: property.squareFeet,
              homeType: property.propertyType,

              // Agent info
              agentName: property.agentName,
              agentPhoneNumber: property.agentPhone,
              agentEmail: property.agentEmail || null,

              // Tracking
              source: 'agent_outreach_system',
              dealType: 'cash_deal',
              importedAt: new Date(),
              ghlOpportunityId: ghlResponse.opportunityId || null,

              // Status
              homeStatus: 'FOR_SALE',
            });
            console.log(`   💰 Saved to cash_houses: ${property.address} (${discountPercent}% discount)`);
          }
        }

        sent++;
        console.log(`   ✅ Sent: ${property.address}`);

      } catch (error: any) {
        console.error(`   ❌ Error sending ${property.address}:`, error.message);

        // Update with error
        await doc.ref.update({
          status: 'failed',
          errorMessage: error.message,
          retryCount: FieldValue.increment(1),
          lastFailedAt: new Date(),
          updatedAt: new Date(),
        });

        errors++;
        errorDetails.push({
          address: property.address,
          error: error.message,
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [AGENT OUTREACH QUEUE] Batch complete in ${duration}s:`);
    console.log(`   ✅ Sent to GHL: ${sent}`);
    console.log(`   ❌ Errors: ${errors}`);

    if (errors > 0) {
      console.log(`\n❌ Error details:`);
      errorDetails.forEach(({ address, error }) => {
        console.log(`   ${address}: ${error}`);
      });
    }

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      batchSize: pending.size,
      sent,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
    });

  } catch (error: any) {
    console.error('❌ [AGENT OUTREACH QUEUE] Critical error:', error);

    return NextResponse.json(
      {
        error: error.message,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      },
      { status: 500 }
    );
  }
}
