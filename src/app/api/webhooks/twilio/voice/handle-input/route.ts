import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone-utils';
import {
  getOrCreateConversation,
  addMessage,
  resolveConversation,
  getActiveQueueItems,
  updateQueueStage,
} from '@/lib/agent-outreach/conversation-manager';
import { handleAgentYes, handleAgentNo } from '@/lib/agent-outreach/property-resolver';

/**
 * Webhook: IVR Input Handler
 *
 * Receives DTMF or speech input from the voice IVR menu.
 * 1/yes → owner financing confirmed
 * 2/no → no owner financing
 * 3 → asking seller (will follow up)
 */
export async function POST(request: NextRequest) {
  console.log('📞 [VOICE INPUT] Processing IVR response');

  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const digits = formData.get('Digits') as string;
    const speechResult = (formData.get('SpeechResult') as string || '').toLowerCase();

    console.log(`   From: ${from} | Digits: ${digits} | Speech: "${speechResult}"`);

    const normalizedPhone = normalizePhone(from);
    const activeItems = await getActiveQueueItems(normalizedPhone);

    if (activeItems.length === 0) {
      return twiml('<Say voice="Polly.Joanna">We couldn\'t find an active property for your number. Please text us instead. Goodbye.</Say>');
    }

    const targetItem = activeItems[0];
    const property = targetItem.data();

    // Determine intent from digits or speech
    let intent: 'yes' | 'no' | 'asking_seller' | 'unknown' = 'unknown';

    if (digits === '1' || speechResult.includes('yes')) {
      intent = 'yes';
    } else if (digits === '2' || speechResult.includes('no')) {
      intent = 'no';
    } else if (digits === '3' || speechResult.includes('check') || speechResult.includes('ask')) {
      intent = 'asking_seller';
    }

    // Get/create conversation for logging
    const conversation = await getOrCreateConversation(normalizedPhone, property.agentName, targetItem.id);

    const inputDescription = digits ? `pressed ${digits}` : `said "${speechResult}"`;

    await addMessage(conversation.id, {
      role: 'inbound',
      body: `[VOICE CALL] ${inputDescription}`,
      timestamp: new Date(),
      classification: intent,
      source: 'voice',
    });

    switch (intent) {
      case 'yes': {
        await handleAgentYes(targetItem.id, `Voice call: ${inputDescription}`);
        await resolveConversation(conversation.id, 'yes');
        return twiml(`
          <Say voice="Polly.Joanna">
            Thank you! We've confirmed that ${escapeXml(property.address)} offers owner financing.
            We'll send qualified buyers your way. Have a great day!
          </Say>
        `);
      }

      case 'no': {
        await handleAgentNo(targetItem.id, `Voice call: ${inputDescription}`);
        await resolveConversation(conversation.id, 'no');
        return twiml(`
          <Say voice="Polly.Joanna">
            Got it, thanks for letting us know about ${escapeXml(property.address)}. Have a great day!
          </Say>
        `);
      }

      case 'asking_seller': {
        await updateQueueStage(targetItem.id, 'asking_seller', {
          askingSellerAt: new Date(),
        });
        return twiml(`
          <Say voice="Polly.Joanna">
            No problem! Take your time checking with the seller about ${escapeXml(property.address)}.
            We'll follow up by text in a few days. Thanks!
          </Say>
        `);
      }

      default: {
        return twiml(`
          <Say voice="Polly.Joanna">
            Sorry, I didn't catch that. Feel free to text us back with YES or NO about ${escapeXml(property.address)}. Goodbye.
          </Say>
        `);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ [VOICE INPUT] Error:', msg);

    return twiml('<Say voice="Polly.Joanna">Sorry, something went wrong. Please text us instead. Goodbye.</Say>');
  }
}

/** Escape special XML characters to prevent malformed TwiML */
function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function twiml(innerXml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml.trim()}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
