import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

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
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    if (!checkRateLimit(ip)) {
      console.warn(`🚫 [CHECK-PHONE] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!isValidPhone(phone)) {
      console.log('❌ [CHECK-PHONE] Invalid phone format:', phone);
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
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

    // ✅ USER EXISTS: Return true regardless of whether they have password or not
    // The auth flow will handle signing them in
    return NextResponse.json({
      exists: true,
      role: user.role || 'buyer',
      userId: user.id,
      hasPassword: !!user.password // Let client know if this is an old account
    });

  } catch (error) {
    console.error('❌ [CHECK-PHONE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}
