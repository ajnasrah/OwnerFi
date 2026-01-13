import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
import { indexRawFirestoreProperty } from '@/lib/typesense/sync';
import crypto from 'crypto';

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

// Webhook secret for security
const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

/**
 * Verify webhook signature using HMAC SHA-256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): { valid: boolean; reason?: string } {
  if (!GHL_WEBHOOK_SECRET) {
    return {
      valid: false,
      reason: 'Server configuration error: GHL_WEBHOOK_SECRET not set'
    };
  }

  if (!signature) {
    return {
      valid: false,
      reason: 'Missing webhook signature header'
    };
  }

  try {
    // Check if GoHighLevel is sending the raw secret as the signature
    if (signature === GHL_WEBHOOK_SECRET) {
      return { valid: true };
    }

    const expectedSignature = crypto
      .createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Try multiple signature formats
    const validFormats = [
      signature === expectedSignature,
      signature === `sha256=${expectedSignature}`,
      signature.replace(/^sha256=/, '') === expectedSignature,
    ];

    if (validFormats.some(valid => valid)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'Signature mismatch - invalid authentication'
    };
  } catch (error) {
    console.error('Error verifying webhook signature', error);
    return {
      valid: false,
      reason: 'Signature verification error'
    };
  }
}

/**
 * Webhook: Agent Response Handler
 *
 * Receives agent YES/NO responses from GoHighLevel
 * Routes properties to unified 'properties' collection:
 * - YES → properties collection with ownerFinanceVerified=true or isCashDeal=true
 * - NO → marks as rejected in agent_outreach_queue
 *
 * Expected payload from GHL:
 * {
 *   firebaseId: string,
 *   response: 'yes' | 'no',
 *   agentNote?: string,
 *   opportunityId?: string
 * }
 */
