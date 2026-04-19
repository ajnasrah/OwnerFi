import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { checkRateLimit as checkRateLimitFirestore } from '@/lib/rate-limit-firestore';

// Tighter limits than the old in-memory version — serverless cold starts
// can't reset our counter anymore. 3/min per phone + a looser 30/15min
// window to catch slow-drip enumeration.
const SHORT_WINDOW_MS = 60 * 1000;
const SHORT_MAX = 3;
const LONG_WINDOW_MS = 15 * 60 * 1000;
const LONG_MAX = 10;

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

    // Rate limiting — two windows enforced together
    const [shortLim, longLim] = await Promise.all([
      checkRateLimitFirestore({
        namespace: 'otp-send:short',
        key: normalizedPhone,
        maxRequests: SHORT_MAX,
        windowMs: SHORT_WINDOW_MS,
      }),
      checkRateLimitFirestore({
        namespace: 'otp-send:long',
        key: normalizedPhone,
        maxRequests: LONG_MAX,
        windowMs: LONG_WINDOW_MS,
      }),
    ]);
    if (!shortLim.allowed || !longLim.allowed) {
      const worst = !shortLim.allowed ? shortLim : longLim;
      return NextResponse.json(
        { error: 'Too many attempts. Please wait and try again.', retryAfter: worst.retryAfterSecs },
        { status: 429, headers: { 'Retry-After': String(worst.retryAfterSecs) } }
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
