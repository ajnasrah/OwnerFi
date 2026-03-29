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
 * Webhook: VAPI End-of-Call
 *
 * VAPI sends call results when a conversation ends.
 * Parses the transcript/tool calls to determine if the agent
 * confirmed or denied owner financing.
 *
 * VAPI payload includes:
 * - message.type: "end-of-call-report"
 * - message.transcript: full conversation text
 * - message.analysis: extracted data from the conversation
 * - call.customer.number: the agent's phone number
 */
export async function POST(request: NextRequest) {
  console.log('📞 [VAPI CALL-END] Received end-of-call webhook');

  try {
    const body = await request.json();

    // VAPI sends different message types — we only care about end-of-call
    const messageType = body.message?.type;
    if (messageType !== 'end-of-call-report') {
      console.log(`   Ignoring message type: ${messageType}`);
      return NextResponse.json({ ok: true });
    }

    const customerPhone = body.message?.call?.customer?.number
      || body.message?.customer?.number
      || body.call?.customer?.number;

    const transcript = body.message?.transcript || '';
    const analysis = body.message?.analysis || {};
    const toolCalls = body.message?.toolCalls || [];

    console.log(`   Phone: ${customerPhone}`);
    console.log(`   Transcript length: ${transcript.length}`);

    if (!customerPhone) {
      console.error('❌ [VAPI] No customer phone in payload');
      return NextResponse.json({ error: 'Missing customer phone' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(customerPhone);

    // Get active queue items
    const activeItems = await getActiveQueueItems(normalizedPhone);
    if (activeItems.length === 0) {
      console.log('   ⚠️ No active queue items for caller');
      return NextResponse.json({ ok: true, message: 'No active items' });
    }

    const targetItem = activeItems[0];
    const property = targetItem.data();

    // Get/create conversation for logging
    const conversation = await getOrCreateConversation(
      normalizedPhone,
      property.agentName,
      targetItem.id
    );

    // Log the voice call
    await addMessage(conversation.id, {
      role: 'inbound',
      body: `[VAPI CALL] ${transcript.substring(0, 500)}`,
      timestamp: new Date(),
      source: 'voice',
    });

    // Determine classification from VAPI analysis or tool calls
    let classification: 'yes' | 'no' | 'asking_seller' | 'unknown' = 'unknown';

    // Check tool calls first (most reliable if VAPI function calling is configured)
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'mark_property') {
        try {
          const args = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

          if (args.classification === 'yes') classification = 'yes';
          else if (args.classification === 'no') classification = 'no';
          else if (args.classification === 'asking_seller') classification = 'asking_seller';
        } catch {
          console.warn('⚠️ [VAPI] Failed to parse tool call arguments');
        }
      }
    }

    // Fall back to analysis fields
    if (classification === 'unknown' && analysis.structuredData) {
      const data = analysis.structuredData;
      if (data.ownerFinancing === true || data.classification === 'yes') {
        classification = 'yes';
      } else if (data.ownerFinancing === false || data.classification === 'no') {
        classification = 'no';
      } else if (data.classification === 'asking_seller') {
        classification = 'asking_seller';
      }
    }

    // Fall back to simple transcript analysis
    if (classification === 'unknown') {
      const lower = transcript.toLowerCase();
      if (lower.includes('yes') && lower.includes('owner financ')) {
        classification = 'yes';
      } else if (lower.includes('no') && (lower.includes('owner financ') || lower.includes('traditional'))) {
        classification = 'no';
      } else if (lower.includes('check with') || lower.includes('ask the seller') || lower.includes('get back to')) {
        classification = 'asking_seller';
      }
    }

    console.log(`   🤖 Classification: ${classification}`);

    // Route based on classification
    switch (classification) {
      case 'yes':
        await handleAgentYes(targetItem.id, `VAPI voice call`);
        await resolveConversation(conversation.id, 'yes');
        console.log(`   ✅ Agent YES via voice for ${property.address}`);
        break;

      case 'no':
        await handleAgentNo(targetItem.id, `VAPI voice call`);
        await resolveConversation(conversation.id, 'no');
        console.log(`   ❌ Agent NO via voice for ${property.address}`);
        break;

      case 'asking_seller':
        await updateQueueStage(targetItem.id, 'asking_seller', {
          askingSellerAt: new Date(),
        });
        console.log(`   🔄 Agent asking seller via voice for ${property.address}`);
        break;

      default:
        console.log(`   ⚠️ Could not classify voice call for ${property.address}`);
        break;
    }

    return NextResponse.json({
      ok: true,
      classification,
      address: property.address,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ [VAPI CALL-END] Error:', msg);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