export async function POST(request: NextRequest) {
  console.log('📨 [AGENT RESPONSE WEBHOOK] Received webhook');

  try {
    // Read raw body
    const rawBody = await request.text();

    // Parse body
    const body = JSON.parse(rawBody);

    // Check for signature in headers only (body signatures are a security risk)
    const signature = request.headers.get('x-webhook-signature') ||
                     request.headers.get('x-ghl-signature');

    // Verify webhook signature
    const verification = verifyWebhookSignature(rawBody, signature);
    if (!verification.valid) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Invalid signature:', verification.reason);
      console.error('   Body keys:', Object.keys(body));
      return NextResponse.json(
        { error: 'Unauthorized', reason: verification.reason },
        { status: 401 }
      );
    }
    // Accept both firebaseId and firebase_id (GHL uses snake_case)
    const firebaseId = body.firebaseId || body.firebase_id;
    const response = body.response;
    const agentNote = body.agentNote || body.agent_note;
    const _opportunityId = body.opportunityId || body.opportunity_id;

    console.log(`📋 [AGENT RESPONSE WEBHOOK] Processing response for ${firebaseId}`);
    console.log(`   Response: ${response}`);
    if (agentNote) {
      console.log(`   Note: ${agentNote}`);
    }

    // Validate required fields
    if (!firebaseId || !response) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: firebaseId and response' },
        { status: 400 }
      );
    }

    // Validate response value
    if (response !== 'yes' && response !== 'no') {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Invalid response value:', response);
      return NextResponse.json(
        { error: 'Invalid response value. Must be "yes" or "no"' },
        { status: 400 }
      );
    }

    // Get property from agent_outreach_queue
    const docRef = db.collection('agent_outreach_queue').doc(firebaseId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Property not found:', firebaseId);
      return NextResponse.json(
        { error: 'Property not found in queue' },
        { status: 404 }
      );
    }

    const property = doc.data()!;

    console.log(`   Property: ${property.address}`);
    console.log(`   Deal Type: ${property.dealType}`);

    // Handle agent response
    if (response === 'yes') {
      console.log('✅ [AGENT RESPONSE WEBHOOK] Agent said YES');

      // Detect financing type from description
      const { detectFinancingType } = await import('@/lib/financing-type-detector');
      const descriptionText = sanitizeDescription(property.rawData?.description || '');
      const financingTypeResult = detectFinancingType(descriptionText);

      const isOwnerFinance = property.dealType === 'potential_owner_finance';
      const isCashDeal = property.dealType === 'cash_deal';

      const discountPercent = property.priceToZestimateRatio
        ? Math.round((1 - property.priceToZestimateRatio) * 100)
        : 0;

      // Add to unified properties collection
      console.log(`   → Routing to properties (${isOwnerFinance ? 'owner_finance' : 'cash_deal'})`);

      await db.collection('properties').doc(`zpid_${property.zpid}`).set({
        // Core identifiers
        zpid: property.zpid,
        url: property.url,

        // Address
        address: property.address || '',
        streetAddress: property.address || '',
        fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        city: property.city || '',
        state: property.state || '',
        zipCode: property.zipCode || '',

        // Pricing
        price: property.price || 0,
        listPrice: property.price || 0,
        zestimate: property.zestimate || null,
        priceToZestimateRatio: property.priceToZestimateRatio || 0,
        discountPercent: isCashDeal ? discountPercent : null,

        // Property details
        bedrooms: property.beds || 0,
        bathrooms: property.baths || 0,
        squareFoot: property.squareFeet || 0,
        homeType: property.propertyType || 'SINGLE_FAMILY',
        homeStatus: 'FOR_SALE',

        // Agent info
        agentName: property.agentName,
        agentPhoneNumber: property.agentPhone,
        agentEmail: property.agentEmail || null,

        // Description
        description: descriptionText,

        // Financing Type Status (for owner finance)
        ...(isOwnerFinance && {
          financingType: financingTypeResult.financingType || 'Owner Finance',
          allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
          financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',
          ownerFinanceVerified: true,
          agentConfirmedOwnerFinance: true,
        }),

        // Cash deal fields
        ...(isCashDeal && {
          agentConfirmedMotivated: true,
        }),

        // Unified collection flags
        isOwnerFinance,
        isCashDeal,
        dealTypes: isOwnerFinance ? ['owner_finance'] : ['cash_deal'],
        isActive: true,

        // Source tracking
        source: 'agent_outreach',
        agentConfirmedAt: new Date(),
        agentNote: agentNote || null,
        originalQueueId: firebaseId,

        // Metadata
        importedAt: new Date(),
        createdAt: new Date(),
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),

        // Full raw data for reference
        rawData: property.rawData || null,
      });

      console.log('   ✅ Added to properties');

      // Sync to Typesense for search
      try {
        const propertyDoc = await db.collection('properties').doc(`zpid_${property.zpid}`).get();
        if (propertyDoc.exists) {
          await indexRawFirestoreProperty(`zpid_${property.zpid}`, propertyDoc.data()!, 'properties');
          console.log('   ✅ Synced to Typesense');
        }
      } catch (typesenseErr: unknown) {
        const errMsg = typesenseErr instanceof Error ? typesenseErr.message : 'Unknown error';
        console.error(`   ⚠️ Typesense sync failed: ${errMsg}`);
      }

      // Update agent_outreach_queue
      await docRef.update({
        status: 'agent_yes',
        agentResponse: 'yes',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: 'properties',
        updatedAt: new Date(),
      });

    } else {
      // Agent said NO
      console.log('❌ [AGENT RESPONSE WEBHOOK] Agent said NO');

      await docRef.update({
        status: 'agent_no',
        agentResponse: 'no',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: 'rejected',
        updatedAt: new Date(),
      });

      console.log('   ✅ Marked as rejected');
    }

    console.log('✅ [AGENT RESPONSE WEBHOOK] Successfully processed response');

    return NextResponse.json({
      success: true,
      message: 'Agent response processed successfully',
      firebaseId,
      response,
      routedTo: response === 'yes' ? 'properties' : 'rejected'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [AGENT RESPONSE WEBHOOK] Error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage
      },
      { status: 500 }
    );
  }
}
