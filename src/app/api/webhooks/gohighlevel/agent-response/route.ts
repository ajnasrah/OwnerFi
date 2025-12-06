import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '@/lib/description-sanitizer';
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
    const expectedSignature = crypto
      .createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Try multiple signature formats
    const validFormats = [
      signature === expectedSignature,
      signature === `sha256=${expectedSignature}`,
      signature.replace(/^sha256=/, '') === expectedSignature,
      signature === GHL_WEBHOOK_SECRET // Raw secret (some systems do this)
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
 * Routes properties to appropriate collections:
 * - Owner Finance YES → zillow_imports (displays on website)
 * - Cash Deal YES → cash_deals (for cash buyers)
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
    // Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') ||
                     request.headers.get('x-ghl-signature');

    // Verify webhook signature
    const verification = verifyWebhookSignature(rawBody, signature);
    if (!verification.valid) {
      console.error('❌ [AGENT RESPONSE WEBHOOK] Invalid signature:', verification.reason);
      return NextResponse.json(
        { error: 'Unauthorized', reason: verification.reason },
        { status: 401 }
      );
    }

    // Parse body
    const body = JSON.parse(rawBody);
    const { firebaseId, response, agentNote, opportunityId } = body;

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

      // Route based on deal type
      if (property.dealType === 'potential_owner_finance') {
        // Add to zillow_imports for display on website
        console.log('   → Routing to zillow_imports (owner finance)');

        // Detect financing type from description (or default to Owner Finance since agent confirmed)
        const { detectFinancingType } = await import('@/lib/financing-type-detector');
        const descriptionText = sanitizeDescription(property.rawData?.description || '');
        const financingTypeResult = detectFinancingType(descriptionText);

        await db.collection('zillow_imports').add({
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

          // Property details
          bedrooms: property.beds || 0,
          bathrooms: property.baths || 0,
          livingArea: property.squareFeet || 0,
          homeType: property.propertyType || 'SINGLE_FAMILY',
          homeStatus: 'FOR_SALE',

          // Agent info
          agentName: property.agentName,
          agentPhoneNumber: property.agentPhone,
          agentEmail: property.agentEmail || null,

          // Description
          description: descriptionText,

          // Financing Type Status (agent confirmed = default to Owner Finance if no keywords detected)
          financingType: financingTypeResult.financingType || 'Owner Finance',
          allFinancingTypes: financingTypeResult.allTypes.length > 0 ? financingTypeResult.allTypes : ['Owner Finance'],
          financingTypeLabel: financingTypeResult.displayLabel || 'Owner Finance',

          // Source tracking
          source: 'agent_outreach',
          agentConfirmedOwnerFinance: true,
          agentConfirmedAt: new Date(),
          agentNote: agentNote || null,
          originalQueueId: firebaseId,

          // CRITICAL: These flags make the property visible to buyers
          ownerFinanceVerified: true,
          isActive: true,

          // Metadata
          importedAt: new Date(),
          lastStatusCheck: new Date(),
          lastScrapedAt: new Date(),

          // Full raw data for reference
          rawData: property.rawData || null,
        });

        console.log('   ✅ Added to zillow_imports');
      }
      else if (property.dealType === 'cash_deal') {
        // Add to cash_deals collection
        console.log('   → Routing to cash_deals');

        const discountPercent = property.priceToZestimateRatio
          ? Math.round((1 - property.priceToZestimateRatio) * 100)
          : 0;

        await db.collection('cash_deals').add({
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

          // Pricing - THIS IS THE KEY DIFFERENCE
          price: property.price || 0,
          listPrice: property.price || 0,
          zestimate: property.zestimate || 0,
          priceToZestimateRatio: property.priceToZestimateRatio || 0,
          discountPercent: discountPercent, // e.g., 25 = 25% below market

          // Property details
          bedrooms: property.beds || 0,
          bathrooms: property.baths || 0,
          livingArea: property.squareFeet || 0,
          homeType: property.propertyType || 'SINGLE_FAMILY',
          homeStatus: 'FOR_SALE',

          // Agent info
          agentName: property.agentName,
          agentPhoneNumber: property.agentPhone,
          agentEmail: property.agentEmail || null,

          // Description
          description: sanitizeDescription(property.rawData?.description || ''),

          // Source tracking
          source: 'agent_outreach',
          agentConfirmedMotivated: true,
          agentConfirmedAt: new Date(),
          agentNote: agentNote || null,
          originalQueueId: firebaseId,

          // Metadata
          importedAt: new Date(),
          lastStatusCheck: new Date(),
          lastScrapedAt: new Date(),

          // Full raw data for reference
          rawData: property.rawData || null,
        });

        console.log('   ✅ Added to cash_deals');
      }

      // Update agent_outreach_queue
      await docRef.update({
        status: 'agent_yes',
        agentResponse: 'yes',
        agentResponseAt: new Date(),
        agentNote: agentNote || null,
        routedTo: property.dealType === 'potential_owner_finance' ? 'zillow_imports' : 'cash_deals',
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
      routedTo: response === 'yes'
        ? (property.dealType === 'potential_owner_finance' ? 'zillow_imports' : 'cash_deals')
        : 'rejected'
    });

  } catch (error: any) {
    console.error('❌ [AGENT RESPONSE WEBHOOK] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
