import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { normalizePhone } from '@/lib/phone-utils';
import { classifyAndRespond } from '@/lib/agent-outreach/ai-classifier';
import { sendSMS } from '@/lib/agent-outreach/twilio-sms';
import {
  getOrCreateConversation,
  addMessage,
  resolveConversation,
  getActiveQueueItems,
  updateQueueStage,
  isOptedOut,
  optOut,
} from '@/lib/agent-outreach/conversation-manager';
import { revokeBuyerTCPAConsent } from '@/lib/tcpa-revocation';
import { handleAgentYes, handleAgentNo } from '@/lib/agent-outreach/property-resolver';
import {
  formatOptOutConfirmation,
  formatYesConfirmation,
  formatNoAcknowledgment,
  formatAskingSellerAcknowledgment,
} from '@/lib/agent-outreach/sms-templates';

// CTIA / carrier standard opt-out keywords. Matches only when the entire
// trimmed message is one of these (case-insensitive, trailing punctuation
// allowed). Substring matching causes false positives like "I want to stop
// by tomorrow" which would silently revoke the user's TCPA consent and
// permanently disable SMS — not what they meant.
const OPT_OUT_KEYWORDS = new Set([
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT', 'OPT OUT',
]);

function isOptOutMessage(body: string): boolean {
  if (!body) return false;
  // Strip trailing punctuation/whitespace, uppercase, collapse internal whitespace.
  const cleaned = body.trim().replace(/[.!?,;:\s]+$/, '').toUpperCase().replace(/\s+/g, ' ');
  return OPT_OUT_KEYWORDS.has(cleaned);
}

/**
 * Validate Twilio webhook signature (X-Twilio-Signature).
 * Prevents spoofed inbound SMS from unauthorized callers.
 *
 * Algorithm: HMAC-SHA1 of (webhookUrl + sorted POST params) using auth token.
 */
