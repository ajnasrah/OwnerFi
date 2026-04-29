import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';
import { normalizePhone, isValidPhone, getAllPhoneFormats } from '@/lib/phone-utils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StandardizedApiError, ValidationErrors, withErrorHandling, ErrorCode } from '@/lib/api-error-standards';

// Simple in-memory rate limiter with cleanup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per IP
let lastCleanup = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Cleanup old entries periodically
  if (now - lastCleanup > RATE_LIMIT_WINDOW * 2) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
    lastCleanup = now;
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    if (!checkRateLimit(ip)) {
      console.warn(`🚫 [CHECK-PHONE] Rate limit exceeded for IP: ${ip}`);
      throw new StandardizedApiError({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please try again later.',
        context: { function: 'check-phone', ip }
      });
    }

    const { phone } = await request.json();

    if (!phone) {
      throw ValidationErrors.missingField('phone');
    }

    // Validate phone format
    if (!isValidPhone(phone)) {
      console.log('❌ [CHECK-PHONE] Invalid phone format:', phone);
      throw ValidationErrors.invalidFormat('phone', 'valid US phone number');
    }

    // Normalize phone to E.164 format
    const normalizedPhone = normalizePhone(phone);
    console.log('🔍 [CHECK-PHONE] Searching for phone:', phone, '→', normalizedPhone);

    // Use unified DB method - it tries all formats automatically
    const user = await unifiedDb.users.findByPhone(normalizedPhone);

    if (!user) {
      console.log('❌ [CHECK-PHONE] No user found');
      return NextResponse.json({
        exists: false
      });
    }

    console.log('✅ [CHECK-PHONE] User exists:', {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      hasPassword: !!user.password
    });

    // Check if user is an investor (for routing to investor dashboard)
    // Realtors can also be investors — they get a buyerProfile with isInvestor=true at signup
    let isInvestor = false;
    if (db && (user.role === 'buyer' || user.role === 'realtor')) {
      try {
        // Try userId first
        let buyerSnap = await getDocs(query(
          collection(db, 'buyerProfiles'),
          where('userId', '==', user.id)
        ));
        // Fallback to phone if userId lookup missed (profile may not have userId yet)
        // Try all phone formats to match profiles stored in any format
        if (buyerSnap.empty && normalizedPhone) {
          const phoneFormats = getAllPhoneFormats(normalizedPhone);
          for (const fmt of phoneFormats) {
            buyerSnap = await getDocs(query(
              collection(db, 'buyerProfiles'),
              where('phone', '==', fmt)
            ));
            if (!buyerSnap.empty) break;
          }
        }
        if (!buyerSnap.empty) {
          isInvestor = buyerSnap.docs[0].data().isInvestor === true;
        }
      } catch (e) {
        console.warn('[CHECK-PHONE] Failed to check investor status:', e);
      }
    }

    // ✅ USER EXISTS: Return true regardless of whether they have password or not
    // The auth flow will handle signing them in
    return NextResponse.json({
      exists: true,
      role: user.role || 'buyer',
      userId: user.id,
      hasPassword: !!user.password, // Let client know if this is an old account
      isInvestor, // For routing investors to /dashboard/investor
    });

  }, { endpoint: 'POST /api/auth/check-phone' });
}
