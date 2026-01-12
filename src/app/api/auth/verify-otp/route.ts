import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

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

    // Use Twilio Verify to check the code
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

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
