import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

// Rate limiting with periodic cleanup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 OTP requests per minute per phone
let lastCleanup = Date.now();

function checkRateLimit(phone: string): boolean {
  const now = Date.now();

  // Cleanup old entries periodically
  if (now - lastCleanup > RATE_LIMIT_WINDOW * 2) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) rateLimitMap.delete(key);
    }
    lastCleanup = now;
  }

  const entry = rateLimitMap.get(phone);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(phone, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Test phone numbers that bypass Twilio in development (use code: 123456)
const TEST_PHONES = new Set(
  (process.env.TEST_PHONE_NUMBERS || '').split(',').map(p => p.trim()).filter(Boolean)
);

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // Rate limiting
    if (!checkRateLimit(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    // Bypass: skip Twilio for test phone numbers (works in dev and when TEST_PHONE_NUMBERS is set)
    if (TEST_PHONES.has(normalizedPhone)) {
      console.log(`🧪 [OTP] Test phone bypass — use code 123456 for ${normalizedPhone}`);
      return NextResponse.json({ success: true, message: 'Verification code sent' });
    }

    // Use Twilio Verify (handles carrier compliance automatically)
    // Trim to remove any trailing newlines from env vars
    const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

    if (twilioSid && twilioToken && verifyServiceSid) {
      try {
        const verifyResponse = await fetch(
          `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: normalizedPhone,
              Channel: 'sms'
            })
          }
        );

        if (verifyResponse.ok) {
          console.log(`✅ [OTP] Sent via Twilio Verify to ${normalizedPhone}`);
          return NextResponse.json({
            success: true,
            message: 'Verification code sent'
          });
        }

        const verifyError = await verifyResponse.text();
        console.error('❌ Twilio Verify failed:', verifyError);
      } catch (twilioErr) {
        console.error('❌ Twilio Verify error:', twilioErr);
      }
    }

    // No SMS provider worked
    console.error('❌ No SMS provider available or Twilio Verify not configured');
    return NextResponse.json(
      { error: 'SMS service unavailable. Please try again or contact support.' },
      { status: 500 }
    );

  } catch (error) {
    console.error('❌ [OTP] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
