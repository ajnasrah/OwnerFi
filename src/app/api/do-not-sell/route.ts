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

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_IP = 5; // Max requests per IP in window
const MAX_REQUESTS_PER_IDENTIFIER = 3; // Max requests per phone/email in window

// In-memory rate limit stores (cleared on server restart)
const ipRateLimitStore = new Map<string, { count: number; resetAt: number }>();
const identifierRateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
function cleanupRateLimitStore(store: Map<string, { count: number; resetAt: number }>) {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetAt) {
      store.delete(key);
    }
  }
}

// Check and update rate limit
function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = store.get(key);

  // Clean up occasionally (1% chance per request)
  if (Math.random() < 0.01) {
    cleanupRateLimitStore(store);
  }

  if (!existing || now > existing.resetAt) {
    // New window
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  // Increment count
  existing.count++;
  return { allowed: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt };
}

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
    const ipLimit = checkRateLimit(ipRateLimitStore, clientIp, MAX_REQUESTS_PER_IP);
    if (!ipLimit.allowed) {
      console.warn(`[Do Not Sell] Rate limit exceeded for IP: ${clientIp}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((ipLimit.resetAt - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((ipLimit.resetAt - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': ipLimit.resetAt.toString()
          }
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
    const identifierLimit = checkRateLimit(identifierRateLimitStore, normalizedIdentifier, MAX_REQUESTS_PER_IDENTIFIER);
    if (!identifierLimit.allowed) {
      const maskedId = phone ? phone.substring(0, 4) : (email || '').substring(0, 4);
      console.warn(`[Do Not Sell] Rate limit exceeded for identifier: ${maskedId}***`);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests for this phone/email. Please try again later.',
          retryAfter: Math.ceil((identifierLimit.resetAt - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((identifierLimit.resetAt - Date.now()) / 1000).toString()
          }
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
      console.log(`[Do Not Sell] No buyer found - phone: ${phone}, email: ${email}`);
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

    // Log the opt-out event
    await db.collection('buyerOptOutLogs').add({
      buyerId: buyerDoc.id,
      buyerPhone: buyerData?.phone || phone || null,
      buyerEmail: buyerData?.email || email || null,
      reason: 'ccpa_do_not_sell',
      source: 'website_form',
      lookupMethod,
      previousStatus: {
        isAvailableForPurchase: buyerData?.isAvailableForPurchase ?? null,
        isActive: buyerData?.isActive ?? null,
      },
      createdAt: new Date(),
    });

    console.log(`[Do Not Sell] Buyer ${buyerDoc.id} marked as unavailable via ${lookupMethod}`);

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
