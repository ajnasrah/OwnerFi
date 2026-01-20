/**
 * GoHighLevel Webhook - Buyer Opt-Out
 *
 * This webhook receives buyer opt-out requests from GoHighLevel when buyers
 * say "stop contacting me" or indicate they're not interested.
 *
 * When triggered, it marks the buyer as unavailable so they won't be offered
 * as a lead to realtors.
 *
 * Route: POST /api/webhooks/gohighlevel/buyer-optout
 *
 * Expected Payload from GHL:
 * {
 *   phone?: string,        // Primary identifier
 *   email?: string,        // Secondary identifier
 *   buyerId?: string,      // Direct ID lookup
 *   reason?: string,       // Optional: "stop_contacting", "not_interested", etc.
 *   contactId?: string,    // GHL contact ID for tracking
 * }
 *
 * SECURITY: Requires webhook signature validation in production
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isWebhookProcessed, markWebhookProcessed } from '@/lib/webhook-idempotency';
import { getAllPhoneFormats } from '@/lib/phone-utils';
import crypto from 'crypto';

// Webhook secret for signature validation
const WEBHOOK_SECRET = process.env.GHL_BUYER_OPTOUT_WEBHOOK_SECRET || process.env.GHL_WEBHOOK_SECRET;

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [SECURITY] GHL_BUYER_OPTOUT_WEBHOOK_SECRET not set - skipping signature validation in dev');
      return true;
    }
    return false;
  }

  if (!signature) {
    return false;
  }

  const signatureValue = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}


interface BuyerOptOutPayload {
  phone?: string;
  email?: string;
  buyerId?: string;
  reason?: string;
  status?: string;  // e.g., "notInterested"
  contactId?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔔 [GHL Buyer Opt-Out] Webhook received');

    // Get raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') ||
                      request.headers.get('x-hub-signature-256') ||
                      request.headers.get('x-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('🚫 [SECURITY] Invalid webhook signature for buyer opt-out');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse request body
    const payload: BuyerOptOutPayload = JSON.parse(rawBody);

    // Validate at least one identifier is provided
    if (!payload.phone && !payload.email && !payload.buyerId) {
      return NextResponse.json(
        { error: 'Missing required field: phone, email, or buyerId required' },
        { status: 400 }
      );
    }

    // Generate idempotency key
    const idempotencyId = payload.buyerId || payload.phone || payload.email || '';

    // Check idempotency to prevent duplicate processing
    const { processed, previousResponse } = await isWebhookProcessed(
      'gohighlevel',
      `buyer-optout:${idempotencyId}`,
      undefined,
      rawBody
    );

    if (processed) {
      console.log(`⏭️ [GHL Buyer Opt-Out] Already processed for ${idempotencyId}`);
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        previousResponse,
        processingTimeMs: Date.now() - startTime,
      });
    }

    // Initialize Firebase Admin
    const db = await getAdminDb();
    if (!db) {
      console.error('❌ [GHL Buyer Opt-Out] Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Find buyer profile by phone, email, or buyerId
    let buyerDoc = null;
    let lookupMethod = '';

    // Try buyerId first (most direct)
    if (payload.buyerId) {
      const doc = await db.collection('buyerProfiles').doc(payload.buyerId).get();
      if (doc.exists) {
        buyerDoc = doc;
        lookupMethod = 'buyerId';
      }
    }

    // Try phone lookup using all possible formats
    if (!buyerDoc && payload.phone) {
      const phoneFormats = getAllPhoneFormats(payload.phone);
      console.log(`🔍 [GHL Buyer Opt-Out] Trying phone formats:`, phoneFormats);

      for (const phoneFormat of phoneFormats) {
        const snapshot = await db.collection('buyerProfiles')
          .where('phone', '==', phoneFormat)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          buyerDoc = snapshot.docs[0];
          lookupMethod = `phone:${phoneFormat}`;
          console.log(`✅ [GHL Buyer Opt-Out] Found by phone format: ${phoneFormat}`);
          break;
        }
      }
    }

    // Try email lookup
    if (!buyerDoc && payload.email) {
      const normalizedEmail = payload.email.toLowerCase().trim();
      const snapshot = await db.collection('buyerProfiles')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        buyerDoc = snapshot.docs[0];
        lookupMethod = 'email';
      }
    }

    // Handle buyer not found
    if (!buyerDoc) {
      console.warn(`⚠️ [GHL Buyer Opt-Out] Buyer not found - phone: ${payload.phone}, email: ${payload.email}, buyerId: ${payload.buyerId}`);

      // Still mark as processed to prevent retries
      await markWebhookProcessed(
        'gohighlevel',
        `buyer-optout:${idempotencyId}`,
        undefined,
        rawBody,
        { success: false, reason: 'buyer_not_found' }
      );

      return NextResponse.json({
        success: false,
        error: 'Buyer not found',
        processingTimeMs: Date.now() - startTime,
      }, { status: 404 });
    }

    const buyerData = buyerDoc.data();
    const buyerName = `${buyerData?.firstName || ''} ${buyerData?.lastName || ''}`.trim() || 'Unknown';

    console.log(`📋 [GHL Buyer Opt-Out] Found buyer: ${buyerName} (${buyerDoc.id}) via ${lookupMethod}`);

    // Use status or reason field (status takes precedence from GHL)
    const optOutReason = payload.status || payload.reason || 'stop_contacting';

    // Update buyer profile to mark as unavailable
    await db.collection('buyerProfiles').doc(buyerDoc.id).update({
      isAvailableForPurchase: false,
      isActive: false,
      optedOutAt: new Date(),
      optOutReason,
      optOutStatus: payload.status || null,
      optOutSource: 'ghl_webhook',
      ghlContactId: payload.contactId || null,
      updatedAt: new Date(),
    });

    console.log(`✅ [GHL Buyer Opt-Out] Marked buyer ${buyerDoc.id} as unavailable`);

    // Log the opt-out event
    await db.collection('buyerOptOutLogs').add({
      buyerId: buyerDoc.id,
      buyerName,
      buyerPhone: buyerData?.phone || payload.phone,
      buyerEmail: buyerData?.email || payload.email,
      reason: optOutReason,
      status: payload.status || null,
      ghlContactId: payload.contactId,
      lookupMethod,
      previousStatus: {
        isAvailableForPurchase: buyerData?.isAvailableForPurchase,
        isActive: buyerData?.isActive,
      },
      createdAt: new Date(),
    });

    // Mark webhook as processed
    const response = {
      success: true,
      message: 'Buyer marked as unavailable',
      buyerId: buyerDoc.id,
      buyerName,
      lookupMethod,
      status: payload.status || null,
      reason: optOutReason,
      processingTimeMs: Date.now() - startTime,
    };

    await markWebhookProcessed(
      'gohighlevel',
      `buyer-optout:${idempotencyId}`,
      undefined,
      rawBody,
      response
    );

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [GHL Buyer Opt-Out] Webhook failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

// GET endpoint for testing/verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/gohighlevel/buyer-optout',
    description: 'Webhook to mark buyers as unavailable when they opt out via GoHighLevel',
    methods: ['POST'],
    requiredFields: 'At least one of: phone, email, or buyerId',
    optionalFields: ['reason', 'status', 'contactId'],
    examplePayload: {
      phone: '+19018319661',
      status: 'notInterested'
    }
  });
}
