import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

// Test phone numbers that bypass Twilio in development (use code: 123456)
const TEST_PHONES = new Set(
  (process.env.TEST_PHONE_NUMBERS || '').split(',').map(p => p.trim()).filter(Boolean)
);

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // Bypass: accept 123456 for test phone numbers (works in dev and when TEST_PHONE_NUMBERS is set)
    if (TEST_PHONES.has(normalizedPhone)) {
      if (code === '123456') {
        console.log(`🧪 [OTP] Test phone verified: ${normalizedPhone}`);
        return NextResponse.json({ success: true, phone: normalizedPhone });
      }
      return NextResponse.json({ error: 'Invalid code. Use 123456 for test numbers.' }, { status: 400 });
    }

    // Use Twilio Verify to check the code
    // Trim to remove any trailing newlines from env vars
    const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

    if (!twilioSid || !twilioToken || !verifyServiceSid) {
      console.error('❌ [OTP] Twilio Verify not configured');
      return NextResponse.json(
        { error: 'Verification service unavailable' },
        { status: 500 }
      );
    }

    try {
      const checkResponse = await fetch(
        `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: normalizedPhone,
            Code: code
          })
        }
      );

      const result = await checkResponse.json();

      if (checkResponse.ok && result.status === 'approved') {
        console.log(`✅ [OTP] Verified successfully for ${normalizedPhone}`);
        return NextResponse.json({
          success: true,
          phone: normalizedPhone
        });
      }

      // Handle specific error cases
      if (result.status === 'pending') {
        return NextResponse.json(
          { error: 'Invalid code. Please try again.' },
          { status: 400 }
        );
      }

      console.error('❌ [OTP] Verification failed:', result);
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      );

    } catch (twilioErr) {
      console.error('❌ [OTP] Twilio Verify check error:', twilioErr);
      return NextResponse.json(
        { error: 'Verification failed. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [OTP] Verify error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
