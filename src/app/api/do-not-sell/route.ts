/**
 * Do Not Sell / CCPA Opt-Out API
 *
 * Allows users to opt out of having their personal information sold or shared.
 * Marks their buyer profile as unavailable for purchase.
 *
 * Route: POST /api/do-not-sell
 *
 * Security: Rate limited to prevent abuse and probing attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAllPhoneFormats } from '@/lib/phone-utils';
import { revokeBuyerTCPAConsent } from '@/lib/tcpa-revocation';
import { checkRateLimit } from '@/lib/rate-limit-firestore';
import { maskPhone, maskEmail } from '@/lib/log-redact';

// Rate limiting configuration — now persisted in Firestore so serverless
// cold starts no longer reset the counter and allow probing/enumeration.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_IP = 5;
const MAX_REQUESTS_PER_IDENTIFIER = 3;

interface OptOutRequest {
  phone?: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Check IP rate limit
    const ipLimit = await checkRateLimit({
      namespace: 'do-not-sell:ip',
      key: clientIp,
      maxRequests: MAX_REQUESTS_PER_IP,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!ipLimit.allowed) {
      console.warn(`[Do Not Sell] Rate limit exceeded for IP`);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: ipLimit.retryAfterSecs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': ipLimit.retryAfterSecs.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': ipLimit.resetAt.toString(),
          },
        }
      );
    }

    const body: OptOutRequest = await request.json();
    const { phone, email } = body;

    // Validate at least one identifier
    if (!phone && !email) {
      return NextResponse.json(
        { success: false, error: 'Please provide a phone number or email address' },
        { status: 400 }
      );
    }

    // Check identifier rate limit (prevents probing specific phone/email)
    // Normalize: for phone remove non-digits, for email just lowercase
    const normalizedIdentifier = phone
      ? phone.replace(/\D/g, '') // Phone: keep only digits
      : (email || '').toLowerCase().trim(); // Email: lowercase and trim
    const identifierLimit = await checkRateLimit({
      namespace: 'do-not-sell:id',
      key: normalizedIdentifier,
      maxRequests: MAX_REQUESTS_PER_IDENTIFIER,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!identifierLimit.allowed) {
      console.warn(`[Do Not Sell] Rate limit exceeded for identifier (masked)`);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests for this phone/email. Please try again later.',
          retryAfter: identifierLimit.retryAfterSecs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': identifierLimit.retryAfterSecs.toString(),
          },
        }
      );
    }

    // Initialize Firebase Admin
    const db = await getAdminDb();
    if (!db) {
      console.error('[Do Not Sell] Firebase Admin not initialized');
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable' },
        { status: 500 }
      );
    }

    let buyerDoc = null;
    let lookupMethod = '';

    // Try phone lookup using all possible formats
    if (phone) {
      const phoneFormats = getAllPhoneFormats(phone);

      for (const phoneFormat of phoneFormats) {
        const snapshot = await db.collection('buyerProfiles')
          .where('phone', '==', phoneFormat)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          buyerDoc = snapshot.docs[0];
          lookupMethod = 'phone';
          break;
        }
      }
    }

    // Try email lookup
    if (!buyerDoc && email) {
      const normalizedEmail = email.toLowerCase().trim();
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
      console.log(`[Do Not Sell] No buyer found - phone: ${maskPhone(phone)}, email: ${maskEmail(email)}`);
      return NextResponse.json({
        success: false,
        error: 'We could not find your information in our system'
      }, { status: 404 });
    }

    const buyerData = buyerDoc.data();

    // Check if already opted out
    if (buyerData?.isAvailableForPurchase === false && buyerData?.optedOutAt) {
      return NextResponse.json(
        {
          success: true,
          message: 'Your information is already marked as do not sell'
        },
        {
          headers: {
            'X-RateLimit-Remaining': ipLimit.remaining.toString()
          }
        }
      );
    }

    // Update buyer profile to mark as unavailable
    await db.collection('buyerProfiles').doc(buyerDoc.id).update({
      isAvailableForPurchase: false,
      isActive: false,
      optedOutAt: new Date(),
      optOutReason: 'ccpa_do_not_sell',
      optOutSource: 'website_form',
      updatedAt: new Date(),
    });

    // CCPA opt-out strongly implies withdrawal of TCPA consent — continuing to
    // SMS/call after this is not defensible. Revoke and propagate DND to GHL.
    let tcpaRevocationCaseId: string | null = null;
    const phoneForRevocation = (buyerData?.phone as string) || phone;
    if (phoneForRevocation) {
      try {
        const revResult = await revokeBuyerTCPAConsent(phoneForRevocation, 'ccpa', {
          note: 'CCPA do-not-sell request via /api/do-not-sell',
        });
        tcpaRevocationCaseId = revResult.caseId;
      } catch (revErr) {
        // Non-fatal: buyer is already marked unavailable; pending drainer retries GHL.
        const revMsg = revErr instanceof Error ? revErr.message : 'Unknown error';
        console.error(`[Do Not Sell] TCPA revocation failed (non-fatal): ${revMsg}`);
      }
    }

    // Log the opt-out event
    await db.collection('buyerOptOutLogs').add({
      buyerId: buyerDoc.id,
      buyerPhone: buyerData?.phone || phone || null,
      buyerEmail: buyerData?.email || email || null,
      reason: 'ccpa_do_not_sell',
      source: 'website_form',
      lookupMethod,
      tcpaRevocationCaseId,
      previousStatus: {
        isAvailableForPurchase: buyerData?.isAvailableForPurchase ?? null,
        isActive: buyerData?.isActive ?? null,
      },
      createdAt: new Date(),
    });

    console.log(`[Do Not Sell] Buyer ${buyerDoc.id} marked as unavailable via ${lookupMethod}; TCPA case ${tcpaRevocationCaseId ?? 'n/a'}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Your information has been marked as do not sell'
      },
      {
        headers: {
          'X-RateLimit-Remaining': ipLimit.remaining.toString()
        }
      }
    );

  } catch (error) {
    console.error('[Do Not Sell] Error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