function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string
): boolean {
  if (!signature) return false;

  // Build the data string: URL + sorted param key/value pairs concatenated
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Response delay: wait 60 seconds before replying to simulate human typing */
const RESPONSE_DELAY_MS = 60 * 1000;

/**
 * Webhook: Inbound SMS from Twilio
 *
 * Returns TwiML immediately (Twilio requires fast response).
 * Processes the message and sends a reply in the background via after().
 */
export async function POST(request: NextRequest) {
  console.log('📨 [TWILIO SMS WEBHOOK] Received inbound SMS');

  // Verify Twilio signature to prevent spoofed requests
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = request.headers.get('x-twilio-signature');

  let from = '';
  let body = '';
  let messageSid = '';
  const formParams: Record<string, string> = {};

  try {
    const formData = await request.formData();
    from = formData.get('From') as string || '';
    body = (formData.get('Body') as string || '').trim();
    messageSid = formData.get('MessageSid') as string || '';

    // Collect all params for signature verification
    formData.forEach((value, key) => {
      formParams[key] = String(value);
    });
  } catch (err) {
    console.error('❌ [TWILIO SMS] Failed to parse form data:', err);
    return twimlResponse();
  }

  // Validate Twilio signature (skip in development)
  if (twilioAuthToken && process.env.NODE_ENV === 'production') {
    // Use the configured webhook URL (Twilio signs against the URL it was configured with)
    const webhookUrl = process.env.TWILIO_SMS_WEBHOOK_URL
      || `${process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`}/api/webhooks/twilio/sms`;

    if (!validateTwilioSignature(webhookUrl, formParams, twilioSignature, twilioAuthToken)) {
      console.error('❌ [TWILIO SMS] Invalid signature — possible spoofed request');
      return twimlResponse();
    }
  }

  if (!from || !body) {
    console.error('❌ [TWILIO SMS] Missing From or Body');
    return twimlResponse();
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhone(from);
  } catch {
    console.error(`❌ [TWILIO SMS] Invalid phone: ${from}`);
    return twimlResponse();
  }

  console.log(`   From: ${normalizedPhone} | Body: "${body}" | SID: ${messageSid}`);

  // Return TwiML immediately — Twilio needs a fast response.
  // All processing + reply happens in after() background task.
  after(async () => {
    try {
      await processInboundSMS(normalizedPhone, body, messageSid);
    } catch (err) {
      console.error('❌ [TWILIO SMS BACKGROUND] Error:', err instanceof Error ? err.message : err);
    }
  });

  return twimlResponse();
}

/**
 * Background processing: classify, wait 60s, reply.
 */
async function processInboundSMS(normalizedPhone: string, body: string, messageSid: string) {
  // All SMS in this function are RESPONSES to inbound messages — bypass business hours
  const responseOpts = { isResponse: true };

  // Check for opt-out keywords first (TCPA compliance) — strict whole-message
  // match against the CTIA keyword set, NOT substring matching.
  if (isOptOutMessage(body)) {
    console.log('   🚫 Opt-out keyword detected');
    // Agent-outreach side: opt out the phone from agent-outreach SMS flow
    await optOut(normalizedPhone);
    // Buyer side: scrub buyerProfiles + write audit record (idempotent if no
    // matching buyer exists — most STOPs are from listing agents, not buyers,
    // but a buyer who replied STOP to a property-match SMS hits this path too).
    try {
      const result = await revokeBuyerTCPAConsent(normalizedPhone, 'sms-stop', {
        inboundMessageSid: messageSid,
        inboundBody: body,
      });
      if (result.buyerProfilesUpdated > 0) {
        console.log(`   📵 TCPA revocation: ${result.buyerProfilesUpdated} buyer profile(s) flagged (case ${result.caseId})`);
      }
    } catch (err) {
      // Don't let buyer-side scrub failure block the agent-side opt-out reply,
      // but write a failure record so a follow-up cron / operator can replay
      // the scrub. TCPA exposure is too high to swallow this silently.
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('   ⚠️ TCPA buyer-side scrub failed:', errMsg);
      try {
        const { db } = (await import('@/lib/scraper-v2/firebase-admin')).getFirebaseAdmin();
        if (db) {
          await db.collection('tcpa_revocation_failures').add({
            phone: normalizedPhone,
            channel: 'sms-stop',
            inboundMessageSid: messageSid,
            inboundBody: body.slice(0, 500),
            error: errMsg,
            failedAt: new Date(),
            retryCount: 0,
          });
        }
      } catch {
        // Last-resort path failed too — at least the console.error above is logged.
      }
    }
    await sendSMS(normalizedPhone, formatOptOutConfirmation(), responseOpts);
    return;
  }

  // Check if already opted out
  if (await isOptedOut(normalizedPhone)) {
    console.log('   🚫 Phone is already opted out, ignoring');
    return;
  }

  // Get active queue items for this phone
  const activeItems = await getActiveQueueItems(normalizedPhone);

  if (activeItems.length === 0) {
    console.log('   ⚠️ No active queue items for this phone');
    return;
  }

  // Get or create conversation
  const primaryItem = activeItems[0].data();
  const conversation = await getOrCreateConversation(
    normalizedPhone,
    primaryItem.agentName,
    activeItems[0].id
  );

  // Log the inbound message
  await addMessage(conversation.id, {
    role: 'inbound',
    body,
    timestamp: new Date(),
    twilioSid: messageSid,
    source: 'sms',
  });

  // Build conversation context for AI
  const multipleProperties = activeItems.length > 1;
  const context = {
    agentName: primaryItem.agentName,
    propertyAddress: primaryItem.address,
    propertyCity: primaryItem.city,
    conversationHistory: conversation.messages.map(m => ({
      role: m.role,
      body: m.body,
    })),
    multipleProperties,
    propertyAddresses: multipleProperties
      ? activeItems.map(d => d.data().address)
      : undefined,
  };

  // Classify with AI
  const result = await classifyAndRespond(body, context);

  console.log(`   🤖 Classification: ${result.classification} (${result.confidence})`);
  console.log(`   🤖 Response: "${result.response}"`);

  // Determine which queue item to act on
  let targetItem = activeItems[0];
  if (multipleProperties && result.propertyAddress) {
    const match = activeItems.find(d =>
      d.data().address?.toLowerCase().includes(result.propertyAddress!.toLowerCase())
    );
    if (match) targetItem = match;
  }

  // Wait 60s before replying to seem human
  console.log('   ⏳ Response delay: waiting 60s before replying');
  await new Promise(r => setTimeout(r, RESPONSE_DELAY_MS));

  // Route based on classification
  switch (result.classification) {
    case 'yes': {
      const { address } = await handleAgentYes(targetItem.id, body);
      const replyText = formatYesConfirmation(address);
      await sendSMS(normalizedPhone, replyText, responseOpts);
      await addMessage(conversation.id, {
        role: 'outbound',
        body: replyText,
        timestamp: new Date(),
        classification: 'yes',
        source: 'sms',
      });

      if (!multipleProperties) {
        await resolveConversation(conversation.id, 'yes');
      }
      break;
    }

    case 'no': {
      const { address } = await handleAgentNo(targetItem.id, body);
      const replyText = formatNoAcknowledgment(address);
      await sendSMS(normalizedPhone, replyText, responseOpts);
      await addMessage(conversation.id, {
        role: 'outbound',
        body: replyText,
        timestamp: new Date(),
        classification: 'no',
        source: 'sms',
      });

      if (!multipleProperties) {
        await resolveConversation(conversation.id, 'no');
      }
      break;
    }

    case 'asking_seller': {
      const address = targetItem.data().address;
      const replyText = formatAskingSellerAcknowledgment(address);
      await sendSMS(normalizedPhone, replyText, responseOpts);
      await updateQueueStage(targetItem.id, 'asking_seller', {
        askingSellerAt: new Date(),
      });
      await addMessage(conversation.id, {
        role: 'outbound',
        body: replyText,
        timestamp: new Date(),
        classification: 'asking_seller',
        source: 'sms',
      });
      break;
    }

    case 'opt_out': {
      await optOut(normalizedPhone);
      await sendSMS(normalizedPhone, formatOptOutConfirmation(), responseOpts);
      await resolveConversation(conversation.id, 'opted_out');
      break;
    }

    case 'question':
    case 'unclear':
    default: {
      if (result.response) {
        await sendSMS(normalizedPhone, result.response, responseOpts);
        await addMessage(conversation.id, {
          role: 'outbound',
          body: result.response,
          timestamp: new Date(),
          classification: result.classification,
          aiResponse: result.response,
          source: 'sms',
        });
      }
      for (const item of activeItems) {
        const data = item.data();
        if (data.status === 'sent') {
          await updateQueueStage(item.id, 'in_conversation');
        }
      }
      break;
    }
  }
}

/**
 * Return empty TwiML response (replies sent via API in background).
 */
function twimlResponse() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}
