import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 OTP requests per minute per phone

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
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
