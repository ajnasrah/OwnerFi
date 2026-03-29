import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone-utils';
import { getActiveQueueItems } from '@/lib/agent-outreach/conversation-manager';

/**
 * Webhook: Inbound Voice Call from Twilio
 *
 * When an agent calls back, we forward the call to VAPI
 * for AI-powered conversation handling.
 *
 * If VAPI is not configured, falls back to a simple IVR menu.
 *
 * Configure this URL as the Voice webhook on your Twilio outreach number.
 */
export async function POST(request: NextRequest) {
  console.log('📞 [TWILIO VOICE WEBHOOK] Inbound call received');

  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const callSid = formData.get('CallSid') as string;

    console.log(`   From: ${from}`);
    console.log(`   CallSid: ${callSid}`);

    // Look up caller in active queue items
    let propertyAddress = 'your property';
    try {
      const normalizedPhone = normalizePhone(from);
      const activeItems = await getActiveQueueItems(normalizedPhone);
      if (activeItems.length > 0) {
        propertyAddress = activeItems[0].data().address || propertyAddress;
      }
    } catch {
      // If lookup fails, proceed with generic greeting
    }

    // Check if VAPI is configured
    const vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (vapiPhoneNumberId) {
      // Forward to VAPI using SIP transfer
      // VAPI handles the AI conversation and sends results to our call-end webhook
      const vapiSipUri = process.env.VAPI_SIP_URI;

      if (vapiSipUri) {
        console.log('   → Forwarding to VAPI');
        return twiml(`
          <Response>
            <Dial>
              <Sip>${vapiSipUri}</Sip>
            </Dial>
          </Response>
        `);
      }
    }

    // Fallback: Simple IVR menu
    console.log('   → Using IVR fallback');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'https://ownerfi.ai';

    return twiml(`
      <Response>
        <Gather input="dtmf speech" timeout="8" numDigits="1" action="${baseUrl}/api/webhooks/twilio/voice/handle-input">
          <Say voice="Polly.Joanna">
            Hi, this is OwnerFi. We help connect buyers with owner-financed homes.
            We recently texted you about ${escapeXml(propertyAddress)}.
            Press 1 or say yes if owner financing is available.
            Press 2 or say no if it is not.
            Press 3 if you need to check with the seller first.
          </Say>
        </Gather>
        <Say voice="Polly.Joanna">We didn't receive any input. Feel free to text us back instead. Goodbye.</Say>
      </Response>
    `);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ [TWILIO VOICE] Error:', msg);

    return twiml(`
      <Response>
        <Say voice="Polly.Joanna">
          Sorry, we're experiencing technical difficulties. Please text us instead. Goodbye.
        </Say>
      </Response>
    `);
  }
}

/** Escape special XML characters to prevent malformed TwiML */
function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function twiml(xml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>${xml.trim()}`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
